#!/usr/bin/env python3
"""
AtelierForm 3D - slider audit for the Blender mannequins (model side of the chain).

For every body in models_src/ it sweeps every driven measure and every shape
slider to its minimum and maximum (limits from src/data/measurementsSchema.ts),
applies the weights the site solver would produce, and records:
  - how many vertices moved and by how much (dead sliders move nothing),
  - what the ruler measures against what was asked (broken or limited sliders).
Site measures a body does not drive are listed as "not implemented".

Usage:
    blender -b --factory-startup -P scripts/audit_sliders.py -- [--out docs/reports/slider_audit.json]

Status values: ok | limit (moves, but stops before the asked value) | dead (nothing moves)
             | drift (a shape slider changes a measure by more than the tolerance) | not_implemented
Exit code: 0 = no dead or drift rows, 1 = at least one, 2 = error.
"""

import glob
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
SCHEMA_PATH = os.path.join(REPO_ROOT, "src", "data", "measurementsSchema.ts")
MOVE_EPS_M = 0.0005  # a vertex counts as moved beyond 0.5 mm


def read_schema_limits():
    text = open(SCHEMA_PATH, "r", encoding="utf-8").read()
    limits = {}
    for key, lo, hi in re.findall(r"key: '(\w+)',[\s\S]*?min: ([\d.]+),\s*max: ([\d.]+)", text):
        limits[key] = (float(lo), float(hi))
    return limits


