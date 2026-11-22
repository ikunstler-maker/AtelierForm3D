---
paths:
  - "scripts/**"
  - "public/**/*.glb"
---
# Blender rules
- Prefer `mcp__Blender__*` tools; `execute_blender_code` is last resort. Return dicts, not prints.
- Inspect first: `get_objects_summary`, then details. Never assume names or units.
- Set mode, active object and selection explicitly before each operator.
- Shape keys / modifiers: check user count before editing shared mesh data.
- Export GLB: +Y up, apply transforms, meters, include shape keys only if the app uses them.
- After export: verify size (≤ 6 MB), object count, and 3–5 key girths against the schema (±0.5 cm).
- Generator script must stay runnable headless: `blender -b -P scripts/blender_sims_human_generator.py`.
- Save a `.blend` backup before destructive steps; never overwrite the owner's open file without OK.
