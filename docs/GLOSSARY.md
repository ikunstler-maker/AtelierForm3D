# Glossary

| Term | Meaning | In code |
|---|---|---|
| Манекен / Mannequin | 3D body built from 50 measurements | `ParametricBody.tsx`, `public/*.glb` |
| Мірка / Parameter | one of 50 body measurements, cm | `src/data/measurementsSchema.ts` |
| Обхват / Girth | circumference measurement (ring overlay) | `MeasurementOverlays.tsx` |
| Fit Check | garment vs body comparison | `FitCheckPanel.tsx`, `src/utils/fitCalculator.ts` |
| Припуск / Ease | garment − body, cm; drives colors | `fitCalculator.ts` |
| Пласка мірка / Flat (×2) | half-girth measured on a flat garment | Fit Check mode toggle |
| Лінійка / Ruler | script that measures a GLB and compares with targets | `scripts/measure_glb.py` |
| Профіль мірок / Profile | JSON: heights, target values, tolerance for one body | `scripts/profiles/*.json` |
| Обхват стрічкою / Tape girth | convex hull length of a body slice, arms excluded | `tape_girth()` in `measure_glb.py` |
| Точка відліку / Baseline | first measurement of the existing models | `docs/reports/baseline.md` |
| Повзунок мірки / Measurement key | calibrated shape key `M_<name>`; weight 1 = known cm | generator, `BlenderBody.tsx` |
| Таблиця калібрування / Calibration | JSON: base girths + cm per unit weight per key | `public/models/*.calibration.json` |
| Режим «Аніме» / Anime mode | stylized Blender body; real measurements, softened response | `glassSettings.bodyModel = 'anime'`, `BlenderBody.tsx` |
| Режим «Реалістичний» / Realistic mode | exact body, ±0.5 cm on 9 driven measures; default | `glassSettings.bodyModel = 'realistic'`, `body_<gender>_realistic.glb` |
| Керовані мірки / Driven measures | measures a body follows: `girthOrder` in its calibration | realistic 9, anime 5 |
| Плечовий суглоб / Shoulder joint | point the arm rides on as one rigid piece | `joint_x`, `armShiftMPerUnit` in calibration |
| Класичний манекен / Classic | previous procedural mannequin | `glassSettings.bodyModel = 'classic'`, `ParametricBody.tsx` |
| М'який перерахунок / Stylization | share of the difference from base size the anime body follows | `stylization` in calibration, `effectiveBodyTargets()` |
| Базова модель / Base mesh | CC0 body from Blender Studio Human Base Meshes | `assets/human-base-meshes/` (not in git) |
| Набір світла / Lighting preset | key, fill, rim, ambient ratios + sliders | `LIGHTING_PRESETS` in `useAtelierStore.ts` |
| GLB | binary 3D model file exported from Blender | `public/` |
| Shape key | Blender morph target to change body shape | generator script |
| Blender MCP | connector that lets Claude control Blender | `mcp__Blender__*` |
