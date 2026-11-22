#!/usr/bin/env python3
"""
AtelierForm 3D — Blender 4.x Sims-Style Parametric Human Generator & Shape-Key Rig
===================================================================================
Run in headless Blender or inside the Blender Scripting workspace / MCP for Blender:
    blender -b -P scripts/blender_sims_human_generator.py

Also supports sending directly to a running Blender MCP socket server (port 9876):
    python3 scripts/blender_sims_human_generator.py --send-mcp localhost:9876
"""

import json
import math
import os
import socket
import sys


def gaussian(val: float, center: float, sigma: float) -> float:
    d = (val - center) / max(1e-5, sigma)
    return math.exp(-0.5 * d * d)


def solve_ellipse_axes(circ_m: float, rho: float):
    """Inverse Ramanujan perimeter solver: P(a, b) = C, a = rho * b."""
    rho = max(0.35, min(3.0, rho))
    factor = math.pi * (3.0 * (rho + 1.0) - math.sqrt((3.0 * rho + 1.0) * (rho + 3.0)))
    b = circ_m / factor
    a = rho * b
    return a, b


def run_blender_generation():
    import bpy
    from mathutils import Vector

    def clear_scene():
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        for mesh in list(bpy.data.meshes):
            bpy.data.meshes.remove(mesh)
        for mat in list(bpy.data.materials):
            bpy.data.materials.remove(mat)

    def create_sims_skin_material(name: str, is_female: bool):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (0.76, 0.81, 0.88, 1.0) if is_female else (0.73, 0.78, 0.86, 1.0)
            bsdf.inputs["Roughness"].default_value = 0.30
            if "Metallic" in bsdf.inputs:
                bsdf.inputs["Metallic"].default_value = 0.05
            if "Coat Weight" in bsdf.inputs:
                bsdf.inputs["Coat Weight"].default_value = 0.38
            elif "Clearcoat" in bsdf.inputs:
                bsdf.inputs["Clearcoat"].default_value = 0.38
            if "Subsurface Weight" in bsdf.inputs:
                bsdf.inputs["Subsurface Weight"].default_value = 0.25
            elif "Subsurface" in bsdf.inputs:
                bsdf.inputs["Subsurface"].default_value = 0.15
        return mat

    def create_lofted_mesh_data(name: str, rings: list, cap_bottom=True, cap_top=True):
        """Builds a quad-dominant Blender Mesh from a list of 3D vertex rings (glTF Y-up, Z-forward -> Blender Z-up, -Y-forward)."""
        num_rings = len(rings)
        segs = len(rings[0])
        verts = []
        faces = []

        def to_blender_coords(v: Vector) -> tuple:
            return (v.x, -v.z, v.y)

        for ring in rings:
            for pt in ring:
                verts.append(to_blender_coords(pt))

        for r in range(num_rings - 1):
            row1 = r * segs
            row2 = (r + 1) * segs
            for s in range(segs):
                ns = (s + 1) % segs
                faces.append((row1 + s, row1 + ns, row2 + ns, row2 + s))

        if cap_bottom and num_rings > 0:
            c = Vector((0.0, 0.0, 0.0))
            for pt in rings[0]:
                c += pt
            c /= segs
            c_idx = len(verts)
            verts.append(to_blender_coords(c))
            for s in range(segs):
                ns = (s + 1) % segs
                faces.append((c_idx, ns, s))

        if cap_top and num_rings > 0:
            top_row = (num_rings - 1) * segs
            c = Vector((0.0, 0.0, 0.0))
            for pt in rings[-1]:
                c += pt
            c /= segs
            c_idx = len(verts)
            verts.append(to_blender_coords(c))
            for s in range(segs):
                ns = (s + 1) % segs
                faces.append((top_row + s, top_row + ns, c_idx))

        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        for poly in mesh.polygons:
            poly.use_smooth = True
        return mesh

    def link_lofted_object(name: str, rings: list, cap_bottom=True, cap_top=True):
        mesh = create_lofted_mesh_data(name, rings, cap_bottom, cap_top)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj

    def build_sims_character(gender: str, export_path: str):
        is_female = (gender == "female")

        p = {
            "totalHeight": 1.68 if is_female else 1.80,
            "yAnkle": 0.074 if is_female else 0.079,
            "yKnee": 0.46 if is_female else 0.495,
            "yCrotch": 0.77 if is_female else 0.825,
            "yHip": 0.865 if is_female else 0.93,
            "yHighHip": 0.96 if is_female else 1.025,
            "yWaist": 1.05 if is_female else 1.115,
            "yUnderbust": 1.13 if is_female else 1.23,
            "yChest": 1.21 if is_female else 1.31,
            "yUpperChest": 1.275 if is_female else 1.385,
            "yShoulder": 1.375 if is_female else 1.475,
            "yCervicale": 1.44 if is_female else 1.545,
            "yJaw": 1.515 if is_female else 1.625,
            "yHeadMax": 1.595 if is_female else 1.71,
            "yCrown": 1.68 if is_female else 1.80,
            "head": 0.56 if is_female else 0.58,
            "neck": 0.34 if is_female else 0.395,
            "upperChest": 0.86 if is_female else 0.98,
            "chest": 0.90 if is_female else 1.00,
            "underbust": 0.75 if is_female else 0.91,
            "waist": 0.68 if is_female else 0.84,
            "highHip": 0.85 if is_female else 0.91,
            "hip": 0.96 if is_female else 0.98,
            "shoulderWidth": 0.395 if is_female else 0.46,
            "bicep": 0.275 if is_female else 0.33,
            "elbow": 0.24 if is_female else 0.28,
            "forearm": 0.23 if is_female else 0.275,
            "wrist": 0.155 if is_female else 0.175,
            "handLength": 0.175 if is_female else 0.195,
            "handWidth": 0.08 if is_female else 0.095,
            "thigh": 0.56 if is_female else 0.58,
            "midThigh": 0.48 if is_female else 0.51,
            "knee": 0.365 if is_female else 0.39,
            "calf": 0.35 if is_female else 0.38,
            "ankle": 0.215 if is_female else 0.235,
            "footLength": 0.245 if is_female else 0.27,
            "footWidth": 0.09 if is_female else 0.105,
            "upperArmLen": 0.31 if is_female else 0.34,
            "forearmLen": 0.25 if is_female else 0.27,
        }

        hip_a, hip_b = solve_ellipse_axes(p["hip"], 1.39 if is_female else 1.32)
        hhip_a, hhip_b = solve_ellipse_axes(p["highHip"], 1.36 if is_female else 1.31)
        waist_a, waist_b = solve_ellipse_axes(p["waist"], 1.33 if is_female else 1.29)
        ubust_a, ubust_b = solve_ellipse_axes(p["underbust"], 1.35 if is_female else 1.34)
        chest_a, chest_b = solve_ellipse_axes(p["chest"], 1.32 if is_female else 1.39)
        uchest_a, uchest_b = solve_ellipse_axes(p["upperChest"], 1.45 if is_female else 1.51)
        neck_a, neck_b = solve_ellipse_axes(p["neck"], 1.05)
        head_a, head_b = solve_ellipse_axes(p["head"], 0.82)
        shoulder_half = p["shoulderWidth"] * 0.49

        # =====================================================================
        # 1. TORSO + NECK + SIMS-4 SCULPTED HEAD & FACE (130 rings x 72 segs)
        # =====================================================================
        torso_rings = []
        num_torso_rings = 130
        segs = 72

        stations = [
            (p["yCrotch"], hip_a * 0.84, hip_b * 0.68, hip_b * 0.76, -0.004),
            (p["yHip"], hip_a, hip_b * (0.89 if is_female else 0.93), hip_b * (1.06 if is_female else 1.02), -0.010),
            (p["yHighHip"], hhip_a, hhip_b * 0.96, hhip_b * 1.02, -0.002),
            (p["yWaist"], waist_a, waist_b * 0.98, waist_b * 0.99, 0.009),
            (p["yUnderbust"], ubust_a, ubust_b * 0.98, ubust_b * 1.01, 0.004),
            (p["yChest"], chest_a * (0.97 if is_female else 1.0), chest_b * 0.97, chest_b * 0.97, -0.002),
            (p["yUpperChest"], uchest_a, uchest_b * 0.95, uchest_b * 1.02, -0.007),
            (p["yShoulder"], shoulder_half * 0.92, uchest_b * 0.74, uchest_b * 0.84, -0.009),
            ((p["yShoulder"] + p["yCervicale"]) * 0.5, (shoulder_half * 0.92 + neck_a * 1.14) * 0.5, neck_b * 1.14, neck_b * 1.24, -0.005),
            (p["yCervicale"], neck_a * 1.06, neck_b * 1.02, neck_b * 1.05, -0.001),
            (p["yJaw"] - 0.014, neck_a * 0.95, neck_b * 0.96, neck_b * 0.96, 0.007),
            (p["yJaw"], head_a * 0.76, head_b * 0.88, head_b * 0.82, 0.015),
            (p["yJaw"] + (p["yHeadMax"] - p["yJaw"]) * 0.52, head_a * 0.97, head_b * 0.98, head_b * 0.98, 0.011),
            (p["yHeadMax"], head_a, head_b * 0.97, head_b * 1.04, 0.005),
            (p["yCrown"] - 0.02, head_a * 0.65, head_b * 0.65, head_b * 0.68, 0.003),
            (p["yCrown"], 0.006, 0.006, 0.006, 0.002),
        ]

        def interp_station(y_val: float):
            if y_val <= stations[0][0]:
                return stations[0][1:]
            if y_val >= stations[-1][0]:
                return stations[-1][1:]
            for idx in range(len(stations) - 1):
                y0, a0, bf0, bb0, cz0 = stations[idx]
                y1, a1, bf1, bb1, cz1 = stations[idx + 1]
                if y0 <= y_val <= y1:
                    t = (y_val - y0) / max(1e-5, y1 - y0)
                    st = t * t * (3.0 - 2.0 * t)
                    return (
                        a0 + (a1 - a0) * st,
                        bf0 + (bf1 - bf0) * st,
                        bb0 + (bb1 - bb0) * st,
                        cz0 + (cz1 - cz0) * st,
                    )
            return stations[-1][1:]

        head_h = p["yCrown"] - p["yJaw"]
        y_chin = p["yJaw"]
        y_lower_lip = p["yJaw"] + head_h * 0.14
        y_mouth = p["yJaw"] + head_h * 0.175
        y_upper_lip = p["yJaw"] + head_h * 0.21
        y_nose_tip = p["yJaw"] + head_h * 0.31
        y_eye = p["yJaw"] + head_h * 0.45
        y_brow = p["yJaw"] + head_h * 0.54

        bust_proj = 0.036 if is_female else 0.014
        glute_proj = 0.034 if is_female else 0.024

        for r in range(num_torso_rings):
            u = r / (num_torso_rings - 1)
            y = p["yCrotch"] + u * (p["yCrown"] - p["yCrotch"])
            a, bf, bb, cz = interp_station(y)

            bust_mask = gaussian(y, p["yChest"], 0.042 if is_female else 0.048) if y < p["yShoulder"] else 0.0
            ubust_mask = gaussian(y, p["yUnderbust"], 0.018)
            glute_mask = gaussian(y, p["yHip"], 0.052)
            gfold_mask = gaussian(y, p["yCrotch"] + 0.012, 0.015)
            navel_mask = gaussian(y, p["yWaist"] - 0.028, 0.011)
            scapula_mask = gaussian(y, p["yUpperChest"] - 0.01, 0.06)
            clavicle_mask = gaussian(y, p["yShoulder"] + 0.012, 0.02)
            crotch_mask = max(0.0, 1.0 - (y - p["yCrotch"]) / max(0.04, p["yHip"] - p["yCrotch"])) ** 1.8 if y < p["yHip"] else 0.0

            ring = []
            for s in range(segs):
                theta = (s / segs) * math.pi * 2.0
                cos_t = math.cos(theta)
                sin_t = math.sin(theta)
                abs_cos = abs(cos_t)

                x = a * cos_t
                z = (bf if sin_t >= 0 else bb) * sin_t
                y_off = 0.0

                if y < p["yJaw"] - 0.01:
                    if bust_mask > 0.001 and sin_t > 0:
                        lobe = gaussian(abs_cos, 0.43 if is_female else 0.48, 0.25 if is_female else 0.31)
                        cleavage = gaussian(abs_cos, 0.0, 0.13) * (sin_t ** 3)
                        z += bust_mask * bust_proj * (sin_t ** 1.25) * (1.12 * lobe + 0.18 - (0.38 if is_female else 0.24) * cleavage)
                    if ubust_mask > 0.001 and sin_t > 0.2:
                        z -= ubust_mask * (0.0085 if is_female else 0.004) * (sin_t ** 1.6)
                    if navel_mask > 0.001 and sin_t > 0.85:
                        z -= navel_mask * 0.006 * gaussian(abs_cos, 0.0, 0.055)
                    if glute_mask > 0.001 and sin_t < 0:
                        bsin = -sin_t
                        globe = gaussian(abs_cos, 0.41, 0.29)
                        cleft = gaussian(abs_cos, 0.0, 0.11) * (bsin ** 3.5)
                        z -= glute_mask * glute_proj * (bsin ** 1.15) * (1.08 * globe + 0.2 - 0.65 * cleft)
                    if gfold_mask > 0.001 and sin_t < -0.25:
                        z += gfold_mask * 0.0085 * ((-sin_t) ** 1.5) * gaussian(abs_cos, 0.42, 0.3)
                    if scapula_mask > 0.001 and sin_t < -0.15:
                        z -= scapula_mask * 0.010 * ((-sin_t) ** 1.4) * gaussian(abs_cos, 0.46, 0.26)
                    if p["yHip"] < y < p["yCervicale"] and sin_t < -0.4:
                        bsin = -sin_t
                        furrow = gaussian(abs_cos, 0.0, 0.09) * (bsin ** 3.5)
                        z += (0.0075 if is_female else 0.0095) * furrow
                    if clavicle_mask > 0.001 and sin_t > 0.25:
                        cbar = gaussian(abs_cos, 0.52, 0.32) - 0.7 * gaussian(abs_cos, 0.0, 0.13)
                        z += clavicle_mask * 0.005 * (sin_t ** 1.6) * cbar
                    if crotch_mask > 0.001:
                        y_off += crotch_mask * 0.030 * (abs_cos ** 1.6)
                else:
                    if sin_t > 0:
                        z += gaussian(y, y_chin + 0.008, 0.012) * (0.012 if is_female else 0.015) * gaussian(abs_cos, 0.0, 0.26) * (sin_t ** 1.4)
                        lip_h = gaussian(abs_cos, 0.0, 0.23)
                        z += gaussian(y, y_lower_lip, 0.0055) * 0.0085 * lip_h * (sin_t ** 2)
                        z += gaussian(y, y_upper_lip, 0.0055) * 0.0095 * lip_h * (sin_t ** 2)
                        z -= gaussian(y, y_mouth, 0.0028) * 0.0038 * lip_h * (sin_t ** 2)
                        nose_v = gaussian(y, y_nose_tip, 0.009) * 0.019 + (
                            math.sin(((y - y_nose_tip) / max(0.01, y_brow - y_nose_tip)) * math.pi) * 0.0135
                            if y_nose_tip <= y <= y_brow else 0.0
                        )
                        z += nose_v * gaussian(abs_cos, 0.0, 0.085) * (sin_t ** 3)
                        z -= gaussian(y, y_eye, 0.014) * gaussian(abs_cos, 0.34, 0.13) * 0.0095 * (sin_t ** 1.5)
                        z += gaussian(y, y_eye, 0.0075) * gaussian(abs_cos, 0.34, 0.08) * 0.0055 * (sin_t ** 1.6)
                        z += gaussian(y, y_brow, 0.011) * gaussian(abs_cos, 0.32, 0.22) * (0.0045 if is_female else 0.0075) * (sin_t ** 1.5)
                    ear_v = gaussian(y, (y_nose_tip + y_eye) * 0.52, 0.022)
                    ear_a = gaussian(sin_t, -0.08, 0.11)
                    if ear_v > 0.02 and ear_a > 0.02:
                        ep = ear_v * ear_a * 0.014
                        x += (1.0 if cos_t >= 0 else -1.0) * ep
                        z -= ep * 0.35

                ring.append(Vector((x, y + y_off, z + cz)))
            torso_rings.append(ring)

        torso_obj = link_lofted_object(f"Sims_{gender}_Body", torso_rings, True, True)

        # =====================================================================
        # 2. ARMS + 5-FINGER HANDS (Left & Right)
        # =====================================================================
        deltoid_a, deltoid_b = solve_ellipse_axes(p["bicep"] * (1.16 if is_female else 1.22), 0.88)
        bicep_a, bicep_b = solve_ellipse_axes(p["bicep"], 0.92)
        elbow_a, elbow_b = solve_ellipse_axes(p["elbow"], 1.06)
        forearm_a, forearm_b = solve_ellipse_axes(p["forearm"], 1.10)
        wrist_a, wrist_b = solve_ellipse_axes(p["wrist"], 1.34)
        palm_a = p["handWidth"] * 0.5
        palm_b = wrist_b * 0.72

        abd_rad = math.radians(15.5 if is_female else 17.5)
        carry_rad = math.radians(19.5 if is_female else 19.0)
        flex_rad = math.radians(9.5)

        sh_pt = Vector((shoulder_half * 0.95, p["yShoulder"], -0.012))
        root_pt = Vector((shoulder_half * 0.72, p["yShoulder"] + 0.008, -0.010))
        u_dir = Vector((math.sin(abd_rad), -math.cos(abd_rad), -0.035)).normalized()
        el_pt = sh_pt + u_dir * p["upperArmLen"]
        l_dir = Vector((math.sin(carry_rad), -math.cos(carry_rad) * math.cos(flex_rad), math.sin(flex_rad))).normalized()
        wr_pt = el_pt + l_dir * p["forearmLen"]
        h_dir = Vector((math.sin(carry_rad * 0.75), -math.cos(carry_rad * 0.75) * math.cos(flex_rad * 1.15), math.sin(flex_rad * 1.15))).normalized()
        htip_pt = wr_pt + h_dir * p["handLength"]

        arm_nodes = [
            (0.00, root_pt, deltoid_a * 0.95, deltoid_b * 1.02),
            (0.10, sh_pt, deltoid_a * 1.06, deltoid_b * 1.05),
            (0.30, sh_pt.lerp(el_pt, 0.52), bicep_a, bicep_b),
            (0.55, el_pt, elbow_a, elbow_b),
            (0.74, el_pt.lerp(wr_pt, 0.36), forearm_a, forearm_b),
            (1.00, wr_pt, wrist_a, wrist_b),
        ]

        def eval_arm_station(t_val: float):
            for idx in range(len(arm_nodes) - 1):
                t0, p0, a0, b0 = arm_nodes[idx]
                t1, p1, a1, b1 = arm_nodes[idx + 1]
                if t0 <= t_val <= t1:
                    u = (t_val - t0) / max(1e-5, t1 - t0)
                    su = u * u * (3.0 - 2.0 * u)
                    pos = p0.lerp(p1, u)
                    tang = (p1 - p0).normalized()
                    return pos, tang, a0 + (a1 - a0) * su, b0 + (b1 - b0) * su
            return arm_nodes[-1][1], l_dir, wrist_a, wrist_b

        fwd_ref = Vector((0.0, 0.0, 1.0))
        for side_sign, side_name in [(1.0, "L"), (-1.0, "R")]:
            arm_rings = []
            num_arm_rings = 40
            arm_segs = 40
            for r in range(num_arm_rings):
                t_val = r / (num_arm_rings - 1)
                c_pos, tang, aa, ab = eval_arm_station(t_val)
                lat_out = tang.cross(fwd_ref).normalized()
                ant_fwd = lat_out.cross(tang).normalized()
                delt_m = gaussian(t_val, 0.13, 0.08)
                bic_m = gaussian(t_val, 0.31, 0.10)
                ring = []
                for s in range(arm_segs):
                    theta = (s / arm_segs) * math.pi * 2.0
                    ca = math.cos(theta)
                    sa = math.sin(theta)
                    lo = ca * aa + (delt_m * 0.007 * (ca ** 1.3) if ca > 0 else 0.0)
                    la = sa * ab + (bic_m * 0.005 * (sa ** 1.5) if sa > 0 else 0.0)
                    pt = c_pos + lat_out * lo + ant_fwd * la
                    if side_sign < 0:
                        pt.x = -pt.x
                    ring.append(pt)
                if side_sign < 0:
                    ring.reverse()
                arm_rings.append(ring)
            link_lofted_object(f"Sims_{gender}_Arm_{side_name}", arm_rings, True, True)

            # 5-Finger Sculpted Hand (Palm + 4 Fingers + Opposable Thumb)
            dorsal_out = h_dir.cross(fwd_ref).normalized()
            thumb_side = dorsal_out.cross(h_dir).normalized()

            def hand_world(u_frac: float, w_frac: float, t_frac: float):
                pt = (
                    wr_pt
                    + h_dir * (u_frac * p["handLength"])
                    + thumb_side * (w_frac * palm_a)
                    + dorsal_out * (t_frac * wrist_a)
                )
                if side_sign < 0:
                    pt.x = -pt.x
                return pt

            palm_slices = [
                (0.00, wrist_b / palm_a, 1.00, 0.00),
                (0.16, 0.92, 0.92, 0.08),
                (0.34, 1.04, 0.82, 0.06),
                (0.50, 1.00, 0.70, 0.00),
                (0.54, 0.95, 0.58, 0.00),
            ]
            palm_rings = []
            for u_sl, ws, ts, wsh in palm_slices:
                pring = []
                for s in range(28):
                    th = (s / 28) * math.pi * 2.0
                    pring.append(hand_world(u_sl, math.sin(th) * ws + wsh, math.cos(th) * ts))
                if side_sign < 0:
                    pring.reverse()
                palm_rings.append(pring)
            link_lofted_object(f"Sims_{gender}_Palm_{side_name}", palm_rings, True, True)

            finger_specs = [
                ("Index", 0.51, 0.44, 0.72, 0.78, 0.21, 0.46, -0.22),
                ("Middle", 0.52, 0.48, 0.24, 0.25, 0.22, 0.48, -0.25),
                ("Ring", 0.51, 0.45, -0.24, -0.27, 0.21, 0.45, -0.28),
                ("Pinky", 0.49, 0.37, -0.72, -0.82, 0.18, 0.40, -0.32),
                ("Thumb", 0.22, 0.38, 0.85, 1.38, 0.26, 0.54, -0.18),
            ]
            for fname, ust, ulen, wb, wsp, rw, rt, ct in finger_specs:
                frings = []
                for st in [0.0, 0.35, 0.68, 0.92, 1.0]:
                    uf = ust + st * ulen
                    wc = wb + (wsp - wb) * st
                    tc = (st ** 1.7) * ct
                    tap = (1.0 - st * 0.24) if st < 0.9 else max(0.15, (1.0 - st) * 7.5)
                    fring = []
                    for s in range(14):
                        th = (s / 14) * math.pi * 2.0
                        fring.append(hand_world(uf, wc + math.sin(th) * rw * tap, tc + math.cos(th) * rt * tap))
                    if side_sign < 0:
                        fring.reverse()
                    frings.append(fring)
                link_lofted_object(f"Sims_{gender}_{fname}_{side_name}", frings, True, True)

        # =====================================================================
        # 3. PELVIS-INTEGRATED LEGS + 5-TOE ANATOMICAL FEET (Left & Right)
        # =====================================================================
        thigh_a, thigh_b = solve_ellipse_axes(p["thigh"], 0.92)
        mthigh_a, mthigh_b = solve_ellipse_axes(p["midThigh"], 0.94)
        knee_a, knee_b = solve_ellipse_axes(p["knee"], 0.96)
        calf_a, calf_b = solve_ellipse_axes(p["calf"], 0.93)
        ankle_a, ankle_b = solve_ellipse_axes(p["ankle"], 0.89)
        stance_x = max(thigh_a * 0.96, hip_a * (0.51 if is_female else 0.53))

        leg_stations = [
            (p["yHip"] - 0.005, thigh_a * 0.94, thigh_b * 1.04, -0.006),
            (p["yCrotch"] + 0.005, thigh_a * 1.01, thigh_b * 1.03, -0.002),
            (p["yCrotch"] - 0.032, thigh_a, thigh_b, 0.004),
            ((p["yCrotch"] + p["yKnee"]) * 0.5, mthigh_a, mthigh_b, 0.006),
            (p["yKnee"], knee_a, knee_b, 0.003),
            (p["yAnkle"] + (p["yKnee"] - p["yAnkle"]) * 0.65, calf_a, calf_b, -0.011),
            (p["yAnkle"], ankle_a, ankle_b, -0.006),
        ]

        for side_sign, side_name in [(1.0, "L"), (-1.0, "R")]:
            leg_rings = []
            num_leg_rings = 50
            leg_segs = 44
            for r in range(num_leg_rings):
                u = r / (num_leg_rings - 1)
                y = leg_stations[0][0] + u * (leg_stations[-1][0] - leg_stations[0][0])
                la, lb, lz = ankle_a, ankle_b, -0.006
                for idx in range(len(leg_stations) - 1):
                    y0, a0, b0, z0 = leg_stations[idx]
                    y1, a1, b1, z1 = leg_stations[idx + 1]
                    if y1 <= y <= y0:
                        t = (y0 - y) / max(1e-5, y0 - y1)
                        st = t * t * (3.0 - 2.0 * t)
                        la = a0 + (a1 - a0) * st
                        lb = b0 + (b1 - b0) * st
                        lz = z0 + (z1 - z0) * st
                        break
                calf_mask = gaussian(u, 0.74, 0.095)
                knee_mask = gaussian(u, 0.56, 0.042)
                ring = []
                for s in range(leg_segs):
                    theta = (s / leg_segs) * math.pi * 2.0
                    ct = math.cos(theta)
                    st = math.sin(theta)
                    dz = -calf_mask * 0.011 * ((-st) ** 1.35) if st < 0 else (knee_mask * 0.005 * (st ** 2.5) if st > 0.3 else 0.0)
                    px = side_sign * (stance_x * (0.98 - 0.03 * u) + ct * la)
                    pz = lz + st * lb + dz
                    ring.append(Vector((px, y, pz)))
                if side_sign < 0:
                    ring.reverse()
                leg_rings.append(ring)

            link_lofted_object(f"Sims_{gender}_Leg_{side_name}", leg_rings, True, True)

            # Anatomical Foot + 5 Toes
            ank_x = side_sign * (stance_x * 0.95)
            ank_y = p["yAnkle"]
            ank_z = -0.006
            flen = p["footLength"]
            fwid = p["footWidth"]
            half_fw = fwid * 0.5
            heel_z = ank_z - flen * 0.25
            ball_z = ank_z + flen * 0.52
            tbase_z = ank_z + flen * 0.58
            ttip_z = ank_z + flen * 0.75

            foot_slices = [
                (0.0015, heel_z + 0.008, tbase_z + 0.006, half_fw * 0.90),
                (0.010, heel_z + 0.002, tbase_z + 0.010, half_fw * 0.99),
                (0.022, heel_z, tbase_z + 0.004, half_fw * 0.96),
                (0.035, heel_z + 0.005, ball_z, half_fw * 0.84),
                (ank_y * 0.68, ank_z - ankle_b * 1.2, ank_z + flen * 0.25, ankle_a * 1.08),
                (ank_y + 0.003, ank_z - ankle_b * 0.96, ank_z + ankle_b * 0.96, ankle_a * 0.96),
            ]
            foot_rings = []
            for fy, zmin, zmax, hfw in foot_slices:
                zc = (zmin + zmax) * 0.5
                zh = (zmax - zmin) * 0.5
                fring = []
                for s in range(36):
                    th = (s / 36) * math.pi * 2.0
                    ct = math.cos(th)
                    st = math.sin(th)
                    wsc = 0.74 + 0.22 * (1.0 + st) if st < -0.2 else 1.0
                    fring.append(Vector((ank_x + ct * hfw * wsc, fy, zc + st * zh)))
                foot_rings.append(fring)
            link_lofted_object(f"Sims_{gender}_Foot_{side_name}", foot_rings, True, True)

            toe_specs = [
                ("Hallux", -0.66, 1.00, 0.23, 0.011),
                ("Toe2", -0.24, 0.96, 0.16, 0.0095),
                ("Toe3", 0.12, 0.88, 0.15, 0.0090),
                ("Toe4", 0.44, 0.78, 0.14, 0.0082),
                ("Toe5", 0.74, 0.64, 0.13, 0.0075),
            ]
            tspan = max(0.025, ttip_z - tbase_z)
            for tname, mfrac, lfrac, rw, rh in toe_specs:
                txc = ank_x + side_sign * (0.0035 + mfrac * half_fw * 0.88)
                trings = []
                for st in [0.0, 0.45, 0.85, 1.0]:
                    tz = tbase_z - 0.004 + st * tspan * lfrac
                    tap = (1.0 - st * 0.15) if st < 0.85 else max(0.2, (1.0 - st) * 5.5)
                    tyc = 0.002 + rh * 0.95
                    tring = []
                    for s in range(12):
                        th = (s / 12) * math.pi * 2.0
                        tring.append(Vector((
                            txc + math.cos(th) * half_fw * rw * tap,
                            max(0.0015, tyc + math.sin(th) * rh * tap),
                            tz,
                        )))
                    trings.append(tring)
                link_lofted_object(f"Sims_{gender}_{tname}_{side_name}", trings, True, True)

        # Join all parts into the unified Sims Character Mesh
        bpy.ops.object.select_all(action='DESELECT')
        for obj in list(bpy.context.collection.objects):
            obj.select_set(True)
        bpy.context.view_layer.objects.active = torso_obj
        bpy.ops.object.join()

        skin_mat = create_sims_skin_material(f"Sims_{gender}_Skin", is_female)
        torso_obj.data.materials.append(skin_mat)

        # =====================================================================
        # 4. CREATE 15 CREATE-A-SIM (CAS) SHAPE KEYS (MORPH TARGETS)
        # =====================================================================
        basis_key = torso_obj.shape_key_add(name="Basis", from_mix=False)
        basis_coords = [v.co.copy() for v in basis_key.data]

        shape_key_specs = [
            ("Chest_Size", p["yChest"], 0.075, 0.18, 0.24),
            ("Underbust_Size", p["yUnderbust"], 0.055, 0.16, 0.18),
            ("Waist_Width", p["yWaist"], 0.075, 0.25, 0.08),
            ("Waist_Depth", p["yWaist"], 0.075, 0.06, 0.25),
            ("HighHip_Width", p["yHighHip"], 0.065, 0.22, 0.16),
            ("Hip_Width", p["yHip"], 0.085, 0.25, 0.18),
            ("Glute_Projection", p["yHip"], 0.075, 0.04, 0.30),
            ("Shoulder_Width", p["yShoulder"], 0.065, 0.24, 0.08),
            ("Bicep_Size", p["yShoulder"] - 0.14, 0.08, 0.18, 0.18),
            ("Thigh_Size", p["yCrotch"] - 0.10, 0.12, 0.22, 0.22),
            ("Knee_Size", p["yKnee"], 0.07, 0.18, 0.18),
            ("Calf_Size", p["yAnkle"] + 0.24, 0.10, 0.22, 0.24),
            ("Ankle_Size", p["yAnkle"], 0.06, 0.18, 0.18),
            ("Neck_Size", p["yCervicale"] + 0.03, 0.05, 0.18, 0.18),
            ("Head_Size", p["yHeadMax"], 0.09, 0.14, 0.14),
        ]

        for sk_name, center_h, sigma_h, scale_x, scale_depth in shape_key_specs:
            sk = torso_obj.shape_key_add(name=sk_name, from_mix=False)
            for idx, v in enumerate(sk.data):
                base = basis_coords[idx]
                h = base.z
                w = gaussian(h, center_h, sigma_h)
                if w > 1e-3:
                    v.co.x = base.x * (1.0 + w * scale_x)
                    v.co.y = base.y * (1.0 + w * scale_depth)

        if export_path:
            os.makedirs(os.path.dirname(export_path), exist_ok=True)
            bpy.ops.export_scene.gltf(
                filepath=export_path,
                export_format='GLB',
                use_selection=True,
                export_yup=True,
                export_apply=False,
                export_morph=True,
                export_morph_normal=True,
            )
            print(f"[AtelierForm 3D Blender Pipeline] Exported {gender} Sims-style mannequin -> {export_path}")

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    models_dir = os.path.join(repo_root, "public", "models")

    clear_scene()
    build_sims_character("female", os.path.join(models_dir, "sims_female_mannequin.glb"))

    clear_scene()
    build_sims_character("male", os.path.join(models_dir, "sims_male_mannequin.glb"))


def send_to_blender_mcp(host_port: str):
    """Sends this generator script directly to a running 'MCP for Blender' socket server (default localhost:9876)."""
    host, port_str = host_port.split(":") if ":" in host_port else (host_port, "9876")
    port = int(port_str)
    with open(__file__, "r", encoding="utf-8") as f:
        script_code = f.read()

    payload = {
        "type": "execute_code",
        "params": {
            "code": script_code + "\nrun_blender_generation()\n"
        }
    }
    with socket.create_connection((host, port), timeout=15) as sock:
        sock.sendall(json.dumps(payload).encode("utf-8"))
        resp = sock.recv(65536).decode("utf-8", errors="replace")
        print(f"[Blender MCP Response]: {resp}")


if __name__ == "__main__":
    if "--send-mcp" in sys.argv:
        idx = sys.argv.index("--send-mcp")
        target = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else "localhost:9876"
        send_to_blender_mcp(target)
    else:
        run_blender_generation()
