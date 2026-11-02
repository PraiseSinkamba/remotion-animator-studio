import React, { useRef, useState } from 'react';
import { Copy, Eye, EyeOff, FolderOpen, Link2, Lock, LockOpen, Pencil, Trash2, Unlink, Wand2 } from 'lucide-react';
import { getComponent, TRANSITION_TYPES } from '@chart-studio/components';
import { CHART_GROUP_LAYOUTS, CHART_GROUP_LAYOUT_LABELS, findClip, useStore } from '@chart-studio/editor';
import { clampTransitionDuration, type Clip, type ElementType, type VideoComponentDefinition } from '@chart-studio/core';
import { EffectList } from './inspector/effect-list';
import { TransactionalParamControl } from './inspector/transactional-param-control';
import {
  Button,
  Input,
  InspectorHeader,
  numberFieldClass,
  Row,
  Section,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@chart-studio/ui';

/** Very small HTML pretty-printer for the 🧩 HTML element's textarea. */
const formatHtml = (src: string): string => {
  const tokens = src
    .replace(/>\s+</g, '><')
    .split(/(<[^>]+>)/g)
    .map((t) => t.trim())
    .filter(Boolean);
  const voidTag = /^<(br|img|hr|input|meta|link|source|area|col|embed|track|wbr)[\s/>]/i;
  let depth = 0;
  const out: string[] = [];
  for (const tok of tokens) {
    const isTag = tok.startsWith('<');
    const isClose = /^<\//.test(tok);
    const isSelfClosing = /\/>$/.test(tok) || voidTag.test(tok);
    if (isClose) depth = Math.max(0, depth - 1);
    out.push('  '.repeat(depth) + tok);
    if (isTag && !isClose && !isSelfClosing && !tok.startsWith('<!')) depth++;
  }
  return out.join('\n');
};

/** Upload a local image/GIF and store it inline as a data URL. */
const FileUpload: React.FC<{ accept: string; onLoad: (dataUrl: string) => void }> = ({ accept, onLoad }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => ref.current?.click()}>
        <FolderOpen data-icon="inline-start" />
        Upload file…
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          if (f.size > 8 * 1024 * 1024) {
            alert(
              'Please keep uploads under 8 MB — larger files make the project slow to save. Host bigger files and paste the URL instead.'
            );
            return;
          }
          const reader = new FileReader();
          reader.onload = () => onLoad(String(reader.result));
          reader.readAsDataURL(f);
        }}
      />
    </>
  );
};

/** The panel shell: a 2px accent bar, a sticky header and the tab strip. */
const Shell: React.FC<{
  icon?: string;
  name: string;
  type?: string;
  children: React.ReactNode;
}> = ({ icon, name, type, children }) => (
  <aside className="flex min-h-0 w-full flex-col overflow-hidden border-l border-border bg-card">
    <div className="h-0.5 w-full shrink-0 bg-primary" />
    <InspectorHeader icon={icon} name={name} type={type} />
    {children}
  </aside>
);

const TRIGGER =
  'h-6 flex-none rounded-full border border-border bg-muted px-2.5 text-[11px] font-medium text-muted-foreground data-[state=active]:border-primary/50 data-[state=active]:bg-primary/10 data-[state=active]:text-foreground';

/**
 * The component's own inspector panel.
 *
 * The panel reads the market at the playhead: the shell runs the component's
 * `evaluate` step for the current frame and hands the result to the panel, so
 * a panel never evaluates the market a second time.
 */
const CustomInspector: React.FC<{
  clip: Clip;
  definition: VideoComponentDefinition;
}> = ({ clip, definition }) => {
  const currentFrame = useStore((s) => s.currentFrame);
  const project = useStore((s) => s.project);
  const evaluated = definition.evaluate?.({
    clip,
    props: clip.props,
    sceneFrame: currentFrame,
    project,
  });
  const { updateClipProps, updateClip, commit } = useStore.getState();
  if (!definition.inspector) return null;
  return React.createElement(definition.inspector, {
    clip,
    props: clip.props,
    onChange: (patch: Record<string, any>) => updateClipProps(clip.id, patch),
    updateClip: (patch: Partial<Pick<Clip, 'from' | 'durationInFrames' | 'name'>>) =>
      updateClip(clip.id, patch),
    commit: () => { if (!useStore.getState().project.tracks.flatMap(t => t.clips).find(c => c.id === clip.id)?.locked) commit(); },
    sceneFrame: currentFrame,
    evaluated,
  });
};

