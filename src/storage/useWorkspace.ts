/**
 * The React binding between the storage port and the editor.
 *
 * The hook owns the life of one workspace: it opens the repository, restores
 * the project that was edited last, and commits the document whenever the
 * editor changes it. Nothing above this file knows which backend serves the
 * workspace.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { migrateProject } from '../project/migrate';
import { uid, useStore } from '../store';
import type { Project } from '../types';
import { selectRepository } from './select';
import {
  StorageConflictError,
  StorageQuotaError,
  StorageUnavailableError,
  type ProjectSummary,
  type RepositoryFactory,
  type StorageStatus,
  type StoredProject,
  type WorkspaceRepository,
} from './types';

export interface UseWorkspaceOptions {
  /** Test seam: replaces how the repository is opened. */
  create?: RepositoryFactory;
  namespace?: string;
}

export interface WorkspaceUiState {
  status: StorageStatus;
  /** True while the editor holds a document that storage does not have yet. */
  saving: boolean;
  error: string | null;
}

/** How long the editor stays quiet before the document is committed. */
const AUTOSAVE_DELAY_MS = 800;

/**
 * How long the document may stay unsaved while the editor keeps changing.
 *
 * Without this ceiling a long drag or a held slider starves the autosave:
 * every change restarts the quiet period, so nothing is written until the
 * editor stops moving.
 */
const AUTOSAVE_MAX_WAIT_MS = 3000;

const DEFAULT_NAMESPACE = 'workspace';

/**
 * The state before the repository is open: the workspace is not durable yet,
 * so nothing may claim that the work is saved.
 */
const INITIAL_STATUS: StorageStatus = {
  backend: 'sqlite-opfs',
  durable: false,
  writeAccess: 'owner',
};

type StatusListener = (status: StorageStatus) => void;

/**
 * The repositories the app shares, one per namespace.
 *
 * React mounts effects twice in development, so the workspace repository is
 * opened once per namespace and then shared; a second open of the same
 * namespace would fight the first one over the database.
 */
const sharedRepositories = new Map<string, Promise<WorkspaceRepository>>();
const statusListeners = new Map<string, Set<StatusListener>>();

const listenersFor = (namespace: string): Set<StatusListener> => {
  const existing = statusListeners.get(namespace);
  if (existing) return existing;
  const listeners = new Set<StatusListener>();
  statusListeners.set(namespace, listeners);
  return listeners;
};

const openShared = (namespace: string): Promise<WorkspaceRepository> => {
  const existing = sharedRepositories.get(namespace);
  if (existing) return existing;
  const listeners = listenersFor(namespace);
  const opened = selectRepository({
    namespace,
    onStatusChange: (status) => {
      listeners.forEach((listener) => listener(status));
    },
  });
  sharedRepositories.set(namespace, opened);
  return opened;
};

const describeError = (error: unknown): string => {
  if (error instanceof StorageConflictError) return 'another tab changed this project';
  if (error instanceof StorageQuotaError) return 'storage is full';
  if (error instanceof StorageUnavailableError) return 'storage is unavailable';
  return error instanceof Error ? error.message : 'the workspace could not be written';
};

/** An empty project, for when the editor starts a new one. */
const blankProject = (): Project => ({
  name: 'Untitled',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#0d0d14',
  tracks: [
    { id: uid('t'), name: 'Track 1', clips: [] },
    { id: uid('t'), name: 'Track 2', clips: [] },
  ],
});

