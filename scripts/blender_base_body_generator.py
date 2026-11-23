#!/usr/bin/env python3
"""
AtelierForm 3D - mannequin generator built on the Blender Studio "Human Base Meshes" bundle (CC0).

Takes a stylized or realistic base body from the bundle, fits it to the default
tailoring profile and adds measurement shape keys calibrated in centimeters.

Run (Blender 5.3):
    blender -b --factory-startup --disable-autoexec -P scripts/blender_base_body_generator.py \
        [-- --style stylized|realistic] [--bundle path/to/human_base_meshes_bundle.blend]

The bundle is not stored in git. Download human-base-meshes-bundle-v1.4.1.zip from
https://download.blender.org/demo/asset-bundles/human-base-meshes/ and unpack it into
assets/human-base-meshes/.

Output per gender in public/models/ (stylized has no suffix, realistic adds "_realistic"):
    body_<gender>[_realistic].glb               one skin + eyes, shape keys M_height and M_<measure>
    body_<gender>[_realistic].calibration.json  cm per unit weight for every key, ruler specs
Check the result with scripts/verify_profiles.py.
"""

import json
import math
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
DEFAULT_BUNDLE = os.path.join(
    REPO_ROOT, "assets", "human-base-meshes", "human-base-meshes-bundle-v1.4.1", "human_base_meshes_bundle.blend"
)
BUNDLE_NAME = "Blender Studio Human Base Meshes v1.4.1 (CC0)"

# Default tailoring profile per gender, in cm (site presets female-m / male-m).
TARGETS_CM = {
    "female": {
        "totalHeight": 168.0, "neck": 34.0, "chest": 90.0, "waist": 68.0, "hip": 96.0,
        "shoulderWidth": 39.5, "bicep": 27.5, "thigh": 56.0, "calf": 35.0,
    },
    "male": {
        "totalHeight": 180.0, "neck": 39.5, "chest": 100.0, "waist": 84.0, "hip": 98.0,
        "shoulderWidth": 46.0, "bicep": 33.0, "thigh": 58.0, "calf": 38.0,
    },
}
# Measures every style is driven by (and fitted to at build time). Names match the site's MeasurementKey.
STYLE_MEASURES = {
    "stylized": ["neck", "chest", "waist", "hip"],
    "realistic": ["neck", "chest", "waist", "hip", "shoulderWidth", "bicep", "thigh", "calf"],
}
STYLE_SUFFIX = {"stylized": "", "realistic": "_realistic"}
# Vertical reach (sigma) of every key, as a fraction of body height (bicep: of arm length).
KEY_SIGMA = {
    "neck": 0.013, "chest": 0.045, "waist": 0.045, "hip": 0.05,
    "shoulderWidth": 0.035, "bicep": 0.08, "thigh": 0.04, "calf": 0.055,
}
KEY_KIND = {
    "neck": "girth", "chest": "girth", "waist": "girth", "hip": "girth",
    "shoulderWidth": "shoulder", "bicep": "arm", "thigh": "leg", "calf": "leg",
}

# How strongly each style follows real measurements. "stylized" is the anime mode:
# the body reacts to a share of the difference from its base size and never leaves
# the range where the cartoon proportions still look right. "realistic" is exact.
STYLIZATION = {
    "stylized": {
        "mode": "anime",
        "response": {"totalHeight": 1.0, "girths": 0.35},
        "maxGirthChange": 0.16,
    },
    "realistic": None,
}

