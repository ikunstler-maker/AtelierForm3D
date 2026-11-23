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
        "totalHeight": 168.0, "neck": 34.0, "upperChest": 86.0, "chest": 90.0, "underbust": 75.0,
        "waist": 68.0, "hip": 96.0, "shoulderWidth": 39.5, "bicep": 27.5, "thigh": 56.0, "calf": 35.0,
    },
    "male": {
        "totalHeight": 180.0, "neck": 39.5, "upperChest": 98.0, "chest": 100.0, "underbust": 91.0,
        "waist": 84.0, "hip": 98.0, "shoulderWidth": 46.0, "bicep": 33.0, "thigh": 58.0, "calf": 38.0,
    },
}
# Measures every body is driven by. Names match the site's MeasurementKey.
MEASURES = [
    "neck", "chest", "underbust", "waist", "hip",
    "shoulderWidth", "bicep", "thigh", "calf",
]
# Measures the base shape is fitted to at build time. The anime body keeps its own limbs.
STYLE_FIT = {
    "stylized": ["neck", "chest", "underbust", "waist", "hip"],
    "realistic": MEASURES,
}
STYLE_SUFFIX = {"stylized": "", "realistic": "_realistic"}
# Shape sliders: they change the form, not the tape measures (the solver compensates).
SHAPE_KEYS = {
    "female": [
        {"id": "muscle", "min": 0.0, "max": 1.0},
        {"id": "breastLift", "min": -1.0, "max": 1.0},
        {"id": "breastSpacing", "min": -1.0, "max": 1.0},
        {"id": "breastFullness", "min": -1.0, "max": 1.0},
        {"id": "breastWidth", "min": -1.0, "max": 1.0},
        {"id": "breastSag", "min": 0.0, "max": 1.0},
        {"id": "gluteProjection", "min": -1.0, "max": 1.0},
        {"id": "gluteLift", "min": -1.0, "max": 1.0},
        {"id": "hipRoundness", "min": -1.0, "max": 1.0},
        {"id": "hipWidePoint", "min": -1.0, "max": 1.0},
    ],
    "male": [
        {"id": "muscle", "min": 0.0, "max": 1.0},
        {"id": "gluteProjection", "min": -1.0, "max": 1.0},
        {"id": "gluteLift", "min": -1.0, "max": 1.0},
        {"id": "hipRoundness", "min": -1.0, "max": 1.0},
        {"id": "hipWidePoint", "min": -1.0, "max": 1.0},
    ],
}
# Vertical reach (sigma) of every key, as a fraction of body height (bicep: of arm length).
KEY_SIGMA = {
    "neck": 0.013, "upperChest": 0.045, "chest": 0.045, "underbust": 0.045, "waist": 0.045, "hip": 0.05,
    "shoulderWidth": 0.035, "bicep": 0.08, "thigh": 0.04, "calf": 0.055,
}
# Where a girth key puts its depth: > 0 more to the front (belly), < 0 more to the back (glutes).
# The tape measure is the same either way; the solver reads it from the calibration.
DEPTH_BIAS = {"chest": 0.2, "underbust": 0.25, "waist": 0.45, "hip": -0.3}
KEY_KIND = {
    "neck": "girth", "upperChest": "girth", "chest": "girth", "underbust": "girth",
    "waist": "girth", "hip": "girth",
    "shoulderWidth": "shoulder", "bicep": "arm", "thigh": "leg", "calf": "leg",
}
BREAST_STEP_M = 0.01      # M_chest = 1.0 brings the apex of each breast forward by 1 cm (female)
FLAT_KEY_NAME = "M_chestFlat"  # female: takes the breast back to the chest wall (negative bust weights)
FLAT_MAX = 0.9            # the flat key never goes past this (a fully flat wall looks artificial)
# Bust curve sample points as shares of the largest / smallest breast weight of the body.
BREAST_CURVE_SHARES = [-1.0, -0.6, -0.3, 0.0, 0.12, 0.25, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4]
# Target big breast (metres on a 1.68 m body; scaled with height). Tuned on close-up renders.
BREAST_SHAPE = {
    "proj": 0.13,       # relief of the biggest breast at its apex
    "r_share": 0.5,     # lower pole radius as a share of the projection
    "x_in": 0.02,       # inner edge of the footprint, from the midline
    "out": 0.07,        # footprint half width outside the centre
    "x_max": 0.17,      # nothing beyond this distance from the midline
    "up": 0.09,         # footprint above the bust line (share of height)
    "p_in": 0.85, "p_out": 1.3,   # roundness towards the sternum / the armpit
    "k1": 0.4, "k2": 0.35,        # upper slope: fullness near the apex / near the collarbone
    "splay": 0.08,      # the breast leans outwards a little
    "rim": 0.4, "rim_z": 0.7,     # blend into the base shape near the footprint rim
    "wall_fade": 0.02,
    "relax": 1500, "smooth": 8,
}
FRAME_CAL_WEIGHT = 4.0    # underbust key weight of the second bust curve (a much bigger rib cage)
FRAME_CURVE_WEIGHTS = [-1.5, -0.75, 0.0, 1.0, 2.0, 3.0, 4.0, 5.5]
SHAPE_CAL_SHARES = [-0.5, 0.0, 0.1, 0.2, 0.35, 0.5, 0.9]  # breast weights (shares, see above) for slider calibration
BUST_RANGE_M = (-0.03, 0.045)  # the full-bust tape is taken at the fullest level in this range
MUSCLE_FEMALE = 0.6       # how much of the muscle shape a female body takes

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


