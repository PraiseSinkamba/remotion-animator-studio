/**
 * Ambient declarations for the modules the verbatim upstream copies import.
 *
 * The upstream `typewriter.tsx` imports `Caret` from
 * `"@/components/remocn/caret"` and `useTypewriter` from `"@/lib/remocn-ui"`.
 * Both paths exist in the upstream Remocn repository, not in this app — the
 * adapted local copies live next to this file. These declarations let the
 * verbatim upstream copy typecheck unchanged against the vendored components.
 */
declare module '@/components/remocn/caret' {
  export { Caret } from './caret';
  export type { CaretProps } from './caret';
}

declare module '@/lib/remocn-ui' {
  export { useTypewriter } from './remocn-ui';
}
