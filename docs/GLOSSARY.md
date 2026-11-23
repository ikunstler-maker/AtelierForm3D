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
| Повзунок форми / Shape slider | changes the form, not the tape measures (`S_<id>` keys) | `BODY_SHAPE_SLIDERS`, `shapeKeys` in calibration |
| М'язова маса / Muscle | shape slider: lats, pecs, deltoids, forearms, glutes, quads | `S_muscle` |
| Купол грудей / Breast dome | smooth bump the full-bust key grows on each breast | `breast_dome()` in the generator |
| Зсув глибини / Depth bias | where a girth key puts its depth: front (belly) or back (glutes) | `DEPTH_BIAS` in the generator |
| Грудна стінка / Chest wall | surface under the breast, found by relaxing the breast region; small busts flatten to it | `breast_fields()`, key `M_chestFlat` |
| Складка під грудьми / Fold | lower edge of the breast; the underbust tape lies just below it | `fold_z` |
| Крива мірки / Measure curve | weight → cm table for a measure that is not a straight line (female bust) | `curveKeys` in calibration |
| Аудит повзунків / Slider audit | sweep of every slider: what moves, what the ruler reads | `scripts/audit_sliders.py`, `docs/reports/slider_audit.md` |
| «Ще не діє» / Not on model | measure the Blender bodies do not follow yet | `BLENDER_BODY_MEASURES`, tag in `MeasurementsPanel.tsx` |
| Вихідні моделі / Source models | uncompressed GLBs for Blender checks | `models_src/` |
| Стиснення / Compression | meshopt + quantization for the site copies | `scripts/compress_models.mjs` |
| Орієнтири / Landmarks | anatomical points and measure definitions with sources | `docs/LANDMARKS.md` |
| Рівень висоти / Level key | key `L_<measure>`: raises one height level, stretches the body between its neighbours | `LEVELS`, `levelKeys` in calibration |
| Мірка-різниця / Delta measure | followed as (value − standard value), not as an absolute number | `deltaMeasures`, `deltaKeys` in calibration |
| Пов'язана мірка / Linked measure | one of 16 measures that move the body through primary measures | `src/utils/linkedMeasures.ts` |
| Плечова точка / Shoulder point | where the outline of the arm turns into the shoulder slope | `shoulder_arc` in `measure_glb.py` |
| Поправкова крива / Residual curve | what is left of a measure after the straight-line part, by one key's weight | `residualCurves` in calibration |
| Пресет користувача / User preset | named body saved in the browser | `userPresets` in the store, `PresetManager.tsx` |
| Контрольна сітка / Contact sheet | one image per body area: same bodies and views every time; owner approves it | `scripts/contact_sheet.py`, `renders/contact/<tag>/` (not in git) |
| Плечовий суглоб / Shoulder joint | point the arm rides on as one rigid piece | `joint_x`, `armShiftMPerUnit` in calibration |
| Класичний манекен / Classic | previous procedural mannequin | `glassSettings.bodyModel = 'classic'`, `ParametricBody.tsx` |
| М'який перерахунок / Stylization | share of the difference from base size the anime body follows | `stylization` in calibration, `effectiveBodyTargets()` |
| Базова модель / Base mesh | CC0 body from Blender Studio Human Base Meshes | `assets/human-base-meshes/` (not in git) |
| Набір світла / Lighting preset | key, fill, rim, ambient ratios + sliders | `LIGHTING_PRESETS` in `useAtelierStore.ts` |
| GLB | binary 3D model file exported from Blender | `public/` |
| Shape key | Blender morph target to change body shape | generator script |
| Blender MCP | connector that lets Claude control Blender | `mcp__Blender__*` |
