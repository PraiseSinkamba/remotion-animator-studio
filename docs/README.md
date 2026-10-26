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

## Interpretation

- **Approved product direction (from conversation):** hybrid manual/real data, two animation modes, local-first, hierarchical scene timelines, Creator-ready media, 2–3 asset assisted SMT, synchronized MTF, SQLite preference, internal save + portable project files.
- **Proposed technical details pending sign-off:** Remotion-primary rendering, React SVG chart-object presentation, dnd-kit for timeline interactions, browser compatibility gates, SQLite VFS selection, exact MVP features and defaults.
- **Exploratory/deferred:** full tick playback, provider integration, cloud and advanced compositing.

This set avoids copying code/UI from ChartAnimator. Its workflows are original design proposals derived from creator goals, not verified reconstructions of ChartAnimator's private code or features.

## Design change procedure

For any change with schema, dependency or user-flow impact: add a short ADR, update normative acceptance IDs, revise affected scenarios/tests, then update roadmap. For implementation tasks, use Superpowers writing-plans only after design approval. Agents must follow root [`AGENTS.md`](../AGENTS.md).

## v1.3 component system decision

[ADR-003 — Source-owned Component System From Day One](decisions/ADR-003-COMPONENT-SYSTEM.md) records the three foundational layers: Remotion video runtime, Remocn source-owned general motion components, and custom trading video components required from R1.
