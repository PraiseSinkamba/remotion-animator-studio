# Documentation map

This documentation set is an **expanded revision of the v1.1 brainstorming candidate**, with library research and agent-oriented work breakdowns. It is a **proposed v1.2 design**, not a claim that the app exists or that the design has been approved.

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

## Interpretation

- **Approved product direction (from conversation):** hybrid manual/real data, two animation modes, local-first, hierarchical scene timelines, Creator-ready media, 2–3 asset assisted SMT, synchronized MTF, SQLite preference, internal save + portable project files.
- **Proposed technical details pending sign-off:** Remotion-primary rendering, React SVG chart-object presentation, dnd-kit for timeline interactions, browser compatibility gates, SQLite VFS selection, exact MVP features and defaults.
- **Exploratory/deferred:** full tick playback, provider integration, cloud and advanced compositing.

This set avoids copying code/UI from ChartAnimator. Its workflows are original design proposals derived from creator goals, not verified reconstructions of ChartAnimator's private code or features.

## Design change procedure

For any change with schema, dependency or user-flow impact: add a short ADR, update normative acceptance IDs, revise affected scenarios/tests, then update roadmap. For implementation tasks, use Superpowers writing-plans only after design approval. Agents must follow root [`AGENTS.md`](../AGENTS.md).

## v1.3 component system decision

[ADR-003 — Source-owned Component System From Day One](decisions/ADR-003-COMPONENT-SYSTEM.md) records the three foundational layers: Remotion video runtime, Remocn source-owned general motion components, and custom trading video components required from R1.
