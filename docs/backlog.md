# Backlog

## Next by plan
1. Realistic mode (PR 2): realistic bodies from the bundle (`--style realistic`, untested), exact response,
   extra keys (shoulder width, upper arm, thigh, calf), owner render checkpoint, mode switch Anime / Realistic.
   Goal from the owner: attractive mannequin with correct proportions that replaces the classic one.
2. Stage 3: snap overlays (rings, lines) to the Blender body; today they follow the classic body and mostly
   hide inside the new one (seen on the waist ring).
3. Extend measurement keys to the remaining girths, lengths and landmark heights.
4. Stage 4: load time and phone check.

## Known gaps / follow-ups
- Anime body drives only totalHeight, neck, chest, waist, hip; response strength lives in `STYLIZATION`
  in `scripts/blender_base_body_generator.py` (owner has not reviewed the tuned sizes yet).
- Anime body has no hair, face options or cel shader (classic only); eyes are plain dark spheres.
- Skin grain is very subtle at the default camera distance; not confirmed visible in a close-up.
- Camera framing hides part of the head behind the header for tall bodies.
- Male base body keeps an elbow crease from the source mesh.
- Height key stretches ankle..neck; hands stretch with it by a few percent.
- Old tube generator still writes `public/models/sims_*`; do not commit those files.
- Blender MCP requests time out while the owner's Blender is open with an unsaved scene; headless Blender works.
- No JS tests yet; only `npm run lint` (tsc) and build. `gh` CLI is not installed (PRs are opened by the owner).
