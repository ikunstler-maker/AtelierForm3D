#!/usr/bin/env python3
"""
AtelierForm 3D - end-to-end accuracy check for the Blender mannequins.

For every verification profile and every body of that gender in public/models
(anime: body_<gender>.glb, realistic: body_<gender>_realistic.glb) it loads the
GLB and its calibration table, computes the shape key weights exactly like the
site does (src/utils/blenderBodySolver.ts), applies them, and measures the body
with the ruler (scripts/measure_glb.py). Fails if a measurement is out of tolerance.

Usage:
    blender -b --factory-startup -P scripts/verify_profiles.py -- \
        [--profiles scripts/profiles/verify] [--out docs/reports/verify_latest.json]

Profile JSON (measure names match the site's MeasurementKey; a body checks the ones it drives):
    {"name": "female-l", "gender": "female",
     "targets_cm": {"totalHeight": 170, "neck": 35.5, "chest": 96, "waist": 74, "hip": 102, "thigh": 59}}

Exit code: 0 = every profile within tolerance, 1 = at least one is out, 2 = error.
"""

import glob
import json
import os
import sys

TOLERANCE_CM = 0.5
# Anime body with shape sliders moved: the sliders do not add up exactly on the stylized breasts.
# Accuracy is promised for the realistic body only (docs/decisions.md), so this case gets a wider band.
ANIME_SHAPED_TOLERANCE_CM = 1.0
# Delta measures (upper chest) follow the change from the standard value; their tape crosses the
# top of the breasts, so with a very large bust the reading is approximate.
DELTA_TOLERANCE_CM = 2.5
MIN_SEGMENT_SHARE = 0.4  # a body segment between two height levels keeps at least this share of its length
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
MODELS_DIR = os.path.join(REPO_ROOT, "public", "models")
# Uncompressed GLBs from the generator; public/models holds the compressed copies for the site.
SOURCE_DIR = os.path.join(REPO_ROOT, "models_src")


def effective_targets(calibration, targets_cm):
    """Mirror of effectiveBodyTargets(): what the model should show for real measurements.

    Exact bodies return the targets unchanged; the anime body follows only a share of
    the difference from its base size, inside a safe range.
    """
    names = ["totalHeight"] + calibration["girthOrder"]
    st = calibration.get("stylization")
    if not st:
        out = {n: targets_cm[n] for n in names}
        # Delta measures follow the difference from their standard value.
        for m, reference in (calibration.get("deltaMeasures") or {}).items():
            out[m] = calibration["base"][m] + (targets_cm[m] - reference)
        return out
    base = calibration["base"]
    reference = st.get("reference", base)
    out = {
        "totalHeight": base["totalHeight"]
        + (targets_cm["totalHeight"] - base["totalHeight"]) * st["response"]["totalHeight"]
    }
    for g in calibration["girthOrder"]:
        # Relative difference from the real default profile, softened and capped.
        change = (targets_cm[g] / reference[g] - 1.0) * st["response"]["girths"]
        change = min(st["maxGirthChange"], max(-st["maxGirthChange"], change))
        out[g] = base[g] * (1.0 + change)
    return out


def shape_values(calibration, shape):
    """Slider values clamped to their ranges; missing sliders are 0."""
    values = {}
    for spec in calibration.get("shapeKeys", []):
        v = float((shape or {}).get(spec["id"], 0.0))
        values[spec["key"]] = min(spec["max"], max(spec["min"], v))
    return values


def curve_value(points, w):
    """Value on a piecewise-linear [[x, y], ...] curve; clamped to the curve ends."""
    if w <= points[0][0]:
        return points[0][1]
    for (w0, v0), (w1, v1) in zip(points, points[1:]):
        if w <= w1:
            return v0 + (v1 - v0) * (w - w0) / max(1e-9, w1 - w0)
    return points[-1][1]


def curve_value_open(points, x):
    """Like curve_value, but continues the end segments in a straight line."""
    if x <= points[0][0]:
        (x0, y0), (x1, y1) = points[0], points[1]
    elif x >= points[-1][0]:
        (x0, y0), (x1, y1) = points[-2], points[-1]
    else:
        return curve_value(points, x)
    return y0 + (y1 - y0) * (x - x0) / max(1e-9, x1 - x0)


def shape_effect(curve, shapes, w):
    """How much the shape sliders change a curved measure at key weight w (cm)."""
    levels = curve["shapeLevels"]
    total = 0.0
    for key, value in shapes.items():
        effect = curve["shapeEffects"].get(key)
        if not effect or not value:
            continue
        side = effect["plus"] if value >= 0 else effect["minus"]
        total += abs(value) * curve_value(list(zip(levels, side)), w)
    return total


