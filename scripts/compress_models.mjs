#!/usr/bin/env node
/**
 * AtelierForm 3D - compress mannequin GLBs for the site.
 *
 * models_src/*.glb (from scripts/blender_base_body_generator.py)
 *   -> public/models/*.glb with KHR_mesh_quantization + EXT_meshopt_compression,
 *      without per-key normals (the site recomputes normals, see BlenderBody.tsx).
 *
 * After writing, every file is read back and compared with its source: the largest
 * position error of the base shape and of every shape key is printed and must stay
 * under MAX_ERROR_MM, otherwise the script fails.
 *
 * Usage: node scripts/compress_models.mjs
 */
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const MAX_ERROR_MM = 0.1;
const QUANTIZE_POSITION_BITS = 16;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'models_src');
const outDir = path.join(root, 'public', 'models');
mkdirSync(outDir, { recursive: true });

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

/** World-space positions of every primitive: base shape and base + each shape key. */
function collectShapes(doc) {
  const shapes = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    const apply = (x, y, z, w) => [
      m[0] * x + m[4] * y + m[8] * z + m[12] * w,
      m[1] * x + m[5] * y + m[9] * z + m[13] * w,
      m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    ];
    const names = mesh.getExtras()?.targetNames ?? [];
    mesh.listPrimitives().forEach((prim, p) => {
      const pos = prim.getAttribute('POSITION');
      const read = (acc, w) => {
        const out = [];
        const el = [0, 0, 0];
        for (let i = 0; i < acc.getCount(); i++) {
          acc.getElement(i, el);
          out.push(apply(el[0], el[1], el[2], w));
        }
        return out;
      };
      shapes.push({ name: `prim${p}:base`, points: read(pos, 1) });
      prim.listTargets().forEach((target, t) => {
        // Deltas are directions: no translation (w = 0).
        shapes.push({
          name: `prim${p}:${names[t] ?? t}`,
          points: read(target.getAttribute('POSITION'), 0),
        });
      });
    });
  }
  return shapes;
}

const CELL_M = 0.0005;

/**
 * Compression reorders vertices, so every source vertex is matched to the nearest
 * unused compressed vertex of the same primitive (by base position) first.
 */
function matchVertices(basePoints, otherPoints) {
  const cell = (v) => Math.round(v / CELL_M);
  const grid = new Map();
  otherPoints.forEach((q, j) => {
    const key = `${cell(q[0])},${cell(q[1])},${cell(q[2])}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(j);
  });
  const used = new Uint8Array(otherPoints.length);
  return basePoints.map((p, i) => {
    let best = -1;
    let bestD = Infinity;
    const c = [cell(p[0]), cell(p[1]), cell(p[2])];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          for (const j of grid.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) ?? []) {
            if (used[j]) continue;
            const q = otherPoints[j];
            const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
            if (d < bestD) {
              bestD = d;
              best = j;
            }
          }
        }
    if (best < 0) throw new Error(`no compressed vertex near source vertex ${i}`);
    used[best] = 1;
    return best;
  });
}

function maxErrorMm(a, b) {
  let worst = 0;
  let worstName = '';
  let mapping = null;
  a.forEach((shape, s) => {
    const other = b[s];
    if (!other || other.points.length !== shape.points.length) {
      throw new Error(`shape mismatch: ${shape.name}`);
    }
    if (shape.name.endsWith(':base')) mapping = matchVertices(shape.points, other.points);
    shape.points.forEach((p, i) => {
      const q = other.points[mapping[i]];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 1000;
      if (d > worst) {
        worst = d;
        worstName = shape.name;
      }
    });
  });
  return { worst, worstName };
}

let failed = false;
for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.glb')).sort()) {
  const srcPath = path.join(srcDir, file);
  const outPath = path.join(outDir, file);
  const doc = await io.read(srcPath);
  const before = collectShapes(doc);

  // Drop per-key normals and tangents: they double the file and the site recomputes normals.
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const target of prim.listTargets()) {
        for (const semantic of target.listSemantics()) {
          if (semantic !== 'POSITION') target.setAttribute(semantic, null);
        }
      }
    }
  }
  await doc.transform(
    prune(),
    meshopt({
      encoder: MeshoptEncoder,
      level: 'high',
      quantizePosition: QUANTIZE_POSITION_BITS,
    })
  );
  await io.write(outPath, doc);

  const after = collectShapes(await io.read(outPath));
  const { worst, worstName } = maxErrorMm(before, after);
  const ok = worst <= MAX_ERROR_MM;
  failed ||= !ok;
  const kb = (p) => `${(statSync(p).size / 1024).toFixed(0)} KB`;
  console.log(
    `${file}: ${kb(srcPath)} -> ${kb(outPath)}, ${before.length} shapes, ` +
      `max error ${worst.toFixed(4)} mm (${worstName}) ${ok ? 'ok' : 'TOO LARGE'}`
  );
}
process.exit(failed ? 1 : 0);
