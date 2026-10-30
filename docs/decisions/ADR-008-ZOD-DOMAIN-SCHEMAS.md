# ADR-008 — Zod validates the domain schemas, and only the domain schemas

**Status:** Proposed for owner approval; implementation is not authorised by this document.  
**Date:** 2026-10-30  
**Depends on:** [ADR-002 — Dependency Adoption](ADR-002-DEPENDENCY-ADOPTION.md) (Zod shortlisted for
runtime schemas), [ADR-003 — Component System](ADR-003-COMPONENT-SYSTEM.md) (`propsSchema:
z.ZodType<Props>`), [ADR-004 — Storage Port](ADR-004-STORAGE-PORT.md) (the persisted project
document), [ADR-007 — Chart Element Model](ADR-007-CHART-ELEMENT-MODEL.md) (schema version 2 and
the series registry this decision validates).  
**Described in:** [Authored swing paths, chart elements and playback control](../superpowers/specs/2026-10-29-chart-studio-authored-path-and-chart-elements-design.md)
§3.10 and §9, the design this decision records.  
**Companion:** [ADR-007 — Chart Element Model](ADR-007-CHART-ELEMENT-MODEL.md) (the document model
this decision validates).  
**Decision owners:** Implementation lead for the boundary and dependency decisions; product owner
for the choice between the classic and mini surfaces.

## Context

`AGENTS.md` already sets the rule this decision implements: every project data type is a strict
TypeScript discriminated union, validated with Zod at import and storage boundaries, with no `any`
domain blobs (`AGENTS.md:41`). Zod was shortlisted for exactly this job in the dependency-adoption
decision, gated on round-trip and migration tests
(`docs/decisions/ADR-002-DEPENDENCY-ADOPTION.md:18`). The technical architecture says the same
thing twice: the design-contract sketches must become versioned Zod schemas
(`docs/architecture/TECHNICAL_ARCHITECTURE.md:99`), and CSV, JSON, archive and SQLite RPC
boundaries are where validation belongs
(`docs/architecture/TECHNICAL_ARCHITECTURE.md:482`).

What is missing today is the runtime validator. The domain types are TypeScript interfaces with no
runtime counterpart: `Clip.props` is `Record<string, any>` (`packages/core/src/schemas.ts:83`),
`Project.schemaVersion` is optional (`packages/core/src/schemas.ts:107`), and `EffectInstance`
(`packages/core/src/schemas.ts:70-74`) is unchecked. The only runtime check on the persisted
document is the hand-written migration in `packages/components/src/project-migrate.ts`, which
rejects an unknown component type (`:37-38`), a clip whose `propsVersion` is newer than its
component's (`:40-44`), a higher schema version (`:92-93`) and a set of malformed scalars
(`:88-101`) — and then trusts everything else it was handed.

Three facts shape the decision:

1. **The domain types are already strict unions.** `ElementType` is a 27-member string union
   (`packages/core/src/schemas.ts:1-31`), `EffectType` is a 35-member union (`:33-68`), and
   `VideoComponentDefinition` carries a discriminated `renderMode` and `category`
   (`packages/core/src/contract.ts:83-124`). The types are not the problem; the missing half is a
   runtime schema that mirrors them.
2. **The schema v2 document adds shapes that hand-written checks will not scale for.** ADR-007
   introduces a project-level `series` registry, a `SeriesSpec` discriminated union over four
   origins, chart props v2 with panes and a clock, and stable bar ids. Validating those by
   hand-written `typeof` chains would grow with every field.
3. **The component contract already names Zod.** ADR-003 sketches `propsSchema: z.ZodType<Props>`
   on the component definition (`docs/decisions/ADR-003-COMPONENT-SYSTEM.md:48`). That field does
   not exist yet, and it cannot be added without a Zod dependency, so the dependency question is
   already open.

## Decision

1. **`zod@4.5.4` is adopted as the runtime validator for the domain schemas, pinned exactly.** The
   version matches the one already resolved in the lockfile, so no second copy of the library is
   fetched and no version skew is introduced between the workspace and the Remotion family.

