# Backlog

## Next by plan
1. Stage 3: snap overlays (rings, lines) to the Blender body surface; today they follow the procedural body.
2. Blender body quality: boxy shoulders (deltoid caps), visible ledge where pelvis meets legs, rough hands.
3. Extend measurement keys: remaining 12 girths, then lengths and landmark heights (chestHeight, waistHeight, ...).
4. Stage 4: load time and phone check with the Blender body.

## Known gaps / follow-ups
- Blender body (beta switch in the customizer) drives only totalHeight, neck, chest, waist, hip.
- Blender body ignores the anime cel shader, hair, face and head display modes; it uses one physical material.
- Height key stretches ankle..neck base; hands stretch with it by a few percent.
- CAS style keys are off by default (`--cas-keys`); they are not calibrated and would change girths.
- `scripts/profiles/sims_*_default.json` use pre-normalisation heights (about 1 mm off); still within tolerance.
- Generator warns: `Material.use_nodes` will be removed in Blender 6.0.
- Blender MCP requests time out while the owner's Blender is open with an unsaved scene; headless Blender works.
- No JS tests yet; only `npm run lint` (tsc) and build. `gh` CLI is not installed (PRs are opened by the owner).