HEIGHT_KEY_NAME = "M_height"
HEIGHT_KEY_M = 0.10       # M_height = 1.0 adds 10 cm between ankle and neck
KEY_SCALE = 0.10          # M_<measure> = 1.0 scales its cross-section by 10 % at the landmark
FIT_PASSES = 3
MULTIRES_LEVEL = 0        # realistic bodies carry a multires modifier; level 1 makes a 14 MB GLB
PROFILE_STEP_M = 0.005
ARM_MARGIN_M = 0.004      # torso boundary sits this far outside the torso surface
ARM_FADE_M = 0.03         # torso scaling blends into rigid arm motion over this distance
ARM_DEPTH_FADE_M = 0.10   # depth scaling fades into the arm over this (longer) distance
LEG_MARGIN_M = 0.05       # below the crotch the boundary sits this far outside the hips
BICEP_BELOW_ARMPIT = 0.035  # upper-arm section sits this far below the armpit (fraction of height)
ARM_BINS = 30


def gaussian(val, center, sigma):
    d = (val - center) / max(1e-6, sigma)
    return math.exp(-0.5 * d * d)


def smooth01(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3.0 - 2.0 * t)


def run():
    import bpy
    from mathutils import Vector

    sys.path.insert(0, SCRIPT_DIR)
    from measure_glb import bmesh_from_objects, measure_objects, slice_components, solve_linear, tape_girth

    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    style = cli[cli.index("--style") + 1] if "--style" in cli else "stylized"
    bundle = cli[cli.index("--bundle") + 1] if "--bundle" in cli else DEFAULT_BUNDLE
    if style not in STYLE_MEASURES:
        raise ValueError(f"unknown style {style}")
    if not os.path.isfile(bundle):
        raise FileNotFoundError(f"Human Base Meshes bundle not found: {bundle} (see the header of this script)")
    models_dir = os.path.join(REPO_ROOT, "public", "models")
    os.makedirs(models_dir, exist_ok=True)
    measures = STYLE_MEASURES[style]

    def make_material(name, color, roughness):
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = color
        mat.roughness = roughness
        return mat

    def flatten(obj, material, name):
        """New object with modifiers and world transform baked into the mesh."""
        for mod in obj.modifiers:
            if mod.type == 'MULTIRES':
                mod.levels = min(mod.total_levels, MULTIRES_LEVEL)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        depsgraph.update()
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
        mesh.transform(obj.matrix_world)
        mesh.materials.clear()
        mesh.materials.append(material)
        new_obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(new_obj)
        return new_obj

    def load_body(gender):
        """Body and eyes from the bundle, joined into one mesh with two materials."""
        with bpy.data.libraries.load(bundle, link=False) as (src, dst):
            wanted = [
                n for n in src.objects
                if n.startswith("GEO-body_") and gender in n.split(".")[0].split("_")
                and style in n and "primitive" not in n
            ]
            dst.objects = wanted
        sources = [o for o in dst.objects if o is not None]
        if not any(".eye" not in o.name for o in sources):
            raise RuntimeError(f"no {style} {gender} body in the bundle; found {wanted}")
        for o in sources:
            bpy.context.scene.collection.objects.link(o)
        bpy.context.view_layer.update()

        skin = make_material("Skin", (0.80, 0.82, 0.86, 1.0), 0.6)
        eye = make_material("Eye", (0.06, 0.07, 0.09, 1.0), 0.25)
        body_src = next(o for o in sources if ".eye" not in o.name)
        body = flatten(body_src, skin, f"Atelier_{gender}_Body")
        parts = [flatten(o, eye, o.name + "_flat") for o in sources if o is not body_src]

        bpy.ops.object.select_all(action='DESELECT')
        for o in [body] + parts:
            o.select_set(True)
        bpy.context.view_layer.objects.active = body
        if parts:
            bpy.ops.object.join()
        for o in sources:
            bpy.data.objects.remove(o, do_unlink=True)
        body.data.polygons.foreach_set("use_smooth", [True] * len(body.data.polygons))
        return body

    def build(gender):
        targets = TARGETS_CM[gender]
        height_m = targets["totalHeight"] / 100.0
        bpy.ops.wm.read_factory_settings(use_empty=True)
        body = load_body(gender)
        mesh = body.data
        vert_count = len(mesh.vertices)

        # ---- 1. Centre on the body axis, feet on the floor, exact total height -------------
        xs = [v.co.x for v in mesh.vertices]
        zs = [v.co.z for v in mesh.vertices]
        cx = (min(xs) + max(xs)) * 0.5
        k = height_m / (max(zs) - min(zs))
        min_z = min(zs)
        for v in mesh.vertices:
            v.co = Vector(((v.co.x - cx) * k, v.co.y * k, (v.co.z - min_z) * k))
        mesh.update()

        # ---- 2. Landmarks from the girth profile (found once, heights do not change later) ---
        def girth_profile():
            bm = bmesh_from_objects([body])
            rows = []
            z = PROFILE_STEP_M
            while z < height_m:
                g = tape_girth(slice_components(bm, z))
                if g is not None:
                    rows.append((z, g["tape_m"], g["max_abs_x_m"], g["center_y_m"], g["width_m"]))
                z += PROFILE_STEP_M
            bm.free()
            return rows

        profile = girth_profile()
        crotch_z = profile[0][0]
        # Armpit: first level where the body loop suddenly includes the arms.
        armpit_idx = next(
            i for i in range(1, len(profile))
            if profile[i][0] > crotch_z + 0.1 * height_m and profile[i][4] > profile[i - 1][4] * 1.25
        )
        armpit_z = profile[armpit_idx - 1][0]

        def pick(lo, hi, best):
            rows = [r for r in profile if lo <= r[0] <= hi]
            return best(rows, key=lambda r: r[1])

        hip_row = pick(crotch_z + 0.02 * height_m, crotch_z + 0.08 * height_m, max)
        waist_row = pick(hip_row[0], armpit_z, min)
        chest_row = pick(waist_row[0], armpit_z - 0.01 * height_m, max)
        neck_row = pick(armpit_z + 0.02 * height_m, armpit_z + 0.16 * height_m, min)
        neck_z = neck_row[0]
        axis_y = waist_row[3]
        z_from = 0.045 * height_m
        # Height stretches the body between ankle and armpit; shoulders, arms, neck and head
        # move up as one piece, so no measure above the armpit changes with height.
        z_to = armpit_z

        # Shoulder line: just below the level where the body narrows fastest towards the neck.
        upper = [r for r in profile if armpit_z + 0.01 * height_m <= r[0] <= neck_z]
        drop_idx = min(range(1, len(upper)), key=lambda i: upper[i][4] - upper[i - 1][4])
        shoulder_z = upper[max(0, drop_idx - 3)][0]

        centers = {
            "neck": neck_z, "chest": chest_row[0], "waist": waist_row[0], "hip": hip_row[0],
            "shoulderWidth": shoulder_z, "thigh": crotch_z - 0.04 * height_m,
        }

        def leg_section(bm, z):
            comps = [c for c in slice_components(bm, z) if c["min_x"] > 0.0]
            if not comps:
                return None
            leg = max(comps, key=lambda c: (c["max_x"] - c["min_x"]) * (c["max_y"] - c["min_y"]))
            from measure_glb import hull_length
            return hull_length(leg["points"]), (leg["min_x"] + leg["max_x"]) * 0.5, (leg["min_y"] + leg["max_y"]) * 0.5

        if "calf" in measures:
            bm = bmesh_from_objects([body])
            best = None
            z = 0.14 * height_m
            while z <= 0.30 * height_m:
                sec = leg_section(bm, z)
                if sec and (best is None or sec[0] > best[1]):
                    best = (z, sec[0])
                z += 0.01
            bm.free()
            centers["calf"] = best[0]

        knee_z = 0.285 * height_m

        def torso_profile(name, z):
            """Vertical reach of a girth key. Hip, waist and chest hand over to each other
            smoothly and always add up to 1 between hip and chest, so an even change of all
            three scales the torso evenly (no belts or dips between the landmarks)."""
            sigma = KEY_SIGMA[name] * height_m
            if name == "neck":
                return gaussian(z, centers["neck"], sigma)
            hip_z, waist_z, chest_z = centers["hip"], centers["waist"], centers["chest"]
            if name == "hip":
                if z <= hip_z:
                    return gaussian(z, hip_z, sigma)
                return 1.0 - smooth01((z - hip_z) / (waist_z - hip_z))
            if name == "waist":
                if z <= waist_z:
                    return smooth01((z - hip_z) / (waist_z - hip_z))
                return 1.0 - smooth01((z - waist_z) / (chest_z - waist_z))
            if z >= chest_z:
                return gaussian(z, chest_z, sigma)
            return smooth01((z - waist_z) / (chest_z - waist_z))

        def leg_profile(name, z):
            """Thigh key fades out towards the knee; calf key is a bump around the calf."""
            center = centers[name]
            sigma = KEY_SIGMA[name] * height_m
            if name == "thigh" and z <= center:
                return 1.0 - smooth01((center - z) / (center - knee_z))
            return gaussian(z, center, sigma)

        def height_shift(z):
            return HEIGHT_KEY_M * min(1.0, max(0.0, (z - z_from) / (z_to - z_from)))

        # ---- 3. Geometry analysis: redone after every fit pass --------------------------------
        def analyze():
            """Torso boundary, per-vertex arm masks, leg axis and arm axis of the current shape."""
            rows = [r for r in girth_profile() if crotch_z <= r[0] <= armpit_z]
            bxs = [r[2] for r in rows]
            table = []
            for i, r in enumerate(rows):
                window = bxs[max(0, i - 3):i + 4]
                table.append((r[0], sum(window) / len(window) + ARM_MARGIN_M))
            lo_z, hi_z = table[0][0], table[-1][0]

            def boundary(z):
                if z <= lo_z:
                    return table[0][1] + LEG_MARGIN_M  # legs stay inside and scale with the hips
                if z >= hi_z:
                    return table[-1][1]  # shoulder joint line continues straight up
                i = min(len(table) - 2, int((z - lo_z) / PROFILE_STEP_M))
                z0, x0 = table[i]
                z1, x1 = table[i + 1]
                return x0 + (x1 - x0) * (z - z0) / max(1e-9, z1 - z0)

            coords = [v.co.copy() for v in mesh.vertices]
            arm = [0.0] * vert_count
            arm_depth = [0.0] * vert_count
            for i, co in enumerate(coords):
                over = abs(co.x) - boundary(co.z)
                if over <= 0.0:
                    continue
                # Arms end at the shoulders: the head (ears) always belongs to the torso.
                head = min(1.0, max(0.0, (neck_z - co.z) / (0.03 * height_m)))
                # ...and never reach the lower legs: wide-set feet are not arms.
                limit = head * smooth01((co.z - 0.20 * height_m) / (0.05 * height_m))
                arm[i] = smooth01(over / ARM_FADE_M) * limit
                # Depth follows the torso only around the shoulder; lower down the arm is fully
                # rigid, so torso keys do not change the upper-arm girth.
                near_shoulder = 1.0 - smooth01((armpit_z - co.z) / (0.035 * height_m))
                soft = smooth01(over / ARM_DEPTH_FADE_M) * limit
                arm_depth[i] = arm[i] + (soft - arm[i]) * near_shoulder

            an = {
                "boundary": boundary, "joint_x": boundary(armpit_z),
                "coords": coords, "arm": arm, "arm_depth": arm_depth,
            }

            if "thigh" in measures or "calf" in measures:
                bm = bmesh_from_objects([body])
                legs = []
                z = 0.03 * height_m
                while z < crotch_z:
                    sec = leg_section(bm, z)
                    if sec:
                        legs.append((z, sec[1], sec[2]))
                    z += 0.01
                bm.free()
                an["legs"] = legs

            if "bicep" in measures:
                pts = [Vector((abs(co.x), co.y, co.z)) for i, co in enumerate(coords) if arm[i] > 0.999]
                mean = sum(pts, Vector((0.0, 0.0, 0.0))) / len(pts)
                # Principal direction of the arm by power iteration on the covariance matrix.
                cov = [[0.0] * 3 for _ in range(3)]
                for p in pts:
                    d = p - mean
                    for a in range(3):
                        for b in range(3):
                            cov[a][b] += d[a] * d[b]
                direction = Vector((1.0, 0.0, -1.0)).normalized()
                for _ in range(60):
                    direction = Vector([sum(cov[a][b] * direction[b] for b in range(3)) for a in range(3)]).normalized()
                if direction.z > 0:
                    direction = -direction  # from the shoulder down to the hand
                ts = [(p - mean).dot(direction) for p in pts]
                t_min, t_max = min(ts), max(ts)
                length = t_max - t_min
                sums = [[Vector((0.0, 0.0, 0.0)), 0] for _ in range(ARM_BINS)]
                for p, t in zip(pts, ts):
                    b = min(ARM_BINS - 1, int((t - t_min) / length * ARM_BINS))
                    sums[b][0] += p
                    sums[b][1] += 1
                axis = [((b + 0.5) / ARM_BINS * length + t_min, s / n) for b, (s, n) in enumerate(sums) if n]

                def arm_center(t):
                    if t <= axis[0][0]:
                        return axis[0][1]
                    for j in range(len(axis) - 1):
                        t0, c0 = axis[j]
                        t1, c1 = axis[j + 1]
                        if t <= t1:
                            return c0.lerp(c1, (t - t0) / max(1e-9, t1 - t0))
                    return axis[-1][1]

                # Upper-arm section: a little below the armpit, where the arm is free of the
                # torso and moves as a rigid piece (this is also where a tailor wraps the tape).
                target_z = armpit_z - BICEP_BELOW_ARMPIT * height_m
                t_bicep = t_min
                while t_bicep < t_max and arm_center(t_bicep).z > target_z:
                    t_bicep += 0.002
                an.update({
                    "arm_mean": mean, "arm_dir": direction, "arm_center": arm_center,
                    "arm_length": length, "t_bicep": t_bicep, "bicep_point": arm_center(t_bicep),
                })
            return an

        # ---- 4. Deformation fields (all linear in the key weight) ----------------------------
        def leg_center(an, z):
            legs = an["legs"]
            if z <= legs[0][0]:
                return legs[0][1], legs[0][2]
            if z >= legs[-1][0]:
                return legs[-1][1], legs[-1][2]
            i = min(len(legs) - 2, int((z - legs[0][0]) / 0.01))
            z0, x0, y0 = legs[i]
            z1, x1, y1 = legs[i + 1]
            t = (z - z0) / max(1e-9, z1 - z0)
            return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t

        def key_shift(an, i, name):
            """Displacement of vertex i for key M_<name> at weight 1."""
            co = an["coords"][i]
            arm = an["arm"][i]
            side = 1.0 if co.x >= 0 else -1.0
            kind = KEY_KIND[name]

            if kind == "girth":
                g = torso_profile(name, co.z) * KEY_SCALE
                g_joint = torso_profile(name, armpit_z) * KEY_SCALE
                return Vector((
                    (1.0 - arm) * co.x * g + arm * side * an["joint_x"] * g_joint,
                    (1.0 - an["arm_depth"][i]) * (co.y - axis_y) * g,
                    0.0,
                ))

            if kind == "shoulder":
                g = gaussian(co.z, centers[name], KEY_SIGMA[name] * height_m) * KEY_SCALE
                return Vector(((1.0 - arm) * co.x * g + arm * side * an["joint_x"] * KEY_SCALE, 0.0, 0.0))

            if kind == "leg":
                g = leg_profile(name, co.z) * KEY_SCALE * (1.0 - arm)
                if g < 1e-5:
                    return None
                lx, ly = leg_center(an, min(co.z, crotch_z))
                ax = abs(co.x)
                # Near and above the crotch the two legs meet: fade the effect to the midline.
                blend = min(1.0, max(0.0, (co.z - (crotch_z - 0.02 * height_m)) / (0.02 * height_m)))
                m = 1.0 + (smooth01(ax / lx) - 1.0) * blend
                return Vector((side * (ax - lx) * g * m, (co.y - ly) * g * m, 0.0))

            if kind == "arm":
                if arm <= 0.0:
                    return None
                p = Vector((abs(co.x), co.y, co.z))
                d = an["arm_dir"]
                t = (p - an["arm_mean"]).dot(d)
                g = gaussian(t, an["t_bicep"], KEY_SIGMA[name] * an["arm_length"]) * KEY_SCALE * arm
                if g < 1e-5:
                    return None
                r = p - an["arm_center"](t)
                r = r - d * r.dot(d)
                return Vector((side * r.x * g, r.y * g, r.z * g))
            raise ValueError(kind)

        def arm_shift_per_unit(an):
            """How far the +x arm moves as a rigid piece per unit weight of every key (meters)."""
            shifts = {HEIGHT_KEY_NAME: [0.0, 0.0, height_shift(armpit_z)]}
            for name in measures:
                kind = KEY_KIND[name]
                if kind == "girth":
                    g = torso_profile(name, armpit_z) * KEY_SCALE
                    shifts[f"M_{name}"] = [an["joint_x"] * g, 0.0, 0.0]
                elif kind == "shoulder":
                    shifts[f"M_{name}"] = [an["joint_x"] * KEY_SCALE, 0.0, 0.0]
                else:
                    shifts[f"M_{name}"] = [0.0, 0.0, 0.0]
            return shifts

        def add_measurement_keys(an):
            body.shape_key_add(name="Basis", from_mix=False)
            coords = an["coords"]
            hk = body.shape_key_add(name=HEIGHT_KEY_NAME, from_mix=False)
            arm_dz = height_shift(armpit_z)
            for i, co in enumerate(coords):
                # Arms keep their length: they ride on the shoulder joint.
                arm = an["arm"][i]
                hk.data[i].co.z = co.z + (1.0 - arm) * height_shift(co.z) + arm * arm_dz
            for name in measures:
                sk = body.shape_key_add(name=f"M_{name}", from_mix=False)
                for i, co in enumerate(coords):
                    shift = key_shift(an, i, name)
                    if shift is not None and shift.length_squared > 0.0:
                        sk.data[i].co = co + shift

        def base_specs(an):
            specs = {}
            for name in measures:
                kind = KEY_KIND[name]
                if kind == "girth":
                    specs[name] = {"type": "girth", "height_m": centers[name]}
                elif kind == "shoulder":
                    specs[name] = {"type": "width", "height_m": centers[name]}
                elif kind == "leg":
                    specs[name] = {"type": "limb_girth", "height_m": centers[name]}
                else:
                    specs[name] = {
                        "type": "plane_girth",
                        "point_m": list(an["bicep_point"]),
                        "normal": list(an["arm_dir"]),
                    }
            return specs

        def measure_with(an, key_values):
            for kb in mesh.shape_keys.key_blocks[1:]:
                kb.value = key_values.get(kb.name, 0.0)
            h_weight = key_values.get(HEIGHT_KEY_NAME, 0.0)
            shifts = arm_shift_per_unit(an)
            specs = {"height": {"type": "height"}}
            for name, spec in base_specs(an).items():
                spec = dict(spec)
                if "height_m" in spec:
                    spec["height_m"] += h_weight * height_shift(spec["height_m"])
                else:
                    point = list(spec["point_m"])
                    for key, weight in key_values.items():
                        for axis in range(3):
                            point[axis] += weight * shifts[key][axis]
                    spec["point_m"] = point
                specs[name] = spec
            results, _ = measure_objects([body], specs)
            missing = [n for n, r in results.items() if r["value_cm"] is None]
            if missing:
                raise RuntimeError(f"ruler found nothing for {missing} with keys {key_values}")
            return {name: r["value_cm"] for name, r in results.items()}

        def calibrate(an):
            base = measure_with(an, {})
            columns = []
            for name in measures:
                one = measure_with(an, {f"M_{name}": 1.0})
                columns.append([one[m] - base[m] for m in measures])
            n = len(measures)
            matrix = [[columns[c][r] for c in range(n)] for r in range(n)]
            tall = measure_with(an, {HEIGHT_KEY_NAME: 1.0})
            for kb in mesh.shape_keys.key_blocks[1:]:
                kb.value = 0.0
            return base, matrix, tall

        source = None
        for _ in range(FIT_PASSES):
            an = analyze()
            add_measurement_keys(an)
            base, matrix, _ = calibrate(an)
            if source is None:
                source = dict(base)
            weights = solve_linear(matrix, [targets[m] - base[m] for m in measures])
            body.shape_key_clear()
            for i, v in enumerate(mesh.vertices):
                total = Vector((0.0, 0.0, 0.0))
                for name, wk in zip(measures, weights):
                    shift = key_shift(an, i, name)
                    if shift is not None:
                        total += shift * wk
                v.co = an["coords"][i] + total
            mesh.update()

        an = analyze()
        add_measurement_keys(an)
        base, matrix, tall = calibrate(an)

        # ---- 5. Export ------------------------------------------------------------------------
        stem = f"body_{gender}{STYLE_SUFFIX[style]}"
        calibration = {
            "version": 2,
            "gender": gender,
            "style": style,
            "model": f"{stem}.glb",
            "source": BUNDLE_NAME,
            "generatedWith": f"Blender {bpy.app.version_string}",
            "units": {"measures": "cm", "landmarks": "m"},
            "base": {"totalHeight": round(base["height"], 3), **{m: round(base[m], 3) for m in measures}},
            "targets": {"totalHeight": targets["totalHeight"], **{m: targets[m] for m in measures}},
            "sourceMeasuresCm": {m: round(source[m], 2) for m in measures},
            # "girth*" names are kept for the site solver; the list may hold widths too.
            "girthOrder": measures,
            "girthKeys": [f"M_{m}" for m in measures],
            "matrixCmPerUnit": [[round(x, 4) for x in row] for row in matrix],
            "heightKey": {
                "name": HEIGHT_KEY_NAME,
                "cmPerUnit": round(tall["height"] - base["height"], 4),
                "stretchFromM": round(z_from, 4),
                "stretchToM": round(z_to, 4),
            },
            "landmarksM": {m: round(centers[m], 4) for m in measures if m in centers},
            "measureSpecs": base_specs(an),
            "armShiftMPerUnit": arm_shift_per_unit(an),
            "stylization": STYLIZATION.get(style),
            "checks": {
                "heightCrossTalkCm": {m: round(tall[m] - base[m], 3) for m in measures},
                "crotchM": round(crotch_z, 4),
                "armpitM": round(armpit_z, 4),
                "vertices": vert_count,
            },
        }
        with open(os.path.join(models_dir, f"{stem}.calibration.json"), "w", encoding="utf-8") as fh:
            json.dump(calibration, fh, indent=2)
            fh.write("\n")

        bpy.ops.object.select_all(action='DESELECT')
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(models_dir, f"{stem}.glb"),
            export_format='GLB',
            use_selection=True,
            export_yup=True,
            export_apply=False,
            export_morph=True,
            export_morph_normal=True,
        )
        print(f"[AtelierForm base body] {gender} {style}: source {calibration['sourceMeasuresCm']}")
        print(f"[AtelierForm base body] {gender} {style}: base {calibration['base']}")
        print(f"[AtelierForm base body] {gender} {style}: landmarks {calibration['landmarksM']} checks {calibration['checks']}")

    for gender in ("female", "male"):
        build(gender)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(2)