2. **The classic surface is used, imported as a namespace: `import * as z from 'zod/v4'`.** The two
   v4 surfaces are compared in full below; the classic surface is chosen because it is the only one
   that provides the instance-method API the schema layer needs and the only one that exports
   `z.ZodType`, which ADR-003 already names.

3. **The classic surface is reached through `zod` or `zod/v4`, never through `zod/v4/classic`.**
   `zod/v4/classic` is not an exported subpath in 4.5.4. The package's export map contains
   `./package.json`, `.`, `./mini`, `./compile`, `./locales`, `./v3`, `./v4`, `./v4-mini`,
   `./v4/mini`, `./v4/core`, `./v4/locales` and `./v4/locales/*` — and no `./v4/classic`.
   Resolving it fails: `Could not resolve "zod/v4/classic" — The path "./v4/classic" is not
   exported by package "zod"`. The classic surface is `zod` (root) and `zod/v4`; `zod/v4/index.js`
   re-exports `./classic/index.js`, so `zod/v4` **is** the classic surface. The mini surface is
   `zod/mini`, `zod/v4/mini` and `zod/v4-mini`.

4. **The import style is a namespace import, not a named `z` binding.** A namespace import
   tree-shakes to the schemas actually used; a named `z` binding retains the whole classic
   namespace object, including the locale message payload. Measured on the same representative
   schema: namespace import 94,496 bytes raw / 26,688 bytes gzip, named `z` binding 434,121 raw /
   87,106 gzip. The gap is the locale message payload — `zod/v4/locales` holds 253 files, and the
   named bundle carries the Danish and Indonesian strings (42 `Ugyldig`, 14 `Ogiltig`) while the
   namespace bundle carries none. Both bundles list the same 63 locale files in the esbuild graph;
   the namespace import drops their contents, the named binding does not.

5. **Zod lives in `packages/core`, and only in `packages/core`.** The domain schemas are core's
   responsibility (`AGENTS.md:56` assigns core the project, scene, clip and object schemas), core is
   the only package that imports them, and core has no runtime dependency today
   (`packages/core/package.json` — `dependencies` is `{}`, and `react` plus `@types/react` are
   devDependencies). `packages/core` therefore gains its first runtime dependency, on a library with
   zero runtime dependencies of its own.

6. **The package boundary exposes plain validators, not Zod types.** Core exports plain functions
   returning a plain discriminated result — `{ ok: true, value }` or `{ ok: false, issues }` with
   `path` and `message` strings — so no consumer outside core needs Zod in scope and no consumer
   outside core needs a Zod dependency. The Zod `safeParse` result never crosses the boundary.

7. **The migration keeps its history-dependent checks; Zod takes the shape checks.** The two are
   separated by what they can know, and the split is recorded in full below.

8. **This slice does not add `propsSchema` to the component definition.** The Zod dependency and
   the domain schemas land first; the per-component props schema is the next slice and the reason
   `packages/core` declares Zod at all.

## Dependency record

Required by `AGENTS.md` for a new runtime package.

- **Exact package and version:** `zod@4.5.4`, pinned exactly in `packages/core/package.json`.
- **Licence:** MIT.
- **Runtime and browser support:** pure ESM and CJS, zero runtime dependencies, zero peer
  dependencies, no `engines` restriction, no install or postinstall script. The v4 runtime code
  imports no `node:` builtins, so the same build runs in the browser, in the Remotion render path
  and in Node. The package's `sideEffects` field is limited to its compile entry points.
