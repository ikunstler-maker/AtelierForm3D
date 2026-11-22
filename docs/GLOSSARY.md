# Glossary

| Term | Meaning | In code |
|---|---|---|
| Манекен / Mannequin | 3D body built from 50 measurements | `ParametricBody.tsx`, `public/*.glb` |
| Мірка / Parameter | one of 50 body measurements, cm | `src/data/measurementsSchema.ts` |
| Обхват / Girth | circumference measurement (ring overlay) | `MeasurementOverlays.tsx` |
| Fit Check | garment vs body comparison | `FitCheckPanel.tsx`, `src/utils/fitCalculator.ts` |
| Припуск / Ease | garment − body, cm; drives colors | `fitCalculator.ts` |
| Пласка мірка / Flat (×2) | half-girth measured on a flat garment | Fit Check mode toggle |
| GLB | binary 3D model file exported from Blender | `public/` |
| Shape key | Blender morph target to change body shape | generator script |
| Blender MCP | connector that lets Claude control Blender | `mcp__Blender__*` |
