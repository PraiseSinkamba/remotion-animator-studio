# Verbatim Remocn source

These files are the unmodified upstream Remocn sources for the three components
we adopted: `marker-highlight`, `soft-blur-in` and `typewriter`, together with
the upstream files they depend on.

They are a **record, not application code**. They are outside every package's
`tsconfig.json`, they are never bundled, and they are not imported by anything
in `packages/`. The adapted copies live in `packages/components/src/motion/`,
and `packages/components/src/motion/PROVENANCE.md` records what changed in each.

The upstream licence is MIT and is kept at
`packages/components/src/motion/LICENSE.remocn`. The fetch date, the source URLs
and the sha256 hashes of the snapshot these came from are recorded in
`docs/reference/remocn/README.md`.

The original upstream import paths — `@/components/remocn/caret` and
`@/lib/remocn-ui` — refer to the upstream project's own layout, not this
repository's.