- **Bundle consequences:** measured, not estimated. The representative schema is a project document
  with a strict object, a discriminated union of three element kinds, positive-integer checks, a
  `SeriesSpec` with a bar refinement and a `safeParse` call. Measurement harness: esbuild 0.28.1,
  `--bundle --format=esm --minify`, `gzip -9 -n`, run in a directory with no `tsconfig.json`
  `paths` mapping for `zod` and `NODE_PATH` pointing at the pnpm store entry so the package
  resolves before it is declared:

  ```bash
  cd E:/4004/orca/remotion-animator-studio/.tmp/zmeasure2
  export NODE_PATH="E:/4004/orca/remotion-animator-studio/node_modules/.pnpm/zod@4.5.4/node_modules"
  node ../../node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/bin/esbuild \
    <entry>.mjs --bundle --format=esm --minify --outfile=<out>.js --metafile=<out>.meta.json
  gzip -9 -n -c <out>.js | wc -c
  ```

  | Surface and import style | Raw bytes | gzip -9 -n bytes |
  |---|---:|---:|
  | Classic, `import * as z from 'zod'`, full schema | 94,496 | 26,688 |
  | Classic, `import * as z from 'zod/v4'`, full schema | 94,496 | 26,688 |
  | Classic, `import * as z from 'zod'`, minimal schema | 80,822 | 23,263 |
  | Classic, `import { z } from 'zod/v4'`, full schema | 434,121 | 87,106 |
  | Classic, `import { z } from 'zod'`, minimal schema | 433,270 | 86,841 |
  | Mini, `import * as z from 'zod/v4/mini'`, full schema | 24,932 | 7,871 |
  | Mini, `import * as z from 'zod/v4/mini'`, minimal schema | 11,934 | 4,276 |

  The mini row is the same schema expressed in mini's idiom — `.check(z.minLength(1))` where
  classic writes `.min(1)`, and the top-level `z.strictObject` where classic writes
  `.strict()` — so the two rows compare equivalent validation, not different work. Mini has no
  `.strict()` instance method, which is why the mini entry point was rewritten before it was
  measured; the classic entry point was verified to reject an unrecognised key at runtime.

  The classic-versus-mini gap on the full schema is 18,817 gzip bytes. Against the studio's
  existing main chunk of 972,773 bytes (`apps/studio/dist/assets/index-GKenjcXV.js`, which
  contains no Zod today) that is a rounding error, and the gap is not the deciding factor: the
  mini surface cannot express the schemas this slice needs. A harness warning for whoever
  re-measures: a `tsconfig.json` with `paths` for `zod` in the measurement directory makes esbuild
  resolve the subpath to the `.d.cts` declaration files instead of the runtime, which pulls the
  locale payload into the output and produces bundles of roughly 506–530 kB. The clean harness
  above has no such `tsconfig.json`.
- **Security posture:** MIT-licensed, no network access, no filesystem access, no telemetry, no
  install script. The classic surface compiles object schemas to JavaScript with the `Function`
  constructor as a JIT fast path: measured 2 calls to the `Function` constructor when parsing one
  classic object schema, 0 calls in the mini surface, and 0 calls in the classic surface under
  `z.config({ jitless: true })`. The fast path is gated by an `allowsEval` probe
  (`zod/v4/core/util.js:148`, `zod/v4/core/schemas.js:1086-1087`) and the compiled code is
  created at `zod/v4/core/compile.js:167-171`. No `Content-Security-Policy` is configured anywhere
  in the workspace — `apps/studio/vite.config.ts` sets only `Cross-Origin-Opener-Policy` and
  `Cross-Origin-Embedder-Policy` — so the JIT path is not blocked today. If a strict CSP without
  `unsafe-eval` is ever adopted, the mitigation is one call: `z.config({ jitless: true })`, which
  removes the `Function` constructor entirely.
- **Where the package already stands:** `zod@4.5.4` is already in the lockfile
  (`pnpm-lock.yaml:3329`, with an empty dependency set at `:6286`), pulled in at runtime by the
  Remotion 4.0.538 family — `@remotion/elevenlabs` (`:4581`), `@remotion/media` (`:4604`),
  `@remotion/openai-whisper` (`:4617`), `@remotion/studio-protocol` (`:4673`) and
  `@remotion/studio` (`:4709`) — reached from the workspace through `@remotion/bundler`
  (`:4509`), which the root manifest declares as a devDependency (`:11`). The `remotion` package
  itself carries `zod` only under `devDependencies`; the runtime edge comes from the packages
  around it. No workspace package declares `zod`: the lockfile's `importers:` section has no
  `zod` entry, and `require.resolve('zod')` from `packages/core` and from `apps/studio` fails with
  `MODULE_NOT_FOUND` unless `NODE_PATH` is set. Declaring it changes three things and nothing
  else: `packages/core/package.json` gains the pinned dependency, the lockfile gains a
  `packages/core` importer entry pointing at the identical resolved store entry — no second
  download, no version skew — and `zod` becomes resolvable by name from `packages/core` instead of
  by accident of hoisting.
