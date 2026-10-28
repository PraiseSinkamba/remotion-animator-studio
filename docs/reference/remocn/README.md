# Remocn upstream snapshot

A point-in-time copy of the Remocn catalogue and the documentation that describes how it
works, taken so that adoption decisions in this repository can be re-checked without
re-fetching the web.

**Fetched:** 2026-10-28 · **Source:** <https://remocn.dev> · **Licence:** MIT (upstream's own
words: *"Everything is MIT, and the code lands in your repo, not in `node_modules`."*)

## What is in here

| File | Bytes | What it is |
|---|---|---|
| `llms.txt` | 63,187 | The upstream doc index — 374 documentation pages across 21 sections |
| `llms-components.txt` | 117,125 | The **router table**: 328 installable components with upstream's own `Use for` / `Avoid for` guidance, natural length at 30fps, vibe tag, tier and dependencies |
| `registry.json` | 261,696 | The shadcn-style registry manifest — 438 items (432 `registry:component` + 6 `registry:lib`) with name, title, description, npm dependencies, `registryDependencies` and file targets |
| `docs/` | — | The pages the analysis depends on: installation, introduction, the curated component index, typography, transitions, ui-blocks, the two chart components, and the craft/motion guidance |

`docs/` is fetched as raw Markdown (`https://remocn.dev/docs/<page>.md`) and is upstream's
own prose — it is a snapshot, not our documentation.

## What is NOT in here

`https://remocn.dev/llms-full.txt` (1,378,409 bytes) is the full documentation corpus in one
file. It is not committed — it is derivable from `llms.txt`'s 374 links, and committing 1.4 MB
of prose to the repository buys nothing. Its sha256 is
`1cbef286f34d7fcb9b33f3c85a1a7fed11ff6ffc512ac37102c3b2fd33b9daba` if you need to prove the
copy you analysed against is the same one.

## Refreshing

```bash
R=docs/reference/remocn
curl -s -o $R/llms.txt https://remocn.dev/llms.txt
curl -s -o $R/llms-components.txt https://remocn.dev/llms-components.txt
curl -s -o $R/registry.json https://remocn.dev/r/registry.json
for p in getting-started/introduction getting-started/installation components typography \
         transitions ui-blocks craft/design-defaults craft/motion-principles \
         ui-blocks/animated-line-chart ui-blocks/animated-bar-chart; do
  curl -s -o $R/docs/$(echo $p | tr '/' '-').md https://remocn.dev/docs/$p.md
done
```

Snapshot sha256 at the time of the fetch:

```
89ca4c2a4909bab243ec0df0a6b56cd2636fc029c6e2356cf01a438fbfe9efff  llms.txt
901c38b61149651f8a9e8a02d95e6f34f45b06db427098ac5d7624a9a9664104  llms-components.txt
2a9b3c9b8e3fb7eecb06697b14a97ec8a34e2fc8ce7a00903c9692e32292d0bd  registry.json
```

## The model, in upstream's words

Remocn is a shadcn-style registry: the component **source** is copied into the project, and
it stays yours.

> "each component is a `.tsx` file copied into `components/remocn/` that you own and edit."
> — `docs/getting-started-introduction.md`

> "Either way the result matches `npx shadcn add`: the source lands in your project and is
> yours to edit." — `docs/getting-started-installation.md`

```bash
npx shadcn@latest init
npx shadcn@latest add @remocn/soft-blur-in
```

What upstream does **not** supply is the editor half: no inspector metadata, no typed props
schema, no provenance, no duration, no bounds. Every component we adopt needs a hand-written
registry definition on our side — see `src/motion-components/definition.ts` and
`src/motion-components/definitions/*.ts` for the three we already have.

## Where the analysis lives

`docs/architecture/REMOCN-CATALOGUE.md` — what the catalogue contains, how it maps onto our
own 23 elements and the 9 planned trading components, and what to mine and what to leave.

`docs/decisions/ADR-003-COMPONENT-SYSTEM.md` — the standing decision and its addendum.
