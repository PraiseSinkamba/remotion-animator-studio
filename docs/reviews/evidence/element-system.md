# Element system regression evidence

The original defect-asserting diagnostic was retired after repair on 2026-11-02.
The [original review](../2026-11-02-element-system-review.md) preserves its observations.
Run these permanent correct-behavior tests from the repository root:

```powershell
node node_modules/vitest/vitest.mjs run apps/studio/src/components/element-interaction.test.tsx packages/editor/src/geometry.test.ts packages/editor/src/store.test.ts packages/components/src/registry.test.ts packages/components/src/element-pose.test.ts packages/components/src/project-migrate.test.ts packages/components/src/base/props-validation.test.ts packages/components/src/base/safe-html.test.ts
node scripts/verify-element-repair.mjs
node scripts/verify-r1.mjs
```

The browser script mounts the actual app, injects a labelled synthetic fixture through normal
store APIs, then uses trusted CDP mouse events to move, deselect/reselect, resize and manipulate
posed geometry. It checks grouped locks, history, lifecycle, normal autosave/reload and actual
preview/export raster extents. It emits screenshots, project JSON and evidence JSON under
`out/element-repair/`. The R1 script separately renders stills and a complete H.264 MP4.

See [final verification record](element-repair-verification.md) for observed results and limits.
