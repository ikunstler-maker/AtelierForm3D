#!/usr/bin/env python3
"""
AtelierForm 3D - GLB measurement tool ("the ruler").

Imports a mannequin GLB into headless Blender, slices it at given heights and
reports girths the way a tape measure reads them (convex hull of the slice),
plus total height. Compares the result with target values from a profile.

Usage:
    blender -b --factory-startup -P scripts/measure_glb.py -- \
        --profile scripts/profiles/sims_female_default.json \
        [--model path/to/model.glb] [--out report.json] \
        [--keys '{"Chest_Size": 0.5}']

Profile JSON (heights in meters from the floor, targets in centimeters):
    {
      "name": "sims_female_default",
      "model": "public/sims_female_mannequin.glb",
      "tolerance_cm": 0.5,
      "measurements": {
        "height": {"type": "height", "target_cm": 168.0},
        "chest":  {"type": "girth", "height_m": 1.21, "target_cm": 90.0},
        "waist":  {"type": "girth", "range_m": [1.0, 1.1], "pick": "min", "target_cm": 68.0}
      }
    }

Exit code: 0 = all measurements within tolerance, 1 = at least one is out,
2 = usage or import error.
"""

import json
import os
import sys

REPORT_BEGIN = "=== MEASURE_REPORT_BEGIN ==="
REPORT_END = "=== MEASURE_REPORT_END ==="
PLANE_NUDGE_M = 1e-5  # avoid slicing exactly through a ring of vertices
RANGE_STEPS = 21


def parse_args(argv):
    args = {"profile": None, "model": None, "out": None, "keys": None}
    if "--" not in argv:
        return args
    rest = argv[argv.index("--") + 1:]
    i = 0
    while i < len(rest):
        name = rest[i].lstrip("-")
        if name in args and i + 1 < len(rest):
            args[name] = rest[i + 1]
            i += 2
        else:
            i += 1
    return args


def polyline_length(points, closed=True):
    total = 0.0
    n = len(points)
    for i in range(n if closed else n - 1):
        ax, ay = points[i]
        bx, by = points[(i + 1) % n]
        total += ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
    return total


def hull_length(points):
    """Perimeter of the convex hull of 2D points (how a tape wraps a section)."""
    from mathutils.geometry import convex_hull_2d

    hull = [points[i] for i in convex_hull_2d(points)]
    return polyline_length(hull)


def slice_components(bm_source, height, plane_co=None, plane_no=None):
    """Cut a copy of the mesh with a plane; return slice loops as components.

    Default: horizontal plane at `height`, points are (x, y). With `plane_co` and
    `plane_no` the plane is arbitrary and points are 2D coordinates inside it,
    measured from `plane_co`.
    """
    import bmesh
    from mathutils import Vector

    oblique = plane_co is not None
    if oblique:
        origin = Vector(plane_co)
        normal = Vector(plane_no).normalized()
        axis_u = normal.cross(Vector((0.0, 0.0, 1.0)))
        if axis_u.length < 1e-6:
            axis_u = Vector((1.0, 0.0, 0.0))
        axis_u.normalize()
        axis_v = normal.cross(axis_u)
    else:
        origin = Vector((0.0, 0.0, height + PLANE_NUDGE_M))
        normal = Vector((0.0, 0.0, 1.0))

    bm = bm_source.copy()
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(
        bm,
        geom=geom,
        dist=1e-7,
        plane_co=origin,
        plane_no=normal,
        clear_inner=False,
        clear_outer=False,
    )
    cut_edges = [g for g in res["geom_cut"] if isinstance(g, bmesh.types.BMEdge)]

    def to_2d(co):
        if oblique:
            d = co - origin
            return (d.dot(axis_u), d.dot(axis_v))
        return (co.x, co.y)

    adjacency = {}
    for e in cut_edges:
        a, b = e.verts
        adjacency.setdefault(a.index, set()).add(b.index)
        adjacency.setdefault(b.index, set()).add(a.index)
    coords = {}
    for e in cut_edges:
        for v in e.verts:
            coords[v.index] = to_2d(v.co)
    edge_len = {}
    for e in cut_edges:
        a, b = e.verts
        edge_len[(min(a.index, b.index), max(a.index, b.index))] = e.calc_length()

    components = []
    seen = set()
    for start in adjacency:
        if start in seen:
            continue
        stack = [start]
        members = []
        seen.add(start)
        while stack:
            cur = stack.pop()
            members.append(cur)
            for nxt in adjacency[cur]:
                if nxt not in seen:
                    seen.add(nxt)
                    stack.append(nxt)
        member_set = set(members)
        contour = sum(l for (a, b), l in edge_len.items() if a in member_set)
        pts = [coords[i] for i in members]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        components.append({
            "points": pts,
            "contour_m": contour,
            "min_x": min(xs), "max_x": max(xs),
            "min_y": min(ys), "max_y": max(ys),
            "cx": sum(xs) / len(xs), "cy": sum(ys) / len(ys),
        })
    bm.free()
    return components


