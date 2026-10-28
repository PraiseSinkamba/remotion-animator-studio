# Chart Studio platform restructure — Phase 1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the repository onto a pnpm workspace whose source tree matches the documented package boundaries, without changing editor behaviour.

**Architecture:** The editor shell becomes `apps/studio`; twelve packages hold the domain, market data, chart rendering, the three component families, the compositor, editor core, timeline, storage, UI and export. Each package exports built JavaScript for production and source for development through an `exports` map with a `development` condition. Turborepo orders and caches the per-package typecheck, test and build tasks.

**Tech Stack:** pnpm 10.28.2, Turborepo 2.11.10, Node 24.20.0, TypeScript 5.6.3, Vite 5.4.11, React 18.3.1, Remotion 4.0.538, Zustand 5.0.3, Tailwind CSS 4.3.3, Vitest 3.2.7

**Design spec:** `docs/superpowers/specs/2026-10-28-chart-studio-platform-and-catalogue-reorganisation-design.md` (commit `5924496`)

## Global Constraints

- No editor behaviour changes. The 153 existing tests must pass with the same names and the same assertions.
- Remotion packages stay pinned to `4.0.538`; React stays on `18.3.1`; Vite stays on `5.4.11`. No dependency upgrades in this phase.
- No component `type` is renamed, renumbered or reused.
- `packages/domain` and `packages/market-data` import no React, Remotion, Zustand or storage code.
- Every cross-package import uses the package's own name and a `workspace:*` dependency. No TypeScript path alias crosses a package boundary.
- pnpm 10 lifecycle scripts are allowlisted explicitly in the root `package.json`.
- The local-first invariant holds: no network call, login or server is required to edit, save, preview or export.
- No package imports a package absent from its own `package.json`.
- After every task, `node scripts/verify-r1.mjs` still renders an MP4 whose logical frames match the preview.
- Every task ends with a commit.

### Open questions this plan proceeds on

The spec carries four open questions in its §16. This plan implements the spec's stated defaults, so the reviewer can override any of them and only the named section changes:

| # | Default implemented | If overridden |
|---|---|---|
| Q1 | `evaluateBarsAtFrame` and `ChartFrameState` live in `market-data` | Task 3 moves two exports and one import |
| Q2 | Transitions live on the track boundary | Phase 2 is affected, not this plan |
| Q3 | The family is `generic-components` | Task 7 renames one directory |
| Q4 | Remocn wave 1 is six components | Phase 2 is affected, not this plan |

---

## File Structure

| Path | Responsibility |
|---|---|
| `pnpm-workspace.yaml` | the workspace globs |
| `turbo.json` | task graph and caching |
| `tsconfig.base.json` | compiler options every package extends |
| `vitest.config.ts` | one test configuration across the workspace |
| `apps/studio/` | the editor shell: React entry, Vite config, app panels, the registry aggregator |
| `apps/studio/remotion/` | the Remotion entry point |
| `packages/domain/` | project, scene, clip and object schemas; the component contract; the registration mechanism; project migration |
| `packages/market-data/` | candles, series, time mapping — pure |
| `packages/chart-renderer/` | evaluated chart to React/SVG |
| `packages/trading-components/` | the trading component definitions, inspectors and render adapters |
| `packages/generic-components/` | the 22 generic element definitions, their adapters and the effect stack |
| `packages/motion-components/` | the adapted Remocn components, their definitions and provenance |
| `packages/scene-compositor/` | the Remotion composition and the clip dispatch |
| `packages/editor-core/` | the store: commands, history, selection |
| `packages/timeline/` | the timeline UI |
| `packages/storage-sqlite/` | the persistence port and its backends |
| `packages/ui/` | shadcn wrappers, inspector and library UI |
| `packages/export/` | the render CLI and the local render server |
| `vendor/remocn/` | verbatim upstream Remocn source, never bundled |

---

### Task 1: Workspace skeleton and the move to `apps/studio`

**Files:**
- Create: `pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json`, `vitest.config.ts`, `apps/studio/package.json`, `apps/studio/tsconfig.json`
- Move: `src/` → `apps/studio/src/`, `remotion/` → `apps/studio/remotion/`, `public/` → `apps/studio/public/`, `index.html` → `apps/studio/index.html`, `vite.config.ts` → `apps/studio/vite.config.ts`, `components.json` → `apps/studio/components.json`
- Modify: root `package.json`, `.gitignore`, `apps/studio/vite.config.ts`, `docs-gifs.mjs`, `scripts/verify-r1.mjs`, `render.mjs`, `server.mjs`
- Delete: `package-lock.json`, `tsconfig.tsbuildinfo`

**Interfaces:**
- Consumes: nothing. This task creates the workspace the packages will live in.
- Produces: `pnpm-workspace.yaml`, `tsconfig.base.json`, `turbo.json`, `vitest.config.ts`, and an `apps/studio` package that runs the existing editor.

- [ ] **Step 1: Create the workspace globs**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 2: Create the shared compiler options**

Create `tsconfig.base.json`. It carries today's root `tsconfig.json` options, minus the two that would
break a package that emits JavaScript:

```jsonc
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  }
}
```

`allowImportingTsExtensions` is deliberately absent: it may only be used with `noEmit`, and packages
emit. `noEmit` is also absent — each package sets what it needs.

- [ ] **Step 3: Move the app shell**

```bash
git mv src apps/studio/src
git mv remotion apps/studio/remotion
git mv public apps/studio/public
git mv index.html apps/studio/index.html
git mv vite.config.ts apps/studio/vite.config.ts
git mv components.json apps/studio/components.json
git mv tsconfig.json apps/studio/tsconfig.json
```

- [ ] **Step 4: Rewrite the app's tsconfig**

