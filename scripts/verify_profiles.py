#!/usr/bin/env python3
"""
AtelierForm 3D - end-to-end accuracy check for the Blender mannequin.

For every verification profile it loads the gender GLB and its calibration
table, computes the shape key weights exactly like the site does
(src/utils/blenderBodySolver.ts), applies them, and measures the body with the
ruler (scripts/measure_glb.py). Fails if any measurement is out of tolerance.

Usage:
    blender -b --factory-startup -P scripts/verify_profiles.py -- \
        [--profiles scripts/profiles/verify] [--out docs/reports/stage2_verify.json]

Profile JSON:
    {"name": "female-l", "gender": "female",
     "targets_cm": {"totalHeight": 170, "neck": 35.5, "chest": 96, "waist": 74, "hip": 102}}

Exit code: 0 = every profile within tolerance, 1 = at least one is out, 2 = error.
"""

import glob
import json
import os
import sys

TOLERANCE_CM = 0.5
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
MODELS_DIR = os.path.join(REPO_ROOT, "public", "models")


def solve_weights(calibration, targets_cm):
    """Mirror of solveBlenderBodyWeights() in src/utils/blenderBodySolver.ts."""
    from measure_glb import solve_linear

    order = calibration["girthOrder"]
    base = calibration["base"]
    rhs = [targets_cm[g] - base[g] for g in order]
    girth_weights = solve_linear(calibration["matrixCmPerUnit"], rhs)
    weights = dict(zip(calibration["girthKeys"], girth_weights))
    hk = calibration["heightKey"]
    weights[hk["name"]] = (targets_cm["totalHeight"] - base["totalHeight"]) / hk["cmPerUnit"]
    return weights


def landmark_height(calibration, name, height_weight):
    hk = calibration["heightKey"]
    z = calibration["landmarksM"][name]
    ratio = (z - hk["stretchFromM"]) / (hk["stretchToM"] - hk["stretchFromM"])
    return z + height_weight * (hk["cmPerUnit"] / 100.0) * min(1.0, max(0.0, ratio))


def verify_profile(profile):
    import bpy
    from measure_glb import measure_objects

    gender = profile["gender"]
    with open(os.path.join(MODELS_DIR, f"sims_{gender}_mannequin.calibration.json"), "r", encoding="utf-8") as fh:
        calibration = json.load(fh)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS_DIR, calibration["model"]))
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]

    targets = profile["targets_cm"]
    weights = solve_weights(calibration, targets)
    for obj in objects:
        for kb in obj.data.shape_keys.key_blocks[1:]:
            value = weights.get(kb.name, 0.0)
            kb.slider_min = min(kb.slider_min, value)
            kb.slider_max = max(kb.slider_max, value)
            kb.value = value

    height_weight = weights[calibration["heightKey"]["name"]]
    specs = {"totalHeight": {"type": "height"}}
    for name in calibration["girthOrder"]:
        specs[name] = {"type": "girth", "height_m": landmark_height(calibration, name, height_weight)}
    measured, _ = measure_objects(objects, specs)

    rows = {}
    ok = True
    for name, target in targets.items():
        value = measured[name]["value_cm"]
        delta = value - target
        row_ok = abs(delta) <= TOLERANCE_CM
        ok = ok and row_ok
        rows[name] = {"target_cm": target, "value_cm": round(value, 2), "delta_cm": round(delta, 2), "ok": row_ok}
    return {
        "profile": profile["name"],
        "gender": gender,
        "weights": {k: round(v, 4) for k, v in weights.items()},
        "all_ok": ok,
        "measurements": rows,
    }


def main():
    sys.path.insert(0, SCRIPT_DIR)
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    profiles_dir = os.path.join(SCRIPT_DIR, "profiles", "verify")
    out_path = None
    if "--profiles" in cli:
        profiles_dir = cli[cli.index("--profiles") + 1]
    if "--out" in cli:
        out_path = cli[cli.index("--out") + 1]

    files = sorted(glob.glob(os.path.join(profiles_dir, "*.json")))
    if not files:
        print(f"ERROR: no profiles in {profiles_dir}")
        return 2

    reports = []
    for path in files:
        with open(path, "r", encoding="utf-8") as fh:
            reports.append(verify_profile(json.load(fh)))

    print("=== VERIFY_REPORT_BEGIN ===")
    for rep in reports:
        print(f"{rep['profile']} ({rep['gender']}): {'OK' if rep['all_ok'] else 'FAIL'}")
        for name, row in rep["measurements"].items():
            mark = "ok" if row["ok"] else "OUT"
            print(f"  {name:<12} target {row['target_cm']:>7.2f}  measured {row['value_cm']:>7.2f}  delta {row['delta_cm']:>+6.2f}  {mark}")
    all_ok = all(rep["all_ok"] for rep in reports)
    print(f"RESULT: {sum(r['all_ok'] for r in reports)}/{len(reports)} profiles within {TOLERANCE_CM} cm")
    print("=== VERIFY_REPORT_END ===")

    if out_path:
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump({"tolerance_cm": TOLERANCE_CM, "all_ok": all_ok, "profiles": reports}, fh, indent=2)
            fh.write("\n")
    return 0 if all_ok else 1


if __name__ == "__main__":
    try:
        code = main()
    except Exception:
        import traceback
        traceback.print_exc()
        code = 2
    sys.exit(code)