def tape_girth(components):
    """Tape-measure girth: convex hull around the central body loop(s) of a slice.

    The body loop is the largest loop that straddles the body axis (x = 0).
    Loops whose centre lies inside its bounding box (inner shells, upper legs)
    are wrapped together with it; arms and hands are left out.
    """
    from mathutils.geometry import convex_hull_2d

    central = [c for c in components if c["min_x"] < 0.0 < c["max_x"]]
    if not central:
        return None
    body = max(central, key=lambda c: (c["max_x"] - c["min_x"]) * (c["max_y"] - c["min_y"]))
    group = [
        c for c in components
        if body["min_x"] <= c["cx"] <= body["max_x"] and body["min_y"] <= c["cy"] <= body["max_y"]
    ]
    points = [p for c in group for p in c["points"]]
    hull_idx = convex_hull_2d(points)
    hull = [points[i] for i in hull_idx]
    return {
        "tape_m": polyline_length(hull),
        "contour_m": body["contour_m"],
        "width_m": body["max_x"] - body["min_x"],
        "depth_m": body["max_y"] - body["min_y"],
        "max_abs_x_m": max(abs(body["min_x"]), abs(body["max_x"])),
        "center_y_m": (body["min_y"] + body["max_y"]) * 0.5,
        "loops_in_slice": len(components),
        "loops_wrapped": len(group),
    }


