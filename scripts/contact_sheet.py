"""Contact sheets: one image per body area with the same bodies and views every time.

Used as the visual gate before a changed body is wired into the site (owner approves the sheets).

blender -b --factory-startup -P scripts/contact_sheet.py -- --tag before [--style realistic|stylized]
        [--gender female|male] [--sheet sizes|torso|lower|limbs] [--out renders/contact]

Output: <out>/<tag>/<style>_<gender>_<sheet>.png (rows = bodies, columns = views).
Reads uncompressed models from models_src/ and the calibration from public/models/.
Weights come from solve_weights() in verify_profiles.py, the same math as the site.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
sys.path.insert(0, SCRIPT_DIR)
from verify_profiles import MODELS_DIR, SOURCE_DIR, solve_weights  # noqa: E402

PROFILES_DIR = os.path.join(SCRIPT_DIR, "profiles", "verify")
SUFFIX = {"realistic": "_realistic", "stylized": ""}

# Rows: verify profile names; "default" = the calibration's own targets.
ROWS = {
    "female": {
        "sizes": ["female-xs", "default", "female-l", "female-plus"],
        "torso": ["female-cup-a-plain", "female-cup-a", "default", "female-cup-f-plain", "female-cup-f",
                  "female-plus"],
        "lower": ["female-xs", "default", "female-l", "female-plus"],
        "limbs": ["female-xs", "default", "female-l", "female-plus"],
    },
    "male": {
        "sizes": ["male-s", "default", "male-athlete", "male-xl"],
        "torso": ["male-s", "default", "male-athlete", "male-xl"],
        "lower": ["male-s", "default", "male-athlete", "male-xl"],
        "limbs": ["male-s", "default", "male-athlete", "male-xl"],
    },
}

# Columns: (label, angle in degrees (0 = front), centre height as a share of body height,
#           visible height in metres (None = whole body), tile width, tile height).
SHEETS = {
    "sizes": [
        ("front", 0, None, None, 380, 660),
        ("three-quarter", 40, None, None, 380, 660),
        ("side", 90, None, None, 380, 660),
        ("back", 180, None, None, 380, 660),
    ],
    "torso": [
        ("front", 0, 0.73, 0.62, 440, 440),
        ("three-quarter", 40, 0.73, 0.62, 440, 440),
        ("side", 90, 0.73, 0.62, 440, 440),
        ("back", 180, 0.73, 0.62, 440, 440),
    ],
    "lower": [
        ("front", 0, 0.50, 0.72, 440, 440),
        ("side", 90, 0.50, 0.72, 440, 440),
        ("back three-quarter", 140, 0.50, 0.72, 440, 440),
        ("back", 180, 0.50, 0.72, 440, 440),
    ],
    "limbs": [
        ("legs front", 0, 0.27, 1.0, 400, 520),
        ("legs side", 90, 0.27, 1.0, 400, 520),
        ("arms and back", 180, 0.72, 1.0, 400, 520),
        ("neck and shoulder", 40, 0.86, 0.52, 400, 520),
    ],
}

BODY_COLOR = (0.80, 0.82, 0.86, 1.0)
TEXT_COLOR = (1.0, 1.0, 1.0, 1.0)


def arg(cli, name, default=None):
    return cli[cli.index(name) + 1] if name in cli else default


def load_profile(name, calibration):
    if name == "default":
        return {"name": "default", "targets_cm": dict(calibration["targets"]), "shape": {}}
    with open(os.path.join(PROFILES_DIR, name + ".json"), "r", encoding="utf-8") as fh:
        return json.load(fh)


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    shading = scene.display.shading
    shading.light = 'STUDIO'
    shading.color_type = 'OBJECT'
    shading.show_cavity = True
    shading.show_shadows = False
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    scene.world = bpy.data.worlds.new("w")
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    text_data = bpy.data.curves.new("label", 'FONT')
    text = bpy.data.objects.new("label", text_data)
    text.color = TEXT_COLOR
    text.parent = cam
    scene.collection.objects.link(text)
    return scene, cam, text


def load_body(path):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path, merge_vertices=True)
    meshes = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
    for obj in meshes:
        obj.color = BODY_COLOR
        # Normals stored in the file do not follow shape keys: drop them so shading shows the real surface.
        bpy.context.view_layer.objects.active = obj
        if obj.data.has_custom_normals:
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return meshes


def apply_weights(meshes, weights):
    for obj in meshes:
        if not obj.data.shape_keys:
            continue
        for kb in obj.data.shape_keys.key_blocks[1:]:
            v = float(weights.get(kb.name, 0.0))
            kb.slider_min = min(kb.slider_min, v)
            kb.slider_max = max(kb.slider_max, v)
            kb.value = v


def render_tile(scene, cam, text, label, view, height_m, path):
    _, deg, centre, span, width, height = view
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    visible_h = span if span else 2.0
    target_z = centre * height_m if centre is not None else 0.94
    # ortho_scale is the size of the longer side of the frame.
    cam.data.ortho_scale = visible_h * max(1.0, width / height)
    visible_w = visible_h * width / height
    a = math.radians(deg)
    target = Vector((0.0, 0.0, target_z))
    pos = target + Vector((math.sin(a) * 5.0, -math.cos(a) * 5.0, 0.0))  # body faces -Y
    cam.location = pos
    cam.rotation_euler = (target - pos).to_track_quat('-Z', 'Y').to_euler()
    size = visible_h * 0.042
    text.data.body = label
    text.data.size = size
    text.location = (-visible_w / 2 + size * 0.5, visible_h / 2 - size * 1.4, -1.0)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def read_pixels(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return buf.reshape(h, w, 4)


def compose(grid, path):
    """grid: rows of tile arrays (bottom-up pixel rows, as Blender stores them)."""
    rows = [np.concatenate(row, axis=1) for row in grid]
    sheet = np.concatenate(rows[::-1], axis=0)  # first row on top
    h, w, _ = sheet.shape
    img = bpy.data.images.new("sheet", w, h, alpha=False)
    img.pixels.foreach_set(sheet.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def main():
    cli = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    tag = arg(cli, "--tag", "latest")
    styles = [arg(cli, "--style")] if "--style" in cli else ["realistic"]
    genders = [arg(cli, "--gender")] if "--gender" in cli else ["female", "male"]
    sheets = [arg(cli, "--sheet")] if "--sheet" in cli else list(SHEETS)
    out_dir = os.path.join(os.path.abspath(arg(cli, "--out", os.path.join(REPO_ROOT, "renders", "contact"))), tag)
    tiles_dir = os.path.join(out_dir, "_tiles")
    os.makedirs(tiles_dir, exist_ok=True)

    written = []
    for style in styles:
        for gender in genders:
            stem = f"body_{gender}{SUFFIX[style]}"
            with open(os.path.join(MODELS_DIR, stem + ".calibration.json"), "r", encoding="utf-8") as fh:
                calibration = json.load(fh)
            scene, cam, text = setup_scene()
            meshes = load_body(os.path.join(SOURCE_DIR, stem + ".glb"))
            for sheet in sheets:
                grid = []
                for row_name in ROWS[gender][sheet]:
                    profile = load_profile(row_name, calibration)
                    weights = solve_weights(calibration, profile["targets_cm"], profile.get("shape"))
                    apply_weights(meshes, weights)
                    height_m = profile["targets_cm"]["totalHeight"] / 100.0
                    row = []
                    for view in SHEETS[sheet]:
                        tile = os.path.join(tiles_dir, f"{style}_{gender}_{sheet}_{row_name}_{view[1]}.png")
                        render_tile(scene, cam, text, f"{row_name} | {view[0]}", view, height_m, tile)
                        row.append(read_pixels(tile))
                    grid.append(row)
                path = os.path.join(out_dir, f"{style}_{gender}_{sheet}.png")
                compose(grid, path)
                written.append(path)
    print("=== CONTACT_SHEETS ===")
    for path in written:
        print(path)
    return 0


if __name__ == "__main__":
    try:
        code = main()
    except Exception:
        import traceback
        traceback.print_exc()
        code = 2
    sys.exit(code)