- **How it improves on what existed:** the persisted document is validated by a schema that mirrors
  the domain types instead of by a list of ad-hoc `typeof` checks
  (`packages/components/src/project-migrate.ts:88-101`). A schema violation is reported with a
  path to the offending field rather than as a flat message, and the same schema can be reused at
  every boundary the architecture names — JSON import, archive, CSV and the SQLite RPC payloads
  (`docs/architecture/TECHNICAL_ARCHITECTURE.md:482`) — instead of each boundary inventing its own
  checks. The schema is also the only way `Clip.props` stops being `Record<string, any>`
  (`packages/core/src/schemas.ts:83`).
- **Exit strategy:** Zod is confined to one module in `packages/core` that exports plain validator
  functions and plain result types. Every consumer — the migration in `packages/components`, the
  storage port, the editor — calls a plain function and never names a Zod symbol. Leaving Zod is a
  rewrite of that one module plus the removal of one `package.json` entry; the persisted JSON
  format, the migration's history-dependent behaviour and every caller stay as they are.

## The two v4 surfaces

Both surfaces were measured against the four capabilities this slice needs.

| Capability | Classic (`zod`, `zod/v4`) | Mini (`zod/mini`, `zod/v4/mini`) |
|---|---|---|
| Discriminated unions | `z.discriminatedUnion` present | `z.discriminatedUnion` present |
| Refinements | `z.refine` and the instance method `.refine()` / `.superRefine()` | `z.refine` and `z.check` exist, but there is no `.refine()` instance method; `.check()` requires check objects, not a raw function |
| `safeParse` | present | present |
| Inferred types | `z.infer` present, and the schema type is `z.ZodType` | `z.infer` present, but the schema type is `ZodMiniType`, not `ZodType` |
| Instance methods available | `.refine`, `.superRefine`, `.transform`, `.pipe`, `.optional`, `.nullable`, `.default`, `.catch`, `.describe`, `.strict`, `.extend`, `.partial`, `.pick`, `.omit`, `.merge`, `.keyof`, `.catchall`, `.readonly` | none of them — measured as `undefined` on a schema instance |
| String helpers | `.min`, `.max`, `.email`, `.url`, `.uuid`, `.regex`, `.trim`, `.toLowerCase`, `.nonempty` | none of them; only the top-level `z.minLength`, `z.maxLength` and check functions |
| Top-level helpers | `z.preprocess`, `z.default`, `z.extend`, `z.optional`, `z.catch`, `z.transform`, `z.pipe`, `z.int`, `z.positive`, `z.strictObject` | `z.extend`, `z.optional`, `z.catch`, `z.transform`, `z.pipe`, `z.int`, `z.positive`, `z.minLength`, `z.maxLength`, `z.strictObject` are present; `z.preprocess` and `z.default` are absent |
| Bundle, full schema, namespace import | 94,496 raw / 26,688 gzip | 24,932 raw / 7,871 gzip |

**Chosen: the classic surface.** Three reasons, in order of weight:

1. **ADR-003 already names `z.ZodType<Props>`**
   (`docs/decisions/ADR-003-COMPONENT-SYSTEM.md:48`). Mini's schema type is `ZodMiniType`. Using
   mini means the component contract is written against a different type than the one already
   agreed, and the component-contract field is exactly where the schemas are headed.
2. **The mini surface has no instance methods.** Measured on a schema instance: `.refine`,
   `.transform`, `.pipe`, `.optional`, `.nullable`, `.default`, `.catch`, `.describe`, `.strict`,
   `.extend`, `.partial`, `.pick` and `.omit` are all `undefined` in mini and all present in
   classic. The schema layer needs `.optional()`, `.default()` and `.refine()` on the schemas
   themselves — a nullable optional field, a defaulted field, a cross-field invariant on a series
   — and mini expresses those as top-level function calls with a different shape. Classic is the
   API the schemas read like the TypeScript they mirror.
3. **The bundle difference does not justify the second dialect.** 18,817 gzip bytes on a
   972,773-byte main chunk, in exchange for a different type name and a different authoring style
   for every schema in the codebase.