def solve_weights(calibration, targets_cm, shape=None):
    """Mirror of solveBlenderBodyWeights() in src/utils/blenderBodySolver.ts."""
    from measure_glb import solve_linear

    real_targets = targets_cm
    targets_cm = effective_targets(calibration, targets_cm)
    order = calibration["girthOrder"]
    base = calibration["base"]
    shapes = shape_values(calibration, shape)
    shape_cols = [spec["key"] for spec in calibration.get("shapeKeys", [])]
    matrix = calibration["matrixCmPerUnit"]
    curves = calibration.get("curveKeys") or {}

    minus = calibration.get("shapeMatrixMinusCm")

    def from_shape(r):
        # The sliders change the measures a little; the measurement keys take that back.
        total = 0.0
        for c, key in enumerate(shape_cols):
            v = shapes[key]
            if v < 0.0 and minus:
                total += minus[r][c] * -v
            else:
                total += calibration["shapeMatrixCmPerUnit"][r][c] * v
        return total

    curve_w = {g: 0.0 for g in curves}
    # Delta measures (upper chest) do not push back when the bust grows through their tape.
    delta_names = set(calibration.get("deltaMeasures") or {})

    def cross_part(r):
        # What the curved keys (bust) add to a straight-line measure, from the calibration.
        return sum(
            curve_value(curve["crossTalk"][order[r]], curve_w[g])
            for g, curve in curves.items()
            if order[r] in (curve.get("crossTalk") or {}) and order[r] not in delta_names
        )

    residual_curves = calibration.get("residualCurves") or []

    def residual_part(r):
        # Left-over of a measure that does not follow one key in a straight line (shoulder width).
        return sum(
            curve_value_open(rc["points"], weights.get(rc["key"], 0.0))
            for rc in residual_curves if rc["measure"] == order[r]
        )

    weights = {}
    for _ in range(3 if residual_curves or any(c.get("crossTalk") for c in curves.values()) else 1):
        # 1. Straight-line part: every measure except the curved ones (their keys touch nothing else).
        lin = [r for r, g in enumerate(order) if g not in curves]
        sub = [[matrix[r][c] for c in lin] for r in lin]
        rhs = [targets_cm[order[r]] - base[order[r]] - from_shape(r) - cross_part(r) - residual_part(r)
               for r in lin]
        solved = solve_linear(sub, rhs)
        weights = {calibration["girthKeys"][r]: w for r, w in zip(lin, solved)}

        # 2. Curved part (female full bust): the other keys scale the section, then the curve is inverted.
        for g, curve in curves.items():
            r = order.index(g)
            # measure(w) = curve(w) blended towards the big-rib-cage curve by L, plus shape(w);
            # L = what the straight-line keys add to this measure (cm).
            keys = calibration["girthKeys"]
            frame_key = curve.get("frameKey")
            # Straight-line keys other than the rib cage key (their effect here is small).
            frame = sum(matrix[r][c] * weights[keys[c]] for c in lin if keys[c] != frame_key)
            points = curve["points"]

            def measure_at(w, r=r, curve=curve, frame=frame, points=points, frame_key=frame_key):
                f = curve_value(points, w)
                if frame_key:
                    # Rib cage size u: its own curve at breast weight 0, plus the breast part,
                    # blended between the normal and the big rib cage.
                    u = weights[frame_key]
                    grow0 = f - curve_value(points, 0.0)
                    grow_a = curve_value(curve["framePoints"], w) - curve_value(curve["framePoints"], 0.0)
                    f = curve_value_open(curve["frameCurve"], u) + grow0 + u / curve["frameWeight"] * (grow_a - grow0)
                f += frame
                if "shapeEffects" in curve:
                    shape_part = shape_effect(curve, shapes, w)
                else:
                    shape_part = from_shape(r)
                return f + shape_part

            # The measure rises with the weight: find the weight by halving the interval.
            lo, hi = points[0][0], points[-1][0]
            for _ in range(40):
                mid = (lo + hi) * 0.5
                if measure_at(mid) < targets_cm[g]:
                    lo = mid
                else:
                    hi = mid
            w = (lo + hi) * 0.5
            curve_w[g] = w
            if curve.get("negKey"):
                # Negative weights are carried by a second key (female: back to the chest wall).
                weights[curve["key"]] = max(w, 0.0)
                weights[curve["negKey"]] = min(curve.get("negMax", 1.0), max(-w, 0.0) * curve["negScale"])
            else:
                weights[curve["key"]] = w
    weights.update(shapes)
    # Heights and lengths use the measures as entered (the anime softening is for girths only).
    weights.update(level_weights(calibration, real_targets))
    weights.update(delta_weights(calibration, real_targets))
    return weights


