#!/usr/bin/env python3
"""
AtelierForm 3D - mannequin generator built on the Blender Studio "Human Base Meshes" bundle (CC0).

Takes a stylized (or realistic) base body from the bundle, fits it to the default
tailoring profile and adds measurement shape keys calibrated in centimeters.

Run (Blender 5.3):
    blender -b --factory-startup --disable-autoexec -P scripts/blender_base_body_generator.py \
        [-- --style stylized|realistic] [--bundle path/to/human_base_meshes_bundle.blend]

The bundle is not stored in git. Download human-base-meshes-bundle-v1.4.1.zip from
https://download.blender.org/demo/asset-bundles/human-base-meshes/ and unpack it into
assets/human-base-meshes/.

Output per gender in public/models/:
    body_<gender>.glb               one skin + eyes, 5 shape keys (M_height, M_neck, M_chest, M_waist, M_hip)
    body_<gender>.calibration.json  cm per unit weight for every key, landmark heights
Check the result with scripts/verify_profiles.py.
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
DEFAULT_BUNDLE = os.path.join(
    REPO_ROOT, "assets", "human-base-meshes", "human-base-meshes-bundle-v1.4.1", "human_base_meshes_bundle.blend"
)
BUNDLE_NAME = "Blender Studio Human Base Meshes v1.4.1 (CC0)"

# Default tailoring profile per gender, in cm (matches the site presets female-m / male-m).
TARGETS_CM = {
    "female": {"totalHeight": 168.0, "neck": 34.0, "chest": 90.0, "waist": 68.0, "hip": 96.0},
    "male": {"totalHeight": 180.0, "neck": 39.5, "chest": 100.0, "waist": 84.0, "hip": 98.0},
}
GIRTH_ORDER = ["neck", "chest", "waist", "hip"]
# Vertical reach (sigma) of every girth key, as a fraction of body height.
KEY_SIGMA = {"neck": 0.013, "chest": 0.045, "waist": 0.045, "hip": 0.05}

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
GIRTH_KEY_SCALE = 0.10    # M_<girth> = 1.0 scales the torso cross-section by 10 % at its landmark
FIT_PASSES = 3
MULTIRES_LEVEL = 1        # realistic bodies carry a multires modifier
PROFILE_STEP_M = 0.005
ARM_MARGIN_M = 0.004      # torso boundary sits this far outside the torso surface
ARM_FADE_M = 0.03         # torso scaling blends into rigid arm motion over this distance
ARM_DEPTH_FADE_M = 0.10   # depth scaling fades into the arm over this (longer) distance
LEG_MARGIN_M = 0.05      # below the crotch the boundary sits this far outside the hips


def gaussian(val, center, sigma):
    d = (val - center) / max(1e-6, sigma)
    return 2.718281828459045 ** (-0.5 * d * d)


def run():
    import bpy
    from mathutils import Vector

    sys.path.insert(0, SCRIPT_DIR)
    from measure_glb import bmesh_from_objects, measure_objects, slice_components, solve_linear, tape_girth

    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    style = cli[cli.index("--style") + 1] if "--style" in cli else "stylized"
    bundle = cli[cli.index("--bundle") + 1] if "--bundle" in cli else DEFAULT_BUNDLE
    if not os.path.isfile(bundle):
        raise FileNotFoundError(f"Human Base Meshes bundle not found: {bundle} (see the header of this script)")
    models_dir = os.path.join(REPO_ROOT, "public", "models")
    os.makedirs(models_dir, exist_ok=True)

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
        # Bundle object names are not uniform ("body_female_stylized", "primitive_female_realistic").
        with bpy.data.libraries.load(bundle, link=False) as (src, dst):
            wanted = [
                n for n in src.objects
                if n.startswith("GEO-body_") and gender in n.split("_") and style in n and "primitive" not in n
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

        # ---- 1. Centre on the body axis, feet on the floor, exact total height -------------
        xs = [v.co.x for v in mesh.vertices]
        zs = [v.co.z for v in mesh.vertices]
        cx = (min(xs) + max(xs)) * 0.5
        k = height_m / (max(zs) - min(zs))
        min_z = min(zs)
        for v in mesh.vertices:
            v.co = Vector(((v.co.x - cx) * k, v.co.y * k, (v.co.z - min_z) * k))
        mesh.update()

        # ---- 2. Find landmarks from the girth profile ---------------------------------------
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
        landmarks = {"neck": neck_row[0], "chest": chest_row[0], "waist": waist_row[0], "hip": hip_row[0]}
        axis_y = waist_row[3]
        z_from = 0.045 * height_m
        z_to = landmarks["neck"] - 0.01 * height_m
        girth_specs = [(name, landmarks[name], KEY_SIGMA[name] * height_m) for name in GIRTH_ORDER]
        targets_cm = {name: targets[name] for name in GIRTH_ORDER}

        # ---- 3. Deformation fields -----------------------------------------------------------
        def torso_boundary_table():
            """(z, x) of the torso side; points beyond it (arms, hands) shift without thickening."""
            rows = [r for r in girth_profile() if crotch_z <= r[0] <= armpit_z]
            xs = [r[2] for r in rows]
            smooth = []
            for i in range(len(xs)):
                window = xs[max(0, i - 3):i + 4]
                smooth.append(sum(window) / len(window))
            return [(r[0], x + ARM_MARGIN_M) for r, x in zip(rows, smooth)]

        def make_boundary(table):
            lo_z, hi_z = table[0][0], table[-1][0]

            def boundary(z):
                if z <= lo_z:
                    return table[0][1] + LEG_MARGIN_M  # legs stay inside and scale with the hips
                if z >= hi_z:
                    return table[-1][1]  # shoulder joint line continues straight up
                i = min(len(table) - 2, int((z - lo_z) / PROFILE_STEP_M))
                z0, x0 = table[i]
                z1, x1 = table[i + 1]
                t = (z - z0) / max(1e-9, z1 - z0)
                return x0 + (x1 - x0) * t

            return boundary

        def girth_shift(co, weights, boundary):
            """XY shift of a point: the torso scales about the body axis, each arm moves
            as one rigid piece with its shoulder joint; the two blend near the joint line."""
            xb = boundary(co.z)
            side = 1.0 if co.x >= 0 else -1.0
            arm = min(1.0, max(0.0, (abs(co.x) - xb) / ARM_FADE_M))
            arm = arm * arm * (3.0 - 2.0 * arm)
            # Depth fades out more slowly, so the upper arm thickens a little with the chest
            # instead of the skin folding behind the shoulder.
            arm_depth = min(1.0, max(0.0, (abs(co.x) - xb) / ARM_DEPTH_FADE_M))
            arm_depth = arm_depth * arm_depth * (3.0 - 2.0 * arm_depth)
            # Arms end at the shoulders: the head (ears) always belongs to the torso field.
            head = min(1.0, max(0.0, (landmarks["neck"] - co.z) / (0.03 * height_m)))
            arm *= head
            arm_depth *= head
            joint_x = boundary(armpit_z)
            sx = sy = 0.0
            for (_, center, sigma), wk in zip(girth_specs, weights):
                if wk:
                    g = gaussian(co.z, center, sigma) * GIRTH_KEY_SCALE * wk
                    g_joint = gaussian(armpit_z, center, sigma) * GIRTH_KEY_SCALE * wk
                    sx += (1.0 - arm) * co.x * g + arm * side * joint_x * g_joint
                    sy += (1.0 - arm_depth) * (co.y - axis_y) * g
            return sx, sy

        def height_shift(z):
            return HEIGHT_KEY_M * min(1.0, max(0.0, (z - z_from) / (z_to - z_from)))

        def add_measurement_keys(boundary):
            body.shape_key_add(name="Basis", from_mix=False)
            coords = [v.co.copy() for v in mesh.vertices]
            hk = body.shape_key_add(name=HEIGHT_KEY_NAME, from_mix=False)
            for i, co in enumerate(coords):
                hk.data[i].co.z = co.z + height_shift(co.z)
            for kidx, name in enumerate(GIRTH_ORDER):
                sk = body.shape_key_add(name=f"M_{name}", from_mix=False)
                unit = [1.0 if j == kidx else 0.0 for j in range(len(GIRTH_ORDER))]
                for i, co in enumerate(coords):
                    sx, sy = girth_shift(co, unit, boundary)
                    if sx or sy:
                        sk.data[i].co.x = co.x + sx
                        sk.data[i].co.y = co.y + sy

        def measure_with(key_values):
            for kb in mesh.shape_keys.key_blocks[1:]:
                kb.value = key_values.get(kb.name, 0.0)
            h_weight = key_values.get(HEIGHT_KEY_NAME, 0.0)
            specs = {"height": {"type": "height"}}
            for name in GIRTH_ORDER:
                z = landmarks[name]
                specs[name] = {"type": "girth", "height_m": z + h_weight * height_shift(z)}
            results, _ = measure_objects([body], specs)
            return {name: r["value_cm"] for name, r in results.items()}

        def calibrate():
            base = measure_with({})
            columns = []
            for name in GIRTH_ORDER:
                one = measure_with({f"M_{name}": 1.0})
                columns.append([one[g] - base[g] for g in GIRTH_ORDER])
            n = len(GIRTH_ORDER)
            matrix = [[columns[c][r] for c in range(n)] for r in range(n)]
            tall = measure_with({HEIGHT_KEY_NAME: 1.0})
            for kb in mesh.shape_keys.key_blocks[1:]:
                kb.value = 0.0
            return base, matrix, tall

        source_girths = None
        for _ in range(FIT_PASSES):
            boundary = make_boundary(torso_boundary_table())
            add_measurement_keys(boundary)
            base, matrix, _ = calibrate()
            if source_girths is None:
                source_girths = dict(base)
            weights = solve_linear(matrix, [targets_cm[g] - base[g] for g in GIRTH_ORDER])
            coords = [v.co.copy() for v in mesh.vertices]
            body.shape_key_clear()
            for i, v in enumerate(mesh.vertices):
                sx, sy = girth_shift(coords[i], weights, boundary)
                v.co.x = coords[i].x + sx
                v.co.y = coords[i].y + sy
            mesh.update()

        boundary = make_boundary(torso_boundary_table())
        add_measurement_keys(boundary)
        base, matrix, tall = calibrate()

        # ---- 4. Export ------------------------------------------------------------------------
        glb_name = f"body_{gender}.glb"
        calibration = {
            "version": 1,
            "gender": gender,
            "style": style,
            "model": glb_name,
            "source": BUNDLE_NAME,
            "generatedWith": f"Blender {bpy.app.version_string}",
            "units": {"girths": "cm", "heights": "cm", "landmarks": "m"},
            "base": {"totalHeight": round(base["height"], 3), **{g: round(base[g], 3) for g in GIRTH_ORDER}},
            "targets": dict(targets),
            "sourceGirthsCm": {g: round(source_girths[g], 2) for g in GIRTH_ORDER},
            "girthOrder": GIRTH_ORDER,
            "girthKeys": [f"M_{g}" for g in GIRTH_ORDER],
            "matrixCmPerUnit": [[round(x, 4) for x in row] for row in matrix],
            "heightKey": {
                "name": HEIGHT_KEY_NAME,
                "cmPerUnit": round(tall["height"] - base["height"], 4),
                "stretchFromM": round(z_from, 4),
                "stretchToM": round(z_to, 4),
            },
            "landmarksM": {g: round(z, 4) for g, z in landmarks.items()},
            "stylization": STYLIZATION.get(style),
            "checks": {
                "heightCrossTalkCm": round(max(abs(tall[g] - base[g]) for g in GIRTH_ORDER), 4),
                "crotchM": round(crotch_z, 4),
                "armpitM": round(armpit_z, 4),
                "vertices": len(mesh.vertices),
            },
        }
        with open(os.path.join(models_dir, f"body_{gender}.calibration.json"), "w", encoding="utf-8") as fh:
            json.dump(calibration, fh, indent=2)
            fh.write("\n")

        bpy.ops.object.select_all(action='DESELECT')
        body.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(models_dir, glb_name),
            export_format='GLB',
            use_selection=True,
            export_yup=True,
            export_apply=False,
            export_morph=True,
            export_morph_normal=True,
        )
        print(f"[AtelierForm base body] {gender}: source girths {calibration['sourceGirthsCm']}")
        print(f"[AtelierForm base body] {gender}: base {calibration['base']} landmarks {calibration['landmarksM']} checks {calibration['checks']}")

    for gender in ("female", "male"):
        build(gender)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(2)