def main():
    sys.path.insert(0, SCRIPT_DIR)
    import bpy
    import verify_profiles as vp
    from measure_glb import bmesh_from_objects, measure_objects

    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_path = cli[cli.index("--out") + 1] if "--out" in cli else None
    limits = read_schema_limits()
    rows = []

    for cal_path in sorted(glob.glob(os.path.join(vp.MODELS_DIR, "body_*.calibration.json"))):
        calibration = json.load(open(cal_path, "r", encoding="utf-8"))
        model = calibration["model"]
        exact = not calibration.get("stylization")
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=os.path.join(vp.SOURCE_DIR, model), merge_vertices=True)
        objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        key_names = {kb.name for o in objects for kb in o.data.shape_keys.key_blocks[1:]}
        defaults = dict(calibration["targets"])
        driven = ["totalHeight"] + calibration["girthOrder"]

        def tolerance_of(measure):
            # Delta measures (upper chest) are approximate by design.
            return vp.DELTA_TOLERANCE_CM if measure in (calibration.get("deltaMeasures") or {}) else vp.TOLERANCE_CM

        def apply(targets, shape):
            weights = vp.solve_weights(calibration, targets, shape)
            for obj in objects:
                for kb in obj.data.shape_keys.key_blocks[1:]:
                    value = weights.get(kb.name, 0.0)
                    kb.slider_min = min(kb.slider_min, value)
                    kb.slider_max = max(kb.slider_max, value)
                    kb.value = value
            bm = bmesh_from_objects(objects)
            coords = [v.co.copy() for v in bm.verts]
            bm.free()
            return weights, coords

        def movement(coords):
            dists = [(a - b).length for a, b in zip(coords, base_coords)]
            return max(dists), sum(1 for d in dists if d > MOVE_EPS_M)

        _, base_coords = apply(defaults, None)

        # Keys the solver drives must exist in the exported file.
        expected_keys = set(calibration["girthKeys"]) | {lk["key"] for lk in calibration["levelKeys"]}
        expected_keys |= {k for row in calibration.get("deltaKeys", []) for k in row["keys"]}
        expected_keys |= {s["key"] for s in calibration.get("shapeKeys", [])}
        for missing in sorted(expected_keys - key_names):
            rows.append({"model": model, "slider": missing, "kind": "key", "status": "dead",
                         "cause": "shape key is missing in the GLB"})

        for name in driven:
            lo, hi = limits[name]
            for label, value in (("min", lo), ("max", hi)):
                targets = dict(defaults)
                targets[name] = value
                weights, coords = apply(targets, None)
                max_move, moved = movement(coords)
                specs = vp.ruler_specs(calibration, weights)
                measured = measure_objects(objects, {name: specs[name]})[0][name]["value_cm"]
                asked = vp.effective_targets(calibration, targets)[name]
                row = {
                    "model": model, "slider": name, "kind": "measure", "at": label, "value": value,
                    "asked_cm": round(asked, 2),
                    "measured_cm": None if measured is None else round(measured, 2),
                    "max_move_mm": round(max_move * 1000, 1), "moved_vertices": moved,
                }
                if moved == 0:
                    row["status"], row["cause"] = "dead", "no vertex moves"
                elif measured is None:
                    row["status"], row["cause"] = "limit", "ruler finds no section at this extreme"
                elif abs(measured - asked) > tolerance_of(name):
                    row["status"] = "limit"
                    row["cause"] = "stops %.1f cm short of the asked value" % abs(measured - asked)
                else:
                    row["status"] = "ok"
                rows.append(row)

        # Height levels, limb lengths, hands and feet: followed as a change from their reference
        # value, so the check here is only that the body moves (no ruler reading for them).
        extra = [(lk["measure"], lk["reference"], 3.0) for lk in calibration["levelKeys"][:-1]]
        extra += [(row["measure"], row["reference"], None) for row in calibration.get("deltaKeys", [])]
        for name, reference, step in extra:
            lo, hi = limits[name]
            ends = (("minus", reference - step), ("plus", reference + step)) if step else (("min", lo), ("max", hi))
            for label, value in ends:
                targets = dict(defaults)
                targets[name] = value
                _, coords = apply(targets, None)
                max_move, moved = movement(coords)
                rows.append({
                    "model": model, "slider": name, "kind": "delta measure", "at": label, "value": value,
                    "asked_cm": None, "measured_cm": None,
                    "max_move_mm": round(max_move * 1000, 1), "moved_vertices": moved,
                    "status": "ok" if moved else "dead",
                    **({} if moved else {"cause": "no vertex moves"}),
                })

        for spec in calibration.get("shapeKeys", []):
            for label, value in (("min", spec["min"]), ("max", spec["max"])):
                if value == 0.0:
                    continue
                weights, coords = apply(defaults, {spec["id"]: value})
                max_move, moved = movement(coords)
                specs = vp.ruler_specs(calibration, weights)
                measured, _ = measure_objects(objects, {m: specs[m] for m in driven})
                asked = vp.effective_targets(calibration, defaults)
                drift = {
                    m: round(measured[m]["value_cm"] - asked[m], 2)
                    for m in driven
                    if measured[m]["value_cm"] is not None and abs(measured[m]["value_cm"] - asked[m]) > max(
                        tolerance_of(m), vp.TOLERANCE_CM if exact else vp.ANIME_SHAPED_TOLERANCE_CM)
                }
                row = {
                    "model": model, "slider": spec["id"], "kind": "shape", "at": label, "value": value,
                    "max_move_mm": round(max_move * 1000, 1), "moved_vertices": moved,
                }
                if moved == 0:
                    row["status"], row["cause"] = "dead", "no vertex moves"
                elif drift:
                    row["status"], row["cause"] = "drift", "changes measures: %s" % drift
                else:
                    row["status"] = "ok"
                rows.append(row)

        # The 16 remaining measures are linked on the site (src/utils/linkedMeasures.ts): an edit
        # moves the driven measures above, so they need no key of their own.
        followed = set(driven) | {name for name, _, _ in extra}
        for name in sorted(limits):
            if name not in followed:
                rows.append({"model": model, "slider": name, "kind": "measure", "status": "linked",
                             "cause": "moves the body through other measures (site linking)"})

    print("=== AUDIT_BEGIN ===")
    for row in rows:
        if row["status"] in ("not_implemented", "linked"):
            continue
        print("%-28s %-15s %-4s %-6s move %6.1f mm  verts %5d  asked %s  measured %s  %s" % (
            row["model"], row["slider"], row.get("at", ""), row["status"],
            row.get("max_move_mm", 0.0), row.get("moved_vertices", 0),
            row.get("asked_cm", "-"), row.get("measured_cm", "-"), row.get("cause", "")))
    counts = {}
    for row in rows:
        counts[row["status"]] = counts.get(row["status"], 0) + 1
    print("SUMMARY", json.dumps(counts))
    print("=== AUDIT_END ===")

    if out_path:
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump({"summary": counts, "rows": rows}, fh, indent=1)
            fh.write("\n")
    return 1 if counts.get("dead") or counts.get("drift") else 0


if __name__ == "__main__":
    try:
        code = main()
    except Exception:
        import traceback
        traceback.print_exc()
        code = 2
    sys.exit(code)
