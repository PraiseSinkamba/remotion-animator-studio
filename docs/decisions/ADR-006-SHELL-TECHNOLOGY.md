# ADR-006 — The application shell stays a Vite SPA; Next.js is deferred

**Status:** Accepted · **Date:** 2026-10-28 · **Supersedes:** nothing · **Relates to:**
[ADR-002](ADR-002-DEPENDENCY-ADOPTION.md), [TECHNICAL_ARCHITECTURE §17](../architecture/TECHNICAL_ARCHITECTURE.md)

## Context

ADR-002 records the rule that Next.js is the preferred shell **if** static, client-only editor routes
can load the whole application — the editor UI, the Remotion bundles, the fonts, the SQLite WASM
binaries — offline, after one successful first visit. It adds the escape hatch: *if Next.js cannot meet
that without fragile server-side rendering, formally reassess a Vite + React SPA shell; the domain and
renderer packages must remain unchanged.*

`TECHNICAL_ARCHITECTURE.md` §17 says the same thing and asks for the reassessment to be escalated
explicitly rather than assumed.

The shell in this repository **is** a Vite SPA. It was built as one, it works as one, and its editor
routes are already static assets served from a plain file host with the two cross-origin-isolation
headers the SQLite OPFS worker requires. Moving to Next.js would mean re-establishing that the App
Router's hydration and routing do not break an offline refresh — a question ADR-002 deliberately leaves
open until it can be answered with evidence rather than optimism.

Three things have changed since ADR-002 was written, and they all point the same way:

1. **The domain is now separate from the shell.** The schemas, the component contract, the registration
   mechanism and the candle maths live in `packages/core`; the component catalogue in
   `packages/components`; the composition in `packages/video`. None of them import React, the shell, or
   the editor's runtime. The dependency direction runs from the shell *into* the packages, never the
   other way, so a shell swap cannot reach the domain.
2. **The repository now runs on pnpm with five packages** and a real package graph. The App Router's
   main advantage — bundling and routing across a monolith — is worth less here than it would have
   been, because the boundaries the shell would have provided now exist as declared dependencies.
3. **The Next.js upgrade path is not free.** The shell sits on React 18; a Next.js App Router requires
   React 19. The dependency and React upgrade is planned as its own pass, and moving the shell at the
   same time would put two large, independent changes in one step, where a failure in either is hard to
   attribute.

## Decision

**The application shell remains a Vite SPA, at `apps/studio`. Next.js is deferred.**

This is a formal reassessment under ADR-002 and `TECHNICAL_ARCHITECTURE.md` §17, not a silent
divergence. The shell is not frozen: it may be replaced later, and the packages are arranged so that
replacing it touches one package.

## Consequences

- **The offline-first requirement is met by the shell that exists.** The built application is a static
  bundle. After one successful load, the service worker or the host's cache holds the editor code, the
  Remotion chunks, the fonts and the SQLite WASM binaries. The two cross-origin-isolation headers are
  the only hosting requirement, and the development server already sends them.
- **The domain and renderer packages are unaffected by the decision.** ADR-002's condition — that the
  domain and renderer packages stay unchanged either way — is satisfied by construction.
- **The shell is the only thing a Next.js migration would touch.** The application imports the
  packages; the packages import nothing from the application. A migration replaces `apps/studio` and
  leaves `packages/core`, `packages/components`, `packages/ui`, `packages/editor` and `packages/video`
  alone.
- **Next.js is not ruled out.** The trigger to revisit is concrete: when the dependency and React
  upgrade pass lands, and a Next.js App Router prototype demonstrably survives an offline refresh with
  the SQLite WASM worker and the Remotion bundles — the same proof ADR-002 asks for — that prototype
  becomes the basis of a new ADR superseding this one.
- **The composition and the render path do not depend on the shell.** The export path bundles
  `packages/video/remotion` and runs in Node; it never loads the editor's HTML.

## What this decision does not change

- The local-first invariant. No network call, login or server is required to edit, save, preview or
  export.
- The Remotion-only video runtime. The shell change does not introduce a second video engine.
- The package boundaries. The five packages exist whether the shell is Vite or Next.js.
