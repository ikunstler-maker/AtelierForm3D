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
| Модель Blender (бета) | GLB mannequin shown instead of the procedural one | `glassSettings.useBlenderBody`, `src/utils/blenderBodySolver.ts` |
| GLB | binary 3D model file exported from Blender | `public/` |
| Shape key | Blender morph target to change body shape | generator script |
| Blender MCP | connector that lets Claude control Blender | `mcp__Blender__*` |
