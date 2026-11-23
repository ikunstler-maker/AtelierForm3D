# Backlog

## Next by plan
1. Shape fixes (owner, 2026-11-23): human bodies must look naturally anthropometric.
   - Breasts look pointed on some settings (large cup with low / teardrop / wide sliders): unrealistic.
   - Sharp vertical crease on the midline of the chest (male with muscle, large female size).
   - Slight dent near the midline on small cups (negative breast weight).
   - Buttocks shape needs work (owner request; details to be agreed in the plan).
   Start with a plan and a render checkpoint. Fast tuning loop: `dome_lab.py` idea (apply a formula to the
   finished GLB and render close-ups in seconds) instead of full regeneration.
2. Stage 3: measurement rings and lines on the Blender bodies. Owner: girth rings hug the body and stay
   visible through it; lengths and widths may be drawn at a distance, like dimension lines.
3. Extend measurement keys: upperChest (needs its own level, see decisions), other girths, arm and leg lengths,
   landmark heights.
4. Stage 4: load time and phone check. The body appears 3–9 s after page load locally; no loading indicator.

## Known gaps / follow-ups
- No one-click breast shape presets yet (planned in the bust PR, not done).
- No hint on the site when a measure hits its limit (full bust below the flat-chest minimum).
- Body shape sliders are saved in view settings, not in the exported profile JSON.
- Owner has not said whether the anime response strength (35 %, cap 16 %) is right; see `STYLIZATION`.
- Anime limbs keep their cartoon size: shoulder, upper arm, thigh, calf follow relative change only.
- Blender bodies have no hair, face options, nipples or cel shader; realistic eyes are closed lids.
- Skin grain is very subtle at the default camera distance; not confirmed visible in a close-up.
- Camera framing hides part of the head behind the header for tall bodies.
- GLBs are 2.9–4.4 MB each (15 shape keys with normals); limit is 6 MB.
- Generation: about 5 min per style (run both in parallel); `verify_profiles.py` about 3 min.
- Old tube generator still writes `public/models/sims_*`; do not commit those files.
- Blender MCP requests time out while the owner's Blender is open with an unsaved scene; headless Blender works.
- No JS tests yet; only `npm run lint` (tsc) and build. `gh` CLI is not installed.
