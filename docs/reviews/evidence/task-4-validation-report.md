# Task 4 report — EL-05 / EL-06

## Behavior and contracts

Added core-owned plain generic `PropsValidator<T>`, `createPropsValidator(defaults, params)` and `normalizeComponentProps(definition, raw)`. No Zod types/dependency escape core. The existing compatibility `ComponentProps` bag remains any-based; new boundaries use unknown, record narrowing and plain results. `VideoComponentDefinition.validateProps` is optional for backward-compatible registration callers; registration installs the metadata-derived validator when absent. All production catalogue definitions explicitly supply callbacks (base definition factory; drawing/domain callback; chart callback; motion/transition callbacks). Registry retains definition identity.

Known scalar/default fields validate types, finite numbers, positive geometric sizes, and declared select options, without treating inspector min/max as persisted hard limits. Font weights accept supported legacy numeric strings and normalize them to numbers. Recursive missing defaults merge named points/styles without discarding extensions. Wrong supplied fields do not become defaults. Nested chart panes/clocks and bar arrays use core domain validators; drawings use core drawing schemas. Base NodeTrail/CommitGraph validators parse JSON into unknown and validate encoded point/commit records and branch references, retaining the original authored JSON string.

Load validates versions before conversion, normalized known component props after conversion and the whole resulting project. Empty/duplicate clip IDs, invalid versions/lifetimes/effect scalars and malformed visibility/lock flags reject. Version 4 projects with explicit older drawing props versions migrate those components independently: old market-relative v1 goes through independent v2, then fractional v2 becomes absolute v3. Sparse authored props remain sparse in persisted migration output: default fills are runtime normalized through the same helper in load validation, canvas geometry, pose and composition. Full-document validator output is used as a check, never to strip unknown nested authored extension fields.

Legacy-only series bars lacking structural IDs receive `${series.id}:${index}`, matching existing series identity conventions. Market timestamps/prices/origins are unchanged; existing IDs survive. Current-version missing IDs reject. Regression proves raw input unchanged and migration idempotent. No project/schema version bump or SQLite/archive migration.

Props batches validate before accepting any project change; one invalid unlocked member rejects the entire batch, preserves project/history references and sets an actionable notice. Existing locked-member skip behavior remains. Timing edits validate full document, and timing shifts reject invalid frames atomically. New invalid-prop tests cover unchanged history/project and multi-object rejection.

HTML rendering uses `sanitizeStaticHtml(source)` with parse5 AST parsing and a strict static tag/style emitter. Authored `html` stays stored unchanged; the single shared HTML adapter sanitizes for preview/export. Active/foreign trees, navigation/resource attributes, CSS escapes/resource properties and arbitrary attributes are dropped; ordinary formatting/text/colors survive. See `docs/decisions/2026-11-02-PARSE5-ADOPTION.md` for exact parse5@7.3.0 adoption evidence, supported subset, licensing, bundle/security posture and exit strategy.

## RED / GREEN evidence

Commands run via installed tools; sandbox pnpm symlink realpath initially failed EPERM, so actual tests/typechecks used approved outside-sandbox execution.

- RED: `node node_modules/vitest/vitest.mjs run packages/components/src/base/safe-html.test.ts` failed because safe-html did not exist (after resolving sandbox EPERM).
- Initial integration RED: project-migrate/store run had 17 migration failures; preserving sparse props removed default-materialization compatibility differences; legacy structural IDs accounted for remaining 13 failures. Existing fixtures were preserved rather than edited to hide compatibility failures.
- GREEN: project migration + store focused run: 79 passed.
- GREEN: core props + safe HTML + project migration: 51 passed, including every registered default and legacy ID input immutability/idempotence.
- GREEN: props + safe HTML + store: 42 passed, including numeric font-weight compatibility, CSS/URL obfuscation and atomic invalid batches.
- RED: encoded data tests had 3 failures (malformed strings/point records previously accepted).
- GREEN: encoded data + project migration: 50 passed after definition-owned encoded-record validation.
- GREEN: current-project old drawing props migration: project-migrate suite 48 passed after adding explicit old-props regression.
- Full suite runs: first 547 passed / 4 failed (registry reference identity changed); fixed by preserving registry definition identity. Subsequent runs: 551 passed, then 557 passed, then 560 passed across 35 files. Final post-migration run recorded below.
- Typecheck: `node C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs typecheck` ultimately passed all 6 package/application tasks. Earlier typecheck caught renderer unknown position narrowing and migration callback implicit parameter typing; both fixed. Final post-migration run recorded below.
- No lint script exists. No browser/manual/render/build success claimed here; Task5 owns production build, real stills/MP4 and browser visual verification.

