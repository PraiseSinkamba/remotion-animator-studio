# Chart Studio platform restructure — Phase 1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the repository onto a pnpm workspace whose source tree matches the documented package boundaries, without changing editor behaviour.

**Architecture:** The editor shell becomes `apps/studio`. Five packages hold the rest: `core` (pure TypeScript — schemas, the component contract, the registration mechanism, the market maths), `components` (the visual catalogue, in `base/`, `trading/` and `motion/` folders), `ui` (the shadcn primitives and the presentational panels), `editor` (the store, the timeline, the persistence) and `video` (the Remotion composition, its entry point and the Node render tools). Packages export built JavaScript for production and source for development through an `exports` map with a `development` condition. Turborepo orders and caches the per-package typecheck, test and build tasks.

**Tech Stack:** pnpm 10.28.2, Turborepo 2.11.10, Node 24.20.0, TypeScript 5.6.3, Vite 5.4.11, React 18.3.1, Remotion 4.0.538, Zustand 5.0.3, Tailwind CSS 4.3.3, Vitest 3.2.7

**Design spec:** `docs/superpowers/specs/2026-10-28-chart-studio-platform-and-catalogue-reorganisation-design.md` (commit `5924496`, revised for the five-package layout)

## Global Constraints

- No editor behaviour changes. The 153 existing tests must pass with the same names and the same assertions.
- Remotion packages stay pinned to `4.0.538`; React stays on `18.3.1`; Vite stays on `5.4.11`. No dependency upgrades in this phase.
- No component `type` is renamed, renumbered or reused. The `category` value `generic` becomes `base`; category is registry metadata and never reaches a saved project.
- `packages/core` imports no React, Remotion, Zustand or storage code.
- Every cross-package import uses the package's own name and a `workspace:*` dependency. No TypeScript path alias crosses a package boundary.
- pnpm 10 lifecycle scripts are allowlisted explicitly in the root `package.json`.
- The local-first invariant holds: no network call, login or server is required to edit, save, preview or export.
- No package imports a package absent from its own `package.json`.
- **A package's relative imports carry an explicit `.js` extension.** The built output is strict ESM, so Node and webpack require fully-specified paths. Vite's build and the type checker are both silent about this; only the Remotion bundler catches it.
- **A package has two TypeScript configurations.** `tsconfig.json` typechecks everything under `src` and emits nothing; `tsconfig.build.json` extends it, emits, and excludes the test files. The build script removes `dist` first.
- React's types are a development dependency. A package that only needs `React.FC` declares `react` and `@types/react` as devDependencies; nothing is bundled.
- Every internal package declares `"sideEffects": false` **only if all of its modules are free of side effects**. The component catalogue must not: a definition registers itself when imported, so declaring it side-effect free makes the bundler drop the registrations and the library panel silently loses its components.
- A package that carries Tailwind classes is listed in `apps/studio/src/index.css` with `@source`, or the build succeeds and the editor renders unstyled.
- After every task, `node scripts/verify-r1.mjs` still renders an MP4 whose logical frames match the preview.
- Every task ends with a commit.

### Open questions this plan proceeds on

The spec carries three open questions in its §16. This plan implements the spec's stated defaults, so the reviewer can override any of them and only the named section changes:

| # | Default implemented | If overridden |
|---|---|---|
| Q1 | `evaluateBarsAtFrame` and `ChartFrameState` live in `packages/core` | Task 2 moves two exports and one import |
| Q2 | Transitions live on the track boundary | Phase 2 is affected, not this plan |
| Q3 | Remocn wave 1 is six components | Phase 2 is affected, not this plan |

### Dependency order

The packages are created in the order their dependencies allow, so every task ends with a green tree:

```text
core  ──►  ui  ──►  components  ──►  editor  ──►  video
  └──────────────────────────────────────►  ▲           │
                              apps/studio ──┴───────────┘
```

---

## File Structure

| Path | Responsibility |
|---|---|
| `pnpm-workspace.yaml` | the workspace globs |
| `turbo.json` | task graph and caching |
| `tsconfig.base.json` | compiler options every package extends |
| `vitest.config.ts` | one test configuration across the workspace |
| `apps/studio/` | the editor shell: React entry, Vite config, app panels, the presets |
| `packages/core/` | schemas, the component contract, the registration mechanism, the market maths |
| `packages/components/` | `base/`, `trading/`, `motion/` — the visual catalogue, the registry aggregator, the project migration |
| `packages/ui/` | shadcn primitives, inspector sections, library cards |
| `packages/editor/` | the store, the timeline, the persistence |
| `packages/video/` | the composition, the Remotion entry point, the render CLI and the local render server |
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