**Entry point: `zod/v4`, imported as a namespace.** `import * as z from 'zod/v4'` is pinned to the
v4 API even if a future Zod 5 changes what the package root exports; the measured size is
identical to the root import (94,496 raw / 26,688 gzip for both). The namespace import is required
for tree-shaking — see decision 4.

**TypeScript check.** `import * as z from 'zod/v4'` with `z.infer<typeof schema>` and
`z.ZodType<Shape>` typechecks under `module`/`moduleResolution: nodenext` with `tsc` exiting 0.

## The migration boundary

`packages/components/src/project-migrate.ts` is not replaced by Zod. It is split, because its two
halves know different things.

### Moves to Zod, in `packages/core`

- **The project document shape at schema version 2**: `schemaVersion`, `name`, `width`, `height`,
  `fps`, `durationInFrames`, `backgroundColor`, `tracks[]`, `clips[]`, `effects[]` — the shape
  defined in `packages/core/src/schemas.ts:76-108`, plus the series registry ADR-007 introduces.
- **Clip fields**: `id`, `name`, `element`, `from`, `durationInFrames`, `props`, `effects`, and the
  optional `groupId` and `propsVersion`
  (`packages/core/src/schemas.ts:76-89`, `:83`, `:88`).
- **`EffectInstance`** (`packages/core/src/schemas.ts:70-74`).
- **`SeriesSpec`**: `id`, `origin`, `timeBasis`, and bars carrying `id`, `t`, `o`, `h`, `l`, `c`.
- **The element-spec discriminated union** by `kind`, as ADR-007 defines it.
- **The numeric and structural checks that are currently inline** in the migration
  (`packages/components/src/project-migrate.ts:88-101`): positive `fps`, `width`, `height`,
  `durationInFrames`, and the `tracks` array shape. These become schema constraints, and a
  violation is reported with the path of the offending field.

### Stays hand-written, in `packages/components/src/project-migrate.ts`

- **Schema-version gating.** `CURRENT_PROJECT_SCHEMA_VERSION` (`:21`) and the rejection of a
  higher version (`:92-93`). This is a comparison against a constant, not a shape.
- **Unknown component type rejection**, via `getComponent` (`:37-38`). The set of valid component
  types is the component registry (`packages/core/src/registry.ts:13`), which a static schema
  cannot consult. The registry, not the schema, decides what exists.
- **The clip `propsVersion` versus the definition's version check** (`:40-44`). Same reason: the
  authoritative version lives on the component definition
  (`packages/components/src/trading/definitions/candlestick-chart.ts:28`).
- **Default filling** (`:48-58`, `:67-72`, `:104-114`). Filling a missing `id` or coercing a
  legacy field is a transform, not a validation.
- **Non-destructiveness and idempotence.** The migration preserves unknown keys and is safe to run
  twice; a schema that rejects unknown keys would break the first, and a schema that coerced would
  break the second.

The order of operations is unchanged in shape: the migration normalises the document first, and
the Zod schema validates the normalised result. Unknown keys in the project document are kept —
the schema is loose about them — so that a document written by a newer version of the app is not
silently truncated on load.

### Not migrated in this slice

- **Per-component props schemas.** ADR-003's `propsSchema: z.ZodType<Props>` is not added to
  `VideoComponentDefinition` (`packages/core/src/contract.ts:83-124`) in this slice. Clip `props`
  stays `Record<string, any>` on the type level and is validated as an unconstrained record.
- **The effect and easing catalogue.** The parameter vocabulary in
  `packages/components/src/base/effects.ts:7-55` and the effect registry (`:68`) stay as they are.
- **CSV import boundary validation.** There is no importer.
- **SQLite RPC payload schemas.** The storage port
  (`packages/editor/src/storage/types.ts:96-125`) keeps its own contract in this slice.
- **Archive (`.chartstudio`) manifest validation.** There is no archive implementation.
- **Market maths.** `packages/core/src/market.ts` is numeric code, not a schema.

## Package placement

- **`packages/core` declares `zod@4.5.4`** (exact). It owns the domain schemas and the validator
  functions, and it is the only package that names a Zod symbol.
