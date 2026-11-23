---
paths:
  - "src/components/canvas/**"
  - "src/utils/**"
---
# Three.js / geometry rules
- Units in scene: meters; schema values are cm → use `CM_TO_M` from `src/utils/geometryMath.ts`.
- Blender body: `BlenderBody.tsx` sets morph influences from `blenderBodySolver.ts`; weights may be < 0 or > 1.
- Overlays sit +2 mm off the surface; keep that offset when geometry changes.
- Load GLB with drei `useGLTF`; paths relative (`./models/...`) because `base: './'`.
- Dispose geometries/materials created in effects; avoid re-creating them per frame.
- Fit colors: coral < 0, amber 0..+2.5, mint +3..+8, cyan > +8 cm (see `src/utils/fitCalculator.ts`).
