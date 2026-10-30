# Chart generation — reference algorithm

`path-to-candles-advanced.ts` is the **authored reference implementation** of the candle generator
that Chart Studio's authored-path series use. It is the normative source for the algorithm; the
production port lives in `packages/core/src/path.ts`.

## What it is

A dependency-free TypeScript generator that turns a **path of anchors** into a realistic OHLCV
series. It combines a stochastic bridge with geometric Brownian motion:

- **Anchors pin the close exactly.** The price the creator places at an anchor is the price that
  bar closes at — the generated value is overridden at anchor indices.
- **Log-price Brownian bridges** between anchors, weighted by the local volatility, so the path
  wanders realistically between the anchors instead of running as a straight line.
- **Volatility clustering** from an AR(1) process: quiet stretches stay quiet, shocks raise
  volatility and then decay.
- **Regimes.** A leg whose drawn move is small next to the noise is classified as a `range` and
  mean-reverts around the line; anything else is a `trend`, optionally with a pause and a
  counter-trend retracement.
- **Intrabar Brownian bridges** that produce each bar's high and low by walking from the open to
  the close.
- Optional tick-size quantisation, and a volume **activity proxy** — not exchange volume.

The whole thing is seeded and reproducible: the same anchors, seed and settings always produce the
same bars.

## Relationship to the production code

The port in `packages/core/src/path.ts` changes exactly two things and nothing else:

| | Reference | Port |
|---|---|---|
| Seeding | numeric seed, own mulberry32 stream | the package's seeded PRNG (`hashString` + `createRng`), extended with a Box–Muller normal and an integer draw |
| Output | `Candle[]` with `time` / `open` / `high` / `low` / `close` / `volume` | `OhlcBar[]` with `id` / `t` / `o` / `h` / `l` / `c` / `v?`, plus the per-segment diagnostics |

Everything else — the validation, the volatility series, the regime classification, the guides,
the bridges, the quantisation and the volume proxy — is carried over unchanged. A parity test
asserts the two produce **bit-identical** output for a fixed set of configurations, so any drift
between the reference and the port fails the build.

## Why it is kept here

`docs/reference/` is the repository's record of material whose exact form matters: the predecessor
design snapshot and the Remocn licence record. The generator's reference implementation belongs to
the same category. It is **not** bundled, not imported by the application, and not edited as part
of the port — the port is a copy that is proved equal by test.

`path-to-candles-lab.html` is the interactive lab for the same algorithm: paste a path, watch the
series generate, export the result. It is a development aid and is not part of the application.

## Provenance

Authored in this repository by the project owner. The design that adopts it is
`docs/superpowers/specs/2026-10-29-chart-studio-authored-path-and-chart-elements-design.md` §3.3,
and the implementation plan is
`docs/superpowers/plans/2026-10-29-chart-studio-authored-path-and-chart-elements.md`.