## Files / self-review

Core contract, registry, validation and index; new core component-props implementation/tests. Component base definitions/adapters/transitions, new safe-html implementation/tests and props-validation implementation/tests; chart/drawing and three motion definitions; project migration/tests; shared element pose. Editor store/tests; studio canvas-hit-test; video composition. Components manifest and pnpm lockfile exact parser dependency; dependency adoption record and this task report.

Self-review checked: input immutability, domain-validator stripping risk, atomic batches/locks, registry object identity, partial named-point fills, shared renderer/geometry normalization, current project/old component migration, legacy-only ID repair, parser output escaping and exclusion of all URL-bearing attributes. No new any was introduced. No predecessor reference docs changed.

## Limitations

Static HTML deliberately supports a narrow formatting subset; arbitrary CSS/layout/media are omitted and raw source is retained. Parser cost is real; production bundle size will be measured by Task5 rather than guessed. No vulnerability audit was run. Legacy components still expose compatibility any-based props to old render adapters; new validators provide runtime checks but this is not a full static-type rewrite. Unknown extension fields are retained; validation covers known scalar/domain/encoded fields, not invented future extension semantics. Browser/render verification remains a final integration requirement.

## Final observed gates

- `node node_modules/vitest/vitest.mjs run` — exit 0; **35 files, 561 tests passed**, 35.28 seconds, final source including independent old-props migration.
- `node C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs typecheck` — exit 0; **6 successful / 6 total**, 5 cached, 26.092 seconds.
- `git diff --check` — exit 0, no whitespace errors (only Windows LF/CRLF informational warnings).

## Review fix round 1 (base bd956ae)

Addressed both Important findings in task-4-review.md. Migration now receives the source schema version through track/clip conversion. Current documents require track identity/name, clip name/timing/props/effects, and project name/backgroundColor before normalization. Supplied wrong IDs/names/structural types reject in both current and legacy documents; only absent supported legacy fields retain existing defaults. Clip props/effects and timing type guards already rejected wrong supplied values; added explicit current/legacy regressions to prove this. Chart scalar validation now uses its declared params, rejects unsupported revealMode, and applies a positive framesPerBar domain constraint without imposing inspector maximums.

RED command: `node node_modules/vitest/vitest.mjs run packages/components/src/project-migrate.test.ts packages/editor/src/store.test.ts` — exit 1; **3 failed / 84 passed**, 2 failing files, 5.10 seconds. Failures were current malformed/missing track IDs being accepted, unsupported chart load values accepted, and unsupported chart mutation changing the project.

GREEN command: `node node_modules/vitest/vitest.mjs run packages/components/src/project-migrate.test.ts packages/core/src/component-props.test.ts packages/components/src/base/props-validation.test.ts packages/components/src/trading/candlestick-chart.test.tsx packages/editor/src/store.test.ts` — exit 0; **5 files / 173 tests passed**, 11.14 seconds. Includes added supplied malformed props/effects/from/duration checks under schemas 1 and 4, current missing required-field rejection and permitted legacy missing track identity/default-name compatibility. Earlier focused run before those last two tests also passed 171 tests.

Affected typechecks: `node C:/Users/4004/AppData/Local/node/corepack/v1/pnpm/10.28.2/bin/pnpm.cjs --filter @chart-studio/components --filter @chart-studio/editor --filter @chart-studio/video --filter @chart-studio/studio typecheck` — exit 0; all four workspace projects reported Done, including video script syntax checks.

Self-review: read final migration/chart diff; checked version propagation and legacy defaults, atomic notice behavior, absence of broad inspector range enforcement and new dependency/schema changes. `git diff --check` exited 0 (only LF/CRLF informational warnings). No full suite/build/browser/render rerun in this fix round; Task5 owns the final integration gates. Files: project-migrate.ts/test, candlestick-chart definition, store.test.ts and existing task report. No new scratch report created.
