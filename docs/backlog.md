# Backlog

## Next by plan
1. Stage 2 / PR 2: generator takes a measurement profile JSON, works in Blender 5.3, compensates bust/glute bumps.
2. Stage 2 / PR 2: calibrate shape keys in cm (+ calibration table JSON next to the GLB).
3. Stage 2 / PR 2: site loads the GLB behind a "Blender model (beta)" switch and sets morph weights from measurements.
4. Stage 2 / PR 2: verify 3 profiles (female, male, extreme) with `scripts/measure_glb.py`, tolerance 0.5 cm.
5. Stage 3: snap overlays to the GLB surface.

## Known gaps / follow-ups
- Site does not load `public/models/*.glb` yet (no `useGLTF` in `src/`); 11 MB ships to Pages unused until PR 2.
- Baseline (docs/reports/baseline.md): chest +1.3..+3.5 cm, hip +2.7..+4.4 cm, male waist −0.55 cm vs generator targets.
- Feet float 1.5 mm above the floor in both GLBs (height −0.15 cm).
- Remaining 12 girths and all lengths are not measured yet; extend `scripts/profiles/*.json` after stage 2.
- Blender MCP requests time out while the owner's Blender is open with an unsaved scene; headless Blender works.
- README has broken encoding (mojibake in the title dash) — re-save as UTF-8.
- No tests yet; only `npm run lint` (tsc) and build. `gh` CLI is not installed (PRs are opened by the owner).