def level_weights(calibration, targets_cm):
    """Mirror of levelWeights(): one key per height level, driven by the change from its reference.

    Total height is absolute. A level missing from the targets follows the total height the way
    the site links them: the body stretches evenly up to the base of the neck, the head keeps its size.
    """
    levels = calibration["levelKeys"]
    total = levels[-1]
    d_total = targets_cm["totalHeight"] - calibration["base"]["totalHeight"]
    cerv = levels[-2]
    floor_m = levels[0]["fromM"]
    d_cerv = targets_cm[cerv["measure"]] - cerv["reference"] if cerv["measure"] in targets_cm else d_total
    deltas = []
    for lk in levels[:-1]:
        if lk["measure"] in targets_cm:
            deltas.append(targets_cm[lk["measure"]] - lk["reference"])
        else:
            deltas.append(d_cerv * (lk["levelM"] - floor_m) / (cerv["levelM"] - floor_m))
    deltas.append(d_total)
    # No part of the body may be squeezed below MIN_SEGMENT_SHARE of its own length (the levels of
    # the mesh sit closer together than the tailor's ones): a level that comes too close to the
    # one below is pushed up.
    below_base, below_new = floor_m, floor_m
    out = {}
    for lk, delta in zip(levels, deltas):
        new = max(lk["levelM"] + delta / 100.0, below_new + MIN_SEGMENT_SHARE * (lk["levelM"] - below_base))
        out[lk["key"]] = (new - lk["levelM"]) * 100.0 / lk["cmPerUnit"]
        below_base, below_new = lk["levelM"], new
    return out


def delta_weights(calibration, targets_cm):
    """Mirror of deltaWeights(): lengths, hands, feet. change (cm) = sum of weight x cm per unit."""
    from measure_glb import solve_linear

    rows = calibration.get("deltaKeys") or []
    keys = sorted({k for row in rows for k in row["keys"]})
    if not keys:
        return {}
    matrix = [[row["keys"].get(k, 0.0) for k in keys] for row in rows]
    rhs = [targets_cm.get(row["measure"], row["reference"]) - row["reference"] for row in rows]
    return dict(zip(keys, solve_linear(matrix, rhs)))


def stretched_height(calibration, z, weights):
    """Height z (m) after the level keys are applied."""
    out = z
    for lk in calibration["levelKeys"]:
        step = weights.get(lk["key"], 0.0) * lk["cmPerUnit"] / 100.0
        if not step or z <= lk["fromM"]:
            continue
        if z <= lk["levelM"]:
            out += step * (z - lk["fromM"]) / (lk["levelM"] - lk["fromM"])
        elif lk["toM"] is None:
            out += step
        elif z < lk["toM"]:
            out += step * (lk["toM"] - z) / (lk["toM"] - lk["levelM"])
    return out


def ruler_specs(calibration, weights):
    """Where to measure once the keys are applied: landmarks rise with height, the arm rides on the shoulder."""
    own_shift = calibration.get("pointShiftMPerUnit", {})
    base_specs = calibration.get("measureSpecs") or {
        name: {"type": "girth", "height_m": calibration["landmarksM"][name]} for name in calibration["girthOrder"]
    }
    arm_shift = calibration.get("armShiftMPerUnit", {})
    specs = {"totalHeight": {"type": "height"}}
    for name, spec in base_specs.items():
        spec = dict(spec)
        if "height_m" in spec:
            spec["height_m"] = stretched_height(calibration, spec["height_m"], weights)
        elif "range_m" in spec:
            spec["range_m"] = [stretched_height(calibration, z, weights) for z in spec["range_m"]]
        else:
            point = list(spec["point_m"])
            for key, weight in weights.items():
                shift = arm_shift.get(key, [0.0, 0.0, 0.0])
                own = own_shift.get(name, {}).get(key, [0.0, 0.0, 0.0])
                for axis in range(3):
                    point[axis] += weight * (shift[axis] + own[axis])
            spec["point_m"] = point
        specs[name] = spec
    return specs


