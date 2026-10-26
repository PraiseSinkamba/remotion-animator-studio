/**
 * Supporting shim for the verbatim upstream copies in this folder.
 *
 * The upstream file `remocn-ui-timeline.ts` imports `Step` from `"./types"`,
 * because upstream keeps `lib/remocn-ui/timeline.ts` next to
 * `lib/remocn-ui/types.ts`. Vendoring renamed the type file to
 * `remocn-ui-types.ts` (so the two vendored files are distinguishable at a
 * glance), which breaks that relative import.
 *
 * This file restores the resolution without touching the verbatim copies: it
 * re-exports the same `Step` type from `remocn-ui-types.ts`.
 */
export type { Step } from './remocn-ui-types';
