# Backlog

## Next by plan
1. **Open PR "all measures act on the body"** (branch `phase1-4-limbs`): part 1.4 (limbs, tailor's shoulder
   width), step A (9 more girths), step B (height levels, arm lengths, hands, feet), linked measures,
   user presets, UI clean-up. Waits for the owner's review of renders and the site.
2. Polish after that PR: explicit gluteal fold control, hand pose (fingers over the thigh in side view),
   male pelvis, anime breasts with strong sliders, loading time on phones.
3. **Body shape reference and UX (old stage 2)**: posture, belly type, one-click shape presets, limit hints,
   switch "Гладкий манекен / Анатомічні орієнтири", measurement rings (girths hug the body and show through
   it; lengths drawn at a distance).

## Known gaps / follow-ups
- Anime body barely reacts to limb measures (4 mm at the range end); decide with the anime response strength
  (35 %, cap 16 %), which the owner has not confirmed yet.
- Limits without a hint: female full bust 87–105 cm at underbust 75; thigh 85 with hip 96 makes legs overlap.
- Three measures fall 0.7–1.6 cm short only at the very end of their range when changed alone.
- Levels, lengths, hands and feet follow the change from the standard value, not absolute numbers; no ruler
  check exists for them (only "the body moves" in the audit).
- Linked measures move primary ones by simple rules (`linkedMeasures.ts`); surface arcs (rises, torso loop,
  front length over the bust) are approximated by height differences.
- Rings of the measurement overlay still use the old mannequin geometry.
- Body shape sliders are saved in view settings, not in the exported profile JSON.
- Blender bodies have no hair, face options, nipples or cel shader; realistic eyes are closed lids.
- Skin grain is very subtle at the default camera distance; not confirmed visible in a close-up.
- Camera framing hides part of the head behind the header for tall bodies.
- `models_src/*.glb` still carry per-key normals (3–4 MB each) until the next regeneration.
- Old tube generator still writes `public/models/sims_*`; do not commit those files.
- Blender MCP requests time out while the owner's Blender is open with an unsaved scene; headless Blender works.
- No JS tests yet; only `npm run lint` (tsc) and build.
