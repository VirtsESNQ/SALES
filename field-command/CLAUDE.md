# Claude Code instructions for Field Command

Before modifying code, read `PROMPT.md`, `FIELD_COMMAND_DESIGN_KNOWLEDGE.md`, and `IMPLEMENTATION_PLAN.md`.

- This is an existing browser-based game. Preserve its current features, modes, and architecture unless evidence shows a focused refactor is necessary.
- Make one coherent, testable improvement per Ralph iteration. Do not stop at advice or a plan when implementation is possible.
- Inspect Git status/diff before and after editing. Never overwrite unrelated user work.
- Verify source definitions and call sites before changing core state such as ranges, orders, facing, morale, routing, and movement.
- Keep simulation rules authoritative and separate from visual effects. Keep 2D and 3D command semantics consistent.
- Run available checks and targeted tests; state clearly what was not tested. Never fabricate successful tests.
- Update `IMPLEMENTATION_PLAN.md` at the end of each iteration with the exact work, files, tests, limitations, and next task.
- Do not commit, push, deploy, or modify external services without explicit authorization.
- Use the companion design knowledge file for concrete implementation patterns and acceptance tests, but verify all examples against the current code.