export const Inspector: React.FC = () => {
  const project = useStore((s) => s.project);
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const [tab, setTab] = useState('properties');
  const setClipLocked = useStore((s) => s.setClipLocked);
  const setClipHidden = useStore((s) => s.setClipHidden);
  const renameClipId = useStore((s) => s.renameClipId);
  const clearRenameRequest = useStore((s) => s.clearRenameRequest);
  const nameRef = useRef<HTMLInputElement>(null);
  const clipEditChanged = useRef(false);

  // The canvas menu asks for a rename: the name field takes the focus so the
  // creator can type straight away. The focus waits for the menu to finish
  // closing, because the menu gives the focus back to the canvas when it
  // does.
  React.useEffect(() => {
    if (!renameClipId) return;
    // The timer is not cancelled: clearing the request re-runs this effect,
    // and the focus must still happen.
    setTimeout(() => {
      nameRef.current?.focus();
      nameRef.current?.select();
    }, 0);
    clearRenameRequest();
  }, [renameClipId, clearRenameRequest]);

  if (selectedClipIds.length > 1) {
    const clips = selectedClipIds.map((id) => findClip(project, id)).filter(Boolean);
    const grouped = clips.length > 0 && clips.every((c) => c!.groupId && c!.groupId === clips[0]!.groupId);
    return (
      <Shell name={`${selectedClipIds.length} clips selected`}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Section title="CLIPS">
            {clips.map((c) => (
              <div key={c!.id} className="truncate text-[11px] text-foreground">
                {c!.groupId ? '⛓ ' : ''}
                {getComponent(c!.element)?.icon ?? '❓'} {c!.name}
              </div>
            ))}
          </Section>
          <Section title="ACTIONS">
            {grouped ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => useStore.getState().ungroupSelection()}
              >
                <Unlink data-icon="inline-start" />
                Ungroup (⇧⌘G)
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => useStore.getState().groupSelection()}
              >
                <Link2 data-icon="inline-start" />
                Group — select &amp; move as one (⌘G)
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={() => useStore.getState().duplicateSelection()}>
              <Copy data-icon="inline-start" />
              Duplicate all (⌘D)
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => useStore.getState().removeClips(selectedClipIds)}
            >
              <Trash2 data-icon="inline-start" />
              Delete {selectedClipIds.length} clips
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Drag any selected clip in the timeline to move the whole group. ⌘C / ⌘V copies and pastes them at the
              playhead.
            </p>
          </Section>
        </div>
      </Shell>
    );
  }

  const clip = findClip(project, selectedClipIds[0]);

  if (!clip) {
    return (
      <Shell name="Inspector">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
          Select a clip in the timeline to edit its parameters.
          <br />
          <br />
          Drag elements from the left panel onto a track to get started.
        </div>
      </Shell>
    );
  }

  const definition = getComponent(clip.element);
  if (!definition) {
    return (
      <Shell name="Inspector">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-[11px] text-muted-foreground">
          Unknown component type “{clip.element}”.
        </div>
      </Shell>
    );
  }

  const { updateClipProps, updateClip } = useStore.getState();
  const commit = () => { if (!findClip(useStore.getState().project, clip.id)?.locked) useStore.getState().commit(); };
  // A chart in a group: the group lays its charts out and gives them one clock.
  const chartGroup = clip.groupId
    ? project.chartGroups?.find((group) => group.id === clip.groupId)
    : undefined;

  // The transition on the boundary this clip leaves, if the creator put one
  // there. It is a property of the boundary, not of the clip.
  const clipTrack = project.tracks.find((track) => track.clips.some((c) => c.id === clip.id));
  const nextClip = clipTrack
    ? [...clipTrack.clips]
        .sort((a, b) => a.from - b.from)
        .find((candidate) => candidate.from === clip.from + clip.durationInFrames)
    : undefined;
  const clipTransition =
    clipTrack && nextClip
      ? (clipTrack.transitions ?? []).find(
          (transition) => transition.fromClipId === clip.id && transition.toClipId === nextClip.id,
        )
      : undefined;
  const clampedTransitionFrames =
    clipTransition && nextClip ? clampTransitionDuration(clip, nextClip, clipTransition.durationInFrames) : 0;
  const positionParams = definition.params.filter((p) => p.key === 'x' || p.key === 'y');
  const ownParams = definition.params.filter((p) => p.key !== 'x' && p.key !== 'y');

  return (
    <Shell icon={definition.icon} name={clip.name} type={definition.type}>
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className="group-data-[orientation=horizontal]/tabs:h-auto flex w-full flex-none items-center justify-start gap-1 rounded-none border-b border-border bg-transparent p-1.5">
          <TabsTrigger value="properties" className={TRIGGER}>
            Properties
          </TabsTrigger>
          <TabsTrigger value="effects" className={TRIGGER}>
            Effects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <Section title="CLIP">
            <Row label="Name" htmlFor={`${clip.id}-name`}>
              <Input
                id={`${clip.id}-name`}
                ref={nameRef}
                type="text"
                className="h-6 min-w-0 flex-1 text-xs md:text-xs"
                value={clip.name}
                onFocus={() => { clipEditChanged.current = false; }}
                onChange={(e) => { if (updateClip(clip.id, { name: e.target.value }, !clipEditChanged.current)) clipEditChanged.current = true; }}
              />
            </Row>
            <Row label="Start (frame)" htmlFor={`${clip.id}-from`}>
              <Input
                id={`${clip.id}-from`}
                type="number"
                className={numberFieldClass}
                min={0}
                max={project.durationInFrames - 1}
                value={clip.from}
                onFocus={() => { clipEditChanged.current = false; }}
                onChange={(e) => {
                  if (updateClip(clip.id, {
                    from: Math.max(0, Math.min(project.durationInFrames - 1, Number(e.target.value))),
                  }, !clipEditChanged.current)) clipEditChanged.current = true;
                }}
              />
            </Row>
            <Row label="Length (frames)" htmlFor={`${clip.id}-length`}>
              <Input
                id={`${clip.id}-length`}
                type="number"
                className={numberFieldClass}
                min={2}
                value={clip.durationInFrames}
                onFocus={() => { clipEditChanged.current = false; }}
                onChange={(e) => { if (updateClip(clip.id, { durationInFrames: Math.max(2, Number(e.target.value)) }, !clipEditChanged.current)) clipEditChanged.current = true; }}
              />
            </Row>
            <Row label="Locked">
              <button
                type="button"
                aria-label={clip.locked ? 'Unlock clip' : 'Lock clip'}
                title={clip.locked ? 'Unlock clip' : 'Lock clip'}
                className={clip.locked ? 'text-primary' : 'text-muted-foreground'}
                onClick={() => setClipLocked(clip.id, !clip.locked)}
              >
                {clip.locked ? <Lock size={14} /> : <LockOpen size={14} />}
              </button>
            </Row>
            <Row label="Hidden">
              <button
                type="button"
                aria-label={clip.hidden ? 'Show clip' : 'Hide clip'}
                title={clip.hidden ? 'Show clip' : 'Hide clip'}
                className={clip.hidden ? 'text-primary' : 'text-muted-foreground'}
                onClick={() => setClipHidden(clip.id, !clip.hidden)}
              >
                {clip.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </Row>
          </Section>

          {positionParams.length > 0 ? (
            <Section title="POSITION">
              {positionParams.map((def) => (
                <TransactionalParamControl
                  key={def.key}
                  def={def}
                  value={clip.props[def.key]}
                  idPrefix={clip.id}
                  onChange={(v, recordHistory) => updateClipProps(clip.id, { [def.key]: v }, recordHistory)}
                />
              ))}
            </Section>
          ) : null}

          <Section title="PROPERTIES">
            {ownParams.map((def) => (
              <React.Fragment key={def.key}>
                <TransactionalParamControl
                  def={def}
                  value={clip.props[def.key]}
                  idPrefix={clip.id}
                  onChange={(v, recordHistory) => updateClipProps(clip.id, { [def.key]: v }, recordHistory)}
                />
                {(def.key === 'src' && ['image', 'gif'].includes(clip.element)) ||
                (def.key === 'imageSrc' && clip.element === 'particles') ? (
                  <FileUpload
                    accept={clip.element === 'gif' ? 'image/gif' : 'image/*'}
                    onLoad={(dataUrl) => {
                      commit();
                      updateClipProps(clip.id, { [def.key]: dataUrl });
                    }}
                  />
                ) : null}
                {def.key === 'data' && clip.element === 'nodeTrail' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => useStore.getState().startDrawingTrail(clip.id)}
                  >
                    <Pencil data-icon="inline-start" />
                    Draw waypoints on canvas
                  </Button>
                ) : null}
                {def.key === 'html' && clip.element === 'html' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      commit();
                      updateClipProps(clip.id, { html: formatHtml(String(clip.props.html ?? '')) });
                    }}
                  >
                    <Wand2 data-icon="inline-start" />
                    Format HTML
                  </Button>
                ) : null}
              </React.Fragment>
            ))}

            {definition.inspector ? (
              <CustomInspector clip={clip} definition={definition} />
            ) : null}
          </Section>

          {chartGroup ? (
            <Section title="GROUP">
              <Row label="Name">
                <span className="text-xs text-foreground">{chartGroup.name}</span>
              </Row>
              <Row label="Charts">
                <span className="text-xs text-foreground">
                  {chartGroup.chartClipIds.length} of up to 3
                </span>
              </Row>
              <Row label="Layout">
                <div className="flex flex-wrap gap-1">
                  {CHART_GROUP_LAYOUTS.map((layout) => (
                    <Button
                      key={layout}
                      variant={chartGroup.layout === layout ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => useStore.getState().setChartGroupLayout(chartGroup.id, layout)}
                    >
                      {CHART_GROUP_LAYOUT_LABELS[layout]}
                    </Button>
                  ))}
                </div>
              </Row>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                The group lays its charts out and gives them one clock. Each chart keeps its own series,
                scale and lifecycle.
              </p>
            </Section>
          ) : null}

          {clipTrack && nextClip ? (
            <Section title="TRANSITION">
              <Row label="Between">
                <span className="text-xs text-foreground">
                  {clip.name} → {nextClip.name}
                </span>
              </Row>
              <Row label="Effect">
                <select
                  aria-label="Transition effect"
                  className={numberFieldClass}
                  value={clipTransition?.element ?? 'none'}
                  onChange={(event) => {
                    const value = event.target.value;
                    const store = useStore.getState();
                    if (value === 'none') {
                      if (clipTransition) store.removeTransition(clipTrack.id, clipTransition.id);
                      return;
                    }
                    if (clipTransition) {
                      store.updateTransition(clipTrack.id, clipTransition.id, {
                        element: value as ElementType,
                      });
                    } else {
                      store.addTransition(clipTrack.id, clip.id, nextClip.id, value as ElementType);
                    }
                  }}
                >
                  <option value="none">None</option>
                  {TRANSITION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type === 'crossfade' ? 'Crossfade' : 'Wipe'}
                    </option>
                  ))}
                </select>
              </Row>
              {clipTransition ? (
                <Row label="Frames">
                  <Input
                    type="number"
                    min={1}
                    value={clipTransition.durationInFrames}
                    onChange={(event) =>
                      useStore
                        .getState()
                        .updateTransition(clipTrack.id, clipTransition.id, {
                          durationInFrames: Number(event.target.value),
                        })
                    }
                    className="h-8"
                  />
                </Row>
              ) : null}
              {clipTransition && clampedTransitionFrames !== clipTransition.durationInFrames ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Clamped to {clampedTransitionFrames} frames — the transition cannot run longer than
                  the shorter of the two clips.
                </p>
              ) : null}
            </Section>
          ) : null}

          <Section title="ACTIONS">
            <Button variant="outline" size="sm" className="w-full" onClick={() => useStore.getState().duplicateSelection()}>
              <Copy data-icon="inline-start" />
              Duplicate (⌘D)
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => useStore.getState().removeClips([clip.id])}
            >
              <Trash2 data-icon="inline-start" />
              Delete clip
            </Button>
          </Section>
        </TabsContent>

        <TabsContent value="effects" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <Section
            title={
              <>
                EFFECTS <span className="text-muted-foreground/70">({clip.effects.length})</span>
              </>
            }
          >
            {clip.effects.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Drag an effect from the library onto this clip.</p>
            ) : (
              <EffectList clip={clip} commit={commit} />
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </Shell>
  );
};
