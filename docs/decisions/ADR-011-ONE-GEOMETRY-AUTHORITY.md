# ADR-011 — One authority for an element's pose

**Status:** Accepted. The repair it records is implemented; this record explains what went wrong and
what now holds it in place.
**Date:** 2026-11-02
**Depends on:** [ADR-003 — Component System](ADR-003-COMPONENT-SYSTEM.md) (one object protocol),
[ADR-010 — Element edit model](ADR-010-ELEMENT-EDIT-MODEL.md) (how an element is picked and edited),
[Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md).
**Described in:** [Element system repair](../superpowers/specs/2026-11-02-element-system-repair-design.md).
**Findings:** [Element system and canvas selection review](../reviews/2026-11-02-element-system-review.md).
**Companion:** [Implementation plan](../superpowers/plans/2026-11-02-element-system-repair.md).

## What went wrong

A creator moved an element and its selection rectangle stayed where it had been. The element grew out
of its own box, and then the element could no longer be picked — the creator had to guess where the
stale rectangle was in order to select what was on screen.

## The immediate cause

The editor measured the rendered elements and cached the measurements so it would not measure on every
frame. The cache decided whether a measurement was still valid by comparing **how many** elements it
held:

```ts
if (previous.size === next.size) return previous;
```

Moving or resizing an element keeps the number of measured elements the same — so the normal case was
the one case the cache threw away. The rendered element moved; the measurement, the selection overlay
and the pick list did not. A second fault sat underneath it: the remaining equality check compared
width and height but never left and top, so an equal-sized translation was discarded too.

**The rule:** *a cache must compare what it caches, not how many entries it has.* A count is not a
content identity.

## The cause underneath it

The immediate bug was a cache. It existed because **there was no single answer to "where is this
element?"** — four of them, each describing part of the truth:

| Authority | What it described |
|---|---|
| the element's static props | where it was authored to be |
| a DOM measurement | the size its content happened to take |
| the registry's `bounds` callback | the box the component claimed |
| the animation effect pose | where it was at this frame |

The renderer used one mix of these; the editor used another. So the editor could agree with its own
selection rectangle and still disagree with the rendered element. The cache was not the disease; it was
the symptom that finally made it visible.

A related fault had the same shape: **the editor inferred what an element was from coincidences in its
data** — two points with the same x were treated as a line with a vertical constraint, and a
catalogue-wide props-version threshold was used to decide whether a clip's points were absolute. A
trend line that happened to be vertical could not have its end dragged sideways. The user's coordinates
were deciding what kind of tool the element was.

## What was done

One evaluation pipeline now answers the question, and the renderer, the picker and the handles all
consume it:

```text
validated project snapshot + scene frame
  → active clips in render order
  → resolved props + component evaluation + animation pose
  → local geometry + composition transform + capabilities
     ├─ Remotion renderer
     ├─ canvas picker (inverse-transform the pointer)
     └─ selection and handles (transform local geometry forward)
```

- **A shared frame pose.** The composition and the editor evaluate the same transform, so an element
  that is translated, scaled or rotated is picked and edited where it is drawn.
- **Content measurement caches size only.** A measurement says how big the content is; it never says
  where the element is. Position comes from the pose, so a move can never depend on a remeasurement
  succeeding.
- **Geometry comes from the component's declared capabilities.** Which points an element has, what a
  handle changes, and whether a corner scales uniformly are declared, not inferred from field names or
  from two points happening to line up.
- **Protection is enforced where the change happens.** A locked element is refused at the mutation
  boundary — including inside a group drag — not merely at the picking boundary.
- **Props are validated at load and at edit.** A malformed value is refused with an actionable message
  instead of being coerced into an invisible or broken element.

## The rules this leaves behind

1. **One authority for a pose.** If the renderer and the editor each compute where an element is, they
   will eventually disagree. Compute it once and share it.
2. **A cache compares its content.** Never its size.
3. **Measure size, not position.** A DOM measurement is an answer about layout, never about the scene.
4. **Never infer meaning from a coincidence.** A props version is not a coordinate space; two points
   sharing an x is not a constraint. Declare it or do not have it.
5. **A declared capability needs a test that it does what it promises** — not a test that it is listed.
   An inert handle is worse than no handle.
6. **Protect at the mutation boundary.** A lock that only stops the first click does not protect
   anything.
7. **A selection rectangle is a view of the element, never a second copy of it.** If it can disagree
   with what is drawn, it will.

## What this did not settle

The repair covered the correctness faults the review found. It did not close every gap the review named:
the component props contract still admits extension fields, the HTML element still accepts authored
markup through a documented safe subset rather than a sandbox, and the broader creator workflow, the
market-time alignment work and the full preview/export parity remain unverified. Those are recorded in
the review's completion record and in the roadmap's deferred list.
