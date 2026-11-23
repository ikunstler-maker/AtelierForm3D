# Backlog

## Next by plan
1. **Stage 1 — anatomy rework, both sexes** (owner: bodies must look naturally anthropometric). Before coding:
   check the "Еталон" column of `docs/LANDMARKS.md` against the ANSUR II Measurer's Handbook.
   - Math: smooth (C2) falloffs everywhere; find the cause of the horizontal line on the back at underbust
     level (not diagnosed yet); smoothing pass in transition zones.
   - Breasts: rounded apex (no cone), natural sag with size, small cups flatten instead of denting,
     separate parts: volume, attachment height, sag, upper fullness, root width, separation.
   - Glutes / hips / thighs: no angular "saddlebags", wider gluteal cheeks, gluteal fold on every size,
     shape sliders (projection, height, side roundness, widest-point height).
   - Whole body on large sizes: upper arm lump above the elbow, forearm, wrist, knee, lower leg, ankle,
     pinch behind the armpit, neck and jaw, belly forward (upper / lower), no notch under the breast fold.
   - Male: groove on the sternum, pelvis / groin, belly, glutes; profiles slim / athletic / heavy.
   - Pose: fingers must not cover the thigh outline in the side view.
   - Gate: contact sheet (female and male, 4 sides, slim / medium / large, 3 breast and 3 glute shapes,
     close-ups) approved by the owner; verify 20/20; audit without dead or drift rows.
   - Mesh can be denser now (compressed files are 0.2 MB of the 6 MB budget).
2. **Stage 2 — body shape reference and UX**: posture (lumbar curve, stoop, shoulder slope), belly type,
   one-click breast and body presets, limit hints, switch "Гладкий манекен / Анатомічні орієнтири",
   then measurement rings (girths hug the body and show through it; lengths drawn at a distance).
3. Connect the 40 measures the Blender bodies ignore (list in `docs/reports/slider_audit.md`).
4. Load time and phone check; loading indicator.

## Known gaps / follow-ups
- Anime body barely reacts to limb measures (4 mm at the range end); decide with the anime response strength
  (35 %, cap 16 %), which the owner has not confirmed yet.
- Limits without a hint: female full bust 87–105 cm at underbust 75; thigh 85 with hip 96 makes legs overlap.
- Three measures fall 0.7–1.6 cm short only at the very end of their range when changed alone.
- `shoulderWidth` is measured as body width at the shoulder line (close to bideltoid), not biacromial.
- Body shape sliders are saved in view settings, not in the exported profile JSON.
- Blender bodies have no hair, face options, nipples or cel shader; realistic eyes are closed lids.
- Skin grain is very subtle at the default camera distance; not confirmed visible in a close-up.
- Camera framing hides part of the head behind the header for tall bodies.
- `models_src/*.glb` still carry per-key normals (3–4 MB each) until the next regeneration.
- Old tube generator still writes `public/models/sims_*`; do not commit those files.
- Blender MCP requests time out while the owner's Blender is open with an unsaved scene; headless Blender works.
- No JS tests yet; only `npm run lint` (tsc) and build. `gh` CLI is not installed.