def measure(bm, bounds, spec):
    kind = spec.get("type", "girth")
    if kind == "height":
        return {"value_cm": (bounds["max_z"] - bounds["min_z"]) * 100.0}

    floor = bounds["min_z"]

    if kind == "limb_girth":
        # One leg: the biggest loop that lies fully on the +x side (hands are smaller).
        comps = [c for c in slice_components(bm, floor + spec["height_m"]) if c["min_x"] > 0.0]
        if not comps:
            return {"value_cm": None, "error": "no limb loop found at this height"}
        limb = max(comps, key=lambda c: (c["max_x"] - c["min_x"]) * (c["max_y"] - c["min_y"]))
        return {
            "value_cm": hull_length(limb["points"]) * 100.0,
            "center_x_m": (limb["min_x"] + limb["max_x"]) * 0.5,
            "center_y_m": (limb["min_y"] + limb["max_y"]) * 0.5,
        }

    if kind == "width":
        g = tape_girth(slice_components(bm, floor + spec["height_m"]))
        if g is None:
            return {"value_cm": None, "error": "no body loop found at this height"}
        return {"value_cm": g["width_m"] * 100.0}

    if kind == "shoulder_arc":
        # Tailor's shoulder width: from shoulder point to shoulder point across the back.
        # Shoulder point: going up the outer outline of the arm, the place where the outline
        # turns from the arm into the shoulder slope (dx/dz passes spec["slope"]).
        from mathutils.geometry import convex_hull_2d

        lo, hi = spec["range_m"]
        step, win = 0.004, 3
        rows = []
        h = lo
        while h <= hi:
            comps = slice_components(bm, floor + h)
            if comps:
                rows.append((h, max(max(c["max_x"], -c["min_x"]) for c in comps)))
            h += step
        threshold = spec.get("slope", -1.667)
        point = None
        prev = None
        for i in range(win, len(rows) - win):
            s = (rows[i + win][1] - rows[i - win][1]) / (rows[i + win][0] - rows[i - win][0])
            if prev is not None and prev[1] > threshold >= s:
                t = (threshold - prev[1]) / (s - prev[1])
                point = (prev[2] + t * (rows[i][1] - prev[2]), prev[0] + t * (rows[i][0] - prev[0]))
                break
            prev = (rows[i][0], s, rows[i][1])
        if point is None:
            return {"value_cm": None, "error": "no shoulder point found"}
        x_sp, z_sp = point
        if "ratio" in spec:
            # Arc = straight distance x the arc / straight ratio of the base body. The true arc
            # also depends on how deep the back is, which no single key controls in a straight line.
            return {"value_cm": 2.0 * x_sp * 100.0 * spec["ratio"], "height_m": round(z_sp, 4)}
        comps = slice_components(bm, floor + z_sp - spec.get("drop_m", 0.02))
        pts = [p for c in comps for p in c["points"]]
        if len(pts) < 3:
            return {"value_cm": None, "error": "no section below the shoulder points"}
        hull = [pts[i] for i in convex_hull_2d(pts)]
        left = min(hull, key=lambda p: p[0])
        right = max(hull, key=lambda p: p[0])
        # Back half of the hull (the body faces -y): points on the +y side of the left-right line.
        back = [left] + sorted(
            (p for p in hull if p is not left and p is not right
             and (right[0] - left[0]) * (p[1] - left[1]) - (right[1] - left[1]) * (p[0] - left[0]) > 0.0),
            key=lambda p: p[0],
        ) + [right]

        def at(x):
            for a, b in zip(back, back[1:]):
                if a[0] <= x <= b[0]:
                    t = (x - a[0]) / max(b[0] - a[0], 1e-9)
                    return (x, a[1] + t * (b[1] - a[1]))
            return (x, back[0][1] if x < back[0][0] else back[-1][1])

        x_lim = min(x_sp, -left[0], right[0])
        chain = [at(-x_lim)] + [p for p in back if -x_lim < p[0] < x_lim] + [at(x_lim)]
        return {
            "value_cm": polyline_length(chain, closed=False) * 100.0,
            "straight_cm": 2.0 * x_sp * 100.0,
            "height_m": round(z_sp, 4),
        }

    if kind == "plane_girth":
        # Section across a slanted limb (upper arm): the loop closest to the given point.
        px, py, pz = spec["point_m"]
        comps = slice_components(bm, 0.0, plane_co=(px, py, pz + floor), plane_no=spec["normal"])
        if not comps:
            return {"value_cm": None, "error": "plane does not cut the mesh"}
        limb = min(comps, key=lambda c: c["cx"] ** 2 + c["cy"] ** 2)
        return {"value_cm": hull_length(limb["points"]) * 100.0}

    if "range_m" in spec:
        lo, hi = spec["range_m"]
        steps = int(spec.get("steps", RANGE_STEPS))
        heights = [lo + (hi - lo) * i / (steps - 1) for i in range(steps)]
    else:
        heights = [spec["height_m"]]

    best = None
    for h in heights:
        g = tape_girth(slice_components(bm, floor + h))
        if g is None:
            continue
        g["height_m"] = h
        if best is None:
            best = g
        elif spec.get("pick", "min") == "min" and g["tape_m"] < best["tape_m"]:
            best = g
        elif spec.get("pick") == "max" and g["tape_m"] > best["tape_m"]:
            best = g
    if best is None:
        return {"value_cm": None, "error": "no body loop found at this height"}

    return {
        "value_cm": best["tape_m"] * 100.0,
        "contour_cm": best["contour_m"] * 100.0,
        "width_cm": best["width_m"] * 100.0,
        "depth_cm": best["depth_m"] * 100.0,
        "height_m": round(best["height_m"], 4),
        "loops_in_slice": best["loops_in_slice"],
        "loops_wrapped": best["loops_wrapped"],
    }


def bmesh_from_objects(mesh_objects):
    """World-space bmesh of the evaluated objects (shape key values applied)."""
    import bpy
    import bmesh

    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    bm = bmesh.new()
    for obj in mesh_objects:
        eval_obj = obj.evaluated_get(depsgraph)
        mesh = eval_obj.to_mesh()
        mesh.transform(obj.matrix_world)
        bm.from_mesh(mesh)
        eval_obj.to_mesh_clear()
    bm.verts.ensure_lookup_table()
    return bm


