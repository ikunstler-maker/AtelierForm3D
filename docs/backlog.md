# Backlog

## Next by plan
1. Stage 1: connect GitHub remote, first push, check Pages deploy (needs repo URL from owner).
2. Stage 2: measurement-check script — load GLB in Blender, measure girths at schema heights, compare with input (±0.5 cm).
3. Stage 2: improve `scripts/blender_sims_human_generator.py` until the check passes for 3 profiles.
4. Stage 3: snap overlays to the GLB surface.

## Known gaps / follow-ups
- GLB location mismatch: `public/sims_*_mannequin.glb` vs empty `public/models/` — pick one.
- Generator header says Blender 4.x; installed is 5.3 — verify API compatibility.
- README has broken encoding (mojibake in the title dash) — re-save as UTF-8.
- No tests yet; only `npm run lint` (tsc) and build.
- Open Blender scene has `Sims_male_Body` — unknown if it is the latest source.
