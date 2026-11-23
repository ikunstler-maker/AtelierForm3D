# Backlog

## Next by plan
1. Stage 3: snap overlays (rings, lines) to the Blender bodies; today they follow the classic body and mostly
   hide inside the new ones (seen on the waist ring in realistic and anime modes).
2. Extend measurement keys: the other 41 measures (remaining girths, lengths, landmark heights). Arm and leg
   lengths first: arms keep a fixed length today.
3. Anime body: decide whether it gets the 4 extra keys (shoulder, upper arm, thigh, calf); today it has 5.
4. Stage 4: load time and phone check (three GLBs of 2.2–2.6 MB each, loaded on demand).

## Known gaps / follow-ups
- Owner has not said whether the anime response strength (35 %, cap 16 %) is right; see `STYLIZATION`.
- Blender bodies have no hair, face options or cel shader (classic only); realistic eyes are closed lids.
- Skin grain is very subtle at the default camera distance; not confirmed visible in a close-up.
- Camera framing hides part of the head behind the header for tall bodies.
- Realistic bodies use multires level 0 (fine scan detail dropped to stay under 6 MB).
- Landmark definitions (shoulder line, upper-arm section) are ours; compare with the site's measurement
  descriptions when overlays are redone.
- Generation is slow (about 2.5 min per style); `verify_profiles.py` takes about 1 min.
- Old tube generator still writes `public/models/sims_*`; do not commit those files.
- Blender MCP requests time out while the owner's Blender is open with an unsaved scene; headless Blender works.
- No JS tests yet; only `npm run lint` (tsc) and build. `gh` CLI is not installed (PRs are opened by the owner).