- **`packages/core` stays free of React, Remotion, Zustand and storage at runtime.** Its only
  React contact is the type-only import at `packages/core/src/contract.ts:1`
  (`import type React from 'react'`), with `react` and `@types/react` as devDependencies; there is
  no runtime import of React, Remotion, Zustand or storage code in
  `packages/core/src/index.ts:1-5` or anywhere in `packages/core/src`. Zod adds none of those
  couplings.
- **No other package declares Zod in this slice.** `packages/components`, `packages/ui`,
  `packages/editor`, `packages/video` and `apps/studio` call the plain validator functions.
  `packages/components` declares Zod in the later slice that adds component props schemas, because
  pnpm's per-package resolution means a package that constructs a schema must declare the
  dependency itself.
- **Cross-package imports keep using package names and `workspace:*`.** No path alias crosses a
  package boundary.

## What changes

- **`packages/core` gains a dependency and a schema module.** The domain types
  (`packages/core/src/schemas.ts`) gain runtime counterparts; the module exports plain validators
  and plain result types.
- **The persisted document is validated by a schema** rather than by the ad-hoc checks at
  `packages/components/src/project-migrate.ts:88-101`.
- **Schema version 2 is expressed as a schema**, matching ADR-007's decision 6.

## What this does not change

- **The migration's behaviour.** History-dependent rejections, default filling, non-destructiveness
  and idempotence are unchanged.
- **The component registry's rules** (ADR-003). Registration is untouched.
- **The local-first invariant.** No network call, login or server is required to edit, save, preview
  or export. Zod is a validator, not a service.
- **The persisted format.** Documents remain plain JSON. No Zod encoding, no schema hash and no
  version marker beyond the existing `schemaVersion`.
- **Every existing rendered frame.** Nothing in this decision changes the render path.
- **`packages/core`'s purity.** It still imports no React, Remotion, Zustand or storage code at
  runtime.

## Alternatives considered

| Approach | Advantage | Problem | Decision |
|---|---|---|---|
| Keep hand-written `typeof` checks and extend them per field | No dependency; total control | Grows with every field; reports no path to the offending value; duplicates the type definitions the compiler already checks | Reject |
| Adopt the **mini** surface (`zod/mini`) | 18,817 gzip bytes smaller on the representative schema | No instance methods — `.optional()`, `.default()`, `.refine()` and the string helpers are all absent; the schema type is `ZodMiniType`, not the `z.ZodType` ADR-003 already names | Reject |
| Use a **named `z` binding** (`import { z } from 'zod'`) | The idiomatic import form | Retains the entire classic namespace including the locale message payload: 434,121 raw / 87,106 gzip against 94,496 / 26,688 for the namespace import | Reject |
| Import `zod/v4/classic` | Names the surface explicitly | Not an exported subpath in 4.5.4; resolution fails | Reject |
| Use `valibot`, `arktype` or `typebox` instead | Comparable or smaller bundle cost | A second dialect with no precedent in the repo; ADR-002 already shortlisted Zod (`docs/decisions/ADR-002-DEPENDENCY-ADOPTION.md:18`); ADR-003 already names `z.ZodType` | Reject |
| Put the schemas in `packages/components`, next to the migration | The migration and the schema live together | The domain types live in core (`packages/core/src/schemas.ts`), the editor and the render path both need the schema, and the renderer must not import the components package | Reject |
| Declare Zod in every package that validates something | No hidden dependency | Every consumer would then depend on Zod's types, which is what the plain-result boundary exists to prevent | Reject |
| **Classic surface, namespace import, Zod confined to one module in `packages/core`, plain validator functions across the boundary** | One dialect; `z.ZodType`; instance methods; one dependency in one package; 26,688 gzip bytes measured | One runtime dependency in a package that had none | **Select** |

## Exit strategies

| Introduced thing | How it leaves |
|---|---|
| The `zod` dependency in `packages/core` | Remove one entry from `packages/core/package.json` and rewrite the schema module. Nothing else imports Zod. |
| The domain schema module | One file. Its exports are plain functions and plain types, so callers do not change when its internals do. |
| The plain validator result shape | It is core's own type, not Zod's `SafeParseReturnType`, so replacing the validator does not ripple. |
| The `propsSchema` field ADR-003 anticipates | Not added in this slice; when it is, it is an optional field on the definition, and removing it is a deletion. |