def verify_profile(profile, calibration):
    import bpy
    from measure_glb import measure_objects

    bpy.ops.wm.read_factory_settings(use_empty=True)
    # merge_vertices: the exporter splits vertices along UV seams; weld them so slices stay closed loops.
    bpy.ops.import_scene.gltf(filepath=os.path.join(SOURCE_DIR, calibration["model"]), merge_vertices=True)
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]

    targets = profile["targets_cm"]
    weights = solve_weights(calibration, targets, profile.get("shape"))
    for obj in objects:
        for kb in obj.data.shape_keys.key_blocks[1:]:
            value = weights.get(kb.name, 0.0)
            kb.slider_min = min(kb.slider_min, value)
            kb.slider_max = max(kb.slider_max, value)
            kb.value = value

    measured, _ = measure_objects(objects, ruler_specs(calibration, weights))

    # The model must match the effective targets (equal to the real ones for exact bodies).
    expected = effective_targets(calibration, targets)
    # ...so what the tape reads there includes the bust's own contribution.
    for g, curve in (calibration.get("curveKeys") or {}).items():
        w = weights.get(curve["key"], 0.0)
        if curve.get("negKey") and weights.get(curve["negKey"], 0.0) > 0.0:
            w = -weights[curve["negKey"]] / curve["negScale"]
        for m in calibration.get("deltaMeasures") or {}:
            if m in (curve.get("crossTalk") or {}):
                expected[m] += curve_value(curve["crossTalk"][m], w)
    rows = {}
    ok = True
    shaped = any(abs(v) > 1e-9 for v in (profile.get("shape") or {}).values())
    tolerance = ANIME_SHAPED_TOLERANCE_CM if calibration.get("stylization") and shaped else TOLERANCE_CM
    for name, target in expected.items():
        value = measured[name]["value_cm"]
        if value is None:
            rows[name] = {"real_cm": targets[name], "target_cm": round(target, 2), "value_cm": None, "ok": False}
            ok = False
            continue
        delta = value - target
        row_ok = abs(delta) <= (DELTA_TOLERANCE_CM if name in (calibration.get("deltaMeasures") or {}) else tolerance)
        ok = ok and row_ok
        rows[name] = {
            "real_cm": targets[name],
            "target_cm": round(target, 2),
            "value_cm": round(value, 2),
            "delta_cm": round(delta, 2),
            "ok": row_ok,
        }
    return {
        "profile": profile["name"],
        "gender": profile["gender"],
        "model": calibration["model"],
        "mode": (calibration.get("stylization") or {}).get("mode", "exact"),
        "weights": {k: round(v, 4) for k, v in weights.items()},
        "tolerance_cm": tolerance,
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
    # --only <text>: check just the models whose file name contains the text (e.g. "realistic").
    only = cli[cli.index("--only") + 1] if "--only" in cli else None
    if "--out" in cli:
        out_path = cli[cli.index("--out") + 1]

    files = sorted(glob.glob(os.path.join(profiles_dir, "*.json")))
    if not files:
        print(f"ERROR: no profiles in {profiles_dir}")
        return 2

    reports = []
    for path in files:
        with open(path, "r", encoding="utf-8") as fh:
            profile = json.load(fh)
        for cal_path in sorted(glob.glob(os.path.join(MODELS_DIR, f"body_{profile['gender']}*.calibration.json"))):
            if only and only not in os.path.basename(cal_path):
                continue
            with open(cal_path, "r", encoding="utf-8") as fh:
                reports.append(verify_profile(profile, json.load(fh)))

    print("=== VERIFY_REPORT_BEGIN ===")
    for rep in reports:
        print(f"{rep['profile']} on {rep['model']} ({rep['mode']}): {'OK' if rep['all_ok'] else 'FAIL'}")
        for name, row in rep["measurements"].items():
            if row["value_cm"] is None:
                print(f"  {name:<14} real {row['real_cm']:>7.2f}  target {row['target_cm']:>7.2f}  NOT MEASURED")
                continue
            mark = "ok" if row["ok"] else "OUT"
            print(
                f"  {name:<14} real {row['real_cm']:>7.2f}  target {row['target_cm']:>7.2f}"
                f"  measured {row['value_cm']:>7.2f}  delta {row['delta_cm']:>+6.2f}  {mark}"
            )
    all_ok = all(rep["all_ok"] for rep in reports)
    wide = sum(1 for r in reports if r["tolerance_cm"] != TOLERANCE_CM)
    print(f"RESULT: {sum(r['all_ok'] for r in reports)}/{len(reports)} checks within {TOLERANCE_CM} cm"
          f" ({wide} anime checks with shape sliders: within {ANIME_SHAPED_TOLERANCE_CM} cm)")
    print("=== VERIFY_REPORT_END ===")

    if out_path:
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump({"tolerance_cm": TOLERANCE_CM, "all_ok": all_ok, "checks": reports}, fh, indent=2)
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