def measure_objects(mesh_objects, measurements):
    """Measure a dict of specs on the given objects; returns {name: result}."""
    bm = bmesh_from_objects(mesh_objects)
    zs = [v.co.z for v in bm.verts]
    bounds = {"min_z": min(zs), "max_z": max(zs)}
    results = {name: measure(bm, bounds, spec) for name, spec in measurements.items()}
    bm.free()
    return results, bounds


def solve_linear(matrix, rhs):
    """Gaussian elimination with partial pivoting; matrix is a list of rows."""
    n = len(rhs)
    a = [list(matrix[i]) + [rhs[i]] for i in range(n)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(a[r][col]))
        if abs(a[pivot][col]) < 1e-12:
            raise ValueError("calibration matrix is singular")
        a[col], a[pivot] = a[pivot], a[col]
        for r in range(n):
            if r != col:
                f = a[r][col] / a[col][col]
                for c in range(col, n + 1):
                    a[r][c] -= f * a[col][c]
    return [a[i][n] / a[i][i] for i in range(n)]


def main():
    import bpy

    args = parse_args(sys.argv)
    if not args["profile"]:
        print(__doc__)
        return 2

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    with open(args["profile"], "r", encoding="utf-8") as fh:
        profile = json.load(fh)

    model_path = args["model"] or profile.get("model")
    if not model_path:
        print("ERROR: no model path in arguments or profile")
        return 2
    if not os.path.isabs(model_path):
        model_path = os.path.join(repo_root, model_path)
    if not os.path.isfile(model_path):
        print(f"ERROR: model not found: {model_path}")
        return 2

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=model_path, merge_vertices=True)
    mesh_objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not mesh_objects:
        print("ERROR: no mesh objects in the model")
        return 2

    key_values = json.loads(args["keys"]) if args["keys"] else profile.get("shape_keys", {})
    shape_key_names = []
    for obj in mesh_objects:
        if obj.data.shape_keys:
            for kb in obj.data.shape_keys.key_blocks:
                if kb.name not in shape_key_names:
                    shape_key_names.append(kb.name)
                if kb.name in key_values:
                    value = float(key_values[kb.name])
                    kb.slider_min = min(kb.slider_min, value)
                    kb.slider_max = max(kb.slider_max, value)
                    kb.value = value
    unknown_keys = [k for k in key_values if k not in shape_key_names]

    vertex_count = sum(len(o.data.vertices) for o in mesh_objects)
    measured, bounds = measure_objects(mesh_objects, profile["measurements"])

    tolerance = float(profile.get("tolerance_cm", 0.5))
    results = {}
    all_ok = True
    for name, spec in profile["measurements"].items():
        r = measured[name]
        target = spec.get("target_cm")
        r["target_cm"] = target
        if r["value_cm"] is None:
            r["ok"] = False
        elif target is None:
            r["ok"] = None
        else:
            r["delta_cm"] = r["value_cm"] - target
            r["ok"] = abs(r["delta_cm"]) <= tolerance
        if r["ok"] is False:
            all_ok = False
        for k, v in list(r.items()):
            if isinstance(v, float):
                r[k] = round(v, 2) if k.endswith("_cm") else v
        results[name] = r

    report = {
        "profile": profile.get("name"),
        "model": os.path.relpath(model_path, repo_root).replace("\\", "/"),
        "model_size_mb": round(os.path.getsize(model_path) / 1048576, 2),
        "blender": bpy.app.version_string,
        "mesh_objects": len(mesh_objects),
        "vertices": vertex_count,
        "floor_z_m": round(bounds["min_z"], 4),
        "shape_keys": shape_key_names,
        "shape_keys_applied": {k: v for k, v in key_values.items() if k in shape_key_names},
        "shape_keys_unknown": unknown_keys,
        "tolerance_cm": tolerance,
        "all_ok": all_ok,
        "measurements": results,
    }

    print(REPORT_BEGIN)
    print(json.dumps(report, indent=2))
    print(REPORT_END)
    if args["out"]:
        out_dir = os.path.dirname(os.path.abspath(args["out"]))
        os.makedirs(out_dir, exist_ok=True)
        with open(args["out"], "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
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