Create `tsconfig.base.json`. It carries today's root `tsconfig.json` options, minus the one that would
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
      '@chart-studio/core',
      '@chart-studio/ui',
      '@chart-studio/components',
      '@chart-studio/editor',
      '@chart-studio/video',
    ],
  },
});
```

The isolation headers and their comment are carried over unchanged — they are what let the SQLite OPFS
VFS run in a worker.

- [ ] **Step 11: Fix the path references outside the app**

Four scripts resolve paths relative to the repository root. Update each:

| File | Change |
|---|---|
| `render.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')` |
| `server.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')` |
| `docs-gifs.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')`; `path.resolve('public/docs/gifs')` → `path.resolve('apps/studio/public/docs/gifs')` |
| `scripts/verify-r1.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('apps/studio/remotion/index.ts')`; its import of `../src/trading/ohlc.ts` becomes `../apps/studio/src/trading/ohlc.ts` for now, and is repointed at the package in Task 2 |

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

### Task 2: `packages/core`

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`
- Move: `apps/studio/src/types.ts` → `packages/core/src/schemas.ts`, `apps/studio/src/registry/types.ts` → `packages/core/src/contract.ts`, `apps/studio/src/registry/registry.ts` → `packages/core/src/registry.ts`, `apps/studio/src/registry/registry.test.ts` → `packages/core/src/registry.test.ts`, `apps/studio/src/trading/ohlc.ts` → `packages/core/src/market.ts`, `apps/studio/src/trading/ohlc.test.ts` → `packages/core/src/market.test.ts`, `apps/studio/src/sampleProject.ts` → `packages/core/src/sample-project.ts`
- Modify: every file that imported the moved modules

**Interfaces:**
- Consumes: nothing.
- Produces: `@chart-studio/core` exporting the schemas (`ElementType`, `EffectType`, `Clip`, `Track`, `Project`, `ParamDef`), the component contract (`ComponentProps`, `ComponentDefinition`, `ComponentRenderContext`, `ComponentInspectorContext`, `ComponentCategory`), the registration mechanism (`registerComponent`, `getComponent`, `buildComponentProps`, `listComponents`, `listComponentsByCategory`, `componentBounds`), the market maths (`OhlcBar`, `BarRevealMode`, `PartialBar`, `ChartFrameState`, `generateSyntheticBars`, `evaluateBarsAtFrame`, `computePriceRange`, `barsToFrames`) and the empty-project factory.

- [ ] **Step 1: Create the package manifest**

`packages/core/package.json`:

```jsonc
{
  "name": "@chart-studio/core",
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
    "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  }
}
```

No dependencies. That is the point of the package: it is the layer that stays free of React, Remotion,
Zustand and storage code.

- [ ] **Step 2: Create the package tsconfig**

`packages/core/tsconfig.json`:

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

Every package in this plan uses this exact tsconfig.

- [ ] **Step 3: Move the sources**

```bash
mkdir -p packages/core/src
git mv apps/studio/src/types.ts packages/core/src/schemas.ts
git mv apps/studio/src/registry/types.ts packages/core/src/contract.ts
git mv apps/studio/src/registry/registry.ts packages/core/src/registry.ts
git mv apps/studio/src/registry/registry.test.ts packages/core/src/registry.test.ts
git mv apps/studio/src/trading/ohlc.ts packages/core/src/market.ts
git mv apps/studio/src/trading/ohlc.test.ts packages/core/src/market.test.ts
git mv apps/studio/src/sampleProject.ts packages/core/src/sample-project.ts
```

`apps/studio/src/registry/` and `apps/studio/src/trading/` are now empty and disappear.

- [ ] **Step 4: Create the barrel**

`packages/core/src/index.ts`:

```ts
export * from './schemas';
export * from './contract';
export * from './registry';
export * from './market';
export * from './sample-project';
```

- [ ] **Step 5: Repoint the imports**

Every import of a moved module changes from a relative path to the package name:

```ts
// was: import { Clip } from '../types';
// now:
import type { Clip } from '@chart-studio/core';
```

```ts
// was: import { getComponent } from '../registry';
// now:
import { getComponent } from '@chart-studio/core';
```

Find every affected file:

```bash
grep -rln "from '\.\./types'\|from '\./types'\|from '\.\./registry'\|from '\./registry'\|from '\.\./registry/types'\|from '\.\./registry/registry'\|from '\.\./trading/ohlc'\|from './ohlc'\|from '\.\./sampleProject'" apps/studio/src packages
```

Two details matter:

- Type-only imports keep the `import type` form where they already had one, so the emitted JavaScript does
  not carry a runtime import of a types-only module.
- Inside `packages/core` itself, the imports stay relative — a package never imports itself by name.

`src/registry/index.ts` still exists and still side-effect imports the definitions, so it keeps working
until Task 4 moves it. Its own imports of `./registry` and `./types` now come from `@chart-studio/core`.

- [ ] **Step 6: Declare the dependency in the app**

In `apps/studio/package.json`, add:

```jsonc
"dependencies": {
  "@chart-studio/core": "workspace:*"
}
```

- [ ] **Step 7: Verify the resolution contract — this is the first real package, so it is where the
  `development` condition is proved**

```bash
pnpm --filter @chart-studio/core build
pnpm --filter @chart-studio/studio build
```

Expected: a successful build, and `packages/core/dist/index.js` plus `packages/core/dist/index.d.ts`
exist. Then confirm the app bundle used the built output rather than compiling the TypeScript source:

```bash
grep -c "CURRENT_PROJECT_SCHEMA_VERSION" apps/studio/dist/assets/*.js
```

Expected: a non-zero count, which proves the built output was bundled.

Then prove the development condition resolves source:

```bash
pnpm --filter @chart-studio/studio exec vite dev --port 5199
```

In a second shell:

```bash
curl -s "http://localhost:5199/@fs$(pwd)/packages/core/src/index.ts" | head -1
```

Expected: TypeScript source. Stop the dev server.

- [ ] **Step 8: Run the gates**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests still pass, with the registry and OHLC tests now reporting under the core package.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Move the schemas, the component contract and the candle maths into one pure package

The project document, the component contract, the registration mechanism and
the market maths are the one part of the editor that no React, video or
storage code may depend on. Giving them a package makes that boundary
enforceable by the dependency list rather than by convention.

No behaviour changes: the same tests pass and the render is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `packages/ui`

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/src/index.ts`
- Move: `apps/studio/src/components/ui/**` → `packages/ui/src/components/ui/**`, `apps/studio/src/components/inspector/**` → `packages/ui/src/components/inspector/**`, `apps/studio/src/components/library/**` → `packages/ui/src/components/library/**`, `apps/studio/src/lib/utils.ts` → `packages/ui/src/lib/utils.ts`
- Modify: every file that imported the moved modules

**Interfaces:**
- Consumes: `@chart-studio/core` for the component contract types.
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
    }
  },
  "scripts": {
    "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/core": "workspace:*",
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

**Do not invent versions.** Run `pnpm list --depth 1` and copy the exact installed version of every package
the moved files import. If the app depends on the `radix-ui` umbrella package rather than individual
`@radix-ui/react-*` packages, keep that single dependency instead of listing both.

Create `packages/ui/tsconfig.json` and `packages/ui/tsconfig.build.json` with exactly the contents the core
package uses — see `packages/core/tsconfig.json` and `packages/core/tsconfig.build.json`.

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

Every one becomes an import from `@chart-studio/ui`:

```tsx
import { Button } from '@chart-studio/ui';
```

**Check one thing before you commit:** `packages/ui/src/components/library/catalog.tsx` must not import the
component registry. If it does, the library package would depend on the components package, and the
components package depends on the library package for its inspectors — a cycle. In that case, pass the
component list in as a prop instead, which is what the presentational design already implies.

- [ ] **Step 5: Handle the stylesheet**

The global stylesheet stays with the application, because it defines the theme tokens every shadcn class
uses. `apps/studio/src/index.css` does not move.

Confirm `apps/studio/src/main.tsx` imports `./index.css` and that the stylesheet contains the
`@import "tailwindcss"` line. If the stylesheet scans `src/components/ui` for class names, repoint it at
the package:

```css
@source "../../../packages/ui/src";
```

Tailwind v4 scans source files; without this the shadcn classes lose their styles while the build still
succeeds.

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
git commit -m "Move the interface primitives into the package every panel shares

The editor controls and the library and inspector pieces are used by every
panel, and they now live behind one package instead of being reached through
relative paths that cross the shell.

No behaviour changes: the same tests pass and the render is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `packages/components`

**Files:**
- Create: `packages/components/package.json`, `packages/components/tsconfig.json`, `packages/components/src/index.ts`, `vendor/remocn/README.md`
- Move: `apps/studio/src/registry/legacy.ts` → `packages/components/src/base/definitions.ts`; `apps/studio/src/remotion/legacy-elements.tsx` → `packages/components/src/base/adapters.tsx`; `apps/studio/src/remotion/scenes.tsx` → `packages/components/src/base/scenes.tsx`; `apps/studio/src/effects.ts` → `packages/components/src/base/effects.ts`; `apps/studio/src/trading/definition.ts` → `packages/components/src/trading/definitions/candlestick-chart.ts`; `apps/studio/src/trading/candlestick-chart-inspector.tsx` → `packages/components/src/trading/inspectors/candlestick-chart.tsx`; `apps/studio/src/trading/candlestick-chart.tsx` → `packages/components/src/trading/chart.tsx`; `apps/studio/src/trading/candlestick-chart.test.tsx` → `packages/components/src/trading/candlestick-chart.test.tsx`; `apps/studio/src/project/migrate.ts` → `packages/components/src/project-migrate.ts`; `apps/studio/src/project/migrate.test.ts` → `packages/components/src/project-migrate.test.ts`; `apps/studio/src/motion-components/**` → `packages/components/src/motion/**` except `upstream/**` → `vendor/remocn/source/`; `apps/studio/src/registry/index.ts` → `packages/components/src/registry.ts`
- Delete: `apps/studio/src/motion-components/upstream-modules.d.ts`

**Interfaces:**
- Consumes: `@chart-studio/core`, `@chart-studio/ui`.
- Produces: `@chart-studio/components` exporting the registry aggregator and its catalogue, the three families, and the project migration.

- [ ] **Step 1: Create the package manifest**

`packages/components/package.json`:

```jsonc
{
  "name": "@chart-studio/components",
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
    "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/core": "workspace:*",
    "@chart-studio/ui": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "4.0.538"
  }
}
```

Create `packages/components/tsconfig.json` and `packages/components/tsconfig.build.json` with exactly the contents the core package uses.

- [ ] **Step 2: Move the base family**

```bash
mkdir -p packages/components/src/base packages/components/src/trading/definitions packages/components/src/trading/inspectors packages/components/src/motion vendor/remocn
git mv apps/studio/src/registry/legacy.ts packages/components/src/base/definitions.ts
git mv apps/studio/src/remotion/legacy-elements.tsx packages/components/src/base/adapters.tsx
git mv apps/studio/src/remotion/scenes.tsx packages/components/src/base/scenes.tsx
git mv apps/studio/src/effects.ts packages/components/src/base/effects.ts
```

- [ ] **Step 3: Move the trading family**

```bash
git mv apps/studio/src/trading/definition.ts packages/components/src/trading/definitions/candlestick-chart.ts
git mv apps/studio/src/trading/candlestick-chart-inspector.tsx packages/components/src/trading/inspectors/candlestick-chart.tsx
git mv apps/studio/src/trading/candlestick-chart.tsx packages/components/src/trading/chart.tsx
git mv apps/studio/src/trading/candlestick-chart.test.tsx packages/components/src/trading/candlestick-chart.test.tsx
```

- [ ] **Step 4: Move the motion family and the verbatim upstream record**

```bash
git mv apps/studio/src/motion-components/upstream vendor/remocn/source
git mv apps/studio/src/motion-components/LICENSE.remocn packages/components/src/motion/LICENSE.remocn
git mv apps/studio/src/motion-components/PROVENANCE.md packages/components/src/motion/PROVENANCE.md
git mv apps/studio/src/motion-components/caret.tsx packages/components/src/motion/caret.tsx
git mv apps/studio/src/motion-components/marker-highlight.tsx packages/components/src/motion/marker-highlight.tsx
git mv apps/studio/src/motion-components/remocn-ui.ts packages/components/src/motion/remocn-ui.ts
git mv apps/studio/src/motion-components/remocn-ui-types.ts packages/components/src/motion/remocn-ui-types.ts
git mv apps/studio/src/motion-components/soft-blur-in.tsx packages/components/src/motion/soft-blur-in.tsx
git mv apps/studio/src/motion-components/typewriter.tsx packages/components/src/motion/typewriter.tsx
git mv apps/studio/src/motion-components/definitions packages/components/src/motion/definitions
git mv apps/studio/src/motion-components/definition.ts packages/components/src/motion/definitions/marker-highlight.ts
git mv apps/studio/src/motion-components/definition.test.ts packages/components/src/motion/definitions/marker-highlight.test.ts
git rm apps/studio/src/motion-components/upstream-modules.d.ts
```

The `definitions/` directory moves first, so that the single `definition.ts` lands beside its two siblings
as `marker-highlight.ts`.

- [ ] **Step 5: Move the aggregator and the migration**

```bash
git mv apps/studio/src/registry/index.ts packages/components/src/registry.ts
git mv apps/studio/src/project/migrate.ts packages/components/src/project-migrate.ts
git mv apps/studio/src/project/migrate.test.ts packages/components/src/project-migrate.test.ts
```

The aggregator keeps its side-effect imports — it is what registers all 26 definitions when the package is
imported:

```ts
import './base/definitions';
import './trading/definitions/candlestick-chart';
import './motion/definitions/marker-highlight';
import './motion/definitions/soft-blur-in';
import './motion/definitions/typewriter';

export * from '@chart-studio/core';
```

- [ ] **Step 6: Create the barrels**

`packages/components/src/index.ts`:

```ts
export * from './registry';
export * from './project-migrate';
export * from './base/definitions';
export * from './trading/definitions/candlestick-chart';
export * from './trading/inspectors/candlestick-chart';
export * from './trading/chart';
export * from './motion/definitions/marker-highlight';
export * from './motion/definitions/soft-blur-in';
export * from './motion/definitions/typewriter';
```

- [ ] **Step 7: Rename the `generic` category to `base`**

`ComponentCategory` in `packages/core/src/contract.ts` gains `base` in place of `generic`, and
`packages/components/src/registry.ts` updates `CATEGORY_ORDER` and `CATEGORY_LABELS` to match:

```ts
export const CATEGORY_ORDER: ComponentCategory[] = ['base', 'trading', 'motion'];

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  base: 'Elements',
  trading: 'Trading',
  motion: 'Motion',
};
```

```bash
grep -rn "'generic'" packages apps/studio/src
```

Every remaining hit is a category reference and becomes `'base'`. Confirm no `type` identifier changes —
the grep must not match any of the 26 component type names.

This is safe for saved projects: `category` is registry metadata, never serialised into a project document.

- [ ] **Step 8: Repoint the imports**

```bash
grep -rln "registry/legacy\|trading/definition\|trading/candlestick-chart\|remotion/legacy-elements\|remotion/scenes\|project/migrate\|motion-components" apps/studio/src packages
```

Every one becomes an import from `@chart-studio/components`:

```ts
import { getComponent, listComponents, CATEGORY_ORDER } from '@chart-studio/components';
```

Inside `packages/components`, the imports between its own files stay relative.

- [ ] **Step 9: Write the vendor record**

Create `vendor/remocn/README.md`:

```markdown
# Verbatim Remocn source

These files are the unmodified upstream Remocn sources for the three components
we adopted: `marker-highlight`, `soft-blur-in` and `typewriter`, together with
the upstream files they depend on.

They are a **record, not application code**. They are outside `tsconfig.json`'s
`include`, they are never bundled, and they are not imported by anything in
`packages/`. The adapted copies live in `packages/components/src/motion/`, and
`packages/components/src/motion/PROVENANCE.md` records what changed in each.

The upstream licence is MIT and is kept at
`packages/components/src/motion/LICENSE.remocn`. The fetch date, the source URLs
and the sha256 hashes of the snapshot these came from are recorded in
`docs/reference/remocn/README.md`.

The original upstream import paths — `@/components/remocn/caret` and
`@/lib/remocn-ui` — refer to the upstream project's own layout, not this
repository's.
```

- [ ] **Step 10: Update the provenance record**

In `packages/components/src/motion/PROVENANCE.md`, change every path of the form
`src/motion-components/upstream/<name>.tsx` to `vendor/remocn/source/<name>.tsx`, and every path of the
form `src/motion-components/definition.ts` to
`packages/components/src/motion/definitions/marker-highlight.ts`. Change nothing else — the upstream URLs,
the licences, the retrieval dates, the enumerated local modifications and the "Unchanged" notes are the
record.

- [ ] **Step 11: Declare the dependencies and run the gates**

Add to `apps/studio/package.json`:

```jsonc
"@chart-studio/components": "workspace:*"
```

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests pass. The chart test file is the largest single file in the repository and covers the
no-lookahead rule; it must pass unchanged. The motion component tests check that the adapted components
read only `fps` and never the composition length — they must pass unchanged.

- [ ] **Step 12: Confirm the verbatim copies are not compiled**

```bash
grep -c "marker-highlight" packages/components/dist/*.js || true
pnpm --filter @chart-studio/components typecheck
```

Expected: the verbatim source does not appear in the package's output, and the package typechecks without
the ambient declaration file that used to make the copies compile.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Gather the whole component catalogue into one package, grouped by family

The base elements, the trading components and the adapted Remocn sources now
sit in one package with three folders, instead of three packages that would
have needed a dependency graph to keep straight. The registry aggregator and
the project migration moved with them, because the migration validates stored
clips against that same catalogue.

The generic category is now called base, to match the folder. It is registry
metadata and never reaches a saved project.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `packages/editor`

**Files:**
- Create: `packages/editor/package.json`, `packages/editor/tsconfig.json`, `packages/editor/src/index.ts`
- Move: `apps/studio/src/store.ts` → `packages/editor/src/store.ts`, `apps/studio/src/store.test.ts` → `packages/editor/src/store.test.ts`, `apps/studio/src/playerRef.ts` → `packages/editor/src/playerRef.ts`; `apps/studio/src/components/timeline/**` → `packages/editor/src/timeline/**`; `apps/studio/src/storage/**` → `packages/editor/src/storage/**`
- Modify: every file that imported the moved modules

**Interfaces:**
- Consumes: `@chart-studio/core`, `@chart-studio/components`, `@chart-studio/ui`.
- Produces: `@chart-studio/editor` exporting the store and its actions, the player bridge, the timeline components and the storage port with its three backends.

- [ ] **Step 1: Create the package**

`packages/editor/package.json`:

```jsonc
{
  "name": "@chart-studio/editor",
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
    "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@chart-studio/components": "workspace:*",
    "@chart-studio/core": "workspace:*",
    "@chart-studio/ui": "workspace:*",
    "@sqlite.org/sqlite-wasm": "3.54.1-build1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.3"
  }
}
```

Create `packages/editor/tsconfig.json` and `packages/editor/tsconfig.build.json` with exactly the contents the core package uses.

- [ ] **Step 2: Move the sources**

```bash
mkdir -p packages/editor/src/timeline
git mv apps/studio/src/store.ts packages/editor/src/store.ts
git mv apps/studio/src/store.test.ts packages/editor/src/store.test.ts
git mv apps/studio/src/playerRef.ts packages/editor/src/playerRef.ts
git mv apps/studio/src/components/timeline/ClipChip.tsx packages/editor/src/timeline/ClipChip.tsx
git mv apps/studio/src/components/timeline/TimelineRuler.tsx packages/editor/src/timeline/TimelineRuler.tsx
git mv apps/studio/src/components/timeline/TrackRow.tsx packages/editor/src/timeline/TrackRow.tsx
git mv apps/studio/src/components/timeline/Timeline.tsx packages/editor/src/timeline/Timeline.tsx
git mv apps/studio/src/components/timeline/shared.ts packages/editor/src/timeline/shared.ts
git mv apps/studio/src/components/timeline/shared.test.ts packages/editor/src/timeline/shared.test.ts
git mv apps/studio/src/storage packages/editor/src/storage
```

- [ ] **Step 3: Create the barrels**

`packages/editor/src/index.ts`:

```ts
export * from './store';
export * from './playerRef';
export { Timeline } from './timeline/Timeline';
export { ClipChip } from './timeline/ClipChip';
export { TimelineRuler } from './timeline/TimelineRuler';
export { TrackRow } from './timeline/TrackRow';
export * from './timeline/shared';
export * from './storage/types';
export * from './storage/contract-suite';
export * from './storage/select';
export * from './storage/useWorkspace';
```

The SQLite driver, worker and client are not exported — they are implementation details of the backend.

- [ ] **Step 4: Repoint the imports**

```bash
grep -rln "from '\.\./\.\./store'\|from '\.\./store'\|from '\.\./playerRef'\|components/timeline\|from './timeline'\|storage/types\|storage/select\|storage/useWorkspace" apps/studio/src packages
```

The store is imported by many panels. Every one becomes:

```ts
import { useStore } from '@chart-studio/editor';
```

The timeline becomes:

```tsx
import { Timeline } from '@chart-studio/editor';
```

Preserve the original import's shape — some are `import { useStore }`, some
`import { useStore, type EditorState }`. Split value imports from type imports the same way the original
did.

- [ ] **Step 5: Declare the dependency and run the gates**

Add `"@chart-studio/editor": "workspace:*"` to `apps/studio/package.json`.

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

Expected: 153 tests pass. The storage contract suite is the largest test file in the repository; it must
still pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Gather the editor runtime into one package

The store, the timeline and the local database now live together, behind one
package name. That keeps the shell replaceable — the runtime that owns the
project survives a swap of the shell that displays it — and it puts the
one-writer rule on the database inside a boundary the render path never
crosses.

No behaviour changes: the same tests pass and the render is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `packages/video`

**Files:**
- Create: `packages/video/package.json`, `packages/video/tsconfig.json`, `packages/video/src/index.ts`
- Move: `apps/studio/src/remotion/MainComposition.tsx` → `packages/video/src/composition.tsx`; `remotion/Root.tsx` → `packages/video/remotion/Root.tsx`; `remotion/index.ts` → `packages/video/remotion/index.ts`; `render.mjs` → `packages/video/tools/render.mjs`; `server.mjs` → `packages/video/tools/server.mjs`
- Modify: the root `package.json`, `scripts/verify-r1.mjs`, `docs-gifs.mjs`

**Interfaces:**
- Consumes: `@chart-studio/core`, `@chart-studio/components`.
- Produces: `@chart-studio/video` exporting the composition and the Remotion entry point.

- [ ] **Step 1: Create the package**

`packages/video/package.json`:

```jsonc
{
  "name": "@chart-studio/video",
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
    "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json && node --check tools/render.mjs && node --check tools/server.mjs",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@chart-studio/components": "workspace:*",
    "@chart-studio/core": "workspace:*",
    "@remotion/bundler": "4.0.538",
    "@remotion/renderer": "4.0.538",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "4.0.538"
  }
}
```

The package holds both the React composition and the Node render tools, so it declares React and the
server-side renderer together. Create `packages/video/tsconfig.json` and `packages/video/tsconfig.build.json`
with exactly the contents the core package uses, except that the `include` stays `["src"]` — the `remotion/`
and `tools/` directories are entry points and scripts, not compiled modules.

- [ ] **Step 2: Move the sources**

```bash
mkdir -p packages/video/src packages/video/remotion packages/video/tools
git mv apps/studio/src/remotion/MainComposition.tsx packages/video/src/composition.tsx
git mv remotion/Root.tsx packages/video/remotion/Root.tsx
git mv remotion/index.ts packages/video/remotion/index.ts
git mv render.mjs packages/video/tools/render.mjs
git mv server.mjs packages/video/tools/server.mjs
```

`apps/studio/src/remotion/` is now empty and disappears.

- [ ] **Step 3: Create the barrel**

`packages/video/src/index.ts`:

```ts
export * from './composition';
```

- [ ] **Step 4: Fix the entry point and the tool paths**

`packages/video/remotion/Root.tsx` imports the composition from the package:

```tsx
import { MainComposition } from '@chart-studio/video';
```

In `packages/video/tools/render.mjs`:

- `path.resolve('remotion/index.ts')` → `path.resolve('packages/video/remotion/index.ts')`
- the default input stays `project.json` at the repository root
- the default output stays `out/animation.mp4` at the repository root

In `packages/video/tools/server.mjs`:

- `path.resolve('remotion/index.ts')` → `path.resolve('packages/video/remotion/index.ts')`
- `path.resolve('out')` stays at the repository root

Both scripts run from the repository root, which is how the root `package.json` invokes them.

- [ ] **Step 5: Update the root scripts and the remaining path references**

In the root `package.json`:

```jsonc
"scripts": {
  "dev": "concurrently -k -n web,render -c cyan,magenta \"pnpm --filter @chart-studio/studio dev\" \"node packages/video/tools/server.mjs\"",
  "render": "node packages/video/tools/render.mjs",
  "docs:gifs": "node docs-gifs.mjs"
}
```

`scripts/verify-r1.mjs` and `docs-gifs.mjs` also bundle the Remotion entry. Update both:

| File | Change |
|---|---|
| `scripts/verify-r1.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('packages/video/remotion/index.ts')` |
| `docs-gifs.mjs` | `path.resolve('remotion/index.ts')` → `path.resolve('packages/video/remotion/index.ts')`; `path.resolve('public/docs/gifs')` → `path.resolve('apps/studio/public/docs/gifs')` |

- [ ] **Step 6: Declare the dependency and run the gates**

Add `"@chart-studio/video": "workspace:*"` to `apps/studio/package.json`.

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
node packages/video/tools/render.mjs
```

Expected: 153 tests pass, `verify-r1.mjs` writes `out/verify/chart-studio-r1.mp4`, and the render CLI
writes `out/animation.mp4`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Gather the composition and the render tools into the package that produces the video

The composition, the Remotion entry point and the Node render tools were the
last pieces living outside a package. They now sit behind one package name,
so the render path depends on named packages rather than on relative paths
that reach across the tree.

No behaviour changes: the same tests pass and both render paths still work.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Documentation and ADRs

**Files:**
- Create: `docs/decisions/ADR-004-SHELL-TECHNOLOGY.md`
- Modify: `AGENTS.md`, `DOCS.md`, `docs/architecture/UPSTREAM_AUDIT.md`, `docs/architecture/TECHNICAL_ARCHITECTURE.md`, `docs/architecture/REMOCN-CATALOGUE.md`, `docs/roadmap/ROADMAP.md`, `docs/quality/TEST_STRATEGY.md`, `docs/decisions/ADR-003-COMPONENT-SYSTEM.md`, `docs/README.md`

**Interfaces:**
- Consumes: the finished tree from Tasks 1 to 6.
- Produces: documentation that matches the code.

- [ ] **Step 1: Write ADR-004**

Create `docs/decisions/ADR-004-SHELL-TECHNOLOGY.md`. It records that the application shell is a Vite SPA
under `apps/studio` and that Next.js is deferred; it cites ADR-002's offline-refresh requirement and
`TECHNICAL_ARCHITECTURE.md` §17; it states the trigger for revisiting the decision; and it states that the
core and component packages stay unchanged either way. Follow the format of ADR-001 to ADR-003: status,
date, context, decision, consequences.

- [ ] **Step 2: Correct `AGENTS.md`**

- The pnpm, Turborepo and `packages/*` claims are now true and stay.
- Replace the Next.js App Router sentence with the Vite SPA shell under `apps/studio` and a pointer to
  ADR-004.
- Replace the dnd-kit sentence with the truth: dnd-kit was not adopted, and the timeline keeps its own
  pointer handling.
- Replace the package-boundary paragraph with the five-package map and the ownership table from the spec's
  §6.
- Keep every product invariant, the dependency-adoption rule list, the verification list, the PR template
  and the out-of-MVP list unchanged.

- [ ] **Step 3: Correct `UPSTREAM_AUDIT.md` §7**

Replace the `packages/*` to `src/*` table with the spec's §6 ownership map. Keep the audit trail.

- [ ] **Step 4: Correct `TECHNICAL_ARCHITECTURE.md`**

Update §2 to show the five packages and the three component families, and to state that the shell is a
Vite SPA under `apps/studio`. Leave the other 480 lines alone.

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
base, trading and motion, correct the preset count, the library tabs and the SQLite autosave path, and
replace the path table with the new layout.

`REMOCN-CATALOGUE.md`: change "23 elements" to 26 in both places it appears, with the breakdown of 22
base, 1 trading and 3 motion.

- [ ] **Step 8: Add the ADR-003 addendum**

Append an addendum to `docs/decisions/ADR-003-COMPONENT-SYSTEM.md` recording the three family folders
inside one package, the transition slot on the track boundary, and the four adoption rules: the
composition-length gotcha, `speed` as the only retiming lever, provenance travelling with the copy, and
additions rather than replacements.

- [ ] **Step 9: Update the docs index**

`docs/README.md` gains `docs/decisions/ADR-004-SHELL-TECHNOLOGY.md` and the new spec and plan.

- [ ] **Step 10: Verify the claims**

```bash
grep -rn "packages/core\|apps/studio" AGENTS.md docs/ | wc -l
grep -rn "does not include an implemented app" docs/ || echo "no stale claim"
grep -rn "23 elements" docs/ || echo "no stale count"
grep -rn "packages/domain\|packages/market-data\|packages/editor-core\|packages/generic-components" docs/ AGENTS.md || echo "no stale package names"
```

Expected: the first command finds many matches; the other three find nothing.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Bring the documentation back in line with the code it describes

The agent guide, the architecture notes, the roadmap and the developer
documentation all described a repository that did not exist: a Next.js shell,
fourteen packages and a catalogue of twenty-three components. They now
describe the pnpm workspace, the five packages that hold real code and the
twenty-six components grouped by family, and the shell decision is recorded
formally.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Cleanup and final verification

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
node packages/video/tools/render.mjs
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
    else if (/\.(ts|tsx)\$/.test(e.name)) files.push(full);
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

Open the served URL and confirm: the library lists all 26 components grouped under Elements, Trading and
Motion; the canvas renders the sample project; the inspector edits a parameter; a change survives a
reload; and the Export button produces an MP4. Stop the server.

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

**Spec coverage.** Every Phase 1 requirement in the spec is covered: the pnpm workspace, the five
packages, the ownership map, the app shell at `apps/studio`, the package consumption contract, the
Turborepo task graph, the single Vitest configuration, the CI gate, ADR-004, the ADR-003 addendum, the
seven documentation corrections, the cleanup list, and the Phase 1 gate itself. The spec's §16 open
questions are listed at the top of this plan with the section each would change.

**Placeholder scan.** No `TBD`, `TODO` or unfinished steps. One instruction is deliberately deferred to
the implementer — copying the exact installed dependency versions in Task 3 Step 1 — because inventing
them would be wrong; the step says to read them from the lockfile.

**Type consistency.** The package names used across tasks are `@chart-studio/core`,
`@chart-studio/ui`, `@chart-studio/components`, `@chart-studio/editor`, `@chart-studio/video` and
`@chart-studio/studio`. The `@chart-studio/*` scope is used consistently in every manifest, import and
grep.

**Ordering.** Each task leaves the tree green, and the dependency order is respected: `core` first because
everything depends on it; `ui` before `components` because the trading inspector needs it; `components`
before `editor` because the store reads the catalogue; `editor` before `video` because the compositor
renders what the editor produces.
