# Compact two-row top bar

Approved by the user on 2026-10-31: implement the recommended two-row arrangement, compact and clean.

The first row contains brand, editable project name, New/Open/Save/Save As, then Help, Theme and storage status last. The second row contains Undo/Redo, format settings, Still and the primary Export MP4 action. Keep Back to start in playback controls. Remove the decorative project chevron and move the version to Help.

Approaches considered: always-visible file actions, an always-collapsed File menu, and responsive file actions. The user subsequently requested desktop-only controls, wider composition fields, and friendlier duration controls. The final design keeps all controls visible, uses 72px width/height inputs and 54px FPS/seconds inputs, and exposes explicit Fixed / From content duration modes. Seconds commit on blur/Enter; the duration slider and number input are disabled in From content mode. Use existing React, Tailwind and Radix controls. No new dependencies or changes to persistence, project schemas, or rendering. Relevant contracts: PR-002/PR-009 storage visibility, TL-009 duration controls; creator authoring and export workflow.
