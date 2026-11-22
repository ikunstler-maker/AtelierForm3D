# AtelierForm 3D — Parametric Tailoring & Fit Verification Studio

Interactive parametric 3D human body mannequin and garment measurement verification studio built with **React 18 + TypeScript + Vite + Three.js (`@react-three/fiber`, `@react-three/drei`) + Zustand + Tailwind CSS**.

## Key Capabilities

- **50 Anthropometric Tailoring Parameters** across 6 anatomical categories (`Circumferences`, `Torso & Shoulders`, `Sleeves`, `Legs & Rise`, `Heights`, `Extremities`).
- **Procedural High-Resolution 3D Mannequin**:
  - 80-ring lofted torso, pelvis, neck, and sculpted head with monotonic cubic Hermite spline interpolation and Ramanujan super-ellipse cross-sectional solver.
  - Multi-segment articulated lofted arms, hands, legs, and feet supporting `Female` and `Male` anatomical proportions.
  - 3 selectable studio shaders: **Matte Clay**, **Satin Resin**, and **Translucent Shell** (revealing inner seams such as inseam and underarm sleeve length from any angle).
- **Interactive 3D Surface Overlays (`+2mm` offset)**:
  - Closed 3D `TubeGeometry` rings for all 17 circumferences.
  - Surface-hugging 3D geodesic polylines with spherical end-markers for trouser outseam, high-hip outseam, inseam, waist-to-knee, front/back/total crotch rise, sleeve from shoulder/C7 neck/armpit, shoulder width, across front/back, front/back/side waist lengths, torso loop, hand/foot dimensions, and height calipers.
- **Garment Size Verification (Fit Check Engine)**:
  - Templates for `Top / Shirt`, `Jacket / Coat`, `Trousers / Jeans`, `Dress / Skirt`, and `All 50 Parameters`.
  - Toggle between **Flat Measurement (`x2` for girths)** and **Full Girth (`x1`)**.
  - Real-time ease delta (`garment - body`) color-coding the 3D mannequin rings and lines:
    - Coral (`< 0 cm` tight/short)
    - Amber (`0 to +2.5 cm` snug)
    - Mint (`+3.0 to +8.0 cm` regular comfort fit)
    - Cyan (`> +8.0 cm` oversized)
- **Bilingual UI (`UA` / `EN`) & Unit Switcher (`cm` / `in`)** with `localStorage` persistence and JSON profile Export/Import.

## Development & One-Command GitHub Pages Deployment

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build production bundle into dist/
npm run build

# One-command deployment to GitHub Pages (gh-pages branch)
npm run deploy
```

Automated deployment on push to `main` is also preconfigured via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