export const useWorkspace = (options?: UseWorkspaceOptions) => {
  const [state, setState] = useState<WorkspaceUiState>({
    status: INITIAL_STATUS,
    saving: true,
    error: null,
  });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  const repoRef = useRef<WorkspaceRepository | null>(null);
  const timerRef = useRef<number | null>(null);
  /** The ceiling timer: it fires even while the editor keeps changing. */
  const ceilingRef = useRef<number | null>(null);
  /** The document the workspace just handed to the editor, so it is not saved back. */
  const restoredRef = useRef<Project | null>(null);
  /** True while the editor holds a document that storage does not have yet. */
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const committingRef = useRef(false);

  /** Mirrors the dirty flag into the state the UI reads. */
  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
    setState((s) => (s.saving === dirty ? s : { ...s, saving: dirty }));
  }, []);

  /**
   * Validate a stored document before it reaches the editor.
   *
   * The stored document may have been written by a newer build, or be
   * corrupt. A document that cannot be read is never hydrated: the editor
   * keeps what it has, the reason is shown, and the stored document is left
   * exactly as it is. A failed restore must not turn into a lost project.
   */
  const readStored = useCallback((stored: StoredProject): Project | null => {
    try {
      return migrateProject(stored.document);
    } catch (error) {
      setState((s) => ({ ...s, error: describeError(error) }));
      return null;
    }
  }, []);

  /**
   * Commits the current document once. Returns false when it did not land.
   *
   * The stored document is only replaced when the repository accepts the
   * commit; a conflict leaves the stored document exactly as it was.
   */
  const commitOnce = useCallback(async (): Promise<boolean> => {
    const repo = repoRef.current;
    if (!repo) return false;
    const store = useStore.getState();
    const document = store.project;
    const id = store.workspaceId;
    const expectedRevision = store.workspaceRevision;
    try {
      const stored = await repo.commit({
        ...(id ? { id } : {}),
        ...(id && expectedRevision !== null ? { expectedRevision } : {}),
        name: document.name,
        document,
      });
      useStore.getState().setWorkspace({ id: stored.id, revision: stored.revision });
      // An edit made while the commit was in flight is still unsaved.
      if (useStore.getState().project === document) setDirty(false);
      setState((s) => ({ ...s, error: null }));
      setProjects(await repo.list());
      return true;
    } catch (error) {
      setState((s) => ({ ...s, error: describeError(error) }));
      return false;
    }
  }, [setDirty]);

  /**
   * Commits the document, one commit at a time.
   *
   * A change that arrives while a commit is in flight is committed after it,
   * so the second commit sees the revision the first one produced.
   */
  const commitDocument = useCallback(async () => {
    if (committingRef.current) {
      pendingRef.current = true;
      return;
    }
    committingRef.current = true;
    try {
      do {
        pendingRef.current = false;
        const landed = await commitOnce();
        if (!landed) break;
      } while (pendingRef.current);
    } finally {
      committingRef.current = false;
    }
  }, [commitOnce]);

  /**
   * Schedule a commit.
   *
   * Two timers run at once. The quiet timer restarts on every change, so a
   * burst of edits becomes one write. The ceiling does not restart: it fires
   * even while the editor keeps changing, so a long drag is saved as it
   * goes instead of waiting for the editor to stop.
   */
  const scheduleSave = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (ceilingRef.current !== null) {
        window.clearTimeout(ceilingRef.current);
        ceilingRef.current = null;
      }
      void commitDocument();
    }, AUTOSAVE_DELAY_MS);

    if (ceilingRef.current === null) {
      ceilingRef.current = window.setTimeout(() => {
        ceilingRef.current = null;
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        void commitDocument();
      }, AUTOSAVE_MAX_WAIT_MS);
    }
  }, [commitDocument]);

  // The editor changes; the workspace follows a moment later.
  useEffect(() => {
    const unsubscribe = useStore.subscribe((next, previous) => {
      if (next.project === previous.project) return;
      // A document the workspace just handed to the editor is already stored.
      if (next.project === restoredRef.current) {
        restoredRef.current = null;
        return;
      }
      setDirty(true);
      scheduleSave();
    });
    return unsubscribe;
  }, [scheduleSave, setDirty]);

  /**
   * Do not lose the document when the page goes away.
   *
   * A scheduled save is a timer, and a timer dies with the page. So when the
   * page is hidden or going away, the pending save is committed now. The
   * browser cannot wait for an async commit during an unload, so the
   * unload handler also asks the user before leaving with unsaved work.
   */
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      // A commit already in flight is carrying the latest change.
      if (committingRef.current) return;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (ceilingRef.current !== null) {
        window.clearTimeout(ceilingRef.current);
        ceilingRef.current = null;
      }
      void commitDocument();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      // Let the browser ask whether the work should really be dropped.
      event.preventDefault();
      event.returnValue = '';
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [commitDocument]);

  // Open the workspace and restore the project that was edited last.
  useEffect(() => {
    let cancelled = false;
    const namespace = options?.namespace ?? DEFAULT_NAMESPACE;
    const create = options?.create;

    const onStatus = (status: StorageStatus) => {
      if (!cancelled) setState((s) => ({ ...s, status }));
    };

    const open = async () => {
      try {
        let repo: WorkspaceRepository;
        if (create) {
          repo = await create(namespace, { onStatusChange: onStatus });
        } else {
          listenersFor(namespace).add(onStatus);
          repo = await openShared(namespace);
        }
        if (cancelled) {
          if (create) await repo.close();
          return;
        }
        repoRef.current = repo;
        const status = await repo.init();
        if (cancelled) return;
        setState((s) => ({ ...s, status }));
        const list = await repo.list();
        if (cancelled) return;
        setProjects(list);
        const newest = list[0];
        if (newest) {
          const stored = await repo.get(newest.id);
          if (cancelled) return;
          if (stored) {
            const document = readStored(stored);
            if (document) {
              restoredRef.current = document;
              useStore.getState().hydrate(document);
              useStore.getState().setWorkspace({ id: stored.id, revision: stored.revision });
            }
          }
        }
        // An edit made while the workspace was opening is still unsaved.
        setDirty(dirtyRef.current);
      } catch (error) {
        if (!cancelled) setState((s) => ({ ...s, error: describeError(error) }));
      }
    };

    void open();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (ceilingRef.current !== null) {
        window.clearTimeout(ceilingRef.current);
        ceilingRef.current = null;
      }
      listenersFor(namespace).delete(onStatus);
      const repo = repoRef.current;
      repoRef.current = null;
      // The shared repository lives as long as the app; an injected one
      // belongs to whoever injected it.
      if (repo && create) void repo.close();
    };
  }, [options?.create, options?.namespace, scheduleSave, setDirty]);

  const saveNow = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (ceilingRef.current !== null) {
      window.clearTimeout(ceilingRef.current);
      ceilingRef.current = null;
    }
    await commitDocument();
  }, [commitDocument]);

  const newProject = useCallback(() => {
    useStore.getState().replaceProject(blankProject());
    setState((s) => ({ ...s, error: null }));
  }, []);

  const openProject = useCallback(async (id: string) => {
    const repo = repoRef.current;
    if (!repo) return;
    const stored = await repo.get(id);
    if (!stored) return;
    const document = readStored(stored);
    if (!document) return;
    restoredRef.current = document;
    useStore.getState().hydrate(document);
    useStore.getState().setWorkspace({ id: stored.id, revision: stored.revision });
    setDirty(false);
    setState((s) => ({ ...s, error: null }));
  }, [readStored, setDirty]);

  const removeProject = useCallback(async (id: string) => {
    const repo = repoRef.current;
    if (!repo) return;
    await repo.remove(id);
    setProjects(await repo.list());
    if (useStore.getState().workspaceId === id) {
      useStore.getState().setWorkspace(null);
    }
  }, []);

  return { state, projects, saveNow, newProject, openProject, removeProject };
};