def smoother01(t):
    """Like smooth01, but the curvature is continuous too (no visible line where a zone ends)."""
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def run():
    import bpy
    import numpy as np
    from mathutils import Vector

    sys.path.insert(0, SCRIPT_DIR)
    from measure_glb import bmesh_from_objects, measure_objects, slice_components, solve_linear, tape_girth

    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    style = cli[cli.index("--style") + 1] if "--style" in cli else "stylized"
    bundle = cli[cli.index("--bundle") + 1] if "--bundle" in cli else DEFAULT_BUNDLE
    if style not in STYLE_FIT:
        raise ValueError(f"unknown style {style}")
    if not os.path.isfile(bundle):
        raise FileNotFoundError(f"Human Base Meshes bundle not found: {bundle} (see the header of this script)")
    models_dir = os.path.join(REPO_ROOT, "public", "models")
    os.makedirs(models_dir, exist_ok=True)
    # Uncompressed GLBs go to models_src/; run scripts/compress_models.mjs to refresh public/models.
    source_dir = os.path.join(REPO_ROOT, "models_src")
    os.makedirs(source_dir, exist_ok=True)
    measures = MEASURES
    fit_measures = STYLE_FIT[style]

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
        shapes = SHAPE_KEYS[gender]
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

        # Chest levels. Upper chest: the tape under the armpits. Bust (female): the level where
        # the front sticks out most; chest (male): the nipple line. Underbust: below the bust.
        def front_point(bm, z, near_x=None):
            """Front-most point (x, y) of the body loop on the +x side at height z."""
            comps = slice_components(bm, z)
            central = [c for c in comps if c["min_x"] < 0.0 < c["max_x"]]
            if not central:
                return None
            loop = max(central, key=lambda c: (c["max_x"] - c["min_x"]) * (c["max_y"] - c["min_y"]))
            pts = [p for p in loop["points"] if p[0] > 0.02]
            if near_x is not None:
                pts = [p for p in pts if abs(p[0] - near_x) < 0.03] or pts
            return min(pts, key=lambda p: p[1])

        bm = bmesh_from_objects([body])
        if gender == "female":
            # Bust level: where the front of the body sticks out most.
            best = None
            z = waist_row[0] + 0.04 * height_m
            while z <= armpit_z - 0.004 * height_m:
                fp = front_point(bm, z)
                if fp and (best is None or fp[1] < best[1][1]):
                    best = (z, fp)
                z += PROFILE_STEP_M
            chest_z = best[0]
            mound_x = best[1][0]
            # Underbust: the fold under the breast. Going down from the bust it is the first
            # level where the most forward point is back on the midline, not on the breast.
            underbust_z = chest_z - 0.045 * height_m
            z = chest_z - PROFILE_STEP_M
            while z > chest_z - 0.06 * height_m:
                fp = front_point(bm, z)
                if fp and fp[0] < 0.6 * mound_x:
                    fold_found = z
                    break
                z -= PROFILE_STEP_M
            else:
                fold_found = chest_z - 0.03 * height_m
            # The breast may hang a little over its fold; the underbust tape lies just below that.
            fold_z = fold_found - 0.007 * height_m
            underbust_z = fold_found - 0.011 * height_m
        else:
            chest_z = armpit_z - 0.03 * height_m
            underbust_z = chest_z - 0.045 * height_m
            fold_z = underbust_z + 0.003 * height_m
            mound_x = front_point(bm, chest_z)[0]
        mound_wall_y = front_point(bm, underbust_z, near_x=mound_x)[1]
        bm.free()
        # Root of the breast / pectoral mound: on the chest wall behind its most forward point.
        mound_root = Vector((mound_x, mound_wall_y + 0.012, chest_z))
        mound_top_z = chest_z + 0.07 * height_m

        centers = {
            "neck": neck_z, "chest": chest_z, "underbust": underbust_z,
            "waist": waist_row[0], "hip": hip_row[0],
            "shoulderWidth": shoulder_z, "thigh": crotch_z - 0.04 * height_m,
        }
        # All-round "frame" keys, bottom to top. On a female body the full-bust measure drives
        # the breast volume instead, so the rib cage is set by the underbust measure alone.
        frames = ["hip", "waist", "underbust"] if gender == "female" else [
            "hip", "waist", "underbust", "chest"]

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

        hip_low_z = knee_z + 0.02 * height_m

        def torso_profile(name, z):
            """Vertical reach of a girth key. Hip, waist and chest hand over to each other
            smoothly and always add up to 1 between hip and chest, so an even change of all
            three scales the torso evenly (no belts or dips between the landmarks)."""
            sigma = KEY_SIGMA[name] * height_m
            if name == "neck":
                return gaussian(z, centers["neck"], sigma)
            idx = frames.index(name)
            here = centers[name]
            if z <= here:
                if idx == 0:
                    # Hip fat continues onto the upper thigh (a short bump left angular "saddlebags").
                    return 1.0 - smoother01((here - z) / (here - hip_low_z))
                below = centers[frames[idx - 1]]
                return smoother01((z - below) / (here - below))
            if idx == len(frames) - 1:
                # The rib cage does not end at the tape: the top frame fades out slowly, up to
                # the shoulder line (a short fade left a shelf across the back on large sizes).
                return 1.0 - smoother01((z - here) / (shoulder_z - here))
            above = centers[frames[idx + 1]]
            return 1.0 - smoother01((z - here) / (above - here))

        def mound_mask(an, i, low_z, peak_z, high_z, outer_sigma):
            """0..1 weight of vertex i inside the breast / pectoral mound on its side."""
            co = an["coords"][i]
            if co.z <= low_z or co.z >= high_z:
                return 0.0
            if co.z >= peak_z:
                wz = 1.0 - smooth01((co.z - peak_z) / (high_z - peak_z))
            else:
                wz = 1.0 - smooth01((peak_z - co.z) / (peak_z - low_z))
            dx = abs(co.x) - an["mound_x"]
            wx = gaussian(dx, 0.0, outer_sigma if dx > 0 else 0.5 * an["mound_x"])
            dy = co.y - axis_y
            r = math.hypot(co.x, dy)
            front = smooth01((-dy / r - 0.1) / 0.5) if r > 1e-6 else 0.0
            return wz * wx * front * (1.0 - an["arm"][i])

        # Breast dome: a smooth bump on the chest wall. It ends at the fold below, near the
        # midline inside, and runs out gently towards the collarbone above.
        dome_out = 0.045 * height_m
        dome_up = 0.065 * height_m
        dome_down = chest_z - fold_z
        dome_dir = Vector((0.2, -1.0, -0.35)).normalized()  # forward, a little outward, hanging down

        def hang(z):
            """Share of vertical motion allowed at height z: 0 at the fold, 1 from the bust line up."""
            return min(1.0, max(0.0, (z - fold_z) / dome_down))

        def breast_dome(an, i, soft=False):
            """0..1 height of the dome at vertex i (1 at the centre of the breast).

            The profile is round like a ball on the underside (so the breast sits on its fold)
            and runs out in a straight slope on top. soft=True gives an evenly smooth bump,
            used by the shape sliders. Tuned on renders; see docs/TROUBLESHOOTING.md.
            """
            co = an["coords"][i]
            dz = co.z - chest_z
            dx = abs(co.x) - an["mound_x"]
            rz = dome_up if dz > 0 else dome_down
            rho2 = (dx / (dome_out if dx > 0 else 0.9 * an["mound_x"])) ** 2 + (dz / rz) ** 2
            if rho2 >= 1.0:
                return 0.0
            dy = co.y - axis_y
            r = math.hypot(co.x, dy)
            front = smooth01((-dy / r - 0.1) / 0.5) if r > 1e-6 else 0.0
            if soft:
                exponent = 2.0
            else:
                rho = math.sqrt(rho2)
                up_share = 0.5 + 0.5 * (dz / rz) / rho if rho > 1e-6 else 0.5
                exponent = 0.5 + 0.5 * smooth01(up_share)
            return (1.0 - rho2) ** exponent * front * (1.0 - an["arm"][i])

        def breast_fields(an):
            """Female bust keys as per-vertex displacements (numpy, n x 3).

            grow: towards a big, natural breast (round lower pole sitting on its fold, straight
            upper slope), per unit weight = 1 cm of apex projection. flat: back to the chest
            wall. The wall is found by relaxing the depth of the surface inside the breast
            region with its rim fixed. Tuned in a render lab; see docs/TROUBLESHOOTING.md.
            """
            q = BREAST_SHAPE
            k = height_m / 1.68
            base = np.array([[c.x, c.y, c.z] for c in an["coords"]], dtype=np.float64)
            n = len(base)
            arm = np.array(an["arm"])
            edges = np.empty(len(mesh.edges) * 2, dtype=np.int64)
            mesh.edges.foreach_get("vertices", edges)
            edges = edges.reshape(-1, 2)
            x, y, z = np.abs(base[:, 0]), base[:, 1], base[:, 2]
            side = np.where(base[:, 0] >= 0, 1.0, -1.0)
            top_z = chest_z + (q["up"] + 0.005) * height_m
            wide = ((x > 0.012 * k) & (x < q["x_max"] * k) & (z > fold_z) & (z < top_z)
                    & (y < axis_y - 0.03 * k) & (arm < 0.5))

            # Chest wall: depth relaxed inside the region (weights = 1 / edge length).
            e = edges[wide[edges[:, 0]] | wide[edges[:, 1]]]
            d = base[e[:, 0]] - base[e[:, 1]]
            wgt = 1.0 / np.maximum(np.hypot(d[:, 0], d[:, 2]), 1e-4)
            tot = np.zeros(n)
            np.add.at(tot, e[:, 0], wgt)
            np.add.at(tot, e[:, 1], wgt)
            wall_y = y.copy()
            for _ in range(q["relax"]):
                acc = np.zeros(n)
                np.add.at(acc, e[:, 0], wall_y[e[:, 1]] * wgt)
                np.add.at(acc, e[:, 1], wall_y[e[:, 0]] * wgt)
                wall_y[wide] = acc[wide] / tot[wide]
            relief = np.where(wide, wall_y - y, 0.0)
            relief_max = float(relief.max())
            # Centre of the breast: where its relief is concentrated.
            wr = np.maximum(relief, 0.0) ** 2
            xc = float((x * wr).sum() / max(wr.sum(), 1e-12))

            x_in, x_out = q["x_in"] * k, min(xc + q["out"] * k, q["x_max"] * k)
            up, down = q["up"] * height_m, chest_z - fold_z
            aa = np.where(x < xc, (x - xc) / (xc - x_in), (x - xc) / (x_out - xc))
            root = np.sqrt(np.clip(1.0 - aa * aa, 0.0, 1.0))
            zb = chest_z - down * root
            zt = chest_z + up * root
            foot = wide & (np.abs(aa) < 1.0) & (z > zb) & (z < zt)

            def cubic(p0, p1, p2, p3, t):
                u = 1.0 - t
                return (u ** 3) * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + (t ** 3) * p3

            target = base.copy()
            proj = q["proj"] * k
            for i in np.where(foot)[0]:
                a = aa[i]
                span = zt[i] - zb[i]
                if span < 1e-4:
                    continue
                lat = (1.0 - a * a) ** (q["p_in"] if a < 0 else q["p_out"])
                pa = proj * lat
                ra = min(q["r_share"] * pa, 0.45 * span)
                hu = span - ra
                # Side outline, bottom to top: shelf on the fold, round lower pole, upper slope.
                l1, l2 = pa - ra, 0.5 * math.pi * ra
                l3 = math.hypot(pa, hu) * 1.08
                dist = (z[i] - zb[i]) / span * (l1 + l2 + l3)
                if dist <= l1:
                    f, zz = dist, zb[i]
                elif dist <= l1 + l2:
                    ang = (dist - l1) / ra
                    f, zz = l1 + ra * math.sin(ang), zb[i] + ra * (1.0 - math.cos(ang))
                else:
                    t = (dist - l1 - l2) / l3
                    f = cubic(pa, pa, 0.0, 0.0, t)
                    zz = cubic(zb[i] + ra, zb[i] + ra + q["k1"] * hu, zt[i] - q["k2"] * hu, zt[i], t)
                rho = math.sqrt(a * a + ((z[i] - chest_z) / (up if z[i] > chest_z else down)) ** 2)
                fade = smooth01((1.0 - rho) / q["rim"])
                fade_z = smooth01((1.0 - rho) / q["rim_z"])
                sx = q["splay"] * (0.5 + 0.5 * a)
                raw = np.array([base[i, 0] + side[i] * sx * f, wall_y[i] - f, z[i] + (zz - z[i]) * fade_z])
                target[i] = base[i] + (raw - base[i]) * fade

            # Smooth the displacement so stretched polygons do not show as streaks.
            grow = target - base
            nb = np.zeros(n)
            np.add.at(nb, edges[:, 0], 1.0)
            np.add.at(nb, edges[:, 1], 1.0)
            nb = np.maximum(nb, 1.0)[:, None]
            for _ in range(q["smooth"]):
                acc = np.zeros((n, 3))
                np.add.at(acc, edges[:, 0], grow[edges[:, 1]])
                np.add.at(acc, edges[:, 1], grow[edges[:, 0]])
                grow = 0.5 * grow + 0.5 * acc / nb
            grow[z <= fold_z] = 0.0  # nothing slides over the underbust tape
            grow *= (1.0 - arm)[:, None]
            max_w = float((-grow[:, 1]).max()) / BREAST_STEP_M
            grow /= max_w

            def ramp(dist):
                t = np.clip(dist / (q["wall_fade"] * k), 0.0, 1.0)
                return t * t * (3.0 - 2.0 * t)

            g = ramp(x - 0.012 * k) * ramp(q["x_max"] * k - x) * ramp(z - fold_z) * ramp(top_z - z)
            flat = np.zeros((n, 3))
            flat[:, 1] = np.where(wide, (wall_y - y) * g, 0.0) * (1.0 - arm)
            neg_scale = BREAST_STEP_M / max(relief_max, 1e-4)  # flat key value per -1 of bust weight
            return {
                "breast_grow": grow, "breast_flat": flat, "breast_neg_scale": neg_scale,
                "breast_max_w": max_w, "breast_min_w": -FLAT_MAX / neg_scale,
            }

        def breast_shift(an, i, w):
            """Displacement of vertex i for bust weight w (either sign)."""
            if w >= 0.0:
                return Vector(an["breast_grow"][i]) * w
            return Vector(an["breast_flat"][i]) * min(FLAT_MAX, -w * an["breast_neg_scale"])

        def expand_keys(an, key_values):
            """A negative bust weight is carried by the flat key."""
            w = key_values.get("M_chest", 0.0)
            if gender != "female" or w >= 0.0:
                return key_values
            out = dict(key_values)
            out["M_chest"] = 0.0
            out[FLAT_KEY_NAME] = min(FLAT_MAX, -w * an["breast_neg_scale"])
            return out

        def leg_profile(name, z):
            """Thigh key fades out towards the knee; calf key is a bump around the calf."""
            center = centers[name]
            sigma = KEY_SIGMA[name] * height_m
            if name == "thigh":
                if z <= center:
                    return 1.0 - smoother01((center - z) / (center - knee_z))
                # Above its tape the thigh key hands over to the hips.
                return 1.0 - smoother01((z - center) / (centers["hip"] - center))
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

            bm = bmesh_from_objects([body])
            mound_now = front_point(bm, chest_z)[0]
            bm.free()
            an = {
                "mound_x": mound_now,
                "boundary": boundary, "joint_x": boundary(armpit_z),
                "coords": coords, "arm": arm, "arm_depth": arm_depth,
            }
            if gender == "female":
                an.update(breast_fields(an))

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
                    "arm_mean": mean, "arm_dir": direction, "arm_center": arm_center, "t_min": t_min,
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

            if name == "chest" and gender == "female":
                # Full bust: each breast grows towards a big natural shape; back and rib cage stay.
                return Vector(an["breast_grow"][i])

            if kind == "girth":
                g = torso_profile(name, co.z) * KEY_SCALE
                g_joint = torso_profile(name, armpit_z) * KEY_SCALE
                dy = co.y - axis_y
                r = math.hypot(co.x, dy)
                # Belly grows forward, hips grow backward (see DEPTH_BIAS).
                gain = 1.0 + DEPTH_BIAS.get(name, 0.0) * (-dy / r if r > 1e-6 else 0.0)
                return Vector((
                    (1.0 - arm) * co.x * g + arm * side * an["joint_x"] * g_joint,
                    (1.0 - an["arm_depth"][i]) * dy * g * gain,
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

        lats_z = (underbust_z + armpit_z) * 0.5
        glute_z = centers["hip"]
        mid_thigh_z = (centers["thigh"] + knee_z) * 0.5
        muscle_gain = 1.0 if gender == "male" else MUSCLE_FEMALE

        def lats_profile(z):
            return gaussian(z, lats_z, 0.05 * height_m) * 0.06

        def shape_shift(an, i, shape_id):
            """Displacement of vertex i for shape key S_<shape_id> at weight 1."""
            co = an["coords"][i]
            arm = an["arm"][i]
            side = 1.0 if co.x >= 0 else -1.0

            if shape_id == "muscle":
                total = Vector((0.0, 0.0, 0.0))
                # Lats: the upper torso gets wider (V shape); the arms ride out with it.
                total.x += ((1.0 - arm) * co.x * lats_profile(co.z)
                            + arm * side * an["joint_x"] * lats_profile(armpit_z))
                # Pectorals: the upper front of the chest comes forward.
                pec = mound_mask(an, i, underbust_z - 0.01 * height_m, chest_z + 0.01 * height_m,
                                 armpit_z + 0.05 * height_m, 0.05 * height_m)
                total.y -= 0.010 * pec
                # Glutes: rounder at the back of the hips.
                dy = co.y - axis_y
                r = math.hypot(co.x, dy)
                if r > 1e-6 and dy > 0.0:
                    back = smooth01((dy / r - 0.3) / 0.5)
                    total.y += 0.012 * back * gaussian(co.z, glute_z, 0.04 * height_m) * (1.0 - arm)
                # Quads: fuller mid thigh.
                if co.z < crotch_z - 0.02 * height_m and arm < 1.0:
                    g = 0.07 * gaussian(co.z, mid_thigh_z, 0.05 * height_m) * (1.0 - arm)
                    if g > 1e-5:
                        lx, ly = leg_center(an, co.z)
                        total.x += side * (abs(co.x) - lx) * g
                        total.y += (co.y - ly) * g
                # Deltoids and forearms: fuller around the arm axis.
                if arm > 0.0:
                    p = Vector((abs(co.x), co.y, co.z))
                    d = an["arm_dir"]
                    t = (p - an["arm_mean"]).dot(d)
                    length = an["arm_length"]
                    g = arm * (0.10 * gaussian(t, an["t_min"] + 0.08 * length, 0.07 * length)
                               + 0.07 * gaussian(t, an["t_min"] + 0.52 * length, 0.08 * length))
                    if g > 1e-5:
                        rr = p - an["arm_center"](t)
                        rr = rr - d * rr.dot(d)
                        total += Vector((side * rr.x * g, rr.y * g, rr.z * g))
                return total * muscle_gain

            if shape_id in ("gluteProjection", "gluteLift", "hipRoundness", "hipWidePoint"):
                if arm >= 1.0:
                    return None
                dy = co.y - axis_y
                r = math.hypot(co.x, dy)
                if r < 1e-6:
                    return None
                keep = 1.0 - arm
                fold_low = crotch_z - 0.03 * height_m
                if shape_id in ("gluteProjection", "gluteLift"):
                    # Cheek: back of the hips, between the fold and the top of the pelvis.
                    back = smoother01((dy / r - 0.15) / 0.6)
                    cheek = gaussian(abs(co.x), 0.05 * height_m, 0.035 * height_m)
                    rise = smoother01((co.z - fold_low) / (glute_z - fold_low))
                    fall = 1.0 - smoother01((co.z - glute_z) / (0.08 * height_m))
                    m = back * cheek * rise * fall * keep
                    if m <= 1e-5:
                        return None
                    if shape_id == "gluteProjection":
                        return Vector((0.0, 0.015 * m, 0.0))
                    # Lift: the fullest part moves up (and a little out); down for a negative value.
                    return Vector((0.0, 0.004 * m, 0.014 * m))
                # Side of the hips.
                flank = smoother01((abs(co.x) / r - 0.45) / 0.45) * keep
                if flank <= 1e-5:
                    return None
                if shape_id == "hipRoundness":
                    m = flank * gaussian(co.z, glute_z + 0.01 * height_m, 0.05 * height_m)
                    return Vector((side * 0.012 * m, 0.0, 0.0))
                # Widest point: fuller above the hip line, slimmer below (or the reverse).
                t = (co.z - glute_z) / (0.055 * height_m)
                m = flank * t * math.exp(-0.5 * t * t)
                return Vector((side * 0.016 * m, 0.0, 0.0))

            m = breast_dome(an, i, soft=True)
            if m <= 0.0:
                return None
            if shape_id == "breastLift":
                return Vector((0.0, 0.0, 0.015 * m * hang(co.z)))
            if shape_id == "breastSpacing":
                return Vector((side * 0.012 * m, 0.0, 0.0))
            if shape_id == "breastFullness":
                # Upper slope: + rounder, - teardrop.
                u = min(1.0, max(0.0, (co.z - chest_z) / dome_up))
                return Vector((0.0, -0.035 * m * u * (1.0 - u) * 4.0 * (1.0 - u), 0.0))
            if shape_id == "breastSag":
                # The breast drops and the upper slope empties a little.
                u = min(1.0, max(0.0, (co.z - chest_z) / dome_up))
                return Vector((0.0, 0.008 * m * u, -0.022 * m * hang(co.z)))
            if shape_id == "breastWidth":
                # + wider and flatter, - narrower and more projecting.
                return Vector((side * 0.20 * m * (abs(co.x) - an["mound_x"]), 0.006 * m, 0.0))
            raise ValueError(shape_id)

        def arm_shift_per_unit(an):
            """How far the +x arm moves as a rigid piece per unit weight of every key (meters)."""
            shifts = {HEIGHT_KEY_NAME: [0.0, 0.0, height_shift(armpit_z)]}
            for shape in shapes:
                dx = an["joint_x"] * lats_profile(armpit_z) * muscle_gain if shape["id"] == "muscle" else 0.0
                shifts[f"S_{shape['id']}"] = [dx, 0.0, 0.0]
            for name in measures:
                kind = KEY_KIND[name]
                if name == "chest" and gender == "female":
                    shifts[f"M_{name}"] = [0.0, 0.0, 0.0]
                elif kind == "girth":
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
            if gender == "female":
                sk = body.shape_key_add(name=FLAT_KEY_NAME, from_mix=False)
                for i, co in enumerate(coords):
                    shift = Vector(an["breast_flat"][i])
                    if shift.length_squared > 0.0:
                        sk.data[i].co = co + shift
            for shape in shapes:
                sk = body.shape_key_add(name=f"S_{shape['id']}", from_mix=False)
                for i, co in enumerate(coords):
                    shift = shape_shift(an, i, shape["id"])
                    if shift is not None and shift.length_squared > 0.0:
                        sk.data[i].co = co + shift

        def base_specs(an):
            specs = {}
            for name in measures:
                kind = KEY_KIND[name]
                if name == "chest" and gender == "female":
                    # Full bust: the fullest level near the bust line, like a tailor's tape.
                    specs[name] = {
                        "type": "girth", "pick": "max", "steps": 11,
                        # ...but always below the armpit, or the tape would catch the arms.
                        "range_m": [chest_z + BUST_RANGE_M[0],
                                    min(chest_z + BUST_RANGE_M[1], armpit_z - 0.008)],
                    }
                elif kind == "girth":
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
            key_values = expand_keys(an, key_values)
            for kb in mesh.shape_keys.key_blocks[1:]:
                value = key_values.get(kb.name, 0.0)
                kb.slider_min = min(kb.slider_min, value)
                kb.slider_max = max(kb.slider_max, value)
                kb.value = value
            h_weight = key_values.get(HEIGHT_KEY_NAME, 0.0)
            shifts = arm_shift_per_unit(an)
            specs = {"height": {"type": "height"}}
            for name, spec in base_specs(an).items():
                spec = dict(spec)
                if "height_m" in spec:
                    spec["height_m"] += h_weight * height_shift(spec["height_m"])
                elif "range_m" in spec:
                    spec["range_m"] = [z + h_weight * height_shift(z) for z in spec["range_m"]]
                else:
                    point = list(spec["point_m"])
                    for key, weight in key_values.items():
                        for axis in range(3):
                            point[axis] += weight * shifts.get(key, (0.0, 0.0, 0.0))[axis]
                    spec["point_m"] = point
                specs[name] = spec
            results, _ = measure_objects([body], specs)
            missing = [n for n, r in results.items() if r["value_cm"] is None]
            if missing:
                raise RuntimeError(f"ruler found nothing for {missing} with keys {key_values}")
            return {name: r["value_cm"] for name, r in results.items()}

        def calibrate(an, with_shapes):
            base = measure_with(an, {})
            columns = []
            for name in measures:
                one = measure_with(an, {f"M_{name}": 1.0})
                columns.append([one[m] - base[m] for m in measures])
            n = len(measures)
            matrix = [[columns[c][r] for c in range(n)] for r in range(n)]
            shape_matrix = [[] for _ in range(n)]
            if with_shapes:
                for shape in shapes:
                    one = measure_with(an, {f"S_{shape['id']}": 1.0})
                    for r, m in enumerate(measures):
                        shape_matrix[r].append(one[m] - base[m])
            tall = measure_with(an, {HEIGHT_KEY_NAME: 1.0})
            # The bust does not grow in a straight line with the breast key: store the curve.
            curves = {}
            if with_shapes and gender == "female":
                curve_weights = [
                    round(sh * (an["breast_max_w"] if sh > 0 else -an["breast_min_w"]), 4)
                    for sh in BREAST_CURVE_SHARES
                ]
                shape_levels = [
                    round(sh * (an["breast_max_w"] if sh > 0 else -an["breast_min_w"]), 4)
                    for sh in SHAPE_CAL_SHARES
                ]
                points = [
                    [w, base["chest"] if w == 0.0 else measure_with(an, {"M_chest": w})["chest"]]
                    for w in curve_weights
                ]
                # The dome and the rib cage do not simply add up: one extra measurement gives
                # the interaction term  chest = f(w) + L + c * L * (f(w) - f(0)),  L = frame part.
                # The breast and the rib cage do not simply add up, so the same curve is measured
                # again on a much bigger rib cage; the solver blends the two by rib cage size.
                frame_points = [
                    [w, measure_with(an, {"M_underbust": FRAME_CAL_WEIGHT, "M_chest": w})["chest"]]
                    for w in curve_weights
                ]
                # The rib cage key itself does not move the bust tape in a straight line either.
                frame_curve = [
                    [u, base["chest"] if u == 0.0 else measure_with(an, {"M_underbust": u})["chest"]]
                    for u in FRAME_CURVE_WEIGHTS
                ]
                # A shape slider changes the bust tape by a different amount on a small and on a
                # large breast, and differently in its two directions: measure both.
                effects = {}
                for shape in shapes:
                    if shape["id"].startswith(("glute", "hip")):
                        continue  # far from the bust tape
                    key = f"S_{shape['id']}"
                    plus, minus = [], []
                    for level in shape_levels:
                        at_level = measure_with(an, {"M_chest": level})["chest"]
                        up = measure_with(an, {"M_chest": level, key: 1.0})["chest"] - at_level
                        plus.append(round(up, 3))
                        if shape["min"] < 0.0:
                            down = measure_with(an, {"M_chest": level, key: -1.0})["chest"] - at_level
                            minus.append(round(down, 3))
                        else:
                            minus.append(round(-up, 3))
                    effects[key] = {"plus": plus, "minus": minus}
                curves["chest"] = {
                    "key": "M_chest",
                    # Negative weights go to the flat key: its value = -weight * negScale.
                    "negKey": FLAT_KEY_NAME,
                    "negScale": round(an["breast_neg_scale"], 6),
                    "negMax": FLAT_MAX,
                    "points": [[w, round(v, 3)] for w, v in points],
                    "framePoints": [[w, round(v, 3)] for w, v in frame_points],
                    "frameKey": "M_underbust",
                    "frameWeight": FRAME_CAL_WEIGHT,
                    "frameCurve": [[u, round(v, 3)] for u, v in frame_curve],
                    "shapeLevels": shape_levels,
                    "shapeEffects": effects,
                }
            for kb in mesh.shape_keys.key_blocks[1:]:
                kb.value = 0.0
            return base, matrix, tall, shape_matrix, curves

        fit_idx = [measures.index(m) for m in fit_measures]
        source = None
        for _ in range(FIT_PASSES):
            an = analyze()
            add_measurement_keys(an)
            base, matrix, _, _, _ = calibrate(an, with_shapes=False)
            if source is None:
                source = dict(base)
            sub = [[matrix[r][c] for c in fit_idx] for r in fit_idx]
            weights = solve_linear(sub, [targets[m] - base[m] for m in fit_measures])
            if gender == "female" and "chest" in fit_measures:
                # The bust is not a straight line in its weight (and shrinking uses another key):
                # find the weight by halving the interval, with the other fit keys applied.
                ci = fit_measures.index("chest")
                others = {f"M_{m}": wk for m, wk in zip(fit_measures, weights) if m != "chest"}
                lo, hi = an["breast_min_w"], an["breast_max_w"]
                for _ in range(12):
                    mid = (lo + hi) * 0.5
                    if measure_with(an, {**others, "M_chest": mid})["chest"] < targets["chest"]:
                        lo = mid
                    else:
                        hi = mid
                weights[ci] = (lo + hi) * 0.5
            body.shape_key_clear()
            for i, v in enumerate(mesh.vertices):
                total = Vector((0.0, 0.0, 0.0))
                for name, wk in zip(fit_measures, weights):
                    if name == "chest" and gender == "female":
                        total += breast_shift(an, i, wk)
                        continue
                    shift = key_shift(an, i, name)
                    if shift is not None:
                        total += shift * wk
                v.co = an["coords"][i] + total
            mesh.update()

        an = analyze()
        add_measurement_keys(an)
        base, matrix, tall, shape_matrix, curves = calibrate(an, with_shapes=True)

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
            # Shape sliders: how much every measure (row) changes per unit of every slider (column).
            "shapeKeys": [{**shape, "key": f"S_{shape['id']}"} for shape in shapes],
            "shapeMatrixCmPerUnit": [[round(x, 4) for x in row] for row in shape_matrix],
            "fitted": fit_measures,
            # Measures that do not follow their key in a straight line: weight -> cm with all
            # other keys at 0. The solver inverts the curve after the linear part.
            "curveKeys": curves,
            "heightKey": {
                "name": HEIGHT_KEY_NAME,
                "cmPerUnit": round(tall["height"] - base["height"], 4),
                "stretchFromM": round(z_from, 4),
                "stretchToM": round(z_to, 4),
            },
            "landmarksM": {m: round(centers[m], 4) for m in measures if m in centers},
            "measureSpecs": base_specs(an),
            "armShiftMPerUnit": arm_shift_per_unit(an),
            # reference = the real default profile; the anime body follows the relative
            # difference from it (its own limbs differ from the real defaults).
            "stylization": (
                {**STYLIZATION[style], "reference": {m: targets[m] for m in measures}}
                if STYLIZATION.get(style) else None
            ),
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
            filepath=os.path.join(source_dir, f"{stem}.glb"),
            export_format='GLB',
            use_selection=True,
            export_yup=True,
            export_apply=False,
            export_morph=True,
            # No normals per key: the site recomputes normals after it applies the keys
            # (scripts/compress_models.mjs strips them from older files too).
            export_morph_normal=False,
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