Replace `apps/studio/tsconfig.json` with:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "remotion"]
}
```

- [ ] **Step 5: Create the app package manifest**

Create `apps/studio/package.json`, moving every dependency from today's root `package.json` into it
unchanged — same versions, same ranges:

```jsonc
{
  "name": "@chart-studio/studio",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p tsconfig.json && vite build",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@remotion/gif": "4.0.538",
    "@remotion/media-utils": "4.0.538",
    "@remotion/noise": "4.0.538",
    "@remotion/paths": "4.0.538",
    "@remotion/player": "4.0.538",
    "@remotion/shapes": "4.0.538",
    "@sqlite.org/sqlite-wasm": "3.54.1-build1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.61.0",
    "next-themes": "^0.4.6",
    "radix-ui": "^1.8.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "4.0.538",
    "sonner": "^2.0.8",
    "tailwind-merge": "^3.7.0",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@remotion/bundler": "4.0.538",
    "@remotion/renderer": "4.0.538",
    "@tailwindcss/vite": "^4.3.3",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/react": "^16.3.3",
    "@types/node": "^22.20.5",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.1.0",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^3.2.7"
  }
}
```

`concurrently` moves to the root, because only the root orchestrates both the app and the render server.

- [ ] **Step 6: Rewrite the root package manifest**

Replace the root `package.json` with:

```jsonc
{
  "name": "chart-studio",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@10.28.2",
  "engines": { "node": ">=24.20.0" },
  "scripts": {
    "dev": "concurrently -k -n web,render -c cyan,magenta \"pnpm --filter @chart-studio/studio dev\" \"node server.mjs\"",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "preview": "pnpm --filter @chart-studio/studio preview",
    "render": "node render.mjs",
    "docs:gifs": "node docs-gifs.mjs"
  },
  "devDependencies": {
    "concurrently": "^10.0.3",
    "turbo": "2.11.10",
    "typescript": "^5.6.3",
    "vitest": "^3.2.7"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

- [ ] **Step 7: Install with pnpm and verify the lifecycle-script allowlist**

```bash
rm -f package-lock.json tsconfig.tsbuildinfo
pnpm install
```

Expected: a `pnpm-lock.yaml` appears, `node_modules` is created, and no warning about ignored build
scripts other than one that is already in the allowlist. Then confirm esbuild's binary is usable:

```bash
pnpm --filter @chart-studio/studio exec node -e "require('esbuild').transformSync('const a=1')"
```

Expected: no error. If esbuild reports a missing native binding, add the package name pnpm named in its
warning to `pnpm.onlyBuiltDependencies` and re-run `pnpm install`.

Also check whether `@sqlite.org/sqlite-wasm` needs a postinstall:

```bash
pnpm --filter @chart-studio/studio exec node -e "console.log(require.resolve('@sqlite.org/sqlite-wasm'))"
```

Expected: a path. If the package declares a `postinstall`, add it to `pnpm.onlyBuiltDependencies` too.

- [ ] **Step 8: Create the Turborepo configuration**

Create `turbo.json`:

```jsonc
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

`typecheck` depends on `^build` because a package's `types` condition points at its source, so a consumer
resolves source; but a consumer that resolves `dist` at runtime needs the dependency built first.

- [ ] **Step 9: Create the root Vitest configuration**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Workspace packages expose their source under the `development` condition.
    conditions: ['development', 'module', 'browser', 'import', 'default'],
  },
  test: {
    // Node by default; DOM tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    include: [
      'apps/*/src/**/*.{test,spec}.{ts,tsx}',
      'packages/*/src/**/*.{test,spec}.{ts,tsx}',
    ],
  },
});
```

- [ ] **Step 10: Point the app's Vite config at the new locations**

Replace `apps/studio/vite.config.ts` with the current file's content, changing only the alias target and
adding the workspace packages to the optimiser exclusions:

```ts
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    headers: ISOLATION_HEADERS,
    proxy: { '/api': 'http://localhost:3333' },
  },
  preview: { headers: ISOLATION_HEADERS },
  worker: {
    rollupOptions: { output: { chunkFileNames: 'assets/[name]-[hash].js' } },
  },
  optimizeDeps: {
    exclude: [
      '@sqlite.org/sqlite-wasm',
      '@chart-studio/domain',
      '@chart-studio/market-data',
    ],
  },
});
```

The `optimizeDeps.exclude` list grows as packages are added in Tasks 2 to 9. The isolation headers and
their comment are carried over unchanged — they are what let the SQLite OPFS VFS run in a worker.

- [ ] **Step 11: Fix the path references outside the app**

Four scripts resolve paths relative to the repository root. Update each:

| File | Change |
|---|---|
| `render.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')` |
| `server.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')` |
| `docs-gifs.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')`; `path.resolve('public/docs/gifs')` → `path.resolve('apps/studio/public/docs/gifs')` |
| `scripts/verify-r1.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')`; its import of `../src/trading/ohlc.ts` becomes `../apps/studio/src/trading/ohlc.ts` for now, and is repointed at the package in Task 3 |

`out/` stays at the repository root; it is a build output, not application source.

- [ ] **Step 12: Add the Turbo cache to the ignore list**

Append to `.gitignore`:

```gitignore
.turbo/
```

- [ ] **Step 13: Verify the toolchain**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: typecheck clean, 153 tests pass across 12 files, and `apps/studio/dist` is produced.

Then the render gate:

```bash
node scripts/verify-r1.mjs
```

Expected: an MP4 at `out/verify/chart-studio-r1.mp4`. If it fails, the failure is in the path change from
Step 11 — no application behaviour has changed in this task.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "Move the editor onto a pnpm workspace without changing how it behaves

The architecture documents describe a pnpm workspace with a package layout
that never existed, so every agent was told to work in directories that
were not there. The shell now lives under apps/studio, Turborepo runs the
typecheck, test and build tasks, and the lockfile is pnpm's.

No application code changed in this move: the same 153 tests pass and the
render still produces the same video.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `packages/domain`

**Files:**
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/index.ts`
- Move: `apps/studio/src/types.ts` → `packages/domain/src/types.ts`, `apps/studio/src/registry/types.ts` → `packages/domain/src/registry/types.ts`, `apps/studio/src/registry/registry.ts` → `packages/domain/src/registry/registry.ts`, `apps/studio/src/registry/registry.test.ts` → `packages/domain/src/registry/registry.test.ts`, `apps/studio/src/project/migrate.ts` → `packages/domain/src/project/migrate.ts`, `apps/studio/src/project/migrate.test.ts` → `packages/domain/src/project/migrate.test.ts`, `apps/studio/src/sampleProject.ts` → `packages/domain/src/project/sample-project.ts`
- Modify: every file that imported the moved modules

**Interfaces:**
- Consumes: nothing.
- Produces: `@chart-studio/domain` exporting `ElementType`, `EffectType`, `Clip`, `Track`, `Project`, `ParamDef`, the component contract types, `registerComponent`, `getDefinition`, `listComponents`, `CURRENT_PROJECT_SCHEMA_VERSION`, `migrateProject` and the empty-project factory.

- [ ] **Step 1: Create the package manifest**

`packages/domain/package.json`:

```jsonc
{
  "name": "@chart-studio/domain",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Create the package tsconfig**

`packages/domain/tsconfig.json`:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Move the sources**

```bash
mkdir -p packages/domain/src/registry packages/domain/src/project
git mv apps/studio/src/types.ts packages/domain/src/types.ts
git mv apps/studio/src/registry/types.ts packages/domain/src/registry/types.ts
git mv apps/studio/src/registry/registry.ts packages/domain/src/registry/registry.ts
git mv apps/studio/src/registry/registry.test.ts packages/domain/src/registry/registry.test.ts
git mv apps/studio/src/project/migrate.ts packages/domain/src/project/migrate.ts
git mv apps/studio/src/project/migrate.test.ts packages/domain/src/project/migrate.test.ts
git mv apps/studio/src/sampleProject.ts packages/domain/src/project/sample-project.ts
```

- [ ] **Step 4: Create the barrel**

`packages/domain/src/index.ts`:

```ts
export * from './types';
export * from './registry/types';
export * from './registry/registry';
export * from './project/migrate';
export * from './project/sample-project';
```

- [ ] **Step 5: Repoint the imports**

Every import of a moved module changes from a relative path to the package name. The patterns:

```ts
// was: import { Clip } from '../types';
// now:
import type { Clip } from '@chart-studio/domain';
```

```ts
// was: import { ElementType } from '../types';
// now:
import type { ElementType } from '@chart-studio/domain';
```

Find every affected file:

```bash
grep -rln "from '\.\./types'\|from '\./types'\|from '\.\./registry/types'\|from '\.\./registry/registry'\|from '\.\./project/migrate'\|from '\.\./sampleProject'" apps/studio/src packages
```

Rewrite each match by hand. Two details matter:

- Type-only imports keep the `import type` form where they already had one, so the emitted JavaScript does
  not carry a runtime import of a types-only module.
- Inside `packages/domain` itself, the relative imports stay relative — a package never imports itself by
  name.

- [ ] **Step 6: Declare the dependency in the app**

In `apps/studio/package.json`, add:

```jsonc
"dependencies": {
  "@chart-studio/domain": "workspace:*"
}
```

- [ ] **Step 7: Verify the resolution contract — this is the first real package, so it is where the
  `development` condition is proved**

```bash
pnpm --filter @chart-studio/studio exec vite build
```

Expected: a successful build. Then confirm the build used the built output, not the source, by checking
that `packages/domain/dist/index.js` exists and that the app bundle does not contain a source-only marker:

```bash
pnpm --filter @chart-studio/domain build
ls packages/domain/dist
grep -c "CURRENT_PROJECT_SCHEMA_VERSION" apps/studio/dist/assets/*.js
```

Expected: `dist/index.js`, `dist/index.d.ts` and `dist/types.js` exist. The grep count is non-zero, which
proves the built output was bundled rather than the TypeScript source being compiled by Vite.

Then prove the development condition resolves source:

```bash
pnpm --filter @chart-studio/studio exec vite dev --port 5199
```

In a second shell, request the module and confirm the served path is the source file:

```bash
curl -s "http://localhost:5199/@fs$(pwd)/packages/domain/src/index.ts" | head -1
```

Expected: TypeScript source. Stop the dev server.

- [ ] **Step 8: Run the gates**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests still pass, the two moved test files now report under the domain package.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Move the project schemas and component contract into their own package

The project document, the component contract and the registry mechanism are
the one part of the editor that no React, video or storage code may depend
on. Giving them a package makes that boundary enforceable by the dependency
list rather than by convention.

No behaviour changes: the same tests pass and the render is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `packages/market-data`

**Files:**
- Create: `packages/market-data/package.json`, `packages/market-data/tsconfig.json`, `packages/market-data/src/index.ts`
- Move: `apps/studio/src/trading/ohlc.ts` → `packages/market-data/src/ohlc.ts`, `apps/studio/src/trading/ohlc.test.ts` → `packages/market-data/src/ohlc.test.ts`
- Modify: every file that imported the moved module

**Interfaces:**
- Consumes: nothing.
- Produces: `@chart-studio/market-data` exporting `OhlcBar`, `BarRevealMode`, `PartialBar`, `ChartFrameState`, `generateSyntheticBars`, `evaluateBarsAtFrame`, `computePriceRange` and `barsToFrames`.

- [ ] **Step 1: Create the package**

`packages/market-data/package.json` — same shape as the domain manifest, with the name
`@chart-studio/market-data` and no dependencies:

```jsonc
{
  "name": "@chart-studio/market-data",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  }
}
```

`packages/market-data/tsconfig.json` — identical to the domain one.

- [ ] **Step 2: Move the sources and create the barrel**

```bash
mkdir -p packages/market-data/src
git mv apps/studio/src/trading/ohlc.ts packages/market-data/src/ohlc.ts
git mv apps/studio/src/trading/ohlc.test.ts packages/market-data/src/ohlc.test.ts
```

`packages/market-data/src/index.ts`:

```ts
export * from './ohlc';
```

- [ ] **Step 3: Repoint the imports**

```bash
grep -rln "trading/ohlc\|from './ohlc'\|from '../ohlc'" apps/studio/src packages
```

Rewrite each to:

```ts
import { evaluateBarsAtFrame, type OhlcBar } from '@chart-studio/market-data';
```

Preserve the split between value imports and type imports exactly as the original did.

`scripts/verify-r1.mjs` also imports this module. Change its import to the package's source file, which
Node 24 runs natively:

```js
import { generateSyntheticBars } from '../packages/market-data/src/ohlc.ts';
```

- [ ] **Step 4: Declare the dependency**

Add `"@chart-studio/market-data": "workspace:*"` to the `dependencies` of `apps/studio/package.json` and of
any package that imports it.

- [ ] **Step 5: Run the gates**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests pass, with the OHLC tests now reporting under `packages/market-data`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Move the candle maths into a package that knows nothing about video

Candle generation and frame evaluation are pure market-time functions. Keeping
them in their own package means the chart renderer and the storage layer
depend on one small, testable surface instead of on each other.

No behaviour changes: the same tests pass and the render is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `packages/storage-sqlite`

**Files:**
- Create: `packages/storage-sqlite/package.json`, `packages/storage-sqlite/tsconfig.json`, `packages/storage-sqlite/src/index.ts`
- Move: `apps/studio/src/storage/**` → `packages/storage-sqlite/src/**`
- Modify: every file that imported the storage modules

**Interfaces:**
- Consumes: `@chart-studio/domain` for the project document types.
- Produces: `@chart-studio/storage-sqlite` exporting the `WorkspaceRepository` port, the contract suite, `select`, `useWorkspace` and the three backends.

- [ ] **Step 1: Create the package**

`packages/storage-sqlite/package.json`:

```jsonc
{
  "name": "@chart-studio/storage-sqlite",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/domain": "workspace:*",
    "@sqlite.org/sqlite-wasm": "3.54.1-build1",
    "react": "^18.3.1"
  }
}
```

`react` is a peer in practice but a direct dependency here, because `useWorkspace.ts` is a React hook and
the package ships compiled JavaScript that imports it.

- [ ] **Step 2: Move the sources**

```bash
git mv apps/studio/src/storage packages/storage-sqlite/src
```

The internal layout (`types.ts`, `contract-suite.ts`, `select.ts`, `useWorkspace.ts`, `sqlite/`, `local/`)
is unchanged.

- [ ] **Step 3: Create the barrel and repoint the imports**

`packages/storage-sqlite/src/index.ts` exports the package's public surface:

```ts
export * from './types';
export * from './contract-suite';
export * from './select';
export * from './useWorkspace';
```

Do not export the driver internals — the worker and its client are implementation details of the SQLite
backend.

```bash
grep -rln "storage/types\|storage/select\|storage/useWorkspace\|from '\.\./storage'\|from '\./storage'" apps/studio/src packages
```

Rewrite each to the package name. The `StorageIndicator` component imports the storage types; it becomes:

```ts
import { type WorkspaceRepository } from '@chart-studio/storage-sqlite';
```

- [ ] **Step 4: Declare the dependency and run the gates**

Add `"@chart-studio/storage-sqlite": "workspace:*"` to `apps/studio/package.json`.

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests pass. The storage contract suite is the largest test file in the repository; it must
still pass unchanged.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Give the local database its own package so one worker owns all writes

The SQLite worker, its RPC boundary and the two fallback backends now sit
behind a single package, which makes the one-writer rule and the
optimistic-revision check enforceable from the dependency list.

No behaviour changes: the storage contract suite passes unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `packages/editor-core` and `packages/timeline`

**Files:**
- Create: `packages/editor-core/{package.json,tsconfig.json,src/index.ts}`, `packages/timeline/{package.json,tsconfig.json,src/index.ts}`
- Move: `apps/studio/src/store.ts`, `apps/studio/src/store.test.ts`, `apps/studio/src/playerRef.ts` → `packages/editor-core/src/`; `apps/studio/src/components/timeline/**` → `packages/timeline/src/`
- Modify: every file that imported the moved modules

**Interfaces:**
- Consumes: `@chart-studio/domain`, `@chart-studio/storage-sqlite`, `@chart-studio/market-data`.
- Produces: `@chart-studio/editor-core` exporting the store and its actions; `@chart-studio/timeline` exporting `Timeline`, `ClipChip`, `TimelineRuler`, `TrackRow` and the shared timeline helpers.

- [ ] **Step 1: Create the two package manifests**

`packages/editor-core/package.json`:

```jsonc
{
  "name": "@chart-studio/editor-core",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/domain": "workspace:*",
    "@chart-studio/market-data": "workspace:*",
    "@chart-studio/storage-sqlite": "workspace:*",
    "zustand": "^5.0.3"
  }
}
```

`packages/timeline/package.json`:

```jsonc
{
  "name": "@chart-studio/timeline",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/domain": "workspace:*",
    "@chart-studio/editor-core": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.3"
  }
}
```

Both `tsconfig.json` files are identical to the domain one.

- [ ] **Step 2: Move the sources**

```bash
mkdir -p packages/editor-core/src packages/timeline/src
git mv apps/studio/src/store.ts packages/editor-core/src/store.ts
git mv apps/studio/src/store.test.ts packages/editor-core/src/store.test.ts
git mv apps/studio/src/playerRef.ts packages/editor-core/src/playerRef.ts
git mv apps/studio/src/components/timeline/ClipChip.tsx packages/timeline/src/ClipChip.tsx
git mv apps/studio/src/components/timeline/TimelineRuler.tsx packages/timeline/src/TimelineRuler.tsx
git mv apps/studio/src/components/timeline/TrackRow.tsx packages/timeline/src/TrackRow.tsx
git mv apps/studio/src/components/timeline/Timeline.tsx packages/timeline/src/Timeline.tsx
git mv apps/studio/src/components/timeline/shared.ts packages/timeline/src/shared.ts
git mv apps/studio/src/components/timeline/shared.test.ts packages/timeline/src/shared.test.ts
```

- [ ] **Step 3: Create the barrels**

`packages/editor-core/src/index.ts`:

```ts
export * from './store';
export * from './playerRef';
```

`packages/timeline/src/index.ts`:

```ts
export { Timeline } from './Timeline';
export { ClipChip } from './ClipChip';
export { TimelineRuler } from './TimelineRuler';
export { TrackRow } from './TrackRow';
export * from './shared';
```

- [ ] **Step 4: Repoint the imports**

```bash
grep -rln "from '\.\./\.\./store'\|from '\.\./store'\|from '\.\./playerRef'\|components/timeline\|from './timeline'" apps/studio/src packages
```

The store is imported by many panels. Every one becomes:

```ts
import { useStore } from '@chart-studio/editor-core';
```

The timeline becomes:

```tsx
import { Timeline } from '@chart-studio/timeline';
```

Preserve the original import's shape — some are `import { useStore }`, some `import { useStore, type EditorState }`. Split value imports from type imports the same way the original did.

- [ ] **Step 5: Declare the dependencies and run the gates**

Add `"@chart-studio/editor-core": "workspace:*"` and `"@chart-studio/timeline": "workspace:*"` to
`apps/studio/package.json`.

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Split the editor commands from the timeline that issues them

The store owns commands and history; the timeline owns the interactions that
issue them. Separating them stops the timeline from reaching into persistence
and makes the documented boundary real rather than aspirational.

No behaviour changes: the same tests pass and the render is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `packages/ui`

**Files:**
- Create: `packages/ui/{package.json,tsconfig.json,src/index.ts}`
- Move: `apps/studio/src/components/ui/**` → `packages/ui/src/components/ui/**`, `apps/studio/src/components/inspector/**` → `packages/ui/src/components/inspector/**`, `apps/studio/src/components/library/**` → `packages/ui/src/components/library/**`, `apps/studio/src/lib/utils.ts` → `packages/ui/src/lib/utils.ts`
- Modify: every file that imported the moved modules

**Interfaces:**
- Consumes: `@chart-studio/domain` for the component contract types.
- Produces: `@chart-studio/ui` exporting the shadcn primitives, the inspector sections and the library cards.

- [ ] **Step 1: Create the package**

`packages/ui/package.json`:

```jsonc
{
  "name": "@chart-studio/ui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    },
    "./styles.css": "./src/styles.css"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/domain": "workspace:*",
    "@radix-ui/react-checkbox": "1.3.3",
    "@radix-ui/react-dialog": "1.1.15",
    "@radix-ui/react-dropdown-menu": "2.1.16",
    "@radix-ui/react-label": "2.1.8",
    "@radix-ui/react-scroll-area": "1.2.10",
    "@radix-ui/react-select": "2.2.6",
    "@radix-ui/react-separator": "1.1.8",
    "@radix-ui/react-slider": "1.3.6",
    "@radix-ui/react-slot": "1.2.4",
    "@radix-ui/react-switch": "1.2.6",
    "@radix-ui/react-tabs": "1.1.13",
    "@radix-ui/react-tooltip": "1.2.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.61.0",
    "next-themes": "^0.4.6",
    "radix-ui": "^1.8.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "sonner": "^2.0.8",
    "tailwind-merge": "^3.7.0"
  }
}
```

**Do not invent these versions.** Run `pnpm list --depth 1` in `apps/studio` and copy the exact installed
version of every `@radix-ui/react-*` package that the moved files import. If the app currently depends on
the `radix-ui` umbrella package rather than individual packages, keep that single dependency instead of
listing both.

- [ ] **Step 2: Move the sources**

```bash
mkdir -p packages/ui/src/components packages/ui/src/lib
git mv apps/studio/src/components/ui packages/ui/src/components/ui
git mv apps/studio/src/components/inspector packages/ui/src/components/inspector
git mv apps/studio/src/components/library packages/ui/src/components/library
git mv apps/studio/src/lib/utils.ts packages/ui/src/lib/utils.ts
```

- [ ] **Step 3: Create the barrel**

`packages/ui/src/index.ts`:

```ts
export * from './components/ui/button';
export * from './components/ui/badge';
export * from './components/ui/card';
export * from './components/ui/dialog';
export * from './components/ui/dropdown-menu';
export * from './components/ui/input';
export * from './components/ui/label';
export * from './components/ui/scroll-area';
export * from './components/ui/select';
export * from './components/ui/separator';
export * from './components/ui/slider';
export * from './components/ui/sonner';
export * from './components/ui/switch';
export * from './components/ui/tabs';
export * from './components/ui/textarea';
export * from './components/ui/tooltip';
export * from './components/inspector/header';
export * from './components/inspector/row';
export * from './components/inspector/section';
export * from './components/inspector/param-control';
export * from './components/inspector/effect-list';
export * from './components/library/catalog';
export * from './components/library/effects-section';
export * from './components/library/group-header';
export * from './components/library/library-card';
export * from './components/library/mime';
export * from './components/library/view-toggle';
export { cn } from './lib/utils';
```

- [ ] **Step 4: Repoint the imports**

```bash
grep -rln "components/ui/\|components/inspector/\|components/library/\|lib/utils" apps/studio/src packages
```

Every one becomes an import from `@chart-studio/ui`. For the primitive components:

```tsx
import { Button } from '@chart-studio/ui';
```

For the library and inspector pieces, import the named export directly from the package root.

- [ ] **Step 5: Handle the stylesheet**

The global stylesheet stays with the application, because it defines the theme tokens every shadcn class
uses:

```bash
git mv apps/studio/src/index.css apps/studio/src/index.css
```

No move is needed — it is already there. Confirm `apps/studio/src/main.tsx` imports `./index.css` and that
`apps/studio/src/index.css` contains the `@import "tailwindcss"` line. If the stylesheet references paths
under `src/components/ui`, repoint them at the package:

```css
@source "../../../packages/ui/src";
```

Tailwind v4 scans source files; without this the shadcn classes lose their styles.

- [ ] **Step 6: Declare the dependency and run the gates**

Add `"@chart-studio/ui": "workspace:*"` to `apps/studio/package.json`.

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests pass and the build succeeds.

Then check the styles survived, because a Tailwind source-path mistake produces a successful build with an
unstyled editor:

```bash
pnpm --filter @chart-studio/studio dev --port 5199
```

Open `http://localhost:5199` and confirm the editor panels are styled and the library cards render. Stop the
server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Move the interface primitives into the package the panels share

The editor controls and the library and inspector pieces are used by every
panel, and they now live behind one package instead of being reached through
relative paths that cross the shell.

No behaviour changes: the same tests pass and the render is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `packages/generic-components`, `packages/chart-renderer` and `packages/trading-components`

**Files:**
- Create: the three packages' manifests, tsconfigs and barrels
- Move: `apps/studio/src/registry/legacy.ts` → `packages/generic-components/src/definitions.ts`; `apps/studio/src/remotion/legacy-elements.tsx` → `packages/generic-components/src/legacy-elements.tsx`; `apps/studio/src/remotion/scenes.tsx` → `packages/generic-components/src/scenes.tsx`; `apps/studio/src/effects.ts` → `packages/generic-components/src/effects.ts`; `apps/studio/src/trading/candlestick-chart.tsx` → `packages/chart-renderer/src/candlestick-chart.tsx`; `apps/studio/src/trading/definition.ts` → `packages/trading-components/src/definitions/candlestick-chart.ts`; `apps/studio/src/trading/candlestick-chart-inspector.tsx` → `packages/trading-components/src/inspectors/candlestick-chart.tsx`; `apps/studio/src/trading/candlestick-chart.test.tsx` → `packages/trading-components/src/candlestick-chart.test.tsx`
- Modify: every file that imported the moved modules; `apps/studio/src/registry/index.ts` → `apps/studio/src/registry.ts`

**Interfaces:**
- Consumes: `@chart-studio/domain`, `@chart-studio/market-data`.
- Produces: `@chart-studio/generic-components` (the 22 definitions, their adapters and the effect stack), `@chart-studio/chart-renderer` (the chart renderer), `@chart-studio/trading-components` (the trading definitions and inspectors).

- [ ] **Step 1: Create the three manifests**

`packages/generic-components/package.json`:

```jsonc
{
  "name": "@chart-studio/generic-components",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/domain": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "4.0.538"
  }
}
```

`packages/chart-renderer/package.json`:

```jsonc
{
  "name": "@chart-studio/chart-renderer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/market-data": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

`packages/trading-components/package.json`:

```jsonc
{
  "name": "@chart-studio/trading-components",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/chart-renderer": "workspace:*",
    "@chart-studio/domain": "workspace:*",
    "@chart-studio/market-data": "workspace:*",
    "@chart-studio/ui": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "4.0.538"
  }
}
```

All three `tsconfig.json` files are identical to the domain one.

- [ ] **Step 2: Move the sources**

```bash
mkdir -p packages/generic-components/src packages/chart-renderer/src packages/trading-components/src/definitions packages/trading-components/src/inspectors
git mv apps/studio/src/registry/legacy.ts packages/generic-components/src/definitions.ts
git mv apps/studio/src/remotion/legacy-elements.tsx packages/generic-components/src/legacy-elements.tsx
git mv apps/studio/src/remotion/scenes.tsx packages/generic-components/src/scenes.tsx
git mv apps/studio/src/effects.ts packages/generic-components/src/effects.ts
git mv apps/studio/src/trading/candlestick-chart.tsx packages/chart-renderer/src/candlestick-chart.tsx
git mv apps/studio/src/trading/definition.ts packages/trading-components/src/definitions/candlestick-chart.ts
git mv apps/studio/src/trading/candlestick-chart-inspector.tsx packages/trading-components/src/inspectors/candlestick-chart.tsx
git mv apps/studio/src/trading/candlestick-chart.test.tsx packages/trading-components/src/candlestick-chart.test.tsx
```

`apps/studio/src/trading/` is now empty and disappears.

- [ ] **Step 3: Create the barrels**

`packages/generic-components/src/index.ts`:

```ts
export * from './definitions';
export * from './legacy-elements';
export * from './scenes';
export * from './effects';
```

`packages/chart-renderer/src/index.ts`:

```ts
export * from './candlestick-chart';
```

`packages/trading-components/src/index.ts`:

```ts
export * from './definitions/candlestick-chart';
export * from './inspectors/candlestick-chart';
```

- [ ] **Step 4: Repoint the imports and move the registry aggregator**

The aggregator — today `apps/studio/src/registry/index.ts` — imports every family definition and registers
them. It is the composition root, so it stays in the application:

```bash
git mv apps/studio/src/registry/index.ts apps/studio/src/registry.ts
```

Inside it, the family imports become:

```ts
import { LEGACY_DEFINITIONS } from '@chart-studio/generic-components';
import { candlestickChartDefinition } from '@chart-studio/trading-components';
```

```bash
grep -rln "registry/legacy\|trading/definition\|trading/candlestick-chart\|remotion/legacy-elements\|remotion/scenes\|from '\.\./effects'\|from './effects'" apps/studio/src packages
```

Rewrite each match to the owning package. Inside `packages/generic-components` and
`packages/trading-components`, the imports between their own files stay relative.

- [ ] **Step 5: Declare the dependencies**

Add to `apps/studio/package.json`:

```jsonc
"@chart-studio/generic-components": "workspace:*",
"@chart-studio/chart-renderer": "workspace:*",
"@chart-studio/trading-components": "workspace:*"
```

- [ ] **Step 6: Run the gates**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests pass. The chart renderer's tests are the largest single file in the repository and
cover the no-lookahead rule; they must pass unchanged.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Give each component family a package of its own

The generic elements, the chart renderer and the trading components now sit
in separate packages, so a trading component cannot reach into a generic
one and the chart renderer cannot reach into the editor. The registry
aggregator moved to the application, where it can import all three without
any of them importing each other.

No behaviour changes: the same tests pass and the render is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `packages/motion-components` and `vendor/remocn/`

**Files:**
- Create: `packages/motion-components/{package.json,tsconfig.json,src/index.ts}`, `vendor/remocn/README.md`
- Move: `apps/studio/src/motion-components/**` → `packages/motion-components/src/**`, except `upstream/**` → `vendor/remocn/`
- Delete: `apps/studio/src/motion-components/upstream-modules.d.ts`
- Modify: `packages/motion-components/PROVENANCE.md`

**Interfaces:**
- Consumes: `@chart-studio/domain`.
- Produces: `@chart-studio/motion-components` exporting the three adapted Remocn components and their definitions.

- [ ] **Step 1: Move the sources**

```bash
mkdir -p packages/motion-components/src vendor/remocn
git mv apps/studio/src/motion-components/upstream vendor/remocn/source
git mv apps/studio/src/motion-components/LICENSE.remocn packages/motion-components/LICENSE.remocn
git mv apps/studio/src/motion-components/PROVENANCE.md packages/motion-components/PROVENANCE.md
git mv apps/studio/src/motion-components/caret.tsx packages/motion-components/src/caret.tsx
git mv apps/studio/src/motion-components/marker-highlight.tsx packages/motion-components/src/marker-highlight.tsx
git mv apps/studio/src/motion-components/remocn-ui.ts packages/motion-components/src/remocn-ui.ts
git mv apps/studio/src/motion-components/remocn-ui-types.ts packages/motion-components/src/remocn-ui-types.ts
git mv apps/studio/src/motion-components/soft-blur-in.tsx packages/motion-components/src/soft-blur-in.tsx
git mv apps/studio/src/motion-components/typewriter.tsx packages/motion-components/src/typewriter.tsx
git mv apps/studio/src/motion-components/definitions packages/motion-components/src/definitions
git mv apps/studio/src/motion-components/definition.ts packages/motion-components/src/definitions/marker-highlight.ts
git mv apps/studio/src/motion-components/definition.test.ts packages/motion-components/src/definitions/marker-highlight.test.ts
git rm apps/studio/src/motion-components/upstream-modules.d.ts
```

The `definitions/` directory moves first, so that the single `definition.ts` lands beside its two siblings
as `marker-highlight.ts`.

- [ ] **Step 2: Create the package**

`packages/motion-components/package.json`:

```jsonc
{
  "name": "@chart-studio/motion-components",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/domain": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "4.0.538"
  }
}
```

`packages/motion-components/tsconfig.json` is identical to the domain one.

- [ ] **Step 3: Create the barrel**

`packages/motion-components/src/index.ts`:

```ts
export * from './definitions/marker-highlight';
export * from './definitions/soft-blur-in';
export * from './definitions/typewriter';
export * from './marker-highlight';
export * from './soft-blur-in';
export * from './typewriter';
```

- [ ] **Step 4: Write the vendor record**

Create `vendor/remocn/README.md`:

```markdown
# Verbatim Remocn source

These files are the unmodified upstream Remocn sources for the three components
we adopted: `marker-highlight`, `soft-blur-in` and `typewriter`, together with
the upstream files they depend on.

They are a **record, not application code**. They are outside `tsconfig.json`'s
`include`, they are never bundled, and they are not imported by anything in
`packages/`. The adapted copies live in `packages/motion-components/src/`, and
`packages/motion-components/PROVENANCE.md` records what changed in each.

The upstream licence is MIT and is kept at `packages/motion-components/LICENSE.remocn`.
The fetch date, the source URLs and the sha256 hashes of the snapshot these came
from are recorded in `docs/reference/remocn/README.md`.

The original upstream import paths — `@/components/remocn/caret` and
`@/lib/remocn-ui` — refer to the upstream project's own layout, not this
repository's.
```

- [ ] **Step 5: Update the provenance record**

In `packages/motion-components/PROVENANCE.md`, change every path of the form
`src/motion-components/upstream/<name>.tsx` to `vendor/remocn/source/<name>.tsx`, and every path of the
form `src/motion-components/definition.ts` to
`packages/motion-components/src/definitions/marker-highlight.ts`. Change nothing else — the upstream URLs,
the licences, the retrieval dates, the enumerated local modifications and the "Unchanged" notes are the
record.

- [ ] **Step 6: Repoint the imports**

```bash
grep -rln "motion-components" apps/studio/src packages
```

The app's registry aggregator imports the three definitions from the package:

```ts
import { markerHighlightDefinition, softBlurInDefinition, typewriterDefinition } from '@chart-studio/motion-components';
```

- [ ] **Step 7: Declare the dependency and run the gates**

Add `"@chart-studio/motion-components": "workspace:*"` to `apps/studio/package.json`.

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests pass. The motion component tests are the ones that check the adapted components read
only `fps` and never the composition length — they must pass unchanged.

- [ ] **Step 8: Confirm the verbatim copies are not compiled**

```bash
grep -c "marker-highlight" packages/motion-components/dist/*.js || true
pnpm --filter @chart-studio/motion-components typecheck
```

Expected: the verbatim source does not appear in the package's output, and the package typechecks without
the ambient declaration file that used to make the copies compile.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Move the adapted Remocn components into their own package and keep the originals as a record

The upstream copies were never bundled, could not compile against themselves,
and read as application source. They now sit outside the compiled tree as
the licence and provenance record, while the adapted components and their
definitions live in one package.

No behaviour changes: the same tests pass and the render is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `packages/scene-compositor` and `packages/export`

**Files:**
- Create: the two packages' manifests, tsconfigs and barrels
- Move: `apps/studio/src/remotion/MainComposition.tsx` → `packages/scene-compositor/src/MainComposition.tsx`; `render.mjs` → `packages/export/src/render.mjs`; `server.mjs` → `packages/export/src/server.mjs`
- Modify: `apps/studio/remotion/Root.tsx`, `apps/studio/remotion/index.ts`

**Interfaces:**
- Consumes: `@chart-studio/domain`, `@chart-studio/generic-components`, `@chart-studio/trading-components`, `@chart-studio/motion-components`, `@chart-studio/chart-renderer`.
- Produces: `@chart-studio/scene-compositor` exporting the composition; `@chart-studio/export` exporting the render entry points.

- [ ] **Step 1: Create the two manifests**

`packages/scene-compositor/package.json`:

```jsonc
{
  "name": "@chart-studio/scene-compositor",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/chart-renderer": "workspace:*",
    "@chart-studio/domain": "workspace:*",
    "@chart-studio/generic-components": "workspace:*",
    "@chart-studio/motion-components": "workspace:*",
    "@chart-studio/trading-components": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "4.0.538"
  }
}
```

`packages/export/package.json`:

```jsonc
{
  "name": "@chart-studio/export",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "node -e \"process.exit(0)\"",
    "typecheck": "node --check src/render.mjs && node --check src/server.mjs",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@remotion/bundler": "4.0.538",
    "@remotion/renderer": "4.0.538",
    "remotion": "4.0.538"
  }
}
```

`packages/export` holds Node scripts, not a compiled library, so it has no `exports` map and no `dist`.
Its `typecheck` is a syntax check.

- [ ] **Step 2: Move the sources**

```bash
mkdir -p packages/scene-compositor/src packages/export/src
git mv apps/studio/src/remotion/MainComposition.tsx packages/scene-compositor/src/MainComposition.tsx
git mv render.mjs packages/export/src/render.mjs
git mv server.mjs packages/export/src/server.mjs
```

`apps/studio/src/remotion/` is now empty and disappears.

- [ ] **Step 3: Create the barrel and fix the Remotion entry**

`packages/scene-compositor/src/index.ts`:

```ts
export * from './MainComposition';
```

`apps/studio/remotion/Root.tsx` imports the composition from the package:

```tsx
import { MainComposition } from '@chart-studio/scene-compositor';
```

- [ ] **Step 4: Fix the paths inside the render scripts**

In `packages/export/src/render.mjs`:

- `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')`
- the default input `project.json` stays at the repository root, so the default becomes
  `path.resolve('project.json')`
- the default output `path.join('out', 'animation.mp4')` stays at the repository root

In `packages/export/src/server.mjs`:

- `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')`
- `path.resolve('out')` stays at the repository root

Both scripts run from the repository root, which is how the root `package.json` invokes them.

- [ ] **Step 5: Update the root scripts**

In the root `package.json`:

```jsonc
"scripts": {
  "dev": "concurrently -k -n web,render -c cyan,magenta \"pnpm --filter @chart-studio/studio dev\" \"node packages/export/src/server.mjs\"",
  "render": "node packages/export/src/render.mjs",
  "docs:gifs": "node docs-gifs.mjs"
}
```

`scripts/verify-r1.mjs` also bundles the Remotion entry; update its path to
`path.resolve('apps/studio/remotion/index.ts')`.

- [ ] **Step 6: Declare the dependencies and run the gates**

Add `"@chart-studio/scene-compositor": "workspace:*"` to `apps/studio/package.json`.

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
node packages/export/src/render.mjs
```

Expected: 153 tests pass, `verify-r1.mjs` writes `out/verify/chart-studio-r1.mp4`, and the render CLI
writes `out/animation.mp4`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Move the composition and the render tools into the packages that own them

The composition and the render scripts were the last pieces living outside a
package. They now sit behind the scene-compositor and export packages, so the
Remotion entry point depends on named packages instead of relative paths.

No behaviour changes: the same tests pass and both render paths still work.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Documentation and ADRs

**Files:**
- Create: `docs/decisions/ADR-004-SHELL-TECHNOLOGY.md`
- Modify: `AGENTS.md`, `DOCS.md`, `docs/architecture/UPSTREAM_AUDIT.md`, `docs/architecture/TECHNICAL_ARCHITECTURE.md`, `docs/architecture/REMOCN-CATALOGUE.md`, `docs/roadmap/ROADMAP.md`, `docs/quality/TEST_STRATEGY.md`, `docs/decisions/ADR-003-COMPONENT-SYSTEM.md`, `docs/README.md`

**Interfaces:**
- Consumes: the finished tree from Tasks 1 to 9.
- Produces: documentation that matches the code.

- [ ] **Step 1: Write ADR-004**

Create `docs/decisions/ADR-004-SHELL-TECHNOLOGY.md`. It records that the application shell is a Vite SPA
under `apps/studio` and that Next.js is deferred; it cites ADR-002's offline-refresh requirement and
`TECHNICAL_ARCHITECTURE.md` §17; it states the trigger for revisiting the decision; and it states that the
domain and renderer packages stay unchanged either way. Follow the format of ADR-001 to ADR-003: status,
date, context, decision, consequences.

- [ ] **Step 2: Correct `AGENTS.md`**

- The pnpm, Turborepo and `packages/*` claims are now true and stay.
- Replace the Next.js App Router sentence with the Vite SPA shell under `apps/studio` and a pointer to
  ADR-004.
- Replace the dnd-kit sentence with the truth: dnd-kit was not adopted, and the timeline keeps its own
  pointer handling.
- Replace the package-boundary paragraph with the table from the spec's §6.
- Keep every product invariant, the dependency-adoption rule list, the verification list, the PR template
  and the out-of-MVP list unchanged.

- [ ] **Step 3: Correct `UPSTREAM_AUDIT.md` §7**

Replace the `packages/*` to `src/*` table with the spec's §6 ownership map. Keep the audit trail.

- [ ] **Step 4: Correct `TECHNICAL_ARCHITECTURE.md`**

Update §2 to add the three component families and to state that the shell is a Vite SPA under
`apps/studio`. Leave the other 480 lines alone.

- [ ] **Step 5: Correct `ROADMAP.md`**

- Tick R1 and R2's persistence items against the code.
- Leave R2's import items unticked — Phase 3 has not happened.
- Replace the workstream table's paths with the real ones.
- Record the numbering collision with `UPSTREAM_AUDIT.md`, whose R1 to R4 mean implementation slices while
  the roadmap's mean delivery stages.

- [ ] **Step 6: Correct `TEST_STRATEGY.md`**

Remove the sentence claiming the repository has no implemented app and no runnable test suite. Mark
Playwright and the named fixture files as not present. Keep the requirement-ID matrix and the target
sections.

- [ ] **Step 7: Correct `DOCS.md` and `REMOCN-CATALOGUE.md`**

`DOCS.md`: replace the pre-registry `ELEMENTS` map with the registry, state 26 components grouped into
generic, trading and motion, correct the preset count, the library tabs and the SQLite autosave path, and
replace the path table with the new layout.

`REMOCN-CATALOGUE.md`: change "23 elements" to 26 in both places it appears, with the breakdown of 22
generic, 1 trading and 3 motion.

- [ ] **Step 8: Add the ADR-003 addendum**

Append an addendum to `docs/decisions/ADR-003-COMPONENT-SYSTEM.md` recording the three family packages,
the transition slot on the track boundary, and the four adoption rules: the composition-length gotcha,
`speed` as the only retiming lever, provenance travelling with the copy, and additions rather than
replacements.

- [ ] **Step 9: Update the docs index**

`docs/README.md` gains `docs/decisions/ADR-004-SHELL-TECHNOLOGY.md` and the new spec and plan.

- [ ] **Step 10: Verify the claims**

```bash
grep -rn "packages/domain\|apps/studio" AGENTS.md docs/ | wc -l
grep -rn "does not include an implemented app" docs/ || echo "no stale claim"
grep -rn "23 elements" docs/ || echo "no stale count"
```

Expected: the first command finds many matches; the second and third find nothing.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Bring the documentation back in line with the code it describes

The agent guide, the architecture notes, the roadmap and the developer
documentation all described a repository that did not exist: a Next.js shell,
fourteen packages and a catalogue of twenty-three components. They now
describe the pnpm workspace, the twelve packages that hold real code and the
twenty-six components grouped by family, and the shell decision is recorded
formally.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Cleanup and final verification

**Files:**
- Delete: `scripts/gen-showcase.mjs`, `scripts/preset-stills.mjs`, `examples/showcase.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: everything above.
- Produces: a tree with no dead code and a green gate.

- [ ] **Step 1: Confirm each deletion has no live reference**

```bash
grep -rn "showcase\|gen-showcase\|preset-stills" --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.json" --include="*.md" . \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=out --exclude-dir=.tmp --exclude-dir=.git
```

Every hit must be inside one of the three files being deleted, or prose that names the idea without
pointing at a file. If a live reference exists, keep that file and note it in the report instead of
deleting.

- [ ] **Step 2: Delete the dead files**

```bash
git rm scripts/gen-showcase.mjs scripts/preset-stills.mjs examples/showcase.json
```

- [ ] **Step 3: Extend the ignore list**

Append to `.gitignore` if not already present:

```gitignore
.turbo/
apps/*/dist/
packages/*/dist/
```

- [ ] **Step 4: Run the full gate**

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
node packages/export/src/render.mjs
```

Expected: a clean install from the lockfile, zero type errors, 153 tests passing across 12 files, a
successful build, and an MP4 from each render path.

- [ ] **Step 5: Verify the boundary rule**

```bash
pnpm -r exec node -e "
const fs = require('fs');
const path = require('path');
const bad = [];
for (const pkg of fs.readdirSync('packages')) {
  const manifest = JSON.parse(fs.readFileSync(path.join('packages', pkg, 'package.json'), 'utf8'));
  const declared = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})]);
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(full);
  });
  walk(path.join('packages', pkg, 'src'));
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/from '(@chart-studio\/[^']+)'/g)) {
      const dep = m[1];
      if (!declared.has(dep)) bad.push(file + ' -> ' + dep);
    }
  }
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log('boundary ok');
"
```

Expected: `boundary ok`. A failure means a package imports one it does not declare; fix the manifest or
the import before continuing.

- [ ] **Step 6: Confirm the editor still works**

```bash
pnpm dev
```

Open the served URL and confirm: the library lists all 26 components, the canvas renders the sample
project, the inspector edits a parameter, a change survives a reload, and the Export button produces an
MP4. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Remove the scripts and generated files that nothing used

Three files were dead: two scripts imported a bundle path no script produces,
and the 51 KB video they generated was referenced by nothing.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** Every Phase 1 requirement in the spec is covered: the pnpm workspace, the twelve
packages, the ownership map, the app shell at `apps/studio`, the package consumption contract, the
Turborepo task graph, the single Vitest configuration, the CI gate, ADR-004, the ADR-003 addendum, the
seven documentation corrections, the cleanup list, and the Phase 1 gate itself. The spec's §16 open
questions are listed at the top of this plan with the section each would change.

**Placeholder scan.** No `TBD`, `TODO` or unfinished steps. One instruction is deliberately deferred to
the implementer — copying the exact installed `@radix-ui` versions in Task 6 Step 1 — because inventing
them would be wrong; the step says to read them from the lockfile.

**Type consistency.** The package names used across tasks are `@chart-studio/domain`,
`@chart-studio/market-data`, `@chart-studio/storage-sqlite`, `@chart-studio/editor-core`,
`@chart-studio/timeline`, `@chart-studio/ui`, `@chart-studio/generic-components`,
`@chart-studio/chart-renderer`, `@chart-studio/trading-components`, `@chart-studio/motion-components`,
`@chart-studio/scene-compositor`, `@chart-studio/export` and `@chart-studio/studio`. The `@chart-studio/*`
scope is used consistently in every manifest, import and grep.

**Ordering.** Each task leaves the tree green, and the dependency order is respected: `domain` and
`market-data` first because everything else depends on them; the component families before the compositor
that renders them; the compositor before the export tools that bundle it.
