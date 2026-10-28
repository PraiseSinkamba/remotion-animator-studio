# Documentation map

This documentation set began as an **expanded revision of the v1.1 brainstorming candidate**, with library research and agent-oriented work breakdowns. The application now exists in this repository and has moved ahead of parts of the v1.2 design; where a document names a path, read the equivalent directory in the tree. The implementation records below cover the slices that have landed.

## Start here

1. [`design/PRODUCT_DESIGN.md`](design/PRODUCT_DESIGN.md) — user experience, editing philosophy and interface behaviors.
2. [`spec/FUNCTIONAL_SPEC.md`](spec/FUNCTIONAL_SPEC.md) — normative functional requirements (`PR`, `MD`, `CH`, `SM`, `TF`, `TL`, `SC`, `OB`, `EX`, `QA` IDs).
3. [`architecture/TECHNICAL_ARCHITECTURE.md`](architecture/TECHNICAL_ARCHITECTURE.md) — APIs, boundaries, persistence, schemas and rendering.
4. [`features/FEATURE_CATALOG.md`](features/FEATURE_CATALOG.md) — testable surface area and priorities.
5. [`scenarios/VIDEO_SCENARIOS.md`](scenarios/VIDEO_SCENARIOS.md) — example videos and complete authoring journeys.
6. [`roadmap/ROADMAP.md`](roadmap/ROADMAP.md) — staged sequence, cross-team contracts, gates and release definition.
7. [`decisions/ADR-001-VIDEO-STACK.md`](decisions/ADR-001-VIDEO-STACK.md) — Remotion / remocn / framecn investigation and fallback conditions.
8. [`decisions/ADR-002-DEPENDENCY-ADOPTION.md`](decisions/ADR-002-DEPENDENCY-ADOPTION.md) — reusable packages, paid starter consideration, Next.js offline strategy.
9. [`quality/TEST_STRATEGY.md`](quality/TEST_STRATEGY.md) — fixtures, acceptance suites, source-integrity and performance.
10. [`reference/chart-studio-design-v1.1.md`](reference/chart-studio-design-v1.1.md) — unmodified original design snapshot.

## Implementation records

11. [`decisions/ADR-004-STORAGE-PORT.md`](decisions/ADR-004-STORAGE-PORT.md) — why persistence sits behind one interface and what the SQLite backend costs.
12. [`decisions/ADR-005-SHADCN-AND-TAILWIND.md`](decisions/ADR-005-SHADCN-AND-TAILWIND.md) — the editor control layer: Tailwind v4 and shadcn/ui, what they cost and how to leave them.
13. [`superpowers/specs/2026-10-26-chart-studio-shadcn-design.md`](superpowers/specs/2026-10-26-chart-studio-shadcn-design.md) — the approved design for the shadcn adoption and the Remocn expansion.
14. [`superpowers/plans/2026-10-26-chart-studio-shadcn.md`](superpowers/plans/2026-10-26-chart-studio-shadcn.md) — the implementation plan for that slice, task by task.
15. [`superpowers/plans/2026-10-25-chart-studio-scaffold.md`](superpowers/plans/2026-10-25-chart-studio-scaffold.md) — the scaffold plan: the project document, the registry and the first components.
16. [`superpowers/plans/2026-10-26-chart-studio-storage.md`](superpowers/plans/2026-10-26-chart-studio-storage.md) — the persistence plan: the storage port, the SQLite backend and the contract suite.
17. [`superpowers/specs/2026-10-27-chart-studio-cinema-shell-design.md`](superpowers/specs/2026-10-27-chart-studio-cinema-shell-design.md) — the design for the cinema shell, the two modes and the repaired primitives.
18. [`superpowers/plans/2026-10-27-chart-studio-cinema-shell.md`](superpowers/plans/2026-10-27-chart-studio-cinema-shell.md) — the implementation plan for that slice.
19. [`superpowers/specs/2026-10-28-chart-studio-platform-and-catalogue-reorganisation-design.md`](superpowers/specs/2026-10-28-chart-studio-platform-and-catalogue-reorganisation-design.md) — the design for the pnpm workspace, the five packages and the three component families.
20. [`superpowers/plans/2026-10-28-chart-studio-platform-restructure.md`](superpowers/plans/2026-10-28-chart-studio-platform-restructure.md) — the implementation plan for that restructure, task by task.
21. [`decisions/ADR-006-SHELL-TECHNOLOGY.md`](decisions/ADR-006-SHELL-TECHNOLOGY.md) — the application shell stays a Vite SPA; Next.js is deferred, with the trigger to revisit.

## Records without a written plan

The 2026-10-28 storage hardening landed without a plan or a spec of its own: saving when the page goes
away with a warning before leaving, autosave during a long edit rather than only after it stops, and
validating a restored project before loading it while recording the component version each clip was
written with. The audit trail for those changes is in
[`architecture/UPSTREAM_AUDIT.md`](architecture/UPSTREAM_AUDIT.md).

## Interpretation

- **Approved product direction (from conversation):** hybrid manual/real data, two animation modes, local-first, hierarchical scene timelines, Creator-ready media, 2–3 asset assisted SMT, synchronized MTF, SQLite preference, internal save + portable project files.
- **Proposed technical details pending sign-off:** Remotion-primary rendering, React SVG chart-object presentation, dnd-kit for timeline interactions, browser compatibility gates, SQLite VFS selection, exact MVP features and defaults.
- **Exploratory/deferred:** full tick playback, provider integration, cloud and advanced compositing.

This set avoids copying code/UI from ChartAnimator. Its workflows are original design proposals derived from creator goals, not verified reconstructions of ChartAnimator's private code or features.

## Design change procedure

For any change with schema, dependency or user-flow impact: add a short ADR, update normative acceptance IDs, revise affected scenarios/tests, then update roadmap. For implementation tasks, use Superpowers writing-plans only after design approval. Agents must follow root [`AGENTS.md`](../AGENTS.md).

## v1.3 component system decision

[ADR-003 — Source-owned Component System From Day One](decisions/ADR-003-COMPONENT-SYSTEM.md) records the three foundational layers: Remotion video runtime, Remocn source-owned general motion components, and custom trading video components required from R1.
