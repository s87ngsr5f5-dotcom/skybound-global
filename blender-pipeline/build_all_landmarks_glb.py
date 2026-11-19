#!/usr/bin/env python3
"""
SKYBOUND GLOBAL — 50 World Landmarks Procedural Blender (bpy) -> GLB Builder
============================================================================

Builds 50 silhouette-accurate, flight-simulator-ready, real-world 1:1 metric scale
world landmark 3D models using Blender `bmesh` and exports each as Binary glTF 2.0
(`.glb`) to `../dist/models/landmarks/<id>.glb`.

Compatibility:
    Blender 3.6 LTS through Blender 4.3+ (uses safe Principled BSDF input checks
    for Emission / Emission Color and stable glTF 2.0 exporter parameters).

Conventions:
    - Scale: 1.0 Blender Unit = 1.0 Meter
    - Origin: (0, 0, 0) at ground-level bottom-center of each landmark
    - Axes: Blender +Z Up, +X East, +Y North -> exported with `export_yup=True`
      so Three.js receives +Y Up, +X East, -Z North
    - Standardized PBR & Night-Lighting Materials:
      `Glass_Curtain`, `Emissive_Windows`, `Emissive_Floodlight`, `Obstacle_Beacons`,
      `Bridge_International_Orange`, `Stone_Limestone`, `White_Marble`,
      `Verdigris_Copper`, `Gold_Leaf`, `Dark_Steel`, `Vermilion_Red`, `Sapphire_Tile`,
      plus complementary architectural materials.

Usage:
    # Build all 50 landmarks:
    blender --background --python build_all_landmarks_glb.py

    # Build a subset via environment variable:
    SKYBOUND_LANDMARKS="taipei_101,paris_eiffel,dubai_burj" blender --background --python build_all_landmarks_glb.py

    # Or pass IDs after `--`:
    blender --background --python build_all_landmarks_glb.py -- taipei_101 golden_gate
"""

import math
import os
import sys
import time
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector


# ==============================================================================
# 1. BLENDER 3.6 - 4.3+ SAFE MATERIAL SYSTEM
# ==============================================================================

def set_principled_emission(bsdf, rgba, strength):
    """Safely configure Principled BSDF emission across Blender 3.6 and 4.x."""
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = rgba
    elif "Emission" in bsdf.inputs:
        bsdf.inputs["Emission"].default_value = rgba
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = float(strength)


def _make_pbr_material(
    name,
    base_color,
    metallic=0.0,
    roughness=0.5,
    emission_color=None,
    emission_strength=0.0,
    alpha=1.0,
):
    """Create or replace a Principled BSDF PBR material safe for Blender 3.6-4.3+."""
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out_node = nodes.new(type="ShaderNodeOutputMaterial")
    out_node.location = (300, 0)

    bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

    if "Base Color" in bsdf.inputs:
        bsdf.inputs["Base Color"].default_value = (
            base_color[0],
            base_color[1],
            base_color[2],
            1.0,
        )
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = float(metallic)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = float(roughness)
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = float(alpha)

    if alpha < 0.999:
        if hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"

    if emission_color is not None and emission_strength > 0.0:
        rgba = (emission_color[0], emission_color[1], emission_color[2], 1.0)
        set_principled_emission(bsdf, rgba, emission_strength)

    return mat


def _hex(hex_str):
    """Convert #RRGGBB sRGB hex to linear-ish RGB tuple for Blender shaders."""
    s = hex_str.lstrip("#")
    r = int(s[0:2], 16) / 255.0
    g = int(s[2:4], 16) / 255.0
    b = int(s[4:6], 16) / 255.0
    # sRGB to linear approximation for accurate glTF PBR albedo
    def to_lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (to_lin(r), to_lin(g), to_lin(b))


def create_material_library():
    """Create the standardized SKYBOUND GLOBAL PBR material palette."""
    specs = {
        # Core required materials
        "Glass_Curtain": (_hex("#2A5E72"), 0.85, 0.12, None, 0.0, 1.0),
        "Emissive_Windows": (_hex("#FFE8A6"), 0.10, 0.25, _hex("#FFD97A"), 3.6, 1.0),
        "Emissive_Floodlight": (_hex("#FFF0CC"), 0.05, 0.30, _hex("#FFE099"), 2.8, 1.0),
        "Obstacle_Beacons": (_hex("#FF1500"), 0.10, 0.20, _hex("#FF1100"), 8.5, 1.0),
        "Bridge_International_Orange": (_hex("#C83828"), 0.38, 0.48, None, 0.0, 1.0),
        "Stone_Limestone": (_hex("#D6C9B0"), 0.02, 0.78, None, 0.0, 1.0),
        "White_Marble": (_hex("#F2F0E8"), 0.04, 0.34, None, 0.0, 1.0),
        "Verdigris_Copper": (_hex("#4F927C"), 0.35, 0.52, None, 0.0, 1.0),
        "Gold_Leaf": (_hex("#EAB928"), 0.94, 0.18, None, 0.0, 1.0),
        "Dark_Steel": (_hex("#2E343B"), 0.78, 0.38, None, 0.0, 1.0),
        "Vermilion_Red": (_hex("#BC1E18"), 0.14, 0.32, None, 0.0, 1.0),
        "Sapphire_Tile": (_hex("#123C84"), 0.22, 0.20, None, 0.0, 1.0),
        # Supplementary architectural PBR materials
        "Silver_Steel": (_hex("#CFD6DC"), 0.88, 0.20, None, 0.0, 1.0),
        "White_Concrete": (_hex("#E8EAE6"), 0.05, 0.62, None, 0.0, 1.0),
        "Dark_Glass": (_hex("#16232F"), 0.88, 0.10, None, 0.0, 1.0),
        "Warm_Sandstone": (_hex("#D4B47D"), 0.02, 0.84, None, 0.0, 1.0),
        "Granite_Grey": (_hex("#74736E"), 0.05, 0.72, None, 0.0, 1.0),
        "Pink_Granite": (_hex("#B89D8B"), 0.05, 0.64, None, 0.0, 1.0),
        "Red_Brick": (_hex("#9B4333"), 0.02, 0.82, None, 0.0, 1.0),
        "Turf_Green": (_hex("#356E38"), 0.00, 0.84, None, 0.0, 1.0),
        "Water_Turquoise": (_hex("#0EB2CA"), 0.10, 0.06, None, 0.0, 1.0),
        "Crimson_Metallic": (_hex("#C81D4E"), 0.76, 0.24, None, 0.0, 1.0),
        "Slate_Blue_Roof": (_hex("#2E4358"), 0.18, 0.50, None, 0.0, 1.0),
        "Eiffel_Bronze": (_hex("#745B42"), 0.65, 0.52, None, 0.0, 1.0),
        "Black_Anodized": (_hex("#1B1D21"), 0.75, 0.38, None, 0.0, 1.0),
        "Asphalt_Road": (_hex("#2A2C30"), 0.05, 0.85, None, 0.0, 1.0),
        "TowerBridge_Blue": (_hex("#3B8EAD"), 0.35, 0.36, None, 0.0, 1.0),
    }
    return {
        name: _make_pbr_material(name, *params)
        for name, params in specs.items()
    }


# ==============================================================================
# 2. PROCEDURAL BMESH GEOMETRY TOOLKIT
# ==============================================================================

def _rot_matrix(rx=0.0, ry=0.0, rz=0.0):
    """Build a 3x3 XYZ Euler rotation matrix."""
    m = Matrix.Identity(3)
    if rz:
        m = Matrix.Rotation(rz, 3, "Z") @ m
    if ry:
        m = Matrix.Rotation(ry, 3, "Y") @ m
    if rx:
        m = Matrix.Rotation(rx, 3, "X") @ m
    return m


def _safe_face(bm, verts, smooth=False):
    """Safely create a face in bmesh, skipping degenerate or duplicate faces."""
    if len(verts) < 3:
        return None
    if len(set(verts)) != len(verts):
        return None
    try:
        f = bm.faces.new(verts)
        f.smooth = smooth
        return f
    except ValueError:
        return None


class LandmarkBuilder:
    """
    Multi-material bmesh builder for a single landmark.
    Geometry is accumulated into per-material bmesh buckets and finalized into
    clean sub-mesh objects at exact world origin (0, 0, 0).
    """

    def __init__(self, landmark_id, materials):
        self.landmark_id = landmark_id
        self.materials = materials
        self.bms = {}

    def _bm(self, mat_name):
        if mat_name not in self.materials:
            mat_name = "White_Concrete"
        bm = self.bms.get(mat_name)
        if bm is None:
            bm = bmesh.new()
            self.bms[mat_name] = bm
        return bm

    def add_box(self, mat, center, size, rx=0.0, ry=0.0, rz=0.0):
        """Add an oriented rectangular box centered at `center` with dimensions `size`."""
        bm = self._bm(mat)
        cx, cy, cz = center
        hx, hy, hz = size[0] * 0.5, size[1] * 0.5, size[2] * 0.5
        if hx <= 1e-6 or hy <= 1e-6 or hz <= 1e-6:
            return
        rot = _rot_matrix(rx, ry, rz)
        local = [
            Vector((-hx, -hy, -hz)),
            Vector((hx, -hy, -hz)),
            Vector((hx, hy, -hz)),
            Vector((-hx, hy, -hz)),
            Vector((-hx, -hy, hz)),
            Vector((hx, -hy, hz)),
            Vector((hx, hy, hz)),
            Vector((-hx, hy, hz)),
        ]
        c = Vector((cx, cy, cz))
        vs = [bm.verts.new(c + (rot @ p)) for p in local]
        faces = [
            (0, 3, 2, 1),
            (4, 5, 6, 7),
            (0, 1, 5, 4),
            (1, 2, 6, 5),
            (2, 3, 7, 6),
            (3, 0, 4, 7),
        ]
        for idx in faces:
            _safe_face(bm, [vs[i] for i in idx], smooth=False)

    def add_box_z(self, mat, x, y, z0, z1, sx, sy, rz=0.0):
        """Add a vertical box spanning from z0 to z1 centered at (x, y)."""
        if z1 <= z0 + 1e-6:
            return
        self.add_box(mat, (x, y, 0.5 * (z0 + z1)), (sx, sy, z1 - z0), rz=rz)

    def add_prism(
        self,
        mat,
        rings,
        cap_bottom=True,
        cap_top=True,
        closed_ring=True,
        smooth=False,
    ):
        """
        Loft a mesh through a list of 3D point rings `[[(x,y,z), ...], ...]`.
        All rings must have the same number of points (>= 3).
        Uses centroid triangle fans for caps with > 4 verts so star/Y/concave
        profiles cap cleanly without n-gon triangulation artifacts.
        """
        if len(rings) < 2:
            return
        n = len(rings[0])
        if n < 3:
            return
        bm = self._bm(mat)
        v_rings = [[bm.verts.new(p) for p in ring] for ring in rings]

        seg_count = n if closed_ring else (n - 1)
        for r_idx in range(len(v_rings) - 1):
            r0 = v_rings[r_idx]
            r1 = v_rings[r_idx + 1]
            for i in range(seg_count):
                j = (i + 1) % n
                _safe_face(bm, [r0[i], r0[j], r1[j], r1[i]], smooth=smooth)

        def _cap(ring_vs, flip=False):
            if not closed_ring:
                return
            if len(ring_vs) <= 4:
                ordered = list(reversed(ring_vs)) if flip else list(ring_vs)
                _safe_face(bm, ordered, smooth=False)
            else:
                cx = sum(v.co.x for v in ring_vs) / len(ring_vs)
                cy = sum(v.co.y for v in ring_vs) / len(ring_vs)
                cz = sum(v.co.z for v in ring_vs) / len(ring_vs)
                cv = bm.verts.new((cx, cy, cz))
                for i in range(len(ring_vs)):
                    j = (i + 1) % len(ring_vs)
                    tri = [cv, ring_vs[j], ring_vs[i]] if flip else [cv, ring_vs[i], ring_vs[j]]
                    _safe_face(bm, tri, smooth=False)

        if cap_bottom:
            _cap(v_rings[0], flip=True)
        if cap_top:
            _cap(v_rings[-1], flip=False)

    def add_poly_extrude(
        self,
        mat,
        pts_2d,
        z0,
        z1,
        scale_top=1.0,
        rot_top=0.0,
        offset_bottom=(0.0, 0.0),
        offset_top=(0.0, 0.0),
        cap_bottom=True,
        cap_top=True,
        smooth=False,
    ):
        """Extrude a 2D polygon from z0 to z1 with optional top scaling, twist, and shear."""
        if z1 <= z0 + 1e-6 or len(pts_2d) < 3:
            return
        ox0, oy0 = offset_bottom
        ox1, oy1 = offset_top
        ca, sa = math.cos(rot_top), math.sin(rot_top)
        r0 = [(x + ox0, y + oy0, z0) for (x, y) in pts_2d]
        r1 = [
            (
                (x * ca - y * sa) * scale_top + ox1,
                (x * sa + y * ca) * scale_top + oy1,
                z1,
            )
            for (x, y) in pts_2d
        ]
        self.add_prism(
            mat, [r0, r1], cap_bottom=cap_bottom, cap_top=cap_top, smooth=smooth
        )

    def add_cylinder(
        self,
        mat,
        center_bottom,
        r_bottom,
        r_top,
        height,
        segs=16,
        rot_z=0.0,
        cap_bottom=True,
        cap_top=True,
        smooth=None,
    ):
        """Add a vertical cylinder, frustum, or cone."""
        if height <= 1e-6 or (r_bottom <= 1e-6 and r_top <= 1e-6):
            return
        if smooth is None:
            smooth = segs >= 12
        cx, cy, z0 = center_bottom
        z1 = z0 + height
        rb = max(r_bottom, 0.02)
        rt = max(r_top, 0.02)
        r0 = []
        r1 = []
        for i in range(segs):
            ang = rot_z + 2.0 * math.pi * i / segs
            ca, sa = math.cos(ang), math.sin(ang)
            r0.append((cx + rb * ca, cy + rb * sa, z0))
            r1.append((cx + rt * ca, cy + rt * sa, z1))
        self.add_prism(
            mat, [r0, r1], cap_bottom=cap_bottom, cap_top=cap_top, smooth=smooth
        )

    def add_ellipse_frustum(
        self,
        mat,
        center_bottom,
        rx0,
        ry0,
        rx1,
        ry1,
        height,
        segs=20,
        rot_z=0.0,
        cap_bottom=True,
        cap_top=True,
        smooth=True,
    ):
        """Add a vertical elliptical frustum."""
        if height <= 1e-6:
            return
        cx, cy, z0 = center_bottom
        z1 = z0 + height
        ca_r, sa_r = math.cos(rot_z), math.sin(rot_z)
        r0, r1 = [], []
        for i in range(segs):
            ang = 2.0 * math.pi * i / segs
            c, s = math.cos(ang), math.sin(ang)
            x0, y0 = rx0 * c, ry0 * s
            x1, y1 = rx1 * c, ry1 * s
            r0.append((cx + x0 * ca_r - y0 * sa_r, cy + x0 * sa_r + y0 * ca_r, z0))
            r1.append((cx + x1 * ca_r - y1 * sa_r, cy + x1 * sa_r + y1 * ca_r, z1))
        self.add_prism(
            mat, [r0, r1], cap_bottom=cap_bottom, cap_top=cap_top, smooth=smooth
        )

    def add_tube_between(self, mat, p0, p1, r0, r1=None, segs=8, cap=True, smooth=None):
        """Add a tapered strut/beam/cable cylinder between any two 3D points."""
        v0 = Vector(p0)
        v1 = Vector(p1)
        axis = v1 - v0
        length = axis.length
        if length <= 1e-5:
            return
        if r1 is None:
            r1 = r0
        if smooth is None:
            smooth = segs >= 10
        w = axis.normalized()
        ref = Vector((0.0, 0.0, 1.0)) if abs(w.z) < 0.92 else Vector((1.0, 0.0, 0.0))
        u = ref.cross(w).normalized()
        v = w.cross(u).normalized()

        ring0, ring1 = [], []
        for i in range(segs):
            ang = 2.0 * math.pi * i / segs
            d = u * math.cos(ang) + v * math.sin(ang)
            ring0.append(tuple(v0 + d * max(r0, 0.02)))
            ring1.append(tuple(v1 + d * max(r1, 0.02)))
        self.add_prism(
            mat, [ring0, ring1], cap_bottom=cap, cap_top=cap, smooth=smooth
        )

    def add_parabolic_cable(self, mat, p0, p1, sag, radius, segs=16, tube_segs=6):
        """Add a parabolic catenary cable between p0 and p1 dipping downward by `sag`."""
        v0, v1 = Vector(p0), Vector(p1)
        pts = []
        for i in range(segs + 1):
            t = i / segs
            p = v0.lerp(v1, t)
            p.z -= 4.0 * sag * t * (1.0 - t)
            pts.append(p)
        for i in range(segs):
            self.add_tube_between(
                mat, pts[i], pts[i + 1], radius, radius, segs=tube_segs, cap=(i in (0, segs - 1))
            )

    def add_sphere(self, mat, center, rx, ry=None, rz=None, u_segs=18, v_segs=10, smooth=True):
        """Add a UV ellipsoid/sphere with clean triangle fans at poles."""
        if ry is None:
            ry = rx
        if rz is None:
            rz = rx
        cx, cy, cz = center
        bm = self._bm(mat)
        v_bot = bm.verts.new((cx, cy, cz - rz))
        v_top = bm.verts.new((cx, cy, cz + rz))

        rings = []
        for j in range(1, v_segs):
            phi = -0.5 * math.pi + math.pi * j / v_segs
            cp, sp = math.cos(phi), math.sin(phi)
            ring = []
            for i in range(u_segs):
                theta = 2.0 * math.pi * i / u_segs
                ring.append(
                    bm.verts.new(
                        (cx + rx * cp * math.cos(theta), cy + ry * cp * math.sin(theta), cz + rz * sp)
                    )
                )
            rings.append(ring)

        for i in range(u_segs):
            ni = (i + 1) % u_segs
            _safe_face(bm, [v_bot, rings[0][ni], rings[0][i]], smooth=smooth)
            _safe_face(bm, [v_top, rings[-1][i], rings[-1][ni]], smooth=smooth)

        for r_idx in range(len(rings) - 1):
            r0, r1 = rings[r_idx], rings[r_idx + 1]
            for i in range(u_segs):
                ni = (i + 1) % u_segs
                _safe_face(bm, [r0[i], r0[ni], r1[ni], r1[i]], smooth=smooth)

    def add_dome(self, mat, center_bottom, rx, ry, rz, u_segs=20, v_segs=8, smooth=True):
        """Add a closed hemispherical/ellipsoidal dome resting at `center_bottom`."""
        cx, cy, cz = center_bottom
        bm = self._bm(mat)
        v_top = bm.verts.new((cx, cy, cz + rz))
        v_center = bm.verts.new((cx, cy, cz))

        rings = []
        for j in range(v_segs):
            phi = 0.5 * math.pi * j / v_segs
            cp, sp = math.cos(phi), math.sin(phi)
            ring = []
            for i in range(u_segs):
                theta = 2.0 * math.pi * i / u_segs
                ring.append(
                    bm.verts.new(
                        (cx + rx * cp * math.cos(theta), cy + ry * cp * math.sin(theta), cz + rz * sp)
                    )
                )
            rings.append(ring)

        for r_idx in range(len(rings) - 1):
            r0, r1 = rings[r_idx], rings[r_idx + 1]
            for i in range(u_segs):
                ni = (i + 1) % u_segs
                _safe_face(bm, [r0[i], r0[ni], r1[ni], r1[i]], smooth=smooth)

        for i in range(u_segs):
            ni = (i + 1) % u_segs
            _safe_face(bm, [v_top, rings[-1][i], rings[-1][ni]], smooth=smooth)
            _safe_face(bm, [v_center, rings[0][ni], rings[0][i]], smooth=False)

    def add_torus(
        self,
        mat,
        center,
        rx_major,
        rz_major,
        tube_rad_inplane,
        tube_rad_depth,
        major_segs=32,
        minor_segs=14,
        plane="XZ",
        rot_z=0.0,
        smooth=True,
    ):
        """Add an elliptical torus in XZ (vertical wheel/ring) or XY (horizontal ring)."""
        cx, cy, cz = center
        ca_r, sa_r = math.cos(rot_z), math.sin(rot_z)
        rings = []
        for i in range(major_segs):
            u = 2.0 * math.pi * i / major_segs
            cu, su = math.cos(u), math.sin(u)
            ring = []
            for j in range(minor_segs):
                v = 2.0 * math.pi * j / minor_segs
                cv, sv = math.cos(v), math.sin(v)
                if plane == "XZ":
                    lx = (rx_major + tube_rad_inplane * cv) * cu
                    ly = tube_rad_depth * sv
                    lz = (rz_major + tube_rad_inplane * cv) * su
                else:
                    lx = (rx_major + tube_rad_inplane * cv) * cu
                    ly = (rz_major + tube_rad_inplane * cv) * su
                    lz = tube_rad_depth * sv
                wx = cx + lx * ca_r - ly * sa_r
                wy = cy + lx * sa_r + ly * ca_r
                wz = cz + lz
                ring.append((wx, wy, wz))
            rings.append(ring)

        bm = self._bm(mat)
        v_rings = [[bm.verts.new(p) for p in r] for r in rings]
        for i in range(major_segs):
            ni = (i + 1) % major_segs
            for j in range(minor_segs):
                nj = (j + 1) % minor_segs
                _safe_face(
                    bm,
                    [v_rings[i][j], v_rings[ni][j], v_rings[ni][nj], v_rings[i][nj]],
                    smooth=smooth,
                )

    def add_pagoda_roof(
        self, mat, cx, cy, z_base, sx, sy, height, eave_flare=1.22, ridge_ratio=0.45, rz=0.0
    ):
        """Add a swept East Asian hip-and-gable roof with flared upturned eaves."""
        ca, sa = math.cos(rz), math.sin(rz)

        def _rect_ring(w, d, z, corner_lift=0.0):
            hw, hd = w * 0.5, d * 0.5
            pts = [
                (-hw, -hd, z + corner_lift),
                (0.0, -hd, z),
                (hw, -hd, z + corner_lift),
                (hw, 0.0, z),
                (hw, hd, z + corner_lift),
                (0.0, hd, z),
                (-hw, hd, z + corner_lift),
                (-hw, 0.0, z),
            ]
            out = []
            for x, y, zz in pts:
                out.append((cx + x * ca - y * sa, cy + x * sa + y * ca, zz))
            return out

        r0 = _rect_ring(sx * eave_flare, sy * eave_flare, z_base, corner_lift=height * 0.14)
        r1 = _rect_ring(sx * 0.96, sy * 0.96, z_base + height * 0.35, corner_lift=height * 0.04)
        r2 = _rect_ring(sx * 0.65, sy * 0.52, z_base + height * 0.72, corner_lift=0.0)
        r3 = _rect_ring(max(sx * ridge_ratio, 0.4), max(sy * 0.08, 0.4), z_base + height, corner_lift=0.0)
        self.add_prism(mat, [r0, r1, r2, r3], cap_bottom=True, cap_top=True, smooth=False)

    def add_window_bands(
        self, mat, cx, cy, z0, z1, sx, sy, count=8, band_h=1.4, outset=0.25, rz=0.0
    ):
        """Add horizontal emissive window strips around a rectangular tower shaft."""
        if count <= 0 or z1 <= z0:
            return
        step = (z1 - z0) / (count + 1)
        for i in range(1, count + 1):
            z = z0 + i * step
            self.add_box_z(mat, cx, cy, z - band_h * 0.5, z + band_h * 0.5, sx + outset, sy + outset, rz=rz)

    def add_ring_band(self, mat, cx, cy, z, radius, band_h=1.5, segs=20, rot_z=0.0):
        """Add a horizontal emissive ring around a cylindrical/curved tower."""
        self.add_cylinder(
            mat, (cx, cy, z - band_h * 0.5), radius, radius, band_h, segs=segs, rot_z=rot_z, smooth=True
        )

    def add_beacon(self, pos, radius=1.2):
        """Place an FAA/ICAO red aviation obstacle beacon sphere."""
        self.add_sphere("Obstacle_Beacons", pos, radius, radius, radius, u_segs=10, v_segs=6, smooth=True)

    def add_rect_arch_portal(self, mat, cx, cy, z0, height, width, depth, arch_w, arch_h, rz=0.0):
        """Add a solid rectangular portal pierced by an open barrel-vault archway along Y."""
        pier_w = (width - arch_w) * 0.5
        ca, sa = math.cos(rz), math.sin(rz)

        def _place(lx, ly, lz0, lz1, lsx, lsy):
            wx = cx + lx * ca - ly * sa
            wy = cy + lx * sa + ly * ca
            self.add_box_z(mat, wx, wy, lz0, lz1, lsx, lsy, rz=rz)

        # Left and right piers
        _place(-(arch_w * 0.5 + pier_w * 0.5), 0.0, z0, z0 + height, pier_w, depth)
        _place(+(arch_w * 0.5 + pier_w * 0.5), 0.0, z0, z0 + height, pier_w, depth)
        # Upper lintel above arch
        if height > arch_h:
            _place(0.0, 0.0, z0 + arch_h, z0 + height, arch_w + 0.2, depth)
        # Chamfered arch haunches for curved vault silhouette
        haunch_h = min(arch_w * 0.35, arch_h * 0.35)
        for sign in (-1.0, 1.0):
            _place(
                sign * (arch_w * 0.42),
                0.0,
                z0 + arch_h - haunch_h * 0.55,
                z0 + arch_h,
                arch_w * 0.18,
                depth * 0.96,
            )

    def finalize(self):
        """Convert all bmesh buckets into Blender scene objects ready for GLB export."""
        created = []
        for mat_name, bm in self.bms.items():
            if len(bm.verts) == 0 or len(bm.faces) == 0:
                bm.free()
                continue
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            mesh_name = f"{self.landmark_id}_{mat_name}_Mesh"
            obj_name = f"{self.landmark_id}_{mat_name}"
            mesh = bpy.data.meshes.new(mesh_name)
            bm.to_mesh(mesh)
            bm.free()
            mesh.materials.append(self.materials[mat_name])
            obj = bpy.data.objects.new(obj_name, mesh)
            bpy.context.scene.collection.objects.link(obj)
            created.append(obj)
        self.bms.clear()
        return created


# ==============================================================================
# 3. REGION 1 — TAIWAN (6 LANDMARKS)
# ==============================================================================

def _taipei101_w_notched_square(half_w, notch_depth):
    """Return 20-point W-notched square cross-section characteristic of Taipei 101."""
    h = half_w
    c = half_w * 0.78
    n = notch_depth
    # 4 sides with chamfered W-notched corners
    pts = [
        # South edge -> SE corner W-notch
        (-c, -h), (c, -h), (c, -h + n), (h - n, -h + n), (h - n, -c),
        # East edge -> NE corner W-notch
        (h, -c), (h, c), (h - n, c), (h - n, h - n), (c, h - n),
        # North edge -> NW corner W-notch
        (c, h), (-c, h), (-c, h - n), (-h + n, h - n), (-h + n, c),
        # West edge -> SW corner W-notch
        (-h, c), (-h, -c), (-h + n, -c), (-h + n, -h + n), (-c, -h + n),
    ]
    return pts


def build_taipei_101(b: LandmarkBuilder):
    """Taipei 101 (508m): podium, 8 flared W-notched bamboo modules, Ruyi crests, crown, 60m spire."""
    # 5-story adjacent luxury shopping mall podium (0m - 30m)
    b.add_box_z("Granite_Grey", 32.0, -28.0, 0.0, 28.0, 74.0, 82.0)
    b.add_box_z("Glass_Curtain", 32.0, -28.0, 26.0, 30.0, 62.0, 68.0)
    b.add_box_z("Emissive_Windows", 32.0, -28.0, 29.8, 31.2, 46.0, 52.0)

    # Truncated pyramidal tower base (0m - 64m, 62m -> 46m)
    base_bot = _taipei101_w_notched_square(31.0, 3.2)
    base_top = _taipei101_w_notched_square(23.0, 2.6)
    b.add_prism(
        "Glass_Curtain",
        [
            [(x, y, 0.0) for x, y in base_bot],
            [(x, y, 64.0) for x, y in base_top],
        ],
    )
    # 4 circular traditional Chinese coin emblems on the 4 base faces at ~50m
    for ang in (0.0, 0.5 * math.pi, math.pi, 1.5 * math.pi):
        cx, cy = math.cos(ang) * 25.5, math.sin(ang) * 25.5
        b.add_box("Silver_Steel", (cx, cy, 50.0), (14.0, 2.2, 14.0), rz=ang + 0.5 * math.pi)
        b.add_box("Emissive_Windows", (cx, cy, 50.0), (5.5, 2.6, 5.5), rz=ang + 0.5 * math.pi)

    # 8 stacked inverted-trapezoidal ("dou" / bamboo joint) modules (64m - 408m, 43m each)
    for m in range(8):
        z0 = 64.0 + m * 43.0
        z1 = z0 + 43.0
        # Slight overall taper with strong 7-degree outward flare per module
        hw_bot = 21.5 - m * 0.45
        hw_top = hw_bot + 4.8
        p_bot = _taipei101_w_notched_square(hw_bot, 2.4)
        p_top = _taipei101_w_notched_square(hw_top, 2.9)
        b.add_prism(
            "Glass_Curtain",
            [[(x, y, z0) for x, y in p_bot], [(x, y, z1) for x, y in p_top]],
        )
        # Silver corner ridge cladding & glowing top rim LED strip
        rim_pts = _taipei101_w_notched_square(hw_top + 0.45, 2.9)
        b.add_prism(
            "Silver_Steel",
            [[(x, y, z1 - 1.8) for x, y in rim_pts], [(x, y, z1 + 0.4) for x, y in rim_pts]],
        )
        b.add_window_bands("Emissive_Windows", 0.0, 0.0, z0 + 4.0, z1 - 4.0, hw_bot * 2.04, hw_bot * 2.04, count=3, band_h=1.6)
        b.add_box_z("Emissive_Windows", 0.0, 0.0, z1 - 0.6, z1 + 0.6, hw_top * 2.02, hw_top * 2.02)
        # Double-curled Ruyi cloud brackets at the 4 corners of each bamboo module
        for sx in (-1.0, 1.0):
            for sy in (-1.0, 1.0):
                rx = sx * (hw_top - 1.2)
                ry = sy * (hw_top - 1.2)
                b.add_box("Silver_Steel", (rx, ry, z1 + 1.8), (4.6, 4.6, 5.5), rz=0.25 * math.pi)
                b.add_box("Gold_Leaf", (rx * 1.03, ry * 1.03, z1 + 4.2), (3.0, 3.0, 2.4), rz=0.25 * math.pi)

    # 4-level tapered mechanical crown & 89F-91F observatory (408m - 448m)
    crown_tiers = [(408.0, 422.0, 32.0), (422.0, 434.0, 24.0), (434.0, 443.0, 17.0), (443.0, 448.0, 11.5)]
    for z0, z1, w in crown_tiers:
        b.add_box_z("Silver_Steel", 0.0, 0.0, z0, z1, w, w)
        b.add_box_z("Emissive_Windows", 0.0, 0.0, z0 + 1.5, z1 - 1.5, w + 0.5, w + 0.5)

    # 60m telescopic pinnacle spire (448m - 508m)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 448.0), 4.6, 3.0, 22.0, segs=12)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 470.0), 2.8, 1.4, 22.0, segs=12)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 492.0), 1.2, 0.25, 16.0, segs=10)
    for zr in (458.0, 472.0, 488.0):
        b.add_ring_band("Emissive_Windows", 0.0, 0.0, zr, 4.2 - (zr - 458.0) * 0.06, band_h=1.2, segs=12)

    # Aviation obstacle beacons
    b.add_beacon((0.0, 0.0, 508.5), 1.6)
    b.add_beacon((0.0, 0.0, 448.5), 1.2)
    for sx in (-22.0, 22.0):
        for sy in (-22.0, 22.0):
            b.add_beacon((sx, sy, 410.0), 1.1)


def build_taipei_cks(b: LandmarkBuilder):
    """CKS Memorial Hall & Liberty Square Complex (70m H x 250m W x 400m D)."""
    # Main stone plaza terrace
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 0.0, 1.2, 240.0, 380.0)

    # 1. Main Memorial Hall (East end, x = +135m)
    hx = 135.0
    # 3-tiered white marble platform (0m - 14.5m)
    b.add_box_z("White_Marble", hx, 0.0, 0.0, 5.0, 84.0, 84.0)
    b.add_box_z("White_Marble", hx, 0.0, 5.0, 10.0, 76.0, 76.0)
    b.add_box_z("White_Marble", hx, 0.0, 10.0, 14.5, 68.0, 68.0)
    # Grand 84-step ceremonial staircase on West face
    for s in range(6):
        t = s / 6.0
        b.add_box_z("White_Marble", hx - 42.0 - (5 - s) * 3.5, 0.0, 0.0, 2.4 + t * 12.1, 4.2, 26.0)
    # Main square hall body (14.5m - 45m)
    b.add_box_z("White_Marble", hx, 0.0, 14.5, 45.0, 56.0, 56.0)
    b.add_box_z("Dark_Steel", hx - 28.2, 0.0, 14.5, 34.0, 2.0, 16.0)
    b.add_box_z("Emissive_Windows", hx - 28.6, 0.0, 16.0, 31.0, 1.2, 12.0)
    # Sapphire-blue octagonal double-eave palace roof (45m - 70m)
    b.add_cylinder("Sapphire_Tile", (hx, 0.0, 44.5), 39.0, 25.0, 9.5, segs=8, rot_z=math.pi / 8.0, smooth=False)
    b.add_cylinder("White_Marble", (hx, 0.0, 53.5), 23.0, 22.0, 3.5, segs=8, rot_z=math.pi / 8.0, smooth=False)
    b.add_cylinder("Sapphire_Tile", (hx, 0.0, 56.5), 28.0, 3.0, 10.5, segs=8, rot_z=math.pi / 8.0, smooth=False)
    b.add_cylinder("Gold_Leaf", (hx, 0.0, 66.8), 2.8, 0.4, 3.2, segs=12)
    b.add_beacon((hx, 0.0, 70.5), 0.9)

    # 2. National Theater (South, y = -95m) & National Concert Hall (North, y = +95m)
    for sy_pos in (-95.0, 95.0):
        b.add_box_z("White_Marble", -15.0, sy_pos, 0.0, 6.0, 104.0, 68.0)
        b.add_box_z("Vermilion_Red", -15.0, sy_pos, 6.0, 22.0, 88.0, 54.0)
        b.add_window_bands("Emissive_Windows", -15.0, sy_pos, 7.0, 20.0, 89.0, 55.0, count=2, band_h=2.0)
        # Colonnade vermilion pillars
        for px in range(-50, 21, 14):
            for py in (-28.0, 28.0):
                b.add_cylinder("Vermilion_Red", (px, sy_pos + py, 6.0), 1.1, 1.0, 16.0, segs=8)
        # Double-eave imperial gold palace roof
        b.add_pagoda_roof("Gold_Leaf", -15.0, sy_pos, 22.0, 92.0, 58.0, 8.0, eave_flare=1.18, ridge_ratio=0.72)
        b.add_pagoda_roof("Gold_Leaf", -15.0, sy_pos, 29.5, 68.0, 38.0, 12.5, eave_flare=1.16, ridge_ratio=0.55)

    # 3. Liberty Square Archway / Paifang (West entrance, x = -165m, 30m H x 80m W)
    ax = -165.0
    pillar_ys = (-36.0, -21.0, -7.5, 7.5, 21.0, 36.0)
    for py in pillar_ys:
        b.add_box_z("White_Marble", ax, py, 0.0, 18.0, 4.8, 3.8)
    # Horizontal white marble lintel beams
    b.add_box_z("White_Marble", ax, 0.0, 14.0, 18.5, 4.6, 76.0)
    b.add_box_z("Emissive_Floodlight", ax, 0.0, 15.0, 17.5, 5.0, 14.0)
    # 5 tiered sapphire-blue glazed tile roofs
    b.add_pagoda_roof("Sapphire_Tile", ax, 0.0, 21.5, 11.0, 20.0, 8.5, eave_flare=1.25, ridge_ratio=0.6)
    for y_mid, z_r, w_r in ((-14.2, 18.5, 16.0), (14.2, 18.5, 16.0), (-28.5, 16.0, 15.0), (28.5, 16.0, 15.0)):
        b.add_pagoda_roof("Sapphire_Tile", ax, y_mid, z_r, 9.5, w_r, 6.2, eave_flare=1.22, ridge_ratio=0.6)


def build_taipei_grand_hotel(b: LandmarkBuilder):
    """The Grand Hotel Taipei (87m H x 116m W x 68m D)."""
    # Two-level hillside terraced podium (0m - 18m)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 0.0, 10.0, 118.0, 72.0)
    b.add_box_z("White_Marble", 0.0, 0.0, 10.0, 18.0, 104.0, 60.0)
    b.add_box_z("Vermilion_Red", 0.0, -33.0, 0.0, 14.0, 32.0, 6.0)
    b.add_pagoda_roof("Gold_Leaf", 0.0, -33.0, 14.0, 36.0, 10.0, 5.5, eave_flare=1.2, ridge_ratio=0.7)

    # Main 14-story palatial tower block (18m - 66m)
    b.add_box_z("White_Concrete", 0.0, 0.0, 18.0, 66.0, 86.0, 44.0)
    # 8 continuous wrap-around balcony tiers & warm amber emissive guestroom windows
    for tier in range(8):
        z = 21.0 + tier * 5.6
        b.add_box_z("Vermilion_Red", 0.0, 0.0, z, z + 1.5, 94.0, 52.0)
        b.add_box_z("Emissive_Windows", 0.0, 0.0, z + 1.5, z + 4.4, 87.2, 45.2)

    # Thick cylindrical vermilion perimeter columns
    for px in (-44.0, -33.0, -22.0, -11.0, 0.0, 11.0, 22.0, 33.0, 44.0):
        for py in (-24.5, 24.5):
            b.add_cylinder("Vermilion_Red", (px, py, 18.0), 1.35, 1.35, 48.0, segs=10)
    for py in (-12.0, 0.0, 12.0):
        for px in (-45.5, 45.5):
            b.add_cylinder("Vermilion_Red", (px, py, 18.0), 1.35, 1.35, 48.0, segs=10)

    # Recessed upper imperial attic & colossal double-eave golden hip-and-gable roof (66m - 87m)
    b.add_box_z("Vermilion_Red", 0.0, 0.0, 66.0, 72.0, 74.0, 36.0)
    b.add_pagoda_roof("Gold_Leaf", 0.0, 0.0, 65.5, 98.0, 56.0, 9.5, eave_flare=1.20, ridge_ratio=0.72)
    b.add_pagoda_roof("Gold_Leaf", 0.0, 0.0, 74.0, 78.0, 42.0, 13.0, eave_flare=1.22, ridge_ratio=0.60)
    b.add_beacon((-23.0, 0.0, 87.5), 0.9)
    b.add_beacon((23.0, 0.0, 87.5), 0.9)


def build_kaohsiung_85(b: LandmarkBuilder):
    """Kaohsiung 85 Sky Tower (378m): hollow '高' twin piers, merged shaft, pyramid crown, spire."""
    # Low inner street-level podium (0m - 26m)
    b.add_box_z("Granite_Grey", 0.0, 0.0, 0.0, 24.0, 84.0, 56.0)
    b.add_window_bands("Emissive_Windows", 0.0, 0.0, 4.0, 22.0, 84.4, 56.4, count=3, band_h=1.8)

    # Twin pronged lower piers (0m - 185m) framing an open 42m central hollow atrium void
    for sign in (-1.0, 1.0):
        px = sign * 30.5
        b.add_box_z("Glass_Curtain", px, 0.0, 0.0, 168.0, 23.0, 50.0)
        b.add_box_z("Silver_Steel", px, 0.0, 168.0, 178.0, 20.0, 44.0)
        b.add_box_z("Glass_Curtain", px, 0.0, 178.0, 186.0, 14.0, 34.0)
        b.add_window_bands("Emissive_Windows", px, 0.0, 26.0, 164.0, 23.4, 50.4, count=14, band_h=1.5)
        # 45-degree chamfered inner shoulders bridging into the merged shaft (145m - 172m)
        b.add_poly_extrude(
            "Silver_Steel",
            [(-10.0, -24.0), (10.0, -24.0), (10.0, 24.0), (-10.0, 24.0)],
            145.0,
            172.0,
            offset_bottom=(px, 0.0),
            offset_top=(sign * 14.0, 0.0),
        )
        b.add_beacon((px, 0.0, 187.0), 1.1)

    # Merged central upper tower shaft (160m - 310m)
    b.add_box_z("Glass_Curtain", 0.0, 0.0, 160.0, 310.0, 44.0, 44.0)
    b.add_box_z("Silver_Steel", 0.0, 0.0, 160.0, 166.0, 62.0, 46.0)
    b.add_window_bands("Emissive_Windows", 0.0, 0.0, 168.0, 306.0, 44.5, 44.5, count=14, band_h=1.6)

    # 3-tier stepped chamfered pyramid crown (310m - 347.5m)
    b.add_cylinder("Glass_Curtain", (0.0, 0.0, 310.0), 28.0, 21.0, 14.0, segs=8, rot_z=math.pi / 8.0, smooth=False)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 324.0), 21.0, 13.0, 12.0, segs=8, rot_z=math.pi / 8.0, smooth=False)
    b.add_cylinder("Glass_Curtain", (0.0, 0.0, 336.0), 13.0, 2.5, 11.5, segs=8, rot_z=math.pi / 8.0, smooth=False)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 324.0, 21.6, band_h=1.8, segs=8, rot_z=math.pi / 8.0)

    # 30.5m pinnacle communications spire (347.5m - 378m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 347.5), 2.2, 0.35, 30.5, segs=10)
    b.add_beacon((0.0, 0.0, 378.5), 1.4)


def build_kaohsiung_music(b: LandmarkBuilder):
    """Kaohsiung Music Center (68m H x 280m W x 180m D): Wave Towers, Coral Reef, Whale Pods."""
    # Waterfront plaza apron
    b.add_box_z("Granite_Grey", 0.0, 0.0, 0.0, 2.5, 260.0, 160.0)

    # Twin sculptural hexagonal-faceted Wave Towers (68m & 52m) + wave bridge
    for tx, ty, th, rx in ((-68.0, 25.0, 68.0, 26.0), (-10.0, 32.0, 52.0, 22.0)):
        rings = []
        for k in range(5):
            t = k / 4.0
            z = 2.5 + t * (th - 2.5)
            rad = rx * (1.0 - 0.32 * t)
            drift_x = math.sin(t * math.pi) * 6.0
            ring = []
            for i in range(6):
                a = i * math.pi / 3.0 + t * 0.25
                ring.append((tx + drift_x + rad * math.cos(a), ty + rad * 0.78 * math.sin(a), z))
            rings.append(ring)
        b.add_prism("Silver_Steel", rings, smooth=False)
        # Inner dark harbor glass & cyber-marine glowing hex rings
        for k in range(1, 4):
            z = 2.5 + (k / 4.0) * (th - 2.5)
            b.add_ring_band("Emissive_Windows", tx + 3.0, ty, z, rx * (1.0 - 0.28 * k / 4.0) + 0.6, band_h=1.4, segs=6)
        b.add_beacon((tx, ty, th + 1.0), 1.0)

    # Connecting curved lower wave bridge
    b.add_box_z("Dark_Glass", -39.0, 28.0, 14.0, 28.0, 48.0, 20.0, rz=0.12)
    b.add_box_z("Silver_Steel", -39.0, 28.0, 28.0, 31.0, 54.0, 24.0, rz=0.12)

    # Coral Reef Terraces (interlocking hexagonal canopies)
    for cx, cy, ch, cr in ((-102.0, -8.0, 18.0, 22.0), (-65.0, -28.0, 22.0, 25.0), (-22.0, -20.0, 19.0, 21.0)):
        b.add_cylinder("Dark_Glass", (cx, cy, 2.5), cr * 0.88, cr * 0.82, ch - 4.0, segs=6, smooth=False)
        b.add_cylinder("Silver_Steel", (cx, cy, ch - 1.5), cr * 1.08, cr * 0.96, 3.2, segs=6, smooth=False)
        b.add_ring_band("Emissive_Windows", cx, cy, ch - 0.2, cr * 1.09, band_h=1.0, segs=6)

    # Row of 5 breaching Whale Pods along the waterfront (East side)
    for idx in range(5):
        wx = 30.0 + idx * 24.0
        wy = -28.0 + (idx % 2) * 16.0
        wh = 16.0 + (idx % 3) * 3.0
        # Aerodynamic sloped whale body
        r0 = [(wx - 9.0, wy - 18.0, 2.5), (wx + 9.0, wy - 18.0, 2.5), (wx + 10.0, wy + 14.0, 2.5), (wx - 10.0, wy + 14.0, 2.5)]
        r1 = [(wx - 7.5, wy - 12.0, wh), (wx + 7.5, wy - 12.0, wh), (wx + 8.5, wy + 14.0, 5.5), (wx - 8.5, wy + 14.0, 5.5)]
        b.add_prism("Turf_Green", [r0, r1], smooth=False)
        # Angled glass observation nose facing harbor
        b.add_box("Dark_Glass", (wx, wy - 14.5, wh * 0.48), (14.5, 4.5, wh * 0.72), rx=-0.32)
        b.add_box("Emissive_Windows", (wx, wy - 15.2, wh * 0.45), (12.0, 1.4, wh * 0.45), rx=-0.32)


def build_taichung_opera(b: LandmarkBuilder):
    """National Taichung Theater (37.7m H x 116m W x 140m D) by Toyo Ito."""
    # Curved front water reflection channel
    b.add_box_z("Water_Turquoise", 0.0, -78.0, 0.0, 0.6, 86.0, 22.0)

    # Main rectangular bounding envelope with deep recessed glass core
    b.add_box_z("Dark_Glass", 0.0, 0.0, 0.0, 36.2, 108.0, 132.0)
    b.add_box_z("Emissive_Windows", 0.0, 0.0, 4.0, 32.0, 109.2, 133.2)

    # Outer white concrete catenoid frame slabs & sculptural hourglass piers
    b.add_box_z("White_Concrete", 0.0, 0.0, 35.0, 37.7, 116.0, 140.0)
    b.add_box_z("White_Concrete", 0.0, 0.0, 0.0, 2.8, 116.0, 140.0)
    # Hourglass catenoid concrete piers along all 4 facades
    def _hourglass_pier(px, py, w_end, w_mid, depth):
        rings = []
        for k in range(7):
            t = k / 6.0
            z = t * 37.7
            waist = w_mid + (w_end - w_mid) * ((2.0 * t - 1.0) ** 2)
            hw, hd = waist * 0.5, depth * 0.5
            rings.append([(px - hw, py - hd, z), (px + hw, py - hd, z), (px + hw, py + hd, z), (px - hw, py + hd, z)])
        b.add_prism("White_Concrete", rings)

    for px in (-52.0, -26.0, 0.0, 26.0, 52.0):
        _hourglass_pier(px, -67.0, 16.0, 7.5, 6.5)
        _hourglass_pier(px, 67.0, 16.0, 7.5, 6.5)
    for py in (-54.0, -27.0, 0.0, 27.0, 54.0):
        _hourglass_pier(-55.0, py, 6.5, 6.5, 16.0)
        _hourglass_pier(55.0, py, 6.5, 6.5, 16.0)

    # Cratered Sky Garden Roof: green turf patches + volcanic acoustic domes
    b.add_box_z("Turf_Green", 0.0, 0.0, 37.7, 38.4, 96.0, 116.0)
    for dx, dy, dr, dh in ((-24.0, -24.0, 14.0, 5.0), (22.0, 18.0, 16.0, 5.5), (-18.0, 30.0, 11.0, 4.2), (24.0, -32.0, 10.5, 4.0)):
        b.add_dome("White_Concrete", (dx, dy, 37.7), dr, dr * 0.85, dh, u_segs=16, v_segs=6)
    for sx in (-56.0, 56.0):
        for sy in (-68.0, 68.0):
            b.add_beacon((sx, sy, 38.5), 0.7)


# ==============================================================================
# 4. REGION 2 — JAPAN & KOREA (5 LANDMARKS)
# ==============================================================================

def build_tokyo_skytree(b: LandmarkBuilder):
    """Tokyo Skytree (634m): triangular-to-circular morphing lattice + Tembo Deck & Galleria + antenna."""
    # Inner reinforced concrete Shinbashira core (0m - 495m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 0.0), 8.5, 5.2, 495.0, segs=16)

    # Outer morphing triangular-to-circular steel lattice (0m - 495m)
    # 18 radial divisions smoothly interpolating from rounded equilateral triangle to circle
    segs = 18
    levels = 24
    rings = []
    for lv in range(levels + 1):
        t = lv / levels
        z = t * 495.0
        # Sori concave taper
        r_base = 38.0 * ((1.0 - t) ** 1.35) + 6.5
        tri_weight = max(0.0, 1.0 - z / 320.0)
        twist = 0.25 * math.sin(t * math.pi)
        ring = []
        for i in range(segs):
            ang = 2.0 * math.pi * i / segs + twist
            # 3-lobe triangular modulation fading smoothly into circle
            tri_mod = 1.0 + 0.24 * tri_weight * math.cos(3.0 * ang)
            r = r_base * tri_mod
            ring.append((r * math.cos(ang), r * math.sin(ang), z))
        rings.append(ring)

    # Build diagonal/vertical tubular lattice struts & horizontal rings
    for lv in range(levels):
        r0, r1 = rings[lv], rings[lv + 1]
        strut_r = 1.35 * (1.0 - 0.55 * (lv / levels))
        for i in range(0, segs, 2):
            ni = (i + 2) % segs
            b.add_tube_between("Silver_Steel", r0[i], r1[i], strut_r, strut_r * 0.95, segs=6, cap=False)
            # Diagrid brace
            b.add_tube_between("Silver_Steel", r0[i], r1[ni], strut_r * 0.55, strut_r * 0.55, segs=5, cap=False)
        if lv % 2 == 0:
            for i in range(segs):
                ni = (i + 1) % segs
                b.add_tube_between("Silver_Steel", r0[i], r0[ni], strut_r * 0.6, strut_r * 0.6, segs=5, cap=False)

    # 350m Tembo Deck (3-tier inverted trapezoidal glass observation pod)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 338.0), 13.5, 19.5, 6.0, segs=24)
    b.add_cylinder("Dark_Glass", (0.0, 0.0, 344.0), 19.5, 20.5, 10.0, segs=24)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 349.0, 20.8, band_h=3.2, segs=24)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 354.0), 20.5, 14.0, 4.0, segs=24)

    # 450m Tembo Galleria + external spiraling glass skywalk ramp
    b.add_cylinder("Dark_Glass", (0.0, 0.0, 442.0), 12.2, 12.2, 13.0, segs=24)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 455.0), 12.6, 9.0, 3.0, segs=24)
    # Spiraling Galleria tube around 445m - 452m
    gal_steps = 16
    for i in range(gal_steps):
        a0 = 2.0 * math.pi * i / gal_steps
        a1 = 2.0 * math.pi * (i + 1) / gal_steps
        p0 = (13.4 * math.cos(a0), 13.4 * math.sin(a0), 445.0 + 7.0 * i / gal_steps)
        p1 = (13.4 * math.cos(a1), 13.4 * math.sin(a1), 445.0 + 7.0 * (i + 1) / gal_steps)
        b.add_tube_between("Emissive_Windows", p0, p1, 1.7, 1.7, segs=8)

    # Broadcast antenna mast (495m - 634m) with white & red aviation bands
    ant_bands = [
        (495.0, 525.0, 5.2, 4.2, "White_Concrete"),
        (525.0, 555.0, 4.2, 3.3, "Bridge_International_Orange"),
        (555.0, 585.0, 3.3, 2.4, "White_Concrete"),
        (585.0, 610.0, 2.4, 1.5, "Bridge_International_Orange"),
        (610.0, 634.0, 1.5, 0.4, "White_Concrete"),
    ]
    for z0, z1, r0, r1, mat in ant_bands:
        b.add_cylinder(mat, (0.0, 0.0, z0), r0, r1, z1 - z0, segs=12)

    for zb in (200.0, 350.0, 450.0, 495.0, 634.5):
        b.add_beacon((0.0, 0.0, zb), 1.6 if zb > 600 else 1.2)


def build_tokyo_tower(b: LandmarkBuilder):
    """Tokyo Tower (333m): FootTown base, 4 parabolic legs, 7 alternating orange/white bands, 2 decks."""
    # FootTown 4-story commercial base (0m - 20m)
    b.add_box_z("White_Concrete", 0.0, 0.0, 0.0, 20.0, 56.0, 56.0)
    b.add_window_bands("Emissive_Windows", 0.0, 0.0, 4.0, 18.0, 56.5, 56.5, count=3, band_h=1.8)

    # 7 alternating International Orange & White aviation bands across 333m
    def _band_mat(z_mid):
        idx = min(6, int(z_mid / (333.0 / 7.0)))
        return "Bridge_International_Orange" if (idx % 2 == 0) else "White_Concrete"

    # Parabolic curve for 4 corner legs (0m -> 250m)
    def _leg_offset(z):
        t = z / 250.0
        return 42.0 * ((1.0 - t) ** 1.85) + 4.5

    steps = 16
    for s in range(steps):
        z0 = 250.0 * s / steps
        z1 = 250.0 * (s + 1) / steps
        o0, o1 = _leg_offset(z0), _leg_offset(z1)
        mat = _band_mat(0.5 * (z0 + z1))
        rad = max(1.1, 3.4 * (1.0 - 0.65 * (z0 / 250.0)))
        corners0 = [(-o0, -o0, z0), (o0, -o0, z0), (o0, o0, z0), (-o0, o0, z0)]
        corners1 = [(-o1, -o1, z1), (o1, -o1, z1), (o1, o1, z1), (-o1, o1, z1)]
        for i in range(4):
            ni = (i + 1) % 4
            b.add_tube_between(mat, corners0[i], corners1[i], rad, rad * 0.92, segs=8)
            # Horizontal & diagonal truss cross-bracing above 45m
            if z0 >= 45.0:
                b.add_tube_between(mat, corners0[i], corners0[ni], rad * 0.45, rad * 0.45, segs=6)
                b.add_tube_between(mat, corners0[i], corners1[ni], rad * 0.38, rad * 0.38, segs=5)
                b.add_tube_between(mat, corners0[ni], corners1[i], rad * 0.38, rad * 0.38, segs=5)

    # 4 decorative semicircular arches between legs below 55m
    for side in range(4):
        ang = side * 0.5 * math.pi
        ca, sa = math.cos(ang), math.sin(ang)
        arch_pts = []
        for k in range(9):
            t = k / 8.0
            u = -26.0 + 52.0 * t
            z = 24.0 + 26.0 * math.sin(t * math.pi)
            d = _leg_offset(z)
            lx, ly = u, -d
            arch_pts.append((lx * ca - ly * sa, lx * sa + ly * ca, z))
        for k in range(8):
            b.add_tube_between("Bridge_International_Orange", arch_pts[k], arch_pts[k + 1], 1.5, 1.5, segs=6)

    # 150m Main Deck (145m - 157m)
    b.add_box_z("White_Concrete", 0.0, 0.0, 145.0, 157.0, 26.0, 26.0)
    b.add_box_z("Dark_Glass", 0.0, 0.0, 147.0, 154.5, 26.6, 26.6)
    b.add_box_z("Emissive_Windows", 0.0, 0.0, 148.5, 153.0, 27.0, 27.0)

    # 250m Top Deck (246m - 255m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 246.0), 8.2, 8.2, 9.0, segs=8, rot_z=math.pi / 8.0, smooth=False)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 250.5, 8.5, band_h=3.2, segs=8, rot_z=math.pi / 8.0)

    # 83m pinnacle broadcast spire (255m - 333m) in alternating bands
    spire_bands = [
        (255.0, 285.0, 4.0, 2.6, "Bridge_International_Orange"),
        (285.0, 310.0, 2.6, 1.5, "White_Concrete"),
        (310.0, 333.0, 1.5, 0.35, "Bridge_International_Orange"),
    ]
    for z0, z1, r0, r1, mat in spire_bands:
        b.add_cylinder(mat, (0.0, 0.0, z0), r0, r1, z1 - z0, segs=8, smooth=False)

    b.add_beacon((0.0, 0.0, 333.5), 1.5)
    for sx in (-13.0, 13.0):
        for sy in (-13.0, 13.0):
            b.add_beacon((sx, sy, 157.5), 0.9)


def build_osaka_castle(b: LandmarkBuilder):
    """Osaka Castle Main Keep (58m H x 95m W x 95m D): Ishigaki base, 5 tiers, copper roofs, gold top."""
    # Megalithic battered Ishigaki stone rampart (0m - 16m)
    b.add_poly_extrude(
        "Granite_Grey",
        [(-47.5, -47.5), (47.5, -47.5), (47.5, 47.5), (-47.5, 47.5)],
        0.0,
        9.0,
        scale_top=0.86,
    )
    b.add_poly_extrude(
        "Granite_Grey",
        [(-36.0, -36.0), (36.0, -36.0), (36.0, 36.0), (-36.0, 36.0)],
        9.0,
        16.0,
        scale_top=0.82,
    )
    # Corner defensive turret base
    b.add_box_z("Granite_Grey", 32.0, -32.0, 0.0, 12.0, 18.0, 18.0)

    # Tiers 1 to 4: white plaster walls + verdigris copper upturned roofs + gables (16m - 46m)
    tiers = [
        (16.0, 23.5, 38.0, 34.0, "White_Marble"),
        (23.5, 31.0, 31.0, 28.0, "White_Marble"),
        (31.0, 38.5, 25.0, 22.0, "White_Marble"),
        (38.5, 45.5, 19.5, 17.5, "White_Marble"),
    ]
    for z0, z1, w, d, wall_mat in tiers:
        b.add_box_z(wall_mat, 0.0, 0.0, z0, z1, w, d)
        b.add_window_bands("Emissive_Windows", 0.0, 0.0, z0 + 1.0, z1 - 1.5, w + 0.3, d + 0.3, count=1, band_h=1.4)
        b.add_pagoda_roof("Verdigris_Copper", 0.0, 0.0, z1 - 0.8, w + 2.0, d + 2.0, 4.6, eave_flare=1.24, ridge_ratio=0.55)
        # Decorative gable accents (Chidori-hafu)
        b.add_box_z("Gold_Leaf", 0.0, -d * 0.56, z1 - 0.5, z1 + 2.4, w * 0.28, 2.2)

    # 5th Top Tier: black lacquer & gold leaf panels + observation balustrade + top copper roof (45.5m - 58m)
    b.add_box_z("Black_Anodized", 0.0, 0.0, 45.5, 51.5, 14.5, 13.0)
    b.add_box_z("Gold_Leaf", 0.0, 0.0, 46.2, 47.6, 16.5, 15.0)
    b.add_box_z("Emissive_Windows", 0.0, 0.0, 48.0, 50.2, 14.8, 13.3)
    b.add_pagoda_roof("Verdigris_Copper", 0.0, 0.0, 51.2, 16.5, 15.0, 6.2, eave_flare=1.26, ridge_ratio=0.52)

    # Twin golden Shachihoko dolphins at main ridge ends
    for sx in (-4.2, 4.2):
        b.add_box_z("Gold_Leaf", sx, 0.0, 56.8, 59.0, 1.3, 1.1)
    b.add_beacon((0.0, 0.0, 58.6), 0.6)


def build_fuji_torii(b: LandmarkBuilder):
    """Chureito 5-Story Pagoda & Grand Vermilion Torii Gate Ensemble (25m H x 45m W x 45m D)."""
    # Stone terrace podium (0m - 3.5m)
    b.add_box_z("Granite_Grey", 0.0, 8.0, 0.0, 3.5, 22.0, 22.0)
    b.add_box_z("Granite_Grey", 0.0, -4.5, 0.0, 2.0, 8.0, 5.0)

    # Five-Story Chureito Pagoda (3.5m - 20.5m)
    py = 8.0
    for lv in range(5):
        z0 = 3.5 + lv * 3.3
        w = 8.8 - lv * 0.75
        b.add_box_z("White_Marble", 0.0, py, z0, z0 + 2.4, w * 0.76, w * 0.76)
        b.add_box_z("Vermilion_Red", 0.0, py, z0, z0 + 0.9, w * 0.94, w * 0.94)
        b.add_box_z("Emissive_Windows", 0.0, py, z0 + 1.1, z0 + 1.9, w * 0.80, w * 0.80)
        b.add_pagoda_roof("Dark_Steel", 0.0, py, z0 + 2.2, w, w, 1.75, eave_flare=1.32, ridge_ratio=0.35)

    # Sorin Bronze Finial Spire (20.5m - 25.0m)
    b.add_cylinder("Gold_Leaf", (0.0, py, 20.5), 0.45, 0.12, 4.5, segs=10)
    for k in range(5):
        b.add_ring_band("Gold_Leaf", 0.0, py, 21.2 + k * 0.6, 0.65 - k * 0.06, band_h=0.2, segs=10)
    b.add_beacon((0.0, py, 25.3), 0.45)

    # Grand Vermilion Ryobu-Torii Gate (Front entrance, y = -12m, Height 16.6m, Span 24m)
    ty = -12.0
    for sx in (-6.8, 6.8):
        # Main thick vermilion pillars
        b.add_cylinder("Vermilion_Red", (sx, ty, 0.0), 1.05, 0.85, 15.2, segs=12)
        b.add_cylinder("Black_Anodized", (sx, ty, 0.0), 1.25, 1.15, 1.8, segs=12)
        # Front & rear outrigger Chigo-bashira support posts
        for oy in (-3.2, 3.2):
            b.add_cylinder("Vermilion_Red", (sx, ty + oy, 0.0), 0.55, 0.48, 8.8, segs=10)
            b.add_tube_between("Vermilion_Red", (sx, ty + oy, 8.2), (sx, ty, 8.2), 0.42, 0.42, segs=8)
            b.add_tube_between("Vermilion_Red", (sx, ty + oy, 4.5), (sx, ty, 4.5), 0.35, 0.35, segs=8)
    # Lower horizontal Nuki tie beam
    b.add_box_z("Vermilion_Red", 0.0, ty, 11.4, 12.6, 19.5, 1.2)
    # Sweeping upturned Kasagi & Shimaki top lintel beams
    b.add_box_z("Vermilion_Red", 0.0, ty, 14.4, 15.6, 22.8, 1.6)
    b.add_box_z("Dark_Steel", 0.0, ty, 15.6, 16.6, 24.0, 2.0)
    for sx in (-11.2, 11.2):
        b.add_box("Dark_Steel", (sx, ty, 16.4), (3.2, 2.0, 1.1), ry=-0.25 if sx > 0 else 0.25)
    b.add_box_z("Gold_Leaf", 0.0, ty, 12.4, 14.6, 2.2, 1.5)


def build_seoul_lotte(b: LandmarkBuilder):
    """Lotte World Tower (555m): calligraphic tapered cone with V-grooves & split diagrid lantern crown."""
    # Curvilinear tapered shaft (0m - 497m) with 2 opposite vertical V-shaped reveal grooves
    segs = 24
    levels = 20
    rings = []
    for lv in range(levels + 1):
        t = lv / levels
        z = t * 497.0
        # Smooth calligraphic taper from 37m radius down to 13.5m
        r_base = 37.5 * (1.0 - 0.64 * (t ** 0.92))
        sq_weight = max(0.0, 1.0 - t * 1.4)
        ring = []
        for i in range(segs):
            ang = 2.0 * math.pi * i / segs
            # Slight rounded-square base blending into circle
            r_sq = r_base * (1.0 + 0.08 * sq_weight * math.cos(4.0 * ang))
            # Two opposite V-notches along X axis (cos(ang) near +-1)
            notch = max(0.0, abs(math.cos(ang)) - 0.92) / 0.08
            r = r_sq * (1.0 - 0.16 * notch)
            ring.append((r * math.cos(ang), r * math.sin(ang), z))
        rings.append(ring)
    b.add_prism("Glass_Curtain", rings, smooth=True)

    # Vertical glowing LED strips inside the 2 full-height side grooves
    for sign in (-1.0, 1.0):
        b.add_tube_between("Emissive_Windows", (sign * 34.5, 0.0, 15.0), (sign * 12.5, 0.0, 495.0), 1.1, 0.7, segs=6)

    # Mid-level horizontal office/hotel window bands & Seoul Sky glass deck boxes
    for zh in range(60, 480, 38):
        t = zh / 497.0
        r = 37.5 * (1.0 - 0.64 * (t ** 0.92)) + 0.5
        b.add_ring_band("Emissive_Windows", 0.0, 0.0, zh, r, band_h=2.0, segs=24)
    for sign in (-1.0, 1.0):
        b.add_box_z("Emissive_Windows", sign * 14.5, 0.0, 478.0, 494.0, 5.0, 8.0)

    # Split Diagrid Lantern Crown (497m - 555m) — two curved shells parting in a V-cut
    crown_levels = 6
    for side in (-1.0, 1.0):
        # Arc spans 140 degrees on +Y or -Y side, tapering up to 555m
        c_rings = []
        for k in range(crown_levels + 1):
            t = k / crown_levels
            z = 497.0 + t * 58.0
            r = 13.8 * (1.0 - 0.38 * t)
            half_arc = math.radians(72.0 * (1.0 - 0.52 * t))
            center_ang = 0.5 * math.pi if side > 0 else -0.5 * math.pi
            pts = []
            for j in range(7):
                a = center_ang - half_arc + (2.0 * half_arc * j / 6.0)
                pts.append((r * math.cos(a), r * math.sin(a), z))
            c_rings.append(pts)
        # Diagonal steel diagrid struts & glowing inner crown ribs
        for k in range(crown_levels):
            r0, r1 = c_rings[k], c_rings[k + 1]
            for j in range(6):
                b.add_tube_between("Silver_Steel", r0[j], r1[j + 1], 0.65, 0.6, segs=6)
                b.add_tube_between("Silver_Steel", r0[j + 1], r1[j], 0.65, 0.6, segs=6)
                b.add_tube_between("Emissive_Windows", r0[j], r0[j + 1], 0.45, 0.45, segs=5)
        b.add_beacon((0.0, side * 8.5, 555.5), 1.5)


# ==============================================================================
# 5. REGION 3 — CHINA, HONG KONG & MACAU (6 LANDMARKS)
# ==============================================================================

def build_shanghai_pearl(b: LandmarkBuilder):
    """Oriental Pearl Tower (468m): tripod struts, 3 vertical columns, all 11 spheres, 113m mast."""
    # Circular glass-and-concrete museum podium (0m - 16m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 0.0), 58.0, 52.0, 10.0, segs=24)
    b.add_cylinder("Glass_Curtain", (0.0, 0.0, 10.0), 40.0, 36.0, 6.0, segs=24)

    # 3 vertical concrete columns (9m diameter) in an equilateral triangle (0m - 340m)
    col_r = 15.0
    for i in range(3):
        ang = 2.0 * math.pi * i / 3.0 + math.pi / 6.0
        cx, cy = col_r * math.cos(ang), col_r * math.sin(ang)
        b.add_cylinder("White_Concrete", (cx, cy, 0.0), 4.5, 4.5, 340.0, segs=12)
        # 3 huge diagonal cylindrical tripod buttress struts (0m outer -> 108m lower sphere)
        bx, by = 64.0 * math.cos(ang), 64.0 * math.sin(ang)
        b.add_tube_between("White_Concrete", (bx, by, 0.0), (cx, cy, 108.0), 4.0, 3.4, segs=12)
        # 3 small base anchor spheres at ground foot of tripod struts (spheres 1-3 of 11)
        b.add_sphere("Crimson_Metallic", (bx * 0.92, by * 0.92, 9.0), 8.5, 8.5, 8.5, u_segs=16, v_segs=10)

    # Horizontal ring tie-beams connecting the 3 columns
    for zr in (55.0, 155.0, 195.0, 235.0, 315.0):
        b.add_ring_band("Silver_Steel", 0.0, 0.0, zr, col_r + 3.8, band_h=2.8, segs=12)

    # Lower primary sphere (Center 115m, Diameter 50m -> radius 25m) (sphere 4 of 11)
    b.add_sphere("Crimson_Metallic", (0.0, 0.0, 115.0), 25.0, 25.0, 25.0, u_segs=24, v_segs=14)
    b.add_ring_band("Dark_Glass", 0.0, 0.0, 115.0, 25.4, band_h=5.2, segs=24)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 115.0, 25.7, band_h=2.0, segs=24)

    # Five small 16m inter-column hotel spheres stacked from 158m to 238m (spheres 5-9 of 11)
    for k in range(5):
        zs = 158.0 + k * 20.0
        b.add_sphere("Silver_Steel", (0.0, 0.0, zs), 8.2, 8.2, 8.2, u_segs=16, v_segs=10)
        b.add_ring_band("Emissive_Windows", 0.0, 0.0, zs, 8.4, band_h=1.4, segs=16)

    # Upper primary observation sphere (Center 272m, Diameter 45m -> radius 22.5m) (sphere 10 of 11)
    b.add_sphere("Crimson_Metallic", (0.0, 0.0, 272.0), 22.5, 22.5, 22.5, u_segs=24, v_segs=14)
    b.add_ring_band("Dark_Glass", 0.0, 0.0, 272.0, 22.9, band_h=4.8, segs=24)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 272.0, 23.2, band_h=2.0, segs=24)

    # Central neck + Space Capsule top sphere (Center 345m, Diameter 14m) (sphere 11 of 11)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 294.0), 7.5, 5.5, 45.0, segs=14)
    b.add_sphere("Crimson_Metallic", (0.0, 0.0, 345.0), 7.5, 7.5, 7.5, u_segs=18, v_segs=10)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 345.0, 7.8, band_h=2.0, segs=18)

    # 113m stepped broadcast antenna mast (355m - 468m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 352.0), 3.4, 2.2, 42.0, segs=12)
    b.add_cylinder("Bridge_International_Orange", (0.0, 0.0, 394.0), 2.2, 1.3, 40.0, segs=12)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 434.0), 1.3, 0.3, 34.0, segs=10)
    b.add_beacon((0.0, 0.0, 468.5), 1.6)
    b.add_beacon((0.0, 0.0, 353.0), 1.1)


def build_shanghai_tower(b: LandmarkBuilder):
    """Shanghai Tower (632m): true 120-degree helically twisted, 55%-tapered rounded-triangle loft."""
    # Podium base (0m - 26m)
    b.add_cylinder("Granite_Grey", (0.0, 0.0, 0.0), 60.0, 56.0, 24.0, segs=24)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 14.0, 58.6, band_h=3.0, segs=24)

    # 120-degree helically twisted rounded equilateral triangle (Reuleaux-like with 3 V-notches)
    segs = 30
    levels = 28
    rings = []
    notch_tracks = [[], [], []]
    for lv in range(levels + 1):
        t = lv / levels
        z_base = t * 632.0
        scale = 1.0 - 0.55 * t
        twist = math.radians(120.0) * t
        ring = []
        for i in range(segs):
            ang = 2.0 * math.pi * i / segs
            # Rounded triangle radius profile + sharp V-notch along one side of each apex
            r_tri = 42.0 * (1.0 + 0.14 * math.cos(3.0 * ang))
            if i % (segs // 3) == 0:
                r_tri *= 0.84  # Iconic corner V-notch groove
            r = r_tri * scale
            wa = ang + twist
            # Slanted funnel crown top cut on upper rings
            z = z_base
            if t > 0.88:
                crown_t = (t - 0.88) / 0.12
                z -= 28.0 * crown_t * (0.5 - 0.5 * math.cos(wa))
            pt = (r * math.cos(wa), r * math.sin(wa), z)
            ring.append(pt)
            if i % (segs // 3) == 0:
                notch_tracks[i // (segs // 3)].append(pt)
        rings.append(ring)
    b.add_prism("Glass_Curtain", rings, smooth=True)

    # 3 continuous glowing spiraling LED ribbons tracing the 120-degree corner V-notches
    for track in notch_tracks:
        for k in range(len(track) - 1):
            b.add_tube_between("Emissive_Windows", track[k], track[k + 1], 0.9, 0.85, segs=6, cap=False)

    # 9 stacked internal sky-lobby mechanical ring bands
    for zone in range(1, 10):
        zz = zone * 64.0
        if zz < 595.0:
            t = zz / 632.0
            r = 43.0 * (1.0 - 0.55 * t)
            b.add_ring_band("Silver_Steel", 0.0, 0.0, zz, r, band_h=2.4, segs=24)
            b.add_ring_band("Emissive_Windows", 0.0, 0.0, zz + 2.2, r + 0.4, band_h=1.4, segs=24)

    # Crown rim beacons
    for pt in rings[-1][::10]:
        b.add_beacon((pt[0], pt[1], pt[2] + 1.5), 1.4)


def build_gz_canton(b: LandmarkBuilder):
    """Canton Tower (604m): true hyperboloid twisted hourglass steel lattice, 5 inner pods, 150m spire."""
    # Riverside podium
    b.add_ellipse_frustum("Granite_Grey", (0.0, 0.0, 0.0), 46.0, 36.0, 43.0, 33.0, 10.0, segs=24)

    # Inner concrete core shaft (0m - 454m) & 5 enclosed sky-zone cylindrical pods
    b.add_cylinder("White_Concrete", (0.0, 0.0, 0.0), 8.5, 7.0, 454.0, segs=16)
    zones = [(22.0, 72.0, 20.0), (110.0, 155.0, 15.5), (195.0, 232.0, 12.0), (310.0, 355.0, 13.5), (388.0, 438.0, 17.5)]
    for z0, z1, r in zones:
        b.add_cylinder("Dark_Glass", (0.0, 0.0, z0), r, r * 0.96, z1 - z0, segs=20)
        b.add_ring_band("Emissive_Windows", 0.0, 0.0, 0.5 * (z0 + z1), r + 0.4, band_h=2.6, segs=20)

    # True hyperboloid twisted hourglass lattice: 24 straight inclined columns
    # Connecting ground ellipse (40m x 30m) to 450m ellipse (27m x 20.25m) rotated by 135 deg
    # (135 deg twist between ellipses yields the ultra-slender ~11m radius waist around 280m!)
    n_cols = 24
    twist_rad = math.radians(135.0)
    bot_pts = []
    top_pts = []
    for i in range(n_cols):
        a0 = 2.0 * math.pi * i / n_cols
        a1 = a0 + twist_rad
        p0 = Vector((40.0 * math.cos(a0), 30.0 * math.sin(a0), 8.0))
        # Tilted top elliptical deck (446m - 460m)
        z_top = 453.0 + 7.0 * math.cos(a1)
        p1 = Vector((27.0 * math.cos(a1), 20.25 * math.sin(a1), z_top))
        bot_pts.append(p0)
        top_pts.append(p1)
        b.add_tube_between("Silver_Steel", p0, p1, 0.95, 0.72, segs=6)

    # 22 horizontal elliptical bracing rings + rainbow/neon emissive rings along hyperboloid
    for k in range(1, 23):
        t = k / 23.0
        ring_pts = [bot_pts[i].lerp(top_pts[i], t) for i in range(n_cols)]
        mat = "Emissive_Windows" if (k % 3 == 0) else "Silver_Steel"
        for i in range(n_cols):
            ni = (i + 1) % n_cols
            b.add_tube_between(mat, ring_pts[i], ring_pts[ni], 0.55, 0.55, segs=5, cap=False)

    # Tilted elliptical rooftop deck + 16 Bubble Tram spherical pods
    for i in range(n_cols):
        ni = (i + 1) % n_cols
        b.add_tube_between("Silver_Steel", top_pts[i], top_pts[ni], 1.4, 1.4, segs=6)
    for k in range(16):
        idx = int(k * n_cols / 16) % n_cols
        tp = top_pts[idx]
        b.add_sphere("Emissive_Windows", (tp.x, tp.y, tp.z + 2.2), 1.8, 1.8, 1.8, u_segs=10, v_segs=6)

    # Two-stage pinnacle antenna spire (454m - 604m)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 452.0), 4.6, 2.5, 78.0, segs=10)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 530.0), 2.4, 0.4, 74.0, segs=10)
    b.add_beacon((0.0, 0.0, 604.5), 1.6)


def build_beijing_cctv(b: LandmarkBuilder):
    """CCTV Headquarters (234m H x 161m W x 161m D): canted 3D folded loop + 75m cantilever."""
    # Helper to create a tilted rectangular tower prism
    def _tilted_tower(x0, y0, x1, y1, z0, z1, sx, sy):
        hx, hy = sx * 0.5, sy * 0.5
        r0 = [(x0 - hx, y0 - hy, z0), (x0 + hx, y0 - hy, z0), (x0 + hx, y0 + hy, z0), (x0 - hx, y0 + hy, z0)]
        r1 = [(x1 - hx, y1 - hy, z1), (x1 + hx, y1 - hy, z1), (x1 + hx, y1 + hy, z1), (x1 - hx, y1 + hy, z1)]
        b.add_prism("Dark_Glass", [r0, r1], smooth=False)
        # External diamond diagrid titanium ribs & emissive floor bands
        for k in range(1, 9):
            t = k / 9.0
            cx = x0 + (x1 - x0) * t
            cy = y0 + (y1 - y0) * t
            cz = z0 + (z1 - z0) * t
            b.add_box_z("Emissive_Windows", cx, cy, cz - 1.2, cz + 1.2, sx + 0.5, sy + 0.5)
        for c_idx in range(4):
            nc = (c_idx + 1) % 4
            b.add_tube_between("Silver_Steel", r0[c_idx], r1[c_idx], 1.1, 1.1, segs=6)
            b.add_tube_between("Silver_Steel", r0[c_idx], r1[nc], 0.75, 0.75, segs=5)
            b.add_tube_between("Silver_Steel", r0[nc], r1[c_idx], 0.75, 0.75, segs=5)

    # Lower L-shaped base podium loop (0m - 42m) connecting the 2 leaning towers
    b.add_box_z("Dark_Glass", -20.0, -52.0, 0.0, 42.0, 120.0, 38.0)
    b.add_box_z("Dark_Glass", 40.0, 0.0, 0.0, 42.0, 42.0, 118.0)
    b.add_window_bands("Emissive_Windows", -20.0, -52.0, 5.0, 38.0, 120.6, 38.6, count=4, band_h=1.5)
    b.add_window_bands("Emissive_Windows", 40.0, 0.0, 5.0, 38.0, 42.6, 118.6, count=4, band_h=1.5)

    # Tower 1 (234m, SW corner leaning inward +X, +Y at ~6 degrees)
    _tilted_tower(-52.0, -52.0, -24.0, -24.0, 0.0, 234.0, 42.0, 52.0)
    # Tower 2 (194m, NE corner leaning inward -X, -Y at ~6 degrees)
    _tilted_tower(44.0, 44.0, 20.0, 20.0, 0.0, 210.0, 40.0, 48.0)

    # 75-meter Overhanging L-shaped Sky Cantilever (162m - 234m) meeting at NW corner
    b.add_box_z("Dark_Glass", -24.0, 10.0, 162.0, 234.0, 42.0, 108.0)
    b.add_box_z("Dark_Glass", 12.0, 36.0, 162.0, 210.0, 96.0, 44.0)
    b.add_window_bands("Emissive_Windows", -24.0, 10.0, 168.0, 228.0, 42.6, 108.6, count=6, band_h=1.8)
    b.add_window_bands("Emissive_Windows", 12.0, 36.0, 168.0, 204.0, 96.6, 44.6, count=4, band_h=1.8)
    # Diagonal structural rim outline on the cantilever nose
    b.add_box_z("Silver_Steel", -24.0, 64.0, 161.5, 234.5, 44.0, 2.4)
    # 3 circular glass-bottom observation portals on underside of cantilever overhang
    for px, py in ((-28.0, 48.0), (-20.0, 52.0), (-12.0, 42.0)):
        b.add_cylinder("Emissive_Windows", (px, py, 161.2), 3.2, 3.2, 1.0, segs=12)

    # Rooftop aviation beacons
    for bx, by, bz in ((-44.0, 62.0, 235.0), (-4.0, 62.0, 235.0), (-44.0, -44.0, 235.0), (40.0, 44.0, 211.0)):
        b.add_beacon((bx, by, bz), 1.3)


def build_hk_icc_ifc(b: LandmarkBuilder):
    """Bank of China Tower Hong Kong (367.4m): 4 asymmetrical triangular crystal prism quadrants + twin masts."""
    # Monolithic grey granite base podium (0m - 18m)
    b.add_box_z("Granite_Grey", 0.0, 0.0, 0.0, 18.0, 56.0, 56.0)
    b.add_box_z("Dark_Glass", 0.0, -28.2, 0.0, 12.0, 18.0, 1.2)

    # 4 triangular prism quadrants dividing the 52m x 52m square along its diagonals
    h = 26.0
    quads = [
        # (triangle 2D vertices, low_top_z, high_top_z, high_idx_in_tri)
        ([(0.0, 0.0), (h, -h), (h, h)], 105.0, 132.0, 0),       # East quadrant
        ([(0.0, 0.0), (-h, -h), (h, -h)], 162.0, 192.0, 0),     # South quadrant
        ([(0.0, 0.0), (-h, h), (-h, -h)], 222.0, 252.0, 0),     # West quadrant
        ([(0.0, 0.0), (h, h), (-h, h)], 285.0, 315.0, 0),       # North tallest quadrant
    ]
    for tri, z_low, z_high, hi_idx in quads:
        r0 = [(x, y, 18.0) for (x, y) in tri]
        r1 = [
            (x, y, z_high if idx == hi_idx else z_low)
            for idx, (x, y) in enumerate(tri)
        ]
        b.add_prism("Glass_Curtain", [r0, r1], smooth=False)

        # Giant silver aluminum megastructure X-braces & white-cyan glowing LED edge strips
        for idx in range(3):
            p_b0, p_t0 = r0[idx], r1[idx]
            p_b1, p_t1 = r0[(idx + 1) % 3], r1[(idx + 1) % 3]
            b.add_tube_between("Silver_Steel", p_b0, p_t0, 1.05, 1.05, segs=6)
            b.add_tube_between("Silver_Steel", p_t0, p_t1, 1.15, 1.15, segs=6)
            b.add_tube_between("Emissive_Windows", p_t0, p_t1, 0.55, 0.55, segs=5)
            # Multi-story exterior X-diagonals along every vertical face
            n_tiers = max(2, int((min(p_t0[2], p_t1[2]) - 18.0) / 52.0))
            for k in range(n_tiers):
                t0 = k / n_tiers
                t1 = (k + 1) / n_tiers
                a0 = Vector(p_b0).lerp(Vector(p_t0), t0)
                a1 = Vector(p_b0).lerp(Vector(p_t0), t1)
                c0 = Vector(p_b1).lerp(Vector(p_t1), t0)
                c1 = Vector(p_b1).lerp(Vector(p_t1), t1)
                b.add_tube_between("Silver_Steel", a0, c1, 0.72, 0.72, segs=5)
                b.add_tube_between("Silver_Steel", c0, a1, 0.72, 0.72, segs=5)
                b.add_tube_between("Emissive_Windows", a0, c1, 0.35, 0.35, segs=4)

        b.add_beacon((r1[hi_idx][0], r1[hi_idx][1], r1[hi_idx][2] + 1.2), 1.0)

    # Twin parallel pinnacle masts rising to 367.4m
    for sx in (-4.2, 4.2):
        b.add_cylinder("Silver_Steel", (sx, 6.0, 304.0), 1.25, 0.35, 63.4, segs=10)
        b.add_beacon((sx, 6.0, 367.8), 1.4)


def build_macau_tower(b: LandmarkBuilder):
    """Macau Tower (338m) & adjacent Grand Lisboa Golden Lotus (261m) landmark duo."""
    # 1. Macau Tower at origin (338m)
    b.add_cylinder("Granite_Grey", (0.0, 0.0, 0.0), 34.0, 30.0, 14.0, segs=20)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 14.0), 8.2, 7.2, 204.0, segs=18)
    # 3 external vertical ribs & glass elevator strip
    for i in range(3):
        a = 2.0 * math.pi * i / 3.0
        b.add_box_z("Silver_Steel", 8.0 * math.cos(a), 8.0 * math.sin(a), 14.0, 218.0, 2.4, 2.4, rz=a)
    b.add_box_z("Emissive_Windows", 0.0, -8.3, 16.0, 216.0, 2.8, 1.2)

    # 4-level conical-cylindrical observation pod (216m - 248m) + struts
    for i in range(8):
        a = 2.0 * math.pi * i / 8.0
        b.add_tube_between("Silver_Steel", (7.4 * math.cos(a), 7.4 * math.sin(a), 206.0), (16.5 * math.cos(a), 16.5 * math.sin(a), 222.0), 0.7, 0.7, segs=6)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 216.0), 10.5, 18.5, 8.0, segs=24)
    b.add_cylinder("Dark_Glass", (0.0, 0.0, 224.0), 19.0, 17.5, 14.0, segs=24)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 231.0, 19.2, band_h=3.2, segs=24)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 238.0), 17.5, 8.5, 10.0, segs=24)

    # 90m red/white steel pinnacle spire (248m - 338m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 248.0), 3.6, 2.2, 32.0, segs=12)
    b.add_cylinder("Bridge_International_Orange", (0.0, 0.0, 280.0), 2.2, 1.2, 30.0, segs=12)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 310.0), 1.2, 0.3, 28.0, segs=10)
    b.add_beacon((0.0, 0.0, 338.5), 1.5)

    # 2. Grand Lisboa Hotel Tower (offset 105m North, Total Height 261m)
    gy = 105.0
    # Golden Egg Podium Dome (0m - 48m)
    b.add_sphere("Gold_Leaf", (0.0, gy, 24.0), 28.0, 24.0, 24.0, u_segs=20, v_segs=12)
    b.add_ring_band("Emissive_Windows", 0.0, gy, 24.0, 28.4, band_h=3.0, segs=20)
    # Tapered neck & blooming golden lotus feather tower (48m - 261m)
    b.add_cylinder("Gold_Leaf", (0.0, gy, 44.0), 14.0, 18.0, 42.0, segs=16)
    # 8 curved golden lotus glass petals flaring outward
    for i in range(8):
        ang = 2.0 * math.pi * i / 8.0
        ca, sa = math.cos(ang), math.sin(ang)
        rings = []
        for k in range(7):
            t = k / 6.0
            z = 78.0 + t * 155.0
            rad_out = 16.0 + 22.0 * math.sin(t * math.pi * 0.85) * (1.0 - 0.35 * t)
            w_p = 10.0 * (1.0 - 0.55 * t)
            # Radial petal quad slice
            p_in_l = (-w_p * 0.35 * sa, w_p * 0.35 * ca)
            p_in_r = (w_p * 0.35 * sa, -w_p * 0.35 * ca)
            p_out_r = (rad_out * ca + w_p * 0.5 * sa, rad_out * sa - w_p * 0.5 * ca)
            p_out_l = (rad_out * ca - w_p * 0.5 * sa, rad_out * sa + w_p * 0.5 * ca)
            rings.append([
                (p_in_l[0], gy + p_in_l[1], z),
                (p_out_l[0], gy + p_out_l[1], z),
                (p_out_r[0], gy + p_out_r[1], z),
                (p_in_r[0], gy + p_in_r[1], z),
            ])
        b.add_prism("Gold_Leaf", rings, smooth=False)
        # Glowing contour rib along each lotus petal outer edge
        for k in range(6):
            p0 = Vector(rings[k][1]).lerp(Vector(rings[k][2]), 0.5)
            p1 = Vector(rings[k + 1][1]).lerp(Vector(rings[k + 1][2]), 0.5)
            b.add_tube_between("Emissive_Windows", p0, p1, 0.7, 0.6, segs=5)

    # Golden spire crown (233m - 261m)
    b.add_cylinder("Gold_Leaf", (0.0, gy, 228.0), 10.0, 1.2, 33.0, segs=12)
    b.add_beacon((0.0, gy, 261.5), 1.4)


# ==============================================================================
# 6. REGION 4 — SOUTHEAST & SOUTH ASIA (4 LANDMARKS)
# ==============================================================================

def build_sg_mbs(b: LandmarkBuilder):
    """Marina Bay Sands (207m) & ArtScience Lotus Museum: 3 splayed towers, 340m SkyPark boat, lotus."""
    # Three curved "Deck of Cards" hotel towers aligned North-South along Y = -85, 0, +85
    for ty in (-85.0, 0.0, 85.0):
        # West vertical/gently curved leg & East dramatic 26-degree leaning leg merging at 85m
        levels = 12
        for leg_sign in (-1.0, 1.0):
            rings = []
            for k in range(levels + 1):
                t = k / levels
                z = t * 194.0
                # Below 85m, legs splay apart forming a hollow A-frame atrium; above 85m they merge
                merge_t = min(1.0, z / 85.0)
                splay = (1.0 - merge_t) ** 1.4
                cx = leg_sign * (22.0 * splay + 5.5 * (1.0 - splay))
                if leg_sign > 0:
                    cx += 10.0 * splay  # East leg leans steeply up to 26 deg
                thickness = 10.5 * (1.0 - 0.15 * t)
                length_y = 56.0 * (1.0 - 0.06 * t)
                hx, hy = thickness * 0.5, length_y * 0.5
                rings.append([
                    (cx - hx, ty - hy, z),
                    (cx + hx, ty - hy, z),
                    (cx + hx, ty + hy, z),
                    (cx - hx, ty + hy, z),
                ])
            b.add_prism("Glass_Curtain", rings, smooth=False)
        # Emissive horizontal hotel room strips on merged upper tower
        b.add_window_bands("Emissive_Windows", 0.0, ty, 90.0, 188.0, 21.6, 54.0, count=10, band_h=1.6)
        b.add_beacon((0.0, ty, 208.5), 1.1)

    # Sands SkyPark Cantilevered Ship Hull (194m - 207m, Length 340m, 66.5m north overhang!)
    # Center shifted north (+25m along Y) so it overhangs dramatically beyond Tower 3 (+85m) to +195m
    hull_levels = [
        (193.5, 0.55, 0.88),
        (197.5, 0.92, 0.96),
        (202.0, 1.00, 1.00),
        (205.5, 0.96, 0.98),
    ]
    hull_rings = []
    for z, w_s, l_s in hull_levels:
        hw = 21.0 * w_s
        # Tapered ship prow at +Y (North cantilever) and rounded stern at -Y
        y_stern = -140.0 * l_s + 22.0
        y_prow = 195.0 * l_s + 22.0
        ring = [
            (-hw * 0.72, y_stern, z),
            (hw * 0.72, y_stern, z),
            (hw, y_stern + 45.0, z),
            (hw, y_prow - 65.0, z),
            (hw * 0.58, y_prow - 20.0, z),
            (0.0, y_prow, z),
            (-hw * 0.58, y_prow - 20.0, z),
            (-hw, y_prow - 65.0, z),
            (-hw, y_stern + 45.0, z),
        ]
        hull_rings.append(ring)
    b.add_prism("White_Concrete", hull_rings, smooth=False)

    # 146m Turquoise Infinity Pool along west bay-facing rim + rooftop trees
    b.add_box_z("Water_Turquoise", -11.5, 8.0, 205.4, 206.4, 9.5, 146.0)
    b.add_box_z("Emissive_Windows", -16.8, 8.0, 204.2, 205.8, 1.2, 152.0)
    for ty in range(-95, 165, 26):
        b.add_sphere("Turf_Green", (7.5, float(ty), 209.0), 5.5, 5.5, 4.2, u_segs=10, v_segs=6)
    b.add_beacon((0.0, 217.0, 207.5), 1.4)
    b.add_beacon((0.0, -118.0, 207.5), 1.2)

    # ArtScience Museum "White Lotus" (Waterfront West side, x = -98m, y = 45m, 10 curving petals)
    lx, ly = -98.0, 45.0
    b.add_cylinder("Water_Turquoise", (lx, ly, 0.0), 44.0, 44.0, 1.2, segs=24)
    b.add_cylinder("White_Concrete", (lx, ly, 1.2), 18.0, 14.0, 14.0, segs=16)
    for i in range(10):
        ang = 2.0 * math.pi * i / 10.0
        ca, sa = math.cos(ang), math.sin(ang)
        h_petal = 44.0 + (i % 3) * 7.5
        r_out = 36.0 + (i % 2) * 5.0
        rings = []
        for k in range(5):
            t = k / 4.0
            rad = 11.0 + t * (r_out - 11.0)
            z = 12.0 + (t ** 1.35) * (h_petal - 12.0)
            w = 8.5 * (1.0 - 0.45 * t)
            th = 4.2 * (1.0 - 0.35 * t)
            p_c = Vector((lx + rad * ca, ly + rad * sa, z))
            tan = Vector((-sa, ca, 0.0)) * (w * 0.5)
            rad_v = Vector((ca, sa, 0.0)) * (th * 0.5)
            rings.append([
                tuple(p_c - tan - rad_v),
                tuple(p_c + tan - rad_v),
                tuple(p_c + tan + rad_v),
                tuple(p_c - tan + rad_v),
            ])
        b.add_prism("White_Marble", rings, smooth=False)
        # Glowing skylight window at tip of each lotus finger
        b.add_sphere("Emissive_Windows", (lx + r_out * ca, ly + r_out * sa, h_petal - 1.0), 2.8, 2.8, 1.6, u_segs=8, v_segs=5)


def _petronas_rub_el_hizb_ring(cx, cy, z, radius):
    """Generate 16-point Rub el Hizb 8-pointed Islamic star + 8 convex lobes profile."""
    pts = []
    for i in range(16):
        ang = 2.0 * math.pi * i / 16.0
        # Alternating sharp star vertices and slightly recessed semicircular lobe crests
        r = radius if (i % 2 == 0) else radius * 0.86
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang), z))
    return pts


def build_kl_petronas(b: LandmarkBuilder):
    """Petronas Twin Towers (451.9m): twin 8-point Rub el Hizb star towers, 170m Skybridge + V-struts."""
    # Suria KLCC retail podium base linking both towers
    b.add_box_z("Glass_Curtain", 0.0, 0.0, 0.0, 26.0, 152.0, 74.0)
    b.add_window_bands("Emissive_Windows", 0.0, 0.0, 4.0, 23.0, 152.5, 74.5, count=3, band_h=1.8)

    # Twin 8-point star towers spaced 88m center-to-center (x = -44m and +44m)
    # 6 cascading setback tiers to 378m + 73.9m ringed stainless spires to 451.9m
    setbacks = [
        (0.0, 245.0, 24.0),
        (245.0, 292.0, 20.5),
        (292.0, 328.0, 17.0),
        (328.0, 352.0, 13.5),
        (352.0, 368.0, 10.0),
        (368.0, 378.4, 6.5),
    ]
    for tx in (-44.0, 44.0):
        for z0, z1, rad in setbacks:
            r0 = _petronas_rub_el_hizb_ring(tx, 0.0, z0, rad)
            r1 = _petronas_rub_el_hizb_ring(tx, 0.0, z1, rad * 0.98)
            b.add_prism("Silver_Steel", [r0, r1], smooth=False)
            # Horizontal recessed teal glass + glowing window rings
            n_bands = max(2, int((z1 - z0) / 22.0))
            for k in range(1, n_bands + 1):
                zb = z0 + (z1 - z0) * k / (n_bands + 1)
                b.add_ring_band("Emissive_Windows", tx, 0.0, zb, rad * 0.96, band_h=1.5, segs=16)
            # Conical stainless-steel setback transition collar
            b.add_cylinder("Silver_Steel", (tx, 0.0, z1 - 0.5), rad * 0.98, rad * 0.78, 3.2, segs=16)

        # Pinnacle ringed spire (378.4m - 451.9m) with segmented ring sphere
        b.add_cylinder("Silver_Steel", (tx, 0.0, 378.0), 4.6, 2.2, 24.0, segs=14)
        b.add_sphere("Silver_Steel", (tx, 0.0, 402.0), 4.8, 4.8, 4.8, u_segs=16, v_segs=10)
        b.add_ring_band("Emissive_Windows", tx, 0.0, 402.0, 5.0, band_h=1.4, segs=16)
        b.add_cylinder("Silver_Steel", (tx, 0.0, 406.0), 2.1, 0.35, 45.9, segs=12)
        b.add_beacon((tx, 0.0, 452.4), 1.6)
        b.add_beacon((tx, 0.0, 407.0), 1.1)

    # Double-deck Skybridge (170m - 178m, spanning 58.4m between towers)
    b.add_box_z("Silver_Steel", 0.0, 0.0, 169.5, 178.5, 62.0, 9.0)
    b.add_box_z("Emissive_Windows", 0.0, 0.0, 171.2, 177.0, 58.0, 9.4)
    # Inverted V-strut tubular steel arch hinged at Floor 29 (115m) of each tower
    for sign in (-1.0, 1.0):
        for oy in (-3.2, 3.2):
            b.add_tube_between("Silver_Steel", (sign * 25.0, oy, 115.0), (0.0, oy, 170.0), 1.1, 1.1, segs=8)


def build_bangkok_mahanakhon(b: LandmarkBuilder):
    """King Power MahaNakhon (314m): square glass monolith with carved 3D helical pixelated voxel ribbon."""
    # Podium cube (0m - 22m)
    b.add_box_z("Dark_Glass", 0.0, 0.0, 0.0, 22.0, 56.0, 56.0)
    b.add_window_bands("Emissive_Windows", 0.0, 0.0, 4.0, 20.0, 56.5, 56.5, count=3, band_h=1.6)

    # Construct the 39m x 39m monolith as a 5x5 horizontal voxel grid over 42 vertical slices (0m - 310m)
    # Carve out outer perimeter voxels along a continuous 3D helical spiral ribbon!
    grid_n = 5
    cell_w = 39.0 / grid_n  # 7.8m voxel width
    n_slices = 42
    slice_h = 310.0 / n_slices

    for s in range(n_slices):
        z0 = s * slice_h
        z1 = z0 + slice_h
        t = s / n_slices
        # Helical angle wrapping 1.35 turns from base to crown
        spiral_ang = t * 2.0 * math.pi * 1.35 + 0.4
        # Solid inner 3x3 core always present for watertight silhouette
        b.add_box_z("Glass_Curtain", 0.0, 0.0, z0, z1, cell_w * 3.02, cell_w * 3.02)

        for gx in range(grid_n):
            for gy in range(grid_n):
                # Skip interior 3x3 already built
                if 1 <= gx <= 3 and 1 <= gy <= 3:
                    continue
                cx = (gx - 2) * cell_w
                cy = (gy - 2) * cell_w
                ang = math.atan2(cy, cx)
                # Angular distance to helical ribbon center
                da = abs((ang - spiral_ang + math.pi) % (2.0 * math.pi) - math.pi)
                # Ribbon is wider near base and heavily carved at top crown (260m-310m)
                ribbon_half = 0.65 if (t < 0.18 or t > 0.82) else 0.48
                if da < ribbon_half:
                    # Carved out voxel! Add a recessed glowing inner voxel ledge for unmistakable look
                    if da > ribbon_half * 0.42:
                        b.add_box_z("Emissive_Windows", cx * 0.84, cy * 0.84, z0 + 0.5, z1 - 0.5, cell_w * 0.68, cell_w * 0.68)
                else:
                    b.add_box_z("Glass_Curtain", cx, cy, z0, z1, cell_w, cell_w)

    # 78th-floor SkyWalk cantilevered glass tray (310m) & rooftop peak cube (314m)
    b.add_box_z("Emissive_Windows", 0.0, -21.0, 308.5, 310.5, 16.0, 9.0)
    b.add_box_z("Glass_Curtain", 0.0, 0.0, 310.0, 314.0, 26.0, 26.0)
    for sx in (-12.5, 12.5):
        for sy in (-12.5, 12.5):
            b.add_beacon((sx, sy, 314.8), 1.1)


def build_agra_taj_mahal(b: LandmarkBuilder):
    """Taj Mahal (73m H x 105m W x 160m D): plinth, mausoleum with Pishtaqs, onion dome, 4 minarets."""
    # Red sandstone sub-base & 7m white marble square plinth (95m x 95m)
    b.add_box_z("Red_Brick", 0.0, 0.0, 0.0, 1.8, 102.0, 102.0)
    b.add_box_z("White_Marble", 0.0, 0.0, 1.8, 7.2, 95.0, 95.0)

    # Front rectangular Charbagh reflecting pool extending 60m South (-Y)
    b.add_box_z("Stone_Limestone", 0.0, -78.0, 0.0, 0.8, 22.0, 62.0)
    b.add_box_z("Water_Turquoise", 0.0, -78.0, 0.6, 1.1, 14.0, 56.0)

    # Chamfered-square Makrana marble mausoleum body (56.6m x 56.6m, 7.2m - 38m)
    h = 28.3
    c = 20.5
    chamfer_sq = [
        (-c, -h), (c, -h), (h, -c), (h, c), (c, h), (-c, h), (-h, c), (-h, -c)
    ]
    b.add_poly_extrude("White_Marble", chamfer_sq, 7.2, 34.0)

    # 4 monumental central Pishtaq / Iwan arch portals rising to 39m on N/S/E/W faces
    for ang in (0.0, 0.5 * math.pi, math.pi, 1.5 * math.pi):
        ca, sa = math.cos(ang), math.sin(ang)
        px, py = 27.5 * ca, 27.5 * sa
        b.add_box_z("White_Marble", px, py, 7.2, 39.5, 22.0, 4.0, rz=ang + 0.5 * math.pi)
        # Recessed glowing arched vault cavity
        b.add_box_z("Emissive_Windows", 29.2 * ca, 29.2 * sa, 8.0, 31.5, 13.0, 1.4, rz=ang + 0.5 * math.pi)
        # Slender Guldasta spirelets flanking each Pishtaq
        for side in (-10.8, 10.8):
            gx = 28.5 * ca - side * sa
            gy = 28.5 * sa + side * ca
            b.add_cylinder("White_Marble", (gx, gy, 38.0), 0.75, 0.35, 6.5, segs=8)

    # High cylindrical drum (34m - 46m) + iconic bulbous Onion Dome (46m - 64.5m)
    b.add_cylinder("White_Marble", (0.0, 0.0, 34.0), 11.5, 11.2, 12.0, segs=24)
    # Lathe profile for authentic swollen lotus-topped onion dome
    dome_profile = [
        (46.0, 11.0), (48.5, 12.6), (51.5, 13.4), (54.5, 12.8),
        (57.5, 10.6), (60.2, 7.2), (62.5, 3.6), (64.5, 0.6),
    ]
    dome_rings = []
    for zd, rd in dome_profile:
        dome_rings.append([(rd * math.cos(2.0 * math.pi * i / 24), rd * math.sin(2.0 * math.pi * i / 24), zd) for i in range(24)])
    b.add_prism("White_Marble", dome_rings, cap_bottom=False, cap_top=True, smooth=True)
    # 9m Gilded bronze Kalash finial (64.5m - 73m)
    b.add_cylinder("Gold_Leaf", (0.0, 0.0, 64.5), 0.7, 0.15, 8.5, segs=10)
    b.add_sphere("Gold_Leaf", (0.0, 0.0, 66.8), 1.35, 1.35, 1.1, u_segs=12, v_segs=8)
    b.add_beacon((0.0, 0.0, 73.4), 0.7)

    # Four corner Chhatri open domed kiosks on mausoleum roof
    for sx in (-17.5, 17.5):
        for sy in (-17.5, 17.5):
            b.add_cylinder("White_Marble", (sx, sy, 34.0), 4.6, 4.6, 2.2, segs=8, smooth=False)
            for k in range(6):
                a = 2.0 * math.pi * k / 6.0
                b.add_cylinder("White_Marble", (sx + 3.6 * math.cos(a), sy + 3.6 * math.sin(a), 36.2), 0.45, 0.42, 6.2, segs=6)
            b.add_dome("White_Marble", (sx, sy, 42.4), 4.6, 4.6, 5.2, u_segs=14, v_segs=6)
            b.add_cylinder("Gold_Leaf", (sx, sy, 47.6), 0.35, 0.1, 2.2, segs=8)

    # Four corner 43m Minarets at corners of 95m plinth (tilted slightly outward 1.5 deg)
    for sx in (-43.0, 43.0):
        for sy in (-43.0, 43.0):
            dx = (1.1 if sx > 0 else -1.1)
            dy = (1.1 if sy > 0 else -1.1)
            b.add_tube_between("White_Marble", (sx, sy, 7.2), (sx + dx, sy + dy, 43.0), 3.2, 2.1, segs=12)
            for frac in (0.33, 0.66, 0.95):
                bx = sx + dx * frac
                by = sy + dy * frac
                bz = 7.2 + 35.8 * frac
                b.add_ring_band("White_Marble", bx, by, bz, 3.6 - 0.8 * frac, band_h=1.2, segs=12)
            b.add_dome("White_Marble", (sx + dx, sy + dy, 43.5), 2.5, 2.5, 3.2, u_segs=12, v_segs=6)
            b.add_cylinder("Gold_Leaf", (sx + dx, sy + dy, 46.7), 0.25, 0.08, 1.8, segs=8)


# ==============================================================================
# 7. REGION 5 — MIDDLE EAST & OCEANIA (5 LANDMARKS)
# ==============================================================================

def build_dubai_burj(b: LandmarkBuilder):
    """Burj Khalifa (828m): Y-shaped 3-wing spiraling 27 setback tiers + telescopic pinnacle spire."""
    # Central hexagonal core rising continuously from 0m to 585m
    b.add_cylinder("Glass_Curtain", (0.0, 0.0, 0.0), 17.5, 9.5, 585.0, segs=6, smooth=False)

    # 27 spiraling counter-clockwise setback tiers across the 3 Y-wings (120 degrees apart)
    # Each wing has 9 staggered lobes stepping progressively inward toward the central core
    for tier in range(27):
        wing_idx = tier % 3
        step_in_wing = tier // 3  # 0..8
        ang = math.radians(wing_idx * 120.0 + 30.0)
        ca, sa = math.cos(ang), math.sin(ang)

        # Smooth exponential/linear height progression from ~52m up to 585m
        top_z = 52.0 + tier * 20.2
        # Radial reach shrinks as tier ascends (outermost base reach ~72m down to ~11m)
        dist = 66.0 * (1.0 - (tier / 28.0) ** 0.85) + 7.0
        lobe_r = 12.5 * (1.0 - 0.58 * (tier / 27.0))

        # Rounded-nose wing lobe cylinder + connecting web to central hexagonal core
        cx, cy = dist * ca, dist * sa
        b.add_cylinder("Glass_Curtain", (cx, cy, 0.0), lobe_r, lobe_r * 0.96, top_z, segs=12)
        b.add_box_z("Glass_Curtain", cx * 0.5, cy * 0.5, 0.0, top_z, dist, lobe_r * 1.45, rz=ang)
        # Shiny stainless-steel setback roof bullnose cap + glowing night rim
        b.add_cylinder("Silver_Steel", (cx, cy, top_z - 1.5), lobe_r * 1.04, lobe_r * 1.0, 2.2, segs=12)
        b.add_ring_band("Emissive_Windows", cx, cy, top_z - 2.5, lobe_r * 1.05, band_h=1.8, segs=12)
        # Vertical stainless mullion ribs along outer wing nose
        b.add_cylinder("Silver_Steel", ((dist + lobe_r * 0.92) * ca, (dist + lobe_r * 0.92) * sa, 0.0), 0.9, 0.7, top_z, segs=6)

        if tier in (6, 14, 21, 26):
            b.add_beacon((cx, cy, top_z + 1.8), 1.3)

    # Sparkling horizontal LED facade accents along upper core
    for zh in range(80, 580, 42):
        r = 18.0 * (1.0 - 0.45 * (zh / 585.0)) + 1.5
        b.add_ring_band("Emissive_Windows", 0.0, 0.0, zh, r, band_h=2.0, segs=6)

    # 6-tier telescopic metallic pinnacle spire (585m - 828m)
    spire_tiers = [
        (585.0, 635.0, 8.8, 6.8),
        (635.0, 680.0, 6.6, 5.0),
        (680.0, 720.0, 4.8, 3.4),
        (720.0, 758.0, 3.2, 2.0),
        (758.0, 795.0, 1.9, 1.0),
        (795.0, 828.0, 0.9, 0.25),
    ]
    for z0, z1, r0, r1 in spire_tiers:
        b.add_cylinder("Silver_Steel", (0.0, 0.0, z0), r0, r1, z1 - z0, segs=12)
        b.add_ring_band("Emissive_Windows", 0.0, 0.0, z0 + 2.0, r0 + 0.35, band_h=1.8, segs=12)

    b.add_beacon((0.0, 0.0, 828.6), 1.8)
    b.add_beacon((0.0, 0.0, 700.0), 1.4)


def build_dubai_burj_alarab(b: LandmarkBuilder):
    """Burj Al Arab (321m): triangular island, billowing dhow sail, diagrid exoskeleton, 210m helipad."""
    # Triangular artificial island base (0m - 8m) + landward access causeway bridge
    island_tri = [(-68.0, -45.0), (68.0, -45.0), (0.0, 82.0)]
    b.add_poly_extrude("Stone_Limestone", island_tri, 0.0, 8.0, scale_top=0.92)
    b.add_box_z("Asphalt_Road", 0.0, -82.0, 4.5, 7.5, 16.0, 80.0)
    b.add_cylinder("Water_Turquoise", (0.0, 62.0, 7.6), 16.0, 16.0, 0.8, segs=16)

    # Vertical landward rear concrete/steel spine mast (8m - 321m) at y = -26m
    b.add_cylinder("White_Concrete", (0.0, -26.0, 8.0), 8.5, 6.2, 242.0, segs=12)
    b.add_cylinder("White_Concrete", (0.0, -26.0, 250.0), 5.6, 0.7, 71.0, segs=12)

    # Sweeping V-shaped aqua-glass hotel wings + billowing white PTFE dhow sail (8m - 252m)
    sail_levels = 16
    sail_rings = []
    for k in range(sail_levels + 1):
        t = k / sail_levels
        z = 8.0 + t * 244.0
        # Billowing dhow sail curve: bulges outward toward +Y (seaward) around t = 0.42
        bulge_y = 58.0 * math.sin(t * math.pi * 0.92 + 0.12) * (1.0 - 0.15 * t)
        half_w = 36.0 * math.sin(t * math.pi * 0.88 + 0.18) + 4.0
        y_rear = -24.0
        y_front = y_rear + bulge_y + 12.0
        y_mid = 0.5 * (y_rear + y_front)
        ring = [
            (-5.5, y_rear, z),
            (5.5, y_rear, z),
            (half_w, y_mid, z),
            (half_w * 0.72, y_front * 0.92, z),
            (0.0, y_front, z),
            (-half_w * 0.72, y_front * 0.92, z),
            (-half_w, y_mid, z),
        ]
        sail_rings.append(ring)
    b.add_prism("Glass_Curtain", sail_rings, smooth=False)

    # Front billowing white PTFE sail screen & bowed horizontal structural ribs
    front_rings = [[r[3], r[4], r[5]] for r in sail_rings]
    for k in range(sail_levels):
        # Bowed white steel horizontal ribs across sail
        if k % 2 == 0:
            r = sail_rings[k]
            b.add_tube_between("White_Concrete", r[2], r[3], 1.1, 1.1, segs=6)
            b.add_tube_between("White_Concrete", r[3], r[4], 1.1, 1.1, segs=6)
            b.add_tube_between("White_Concrete", r[4], r[5], 1.1, 1.1, segs=6)
            b.add_tube_between("White_Concrete", r[5], r[6], 1.1, 1.1, segs=6)
        # Glowing sail membrane panels
        if 1 <= k <= sail_levels - 2:
            p0 = Vector(front_rings[k][1]) + Vector((0.0, 0.8, 0.0))
            p1 = Vector(front_rings[k + 1][1]) + Vector((0.0, 0.8, 0.0))
            b.add_tube_between("Emissive_Windows", p0, p1, 2.2, 2.0, segs=6)

    # Giant external white steel diagonal exoskeleton mega-trusses on East & West flanks
    for sign in (-1.0, 1.0):
        # Outer sweeping curved edge chord + base triangular buttress
        for k in range(sail_levels):
            idx = 2 if sign > 0 else 6
            b.add_tube_between("White_Concrete", sail_rings[k][idx], sail_rings[k + 1][idx], 1.8, 1.7, segs=8)
        # Massive X-diagrid trusses spanning flank
        b.add_tube_between("White_Concrete", (sign * 42.0, -32.0, 8.0), (sign * 28.0, 12.0, 125.0), 1.6, 1.5, segs=8)
        b.add_tube_between("White_Concrete", (sign * 42.0, 26.0, 8.0), (sign * 10.0, -24.0, 130.0), 1.6, 1.5, segs=8)
        b.add_tube_between("White_Concrete", (sign * 28.0, 12.0, 125.0), (sign * 8.0, -24.0, 240.0), 1.4, 1.3, segs=8)
        b.add_tube_between("White_Concrete", (sign * 10.0, -24.0, 125.0), (sign * 24.0, 10.0, 225.0), 1.4, 1.3, segs=8)

    # 210m Cantilevered Circular Helipad on landward (-Y) side
    b.add_cylinder("White_Concrete", (0.0, -45.0, 209.0), 12.5, 12.5, 2.2, segs=24)
    b.add_ring_band("Emissive_Windows", 0.0, -45.0, 211.2, 12.6, band_h=0.8, segs=24)
    for sx in (-6.0, 6.0):
        b.add_tube_between("White_Concrete", (sx, -28.0, 194.0), (sx, -46.0, 209.5), 1.1, 1.0, segs=8)

    # 200m Al Muntaha horizontal skyview restaurant capsule cantilevered on seaward (+Y) side
    b.add_box_z("White_Concrete", 0.0, 32.0, 197.0, 205.0, 44.0, 12.0)
    b.add_box_z("Emissive_Windows", 0.0, 38.2, 198.5, 203.5, 42.0, 1.4)

    b.add_beacon((0.0, -26.0, 321.5), 1.5)
    b.add_beacon((0.0, -57.5, 211.8), 1.0)
    b.add_beacon((-22.0, 32.0, 205.8), 1.0)
    b.add_beacon((22.0, 32.0, 205.8), 1.0)


def build_dubai_future(b: LandmarkBuilder):
    """Museum of the Future (77m H x 115m W x 85m D): green hill mound + asymmetric stainless torus ring."""
    # Landscaped green earth mound podium (0m - 18m)
    b.add_dome("Turf_Green", (0.0, 0.0, 0.0), 58.0, 42.0, 19.0, u_segs=28, v_segs=8)
    b.add_box_z("Dark_Glass", 0.0, -34.0, 0.0, 12.0, 28.0, 12.0)
    b.add_box_z("Emissive_Windows", 0.0, -40.2, 2.0, 10.5, 24.0, 1.0)

    # Upright asymmetric elliptical stainless-steel torus ring (18m - 77m) with open sky void
    # Center at z = 44m, rx_major = 34m, rz_major = 22m, tube depth 17m -> reaches 77m top!
    b.add_torus(
        "Silver_Steel",
        center=(0.0, 0.0, 43.5),
        rx_major=34.0,
        rz_major=21.5,
        tube_rad_inplane=11.5,
        tube_rad_depth=14.5,
        major_segs=32,
        minor_segs=14,
        plane="XZ",
        smooth=True,
    )
    # Sweeping glowing Arabic calligraphy ribbon bands wrapping the torus exterior
    for offset_v in (-0.45, 0.0, 0.45):
        pts = []
        for i in range(33):
            u = 2.0 * math.pi * i / 32.0
            v = offset_v + 0.35 * math.sin(3.0 * u)
            lx = (34.0 + 11.9 * math.cos(v)) * math.cos(u)
            ly = 14.9 * math.sin(v)
            lz = 43.5 + (21.5 + 11.9 * math.cos(v)) * math.sin(u)
            pts.append((lx, ly, lz))
        for i in range(32):
            b.add_tube_between("Emissive_Windows", pts[i], pts[i + 1], 0.85, 0.85, segs=5, cap=False)

    b.add_beacon((-10.0, 0.0, 77.2), 0.9)
    b.add_beacon((10.0, 0.0, 77.2), 0.9)


def _add_sydney_sail(b: LandmarkBuilder, cx, cy, z0, length, width, height, yaw=0.0, lean_dir=1.0):
    """Build one sharp-ridged spherical concrete vault sail + recessed glass mouth."""
    ca, sa = math.cos(yaw), math.sin(yaw)

    def _to_world(lx, ly, lz):
        return (cx + lx * ca - ly * sa, cy + lx * sa + ly * ca, z0 + lz)

    # 6 lofted pointed-arch cross-sections fanning upward and leaning outward
    n_u = 6
    rings = []
    for k in range(n_u):
        t = k / (n_u - 1)
        # Base starts narrow, opens wide at mouth, tapers to pointed peak
        y_loc = lean_dir * (t * length)
        h_loc = height * (0.25 + 0.75 * math.sin(t * math.pi * 0.55))
        w_loc = width * (0.35 + 0.65 * math.sin(t * math.pi * 0.75 + 0.15))
        # Pointed gothic arch profile (7 points from left base -> ridge -> right base)
        hw = w_loc * 0.5
        ring = [
            _to_world(-hw, y_loc, 0.0),
            _to_world(-hw * 0.92, y_loc, h_loc * 0.42),
            _to_world(-hw * 0.52, y_loc, h_loc * 0.80),
            _to_world(0.0, y_loc + lean_dir * 2.5 * t, h_loc),
            _to_world(hw * 0.52, y_loc, h_loc * 0.80),
            _to_world(hw * 0.92, y_loc, h_loc * 0.42),
            _to_world(hw, y_loc, 0.0),
        ]
        rings.append(ring)
    b.add_prism("White_Marble", rings, cap_bottom=True, cap_top=True, closed_ring=True, smooth=False)

    # Recessed bronze-glass fan curtain wall inside the tall open mouth
    mouth = rings[-1]
    glass_inner = [
        _to_world(-width * 0.36, lean_dir * (length - 3.5), 0.5),
        _to_world(0.0, lean_dir * (length - 3.5), height * 0.82),
        _to_world(width * 0.36, lean_dir * (length - 3.5), 0.5),
    ]
    b.add_prism("Dark_Glass", [mouth[:3], glass_inner], cap_bottom=False, cap_top=False, closed_ring=False)
    b.add_box("Emissive_Windows", _to_world(0.0, lean_dir * (length - 2.2), height * 0.35), (width * 0.52, 1.8, height * 0.55), rz=yaw)


def build_sydney_opera(b: LandmarkBuilder):
    """Sydney Opera House (65m H x 120m W x 183m D): pink granite podium + 3 interlocking sail groups."""
    # Monumental warm pink-granite podium peninsula (0m - 16m)
    b.add_box_z("Pink_Granite", 0.0, 5.0, 0.0, 15.5, 114.0, 168.0)
    # 90m-wide grand ceremonial staircase on South (-Y) landward approach
    for s in range(6):
        t = s / 6.0
        b.add_box_z("Pink_Granite", 0.0, -80.0 - (5 - s) * 3.8, 0.0, 2.5 + t * 13.0, 88.0, 4.4)

    # Group 1: Concert Hall (West main group, x = -25m, 4 nested pairs climbing to 65m)
    _add_sydney_sail(b, -25.0, -32.0, 15.5, 22.0, 32.0, 28.0, yaw=0.0, lean_dir=-1.0)
    _add_sydney_sail(b, -25.0, -14.0, 15.5, 28.0, 38.0, 42.0, yaw=0.0, lean_dir=1.0)
    _add_sydney_sail(b, -25.0, 8.0, 15.5, 32.0, 42.0, 49.5, yaw=0.0, lean_dir=1.0)
    _add_sydney_sail(b, -25.0, 36.0, 15.5, 28.0, 36.0, 38.0, yaw=0.0, lean_dir=1.0)

    # Group 2: Joan Sutherland Opera Theatre (East parallel group, x = +26m, climbing to 54m)
    _add_sydney_sail(b, 26.0, -24.0, 15.5, 20.0, 28.0, 24.0, yaw=0.0, lean_dir=-1.0)
    _add_sydney_sail(b, 26.0, -6.0, 15.5, 25.0, 34.0, 34.0, yaw=0.0, lean_dir=1.0)
    _add_sydney_sail(b, 26.0, 14.0, 15.5, 28.0, 36.0, 38.5, yaw=0.0, lean_dir=1.0)
    _add_sydney_sail(b, 26.0, 38.0, 15.5, 22.0, 30.0, 30.0, yaw=0.0, lean_dir=1.0)

    # Group 3: Bennelong Restaurant (Southwest front pod, x = -34m, y = -62m, max height 25m)
    _add_sydney_sail(b, -34.0, -62.0, 15.5, 16.0, 22.0, 12.0, yaw=0.3, lean_dir=1.0)
    _add_sydney_sail(b, -34.0, -56.0, 15.5, 14.0, 18.0, 10.0, yaw=0.3, lean_dir=-1.0)

    b.add_beacon((-25.0, 38.0, 65.5), 0.9)
    b.add_beacon((26.0, 40.0, 54.5), 0.9)


def build_sydney_bridge(b: LandmarkBuilder):
    """Sydney Harbour Bridge (134m H x 49m W x 1149m L): 503m parabolic through-arch + 4 granite pylons."""
    # Aligned along Y axis (-574.5m to +574.5m); width along X (-24.5m to +24.5m)
    half_span = 251.5
    half_w = 24.5
    deck_z = 52.0

    # 1. Suspended 8-lane road & rail deck (49m wide, clear 49m navigable water height underneath)
    b.add_box_z("Dark_Steel", 0.0, 0.0, 49.0, deck_z, 49.0, 1149.0)
    b.add_box_z("Asphalt_Road", 0.0, 0.0, deck_z, deck_z + 0.6, 44.0, 1149.0)
    # Continuous warm highway streetlight strips along deck edges
    for sx in (-22.0, 22.0):
        b.add_box_z("Emissive_Windows", sx, 0.0, deck_z + 1.0, deck_z + 2.2, 1.2, 1120.0)

    # 2. Main Parabolic Double-Chord Steel Through-Arch ("The Coathanger", 503m span, 134m crown)
    n_arch = 24
    lower_pts = {s: [] for s in (-1.0, 1.0)}
    upper_pts = {s: [] for s in (-1.0, 1.0)}
    for i in range(n_arch + 1):
        u = -1.0 + 2.0 * i / n_arch  # -1..+1
        y = u * half_span
        # Lower arch chord rises from water hinge (14m) to 116m at crown
        z_low = 14.0 + 102.0 * (1.0 - u * u)
        # Upper arch chord tapers from 57m above lower at shore to 18m above lower at crown (134m)
        truss_depth = 18.0 + 39.0 * (u * u)
        z_up = z_low + truss_depth
        for s in (-1.0, 1.0):
            lower_pts[s].append(Vector((s * half_w, y, z_low)))
            upper_pts[s].append(Vector((s * half_w, y, z_up)))

    for s in (-1.0, 1.0):
        for i in range(n_arch):
            b.add_tube_between("Dark_Steel", lower_pts[s][i], lower_pts[s][i + 1], 2.1, 2.1, segs=6)
            b.add_tube_between("Dark_Steel", upper_pts[s][i], upper_pts[s][i + 1], 1.9, 1.9, segs=6)
            # Vertical & Warren diagonal web struts
            b.add_tube_between("Dark_Steel", lower_pts[s][i], upper_pts[s][i], 1.1, 1.1, segs=5)
            b.add_tube_between("Dark_Steel", lower_pts[s][i], upper_pts[s][i + 1], 0.95, 0.95, segs=5)
            # Vertical deck hanger cables from arch down to 52m deck
            if lower_pts[s][i].z > deck_z + 3.0:
                b.add_tube_between("Dark_Steel", (s * half_w, lower_pts[s][i].y, deck_z), lower_pts[s][i], 0.55, 0.55, segs=5)

    # Overhead lateral X-bracing portal trusses connecting East & West arch ribs
    for i in range(3, n_arch - 2, 2):
        b.add_tube_between("Dark_Steel", upper_pts[-1.0][i], upper_pts[1.0][i], 1.0, 1.0, segs=5)
        b.add_tube_between("Dark_Steel", upper_pts[-1.0][i], upper_pts[1.0][i + 1], 0.75, 0.75, segs=4)
        b.add_tube_between("Dark_Steel", upper_pts[1.0][i], upper_pts[-1.0][i + 1], 0.75, 0.75, segs=4)

    # 3. Four Monumental 89m Art-Deco Moruya Granite Shore Pylons (2 North, 2 South)
    for sy in (-half_span - 14.0, half_span + 14.0):
        b.add_box_z("Granite_Grey", 0.0, sy, 0.0, 48.0, 56.0, 28.0)
        for sx in (-20.0, 20.0):
            b.add_box_z("Granite_Grey", sx, sy, 0.0, 82.0, 15.0, 22.0)
            b.add_box_z("Granite_Grey", sx, sy, 82.0, 89.0, 12.5, 19.0)
            b.add_box_z("Emissive_Floodlight", sx, sy, 62.0, 80.0, 15.4, 8.0)
            b.add_beacon((sx, sy, 90.0), 1.3)

    # 4. Approach truss support piers on North & South shorelines
    for side in (-1.0, 1.0):
        for k in range(1, 6):
            py = side * (half_span + 32.0 + k * 56.0)
            b.add_box_z("Granite_Grey", -18.0, py, 0.0, 49.0, 7.0, 8.0)
            b.add_box_z("Granite_Grey", 18.0, py, 0.0, 49.0, 7.0, 8.0)

    b.add_beacon((-half_w, 0.0, 135.2), 1.5)
    b.add_beacon((half_w, 0.0, 135.2), 1.5)


# ==============================================================================
# 8. REGION 6 — NORTH & SOUTH AMERICA (12 LANDMARKS)
# ==============================================================================

def build_golden_gate(b: LandmarkBuilder):
    """Golden Gate Bridge (227m H x 2737m L x 27.4m W): 4-tier Art Deco towers, catenary cables, Fort Point."""
    # Aligned along Y axis (-1368.5m to +1368.5m), main span 1280m -> towers at y = -640m and +640m
    tower_y = 640.0
    deck_z = 67.0
    half_w = 13.7

    # 1. Orthotropic steel truss roadway deck (67m above water)
    b.add_box_z("Bridge_International_Orange", 0.0, 0.0, deck_z - 7.5, deck_z, 27.4, 2737.0)
    b.add_box_z("Asphalt_Road", 0.0, 0.0, deck_z, deck_z + 0.6, 23.0, 2737.0)
    for sx in (-12.5, 12.5):
        b.add_box_z("Emissive_Windows", sx, 0.0, deck_z + 1.0, deck_z + 2.2, 0.9, 2700.0)

    # 2. Twin 227m 4-tier Art Deco stepped International Orange Towers
    for ty in (-tower_y, tower_y):
        # Elliptical concrete water pier & fender ring (0m - 14m)
        b.add_ellipse_frustum("Granite_Grey", (0.0, ty, 0.0), 28.0, 16.0, 26.0, 14.0, 14.0, segs=20)
        # 4 stepped Art Deco vertical leg tiers
        leg_tiers = [
            (14.0, 82.0, 10.5, 13.5),
            (82.0, 134.0, 9.0, 11.5),
            (134.0, 182.0, 7.6, 9.8),
            (182.0, 227.0, 6.2, 8.2),
        ]
        for sx in (-half_w, half_w):
            for z0, z1, wx, wy in leg_tiers:
                b.add_box_z("Bridge_International_Orange", sx, ty, z0, z1, wx, wy)
            b.add_beacon((sx, ty, 228.2), 1.6)
        # 4 horizontal Art Deco portal cross-struts above deck + X-bracing below deck
        for zs in (104.0, 142.0, 180.0, 218.0):
            b.add_box_z("Bridge_International_Orange", 0.0, ty, zs - 5.5, zs + 5.5, 27.4, 5.2)
            b.add_box_z("Emissive_Floodlight", 0.0, ty, zs - 2.0, zs + 2.0, 22.0, 5.6)
        # Diagonal X-bracing below roadway deck
        b.add_tube_between("Bridge_International_Orange", (-half_w, ty, 16.0), (half_w, ty, 64.0), 1.4, 1.4, segs=6)
        b.add_tube_between("Bridge_International_Orange", (half_w, ty, 16.0), (-half_w, ty, 64.0), 1.4, 1.4, segs=6)

    # 3. Parabolic Catenary Main Cables + Vertical Suspender Ropes
    anch_y = 1340.0
    for sx in (-half_w, half_w):
        # Center main span catenary (sag ~148m from 227m tower tops down to ~79m at mid-span)
        b.add_parabolic_cable("Bridge_International_Orange", (sx, -tower_y, 227.0), (sx, tower_y, 227.0), sag=148.0, radius=1.25, segs=24, tube_segs=6)
        # South & North side span catenaries down to concrete anchorages
        b.add_parabolic_cable("Bridge_International_Orange", (sx, -anch_y, 68.0), (sx, -tower_y, 227.0), sag=36.0, radius=1.25, segs=14, tube_segs=6)
        b.add_parabolic_cable("Bridge_International_Orange", (sx, tower_y, 227.0), (sx, anch_y, 68.0), sag=36.0, radius=1.25, segs=14, tube_segs=6)

        # Vertical twin-wire suspender ropes along main & side spans
        for y in range(-1240, 1241, 64):
            if abs(abs(y) - tower_y) < 28.0:
                continue
            if abs(y) < tower_y:
                t = (y + tower_y) / (2.0 * tower_y)
                z_cable = 227.0 - 4.0 * 148.0 * t * (1.0 - t)
            else:
                t = (abs(y) - tower_y) / (anch_y - tower_y)
                z_cable = 227.0 * (1.0 - t) + 68.0 * t - 4.0 * 36.0 * t * (1.0 - t)
            if z_cable > deck_z + 2.0:
                b.add_tube_between("Bridge_International_Orange", (sx, float(y), deck_z), (sx, float(y), z_cable), 0.32, 0.32, segs=4)

    # 4. Concrete Shore Anchorages & South Fort Point Historic Brick Bastion
    for sy in (-anch_y, anch_y):
        b.add_box_z("Granite_Grey", 0.0, sy, 0.0, 70.0, 44.0, 52.0)
    # Historic 3-tier red-brick Fort Point tucked under South approach arch
    b.add_box_z("Red_Brick", 0.0, -980.0, 0.0, 22.0, 62.0, 48.0)


def build_sf_transamerica(b: LandmarkBuilder):
    """Transamerica Pyramid (260m) + companion Salesforce Tower (326m) San Francisco landmark duo."""
    # 1. Transamerica Pyramid centered at origin (260m x 53m x 53m)
    # 4-story diagonal K-brace truss podium (0m - 22m)
    b.add_box_z("White_Concrete", 0.0, 0.0, 0.0, 22.0, 53.0, 53.0)
    for ang in (0.0, 0.5 * math.pi, math.pi, 1.5 * math.pi):
        ca, sa = math.cos(ang), math.sin(ang)
        for u in (-16.0, 0.0, 16.0):
            p_b = (u * ca - 27.0 * sa, u * sa + 27.0 * ca, 0.0)
            p_t = ((u + 8.0) * ca - 25.0 * sa, (u + 8.0) * sa + 25.0 * ca, 22.0)
            p_t2 = ((u - 8.0) * ca - 25.0 * sa, (u - 8.0) * sa + 25.0 * ca, 22.0)
            b.add_tube_between("White_Concrete", p_b, p_t, 0.9, 0.85, segs=6)
            b.add_tube_between("White_Concrete", p_b, p_t2, 0.9, 0.85, segs=6)

    # Main 4-sided steeply tapered Sierra quartz pyramid shaft (22m - 195.4m)
    b.add_poly_extrude(
        "White_Marble",
        [(-24.5, -24.5), (24.5, -24.5), (24.5, 24.5), (-24.5, 24.5)],
        22.0,
        195.4,
        scale_top=0.29,
    )
    # Recessed bronze-window horizontal office strips along tapered shaft
    for k in range(1, 16):
        t = k / 16.0
        z = 22.0 + t * 173.4
        w = 49.0 * (1.0 - 0.71 * t) + 0.4
        b.add_box_z("Emissive_Windows", 0.0, 0.0, z - 1.1, z + 1.1, w, w)

    # Twin vertical rectangular external elevator/stairwell wing ears (East & West, 108m - 196m)
    for sign in (-1.0, 1.0):
        b.add_box_z("White_Marble", sign * 15.5, 0.0, 108.0, 196.0, 10.5, 13.0)
        b.add_box_z("Dark_Glass", sign * 20.8, 0.0, 114.0, 190.0, 0.8, 9.5)

    # 64.6m Translucent glowing louvered glass pyramid spire crown (195.4m - 260m)
    b.add_poly_extrude(
        "Emissive_Floodlight",
        [(-7.2, -7.2), (7.2, -7.2), (7.2, 7.2), (-7.2, 7.2)],
        195.4,
        256.0,
        scale_top=0.06,
    )
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 255.0), 0.5, 0.12, 5.0, segs=8)
    b.add_beacon((0.0, 0.0, 260.4), 1.3)

    # 2. Companion Salesforce Tower (326m, offset 95m East-South)
    sx, sy = 95.0, -35.0
    rings = []
    for k in range(13):
        t = k / 12.0
        z = t * 326.0
        r = 28.0 * (1.0 - 0.34 * (t ** 1.4))
        ring = []
        for i in range(20):
            a = 2.0 * math.pi * i / 20.0
            # Squircle rounded-corner obelisk profile
            rr = r * (1.0 + 0.06 * math.cos(4.0 * a))
            ring.append((sx + rr * math.cos(a), sy + rr * math.sin(a), z))
        rings.append(ring)
    b.add_prism("Glass_Curtain", rings, smooth=True)
    # Glowing 45m sculpted LED video-art crown (281m - 326m)
    b.add_cylinder("Emissive_Windows", (sx, sy, 282.0), 21.6, 18.8, 42.0, segs=20)
    b.add_beacon((sx, sy, 326.6), 1.4)


def build_nyc_owtc(b: LandmarkBuilder):
    """One World Trade Center (541.3m): cubic podium, exact 8-triangle antiprism shaft, 124.3m spire."""
    # Fortified cubic prismatic-fin podium (0m - 57m, 61m x 61m)
    b.add_box_z("Silver_Steel", 0.0, 0.0, 0.0, 57.0, 61.0, 61.0)
    b.add_window_bands("Emissive_Windows", 0.0, 0.0, 6.0, 52.0, 61.6, 61.6, count=5, band_h=1.4)

    # True chamfered 8-isosceles-triangle antiprism shaft (57m - 417m)
    # Base square (61m, axis-aligned) smoothly morphs into 45-deg rotated square (45m) at roof!
    r_bot = 30.5 * math.sqrt(2.0)  # corner radius of 61m square
    r_top = 22.5 * math.sqrt(2.0)  # corner radius of 45m square
    bot_sq = [
        (r_bot * math.cos(math.pi * 0.25 + k * 0.5 * math.pi),
         r_bot * math.sin(math.pi * 0.25 + k * 0.5 * math.pi), 57.0)
        for k in range(4)
    ]
    top_sq = [
        (r_top * math.cos(k * 0.5 * math.pi),
         r_top * math.sin(k * 0.5 * math.pi), 417.0)
        for k in range(4)
    ]
    # Exact antiprism: 4 upward-pointing isosceles triangles + 4 downward-pointing isosceles triangles
    bm = b._bm("Glass_Curtain")
    vb = [bm.verts.new(p) for p in bot_sq]
    vt = [bm.verts.new(p) for p in top_sq]
    for k in range(4):
        nk = (k + 1) % 4
        # Upward triangle (base edge -> top vertex between them)
        _safe_face(bm, [vb[k], vb[nk], vt[nk]], smooth=False)
        # Downward triangle (top edge -> bottom vertex)
        _safe_face(bm, [vt[k], vb[k], vt[nk]], smooth=False)
    _safe_face(bm, list(reversed(vb)), smooth=False)
    _safe_face(bm, vt, smooth=False)

    # Horizontal illuminated office strips following the antiprism cross-section
    for lv in range(1, 18):
        t = lv / 18.0
        z = 57.0 + t * 355.0
        ring = []
        for k in range(4):
            nk = (k + 1) % 4
            p1 = Vector(bot_sq[k]).lerp(Vector(top_sq[k]), t)
            p2 = Vector(bot_sq[k]).lerp(Vector(top_sq[nk]), t)
            ring.append((p1.x * 1.01, p1.y * 1.01, z))
            ring.append((p2.x * 1.01, p2.y * 1.01, z))
        ring_hi = [(x, y, z + 1.8) for (x, y, _) in ring]
        b.add_prism("Emissive_Windows", [ring, ring_hi], cap_bottom=False, cap_top=False)

    # Rooftop parapet & communication ring (408m - 421m)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 417.0), 19.5, 19.0, 4.5, segs=24)

    # 124.3m sculpted broadcast spire (417m - 541.3m) with 3 circular communication rings & guy cables
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 417.0), 4.6, 2.2, 55.0, segs=14)
    b.add_cylinder("Emissive_Floodlight", (0.0, 0.0, 472.0), 2.1, 0.45, 69.3, segs=12)
    for zr, rr in ((435.0, 11.5), (465.0, 8.2), (498.0, 5.5)):
        b.add_ring_band("Emissive_Windows", 0.0, 0.0, zr, rr, band_h=2.0, segs=20)
    for k in range(4):
        a = k * 0.5 * math.pi
        b.add_tube_between("Silver_Steel", (18.0 * math.cos(a), 18.0 * math.sin(a), 419.0), (2.2 * math.cos(a), 2.2 * math.sin(a), 472.0), 0.35, 0.35, segs=5)
    b.add_beacon((0.0, 0.0, 541.8), 1.8)


def build_nyc_empire(b: LandmarkBuilder):
    """Empire State Building (443.2m): 5-story podium, Art Deco wedding-cake setbacks, mooring mast, spire."""
    # Classic Art Deco wedding-cake Indiana limestone setbacks (0m - 320m)
    tiers = [
        (0.0, 26.0, 129.0, 57.0),      # 5-story street podium
        (26.0, 82.0, 96.0, 52.0),      # Floor 6-21
        (82.0, 108.0, 80.0, 48.0),     # Floor 21-25
        (108.0, 282.0, 60.0, 42.0),    # Main shaft (Floor 30-72)
        (282.0, 306.0, 48.0, 34.0),    # Floor 72-81
        (306.0, 320.0, 38.0, 28.0),    # Floor 81-86 observation deck
    ]
    for z0, z1, sx, sy in tiers:
        b.add_box_z("Stone_Limestone", 0.0, 0.0, z0, z1, sx, sy)
        count = max(2, int((z1 - z0) / 14.0))
        b.add_window_bands("Emissive_Windows", 0.0, 0.0, z0 + 3.0, z1 - 3.0, sx + 0.5, sy + 0.5, count=count, band_h=1.5)
        # Vertical Art Deco chrome window mullions along wide East/West facades
        for mx in (-sx * 0.32, 0.0, sx * 0.32):
            b.add_box_z("Silver_Steel", mx, -sy * 0.505, z0, z1, 1.8, 0.8)
            b.add_box_z("Silver_Steel", mx, sy * 0.505, z0, z1, 1.8, 0.8)

    # Side wing shoulders flanking main shaft up to 240m
    for sign in (-1.0, 1.0):
        b.add_box_z("Stone_Limestone", sign * 35.0, 0.0, 108.0, 240.0, 14.0, 30.0)

    # 86F Open-Air Observation Deck glow band & Dirigible Mooring Mast (320m - 381m)
    b.add_box_z("Emissive_Floodlight", 0.0, 0.0, 319.5, 323.5, 39.0, 29.0)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 320.0, 340.0, 26.0, 22.0)
    # Ribbed metallic mooring mast + 4 wing buttresses + 102F circular lantern
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 340.0), 10.5, 8.2, 34.0, segs=16)
    b.add_ring_band("Emissive_Floodlight", 0.0, 0.0, 355.0, 10.0, band_h=6.0, segs=16)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 374.0, 8.6, band_h=3.6, segs=16)
    b.add_dome("Silver_Steel", (0.0, 0.0, 375.5), 8.2, 8.2, 6.0, u_segs=16, v_segs=6)
    for k in range(4):
        a = k * 0.5 * math.pi
        b.add_box_z("Silver_Steel", 10.2 * math.cos(a), 10.2 * math.sin(a), 336.0, 368.0, 3.2, 3.2, rz=a)

    # Broadcast antenna spire (381m - 443.2m)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 381.0), 3.2, 1.4, 34.0, segs=10)
    b.add_cylinder("Silver_Steel", (0.0, 0.0, 415.0), 1.3, 0.25, 28.2, segs=10)
    b.add_beacon((0.0, 0.0, 443.7), 1.6)
    b.add_beacon((0.0, 0.0, 412.0), 1.1)


def build_nyc_chrysler(b: LandmarkBuilder):
    """Chrysler Building (318.9m): stepped brick shaft, corner eagles, 7 sunburst arches, needle spire."""
    # Stepped white glazed brick base & Art Deco tower shaft (0m - 225m)
    shaft_tiers = [
        (0.0, 62.0, 61.0, 61.0),
        (62.0, 96.0, 50.0, 50.0),
        (96.0, 128.0, 40.0, 40.0),
        (128.0, 225.0, 31.0, 31.0),
    ]
    for z0, z1, sx, sy in shaft_tiers:
        b.add_box_z("White_Marble", 0.0, 0.0, z0, z1, sx, sy)
        count = max(2, int((z1 - z0) / 14.0))
        b.add_window_bands("Emissive_Windows", 0.0, 0.0, z0 + 3.0, z1 - 3.0, sx + 0.4, sy + 0.4, count=count, band_h=1.4)

    # 31F radiator-cap winged hubs & 61F protruding stainless-steel eagle gargoyles at corners
    for z_orn, dist, sz in ((124.0, 21.5, 4.5), (218.0, 17.5, 5.2)):
        for sx in (-1.0, 1.0):
            for sy in (-1.0, 1.0):
                b.add_box("Silver_Steel", (sx * dist, sy * dist, z_orn), (sz, 2.2, 2.4), rz=math.atan2(sy, sx))

    # 7-Tiered Radiating Cruciform Sunburst Stainless Steel Crown (225m - 282m)
    for tier in range(7):
        t = tier / 6.0
        z0 = 225.0 + tier * 8.1
        rad = 16.5 * (1.0 - 0.72 * t)
        arch_h = 11.5 * (1.0 - 0.48 * t)
        # Cruciform intersecting vaulted stainless-steel arches on both X and Y planes
        b.add_dome("Silver_Steel", (0.0, 0.0, z0), rad, rad, arch_h, u_segs=16, v_segs=6, smooth=True)
        # Iconic glowing Art Deco triangular chevron windows radiating around each sunburst tier
        n_win = max(4, 12 - tier)
        for k in range(n_win):
            a = 2.0 * math.pi * k / n_win
            wx = (rad * 0.92) * math.cos(a)
            wy = (rad * 0.92) * math.sin(a)
            wz = z0 + arch_h * 0.42
            b.add_box("Emissive_Windows", (wx, wy, wz), (1.8 * (1.0 - 0.35 * t), 1.8 * (1.0 - 0.35 * t), 2.8 * (1.0 - 0.35 * t)), rz=a)

    # 37m square-section stainless-steel needle spire (282m - 318.9m)
    b.add_poly_extrude(
        "Silver_Steel",
        [(-2.4, -2.4), (2.4, -2.4), (2.4, 2.4), (-2.4, 2.4)],
        281.0,
        318.9,
        scale_top=0.08,
    )
    b.add_beacon((0.0, 0.0, 319.4), 1.4)


def build_nyc_liberty(b: LandmarkBuilder):
    """Statue of Liberty (93m): 11-point Star Fort Wood, granite pedestal, robed statue, 7-spike crown, torch."""
    # 1. 11-Point Star Fort Wood granite bastion (0m - 20m, diameter 65m)
    star_pts = []
    for i in range(22):
        ang = 2.0 * math.pi * i / 22.0
        r = 32.5 if (i % 2 == 0) else 22.5
        star_pts.append((r * math.cos(ang), r * math.sin(ang)))
    b.add_poly_extrude("Granite_Grey", star_pts, 0.0, 17.5, scale_top=0.90)
    b.add_poly_extrude("Turf_Green", star_pts, 17.5, 19.5, scale_top=0.82)

    # 2. Richard Morris Hunt stepped neoclassical granite pedestal (19.5m - 47m)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 19.5, 25.0, 22.0, 22.0)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 25.0, 42.0, 17.5, 17.5)
    b.add_box_z("Emissive_Floodlight", 0.0, 0.0, 33.0, 38.0, 18.0, 18.0)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 42.0, 47.0, 19.5, 19.5)

    # 3. 46m Verdigris Copper Statue of Liberty (47m - 93m)
    # Draped Roman Stola & Palla robes (fluted tapered cylinder from feet 47m to shoulders 74m)
    robe_rings = []
    for k in range(9):
        t = k / 8.0
        z = 47.0 + t * 27.5
        rx = 5.6 * (1.0 - 0.32 * t) + 0.5 * math.sin(t * math.pi)
        ry = 4.8 * (1.0 - 0.30 * t)
        ring = []
        for i in range(16):
            a = 2.0 * math.pi * i / 16.0
            flute = 1.0 + 0.07 * math.cos(8.0 * a)
            ring.append((rx * flute * math.cos(a), ry * flute * math.sin(a), z))
        robe_rings.append(ring)
    b.add_prism("Verdigris_Copper", robe_rings, smooth=True)

    # Left arm cradling the Tabula Ansata tablet
    b.add_tube_between("Verdigris_Copper", (-4.2, 0.5, 72.0), (-5.2, -2.5, 65.0), 1.5, 1.3, segs=8)
    b.add_box("Verdigris_Copper", (-5.4, -3.2, 67.5), (2.2, 4.6, 6.2), rx=0.22, rz=-0.3)

    # Neck, classical head, and 7-spike radiant diadem crown (74.5m - 82.5m)
    b.add_cylinder("Verdigris_Copper", (0.0, 0.0, 74.0), 1.8, 1.6, 2.5, segs=10)
    b.add_sphere("Verdigris_Copper", (0.0, -0.3, 78.6), 2.3, 2.6, 3.0, u_segs=14, v_segs=10)
    b.add_ring_band("Emissive_Windows", 0.0, -0.3, 80.6, 2.5, band_h=0.8, segs=14)
    # 7 sharp sun-ray spikes radiating from the crown
    for k in range(7):
        a = math.radians(-75.0 + k * 25.0)
        p0 = (2.4 * math.sin(a), -0.6, 80.6 + 1.4 * math.cos(a))
        p1 = (6.2 * math.sin(a), -1.4, 81.2 + 4.4 * math.cos(a))
        b.add_tube_between("Verdigris_Copper", p0, p1, 0.35, 0.06, segs=6)

    # Raised right arm extending high overhead (73m -> 87m) holding torch gallery & 24k gold flame (93m)
    b.add_tube_between("Verdigris_Copper", (4.0, 0.0, 72.5), (4.6, -1.2, 86.5), 1.55, 1.1, segs=10)
    b.add_cylinder("Verdigris_Copper", (4.6, -1.2, 85.8), 1.6, 2.4, 2.4, segs=12)
    b.add_cylinder("Gold_Leaf", (4.6, -1.2, 88.2), 1.4, 0.25, 4.8, segs=10)
    b.add_sphere("Emissive_Windows", (4.6, -1.2, 90.2), 1.5, 1.5, 2.4, u_segs=10, v_segs=8)
    b.add_beacon((4.6, -1.2, 93.4), 0.7)


def build_seattle_needle(b: LandmarkBuilder):
    """Seattle Space Needle (184m): 3 hourglass steel legs, central core, 42m flying-saucer halo, spire."""
    # Circular glazed entry pavilion base (0m - 12m)
    b.add_cylinder("Glass_Curtain", (0.0, 0.0, 0.0), 19.0, 17.5, 10.0, segs=24)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 10.0), 20.0, 18.0, 2.0, segs=24)

    # Central hexagonal elevator core (0m - 158m) + 30m SkyLine intermediate platform
    b.add_cylinder("White_Concrete", (0.0, 0.0, 0.0), 4.8, 4.4, 158.0, segs=6, smooth=False)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 28.0), 14.5, 14.5, 4.0, segs=18)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 30.0, 14.8, band_h=1.6, segs=18)

    # 3 double-column hourglass steel legs arranged at 120 deg intervals (0m - 134m)
    # Spread 18.5m radius at ground -> pinched 6.8m waist at 114m -> flared 16.5m under saucer at 134m
    def _hourglass_r(z):
        if z <= 114.0:
            t = z / 114.0
            return 18.5 * ((1.0 - t) ** 1.45) + 6.8
        t = (z - 114.0) / 20.0
        return 6.8 + 9.7 * (t ** 1.35)

    steps = 16
    for leg in range(3):
        base_ang = 2.0 * math.pi * leg / 3.0
        for sub in (-0.12, 0.12):
            a = base_ang + sub
            pts = [(_hourglass_r(134.0 * k / steps) * math.cos(a), _hourglass_r(134.0 * k / steps) * math.sin(a), 134.0 * k / steps) for k in range(steps + 1)]
            for k in range(steps):
                b.add_tube_between("White_Concrete", pts[k], pts[k + 1], 1.15, 1.05, segs=8)
        # Ladder cross-rungs between each leg's twin steel columns
        for k in range(1, steps):
            z = 134.0 * k / steps
            r = _hourglass_r(z)
            p_l = (r * math.cos(base_ang - 0.12), r * math.sin(base_ang - 0.12), z)
            p_r = (r * math.cos(base_ang + 0.12), r * math.sin(base_ang + 0.12), z)
            b.add_tube_between("White_Concrete", p_l, p_r, 0.55, 0.55, segs=6)

    # Flying-Saucer "Top House" 42m Observation Halo (132m - 158m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 132.0), 12.0, 21.0, 6.0, segs=36)
    b.add_cylinder("Glass_Curtain", (0.0, 0.0, 138.0), 21.0, 22.0, 7.5, segs=36)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 142.0, 22.3, band_h=3.6, segs=36)
    # Cantilevered observation rim & Galaxy-Gold scalloped pagoda-curved roof
    b.add_cylinder("White_Concrete", (0.0, 0.0, 145.5), 22.4, 21.5, 2.5, segs=36)
    b.add_cylinder("Bridge_International_Orange", (0.0, 0.0, 148.0), 21.5, 10.0, 7.5, segs=36)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 155.5), 10.0, 5.2, 4.5, segs=24)

    # Torch Mezzanine & 26m Spire Mast (160m - 184m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 160.0), 2.2, 0.3, 24.0, segs=10)
    b.add_beacon((0.0, 0.0, 184.5), 1.3)


def build_toronto_cn(b: LandmarkBuilder):
    """CN Tower (553.3m): Y-section concave concrete buttress fins, 44m Main Pod, SkyPod, 102m antenna."""
    # Y-shaped hexagonal concrete core + 3 sweeping concave triangular buttress fins (0m - 335m)
    levels = 20
    rings = []
    for k in range(levels + 1):
        t = k / levels
        z = t * 335.0
        # 3 concave fins taper smoothly from 33m reach at ground down to 9.5m neck under Main Pod
        fin_r = 24.5 * ((1.0 - t) ** 1.65) + 9.0
        core_r = 10.5 * (1.0 - 0.32 * t)
        ring = []
        for arm in range(3):
            a_c = 2.0 * math.pi * arm / 3.0
            a_l = a_c - 0.24
            a_r = a_c + 0.24
            a_mid = a_c + math.pi / 3.0
            ring.append((fin_r * math.cos(a_l), fin_r * math.sin(a_l), z))
            ring.append((fin_r * math.cos(a_r), fin_r * math.sin(a_r), z))
            ring.append((core_r * math.cos(a_mid), core_r * math.sin(a_mid), z))
        rings.append(ring)
    b.add_prism("White_Concrete", rings, smooth=False)

    # Vertical glowing elevator LED strips running full height up the 3 fin channels
    for arm in range(3):
        a = 2.0 * math.pi * arm / 3.0 + math.pi / 3.0
        b.add_tube_between("Emissive_Windows", (11.2 * math.cos(a), 11.2 * math.sin(a), 15.0), (7.6 * math.cos(a), 7.6 * math.sin(a), 332.0), 1.0, 0.8, segs=6)

    # 12 sloped radial concrete support brackets under Main Pod (322m - 340m)
    for i in range(12):
        a = 2.0 * math.pi * i / 12.0
        b.add_tube_between("White_Concrete", (8.5 * math.cos(a), 8.5 * math.sin(a), 322.0), (20.5 * math.cos(a), 20.5 * math.sin(a), 342.0), 1.1, 0.9, segs=6)

    # 44m-diameter 7-story Main Pod (336m - 366m): white radome ring + canted panoramic glass
    b.add_cylinder("White_Concrete", (0.0, 0.0, 336.0), 14.0, 22.0, 8.0, segs=32)
    b.add_cylinder("Dark_Glass", (0.0, 0.0, 344.0), 22.0, 21.0, 12.0, segs=32)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 350.0, 22.2, band_h=3.6, segs=32)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 356.0), 21.0, 11.0, 10.0, segs=32)

    # Upper hexagonal concrete shaft & 447m SkyPod observatory ring (366m - 457m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 366.0), 8.5, 6.2, 91.0, segs=6, smooth=False)
    b.add_cylinder("Dark_Glass", (0.0, 0.0, 442.0), 9.2, 9.2, 11.0, segs=20)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 447.5, 9.5, band_h=3.0, segs=20)

    # 102m tapered white/red broadcast antenna (457m - 553.3m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 457.0), 4.2, 2.5, 36.0, segs=12)
    b.add_cylinder("Bridge_International_Orange", (0.0, 0.0, 493.0), 2.5, 1.4, 32.0, segs=12)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 525.0), 1.4, 0.35, 28.3, segs=10)
    b.add_beacon((0.0, 0.0, 553.8), 1.6)
    b.add_beacon((0.0, 0.0, 455.0), 1.1)


def build_chicago_willis(b: LandmarkBuilder):
    """Willis / Sears Tower (527m): exact Fazlur Khan 3x3 9-bundled-tube setbacks + twin antennas."""
    # Exact 3x3 matrix of 9 square tubes (each 22.9m x 22.9m = 68.7m total footprint)
    # Grid indices (gx, gy) in {-1, 0, +1}: gx=-1 West, gx=+1 East; gy=+1 North, gy=-1 South
    tube_w = 22.9
    tube_heights = {
        # Stepback 1 (Floor 50 / 198m): NW (-1, +1) and SE (+1, -1) terminate
        (-1, 1): 198.0,
        (1, -1): 198.0,
        # Stepback 2 (Floor 66 / 266m): NE (+1, +1) and SW (-1, -1) terminate
        (1, 1): 266.0,
        (-1, -1): 266.0,
        # Stepback 3 (Floor 90 / 362m): N (0, +1), E (+1, 0), S (0, -1) terminate
        (0, 1): 362.0,
        (1, 0): 362.0,
        (0, -1): 362.0,
        # Summit (Floor 108 / 442.1m): Central (0, 0) and West (-1, 0) twin contiguous tubes!
        (0, 0): 442.1,
        (-1, 0): 442.1,
    }
    for (gx, gy), th in tube_heights.items():
        cx = gx * tube_w
        cy = gy * tube_w
        b.add_box_z("Black_Anodized", cx, cy, 0.0, th, tube_w - 0.15, tube_w - 0.15)
        n_bands = max(6, int(th / 20.0))
        b.add_window_bands("Emissive_Windows", cx, cy, 12.0, th - 12.0, tube_w + 0.25, tube_w + 0.25, count=n_bands, band_h=1.4)
        # Mechanical louver belt bands at F29-32 (~122m), F64-66 (~260m), F88-90 (~356m)
        for zm in (122.0, 260.0, 356.0):
            if th > zm + 6.0:
                b.add_box_z("Dark_Steel", cx, cy, zm - 4.0, zm + 4.0, tube_w + 0.5, tube_w + 0.5)

    # 103rd-floor Skydeck "The Ledge" 4 cantilevered all-glass boxes on West face (412m)
    for ly in (-7.0, -2.4, 2.4, 7.0):
        b.add_box_z("Emissive_Windows", -tube_w * 1.5 - 1.2, ly, 410.5, 413.8, 2.6, 3.0)

    # Twin White Broadcast Antennas atop West (-22.9, 0) -> 527m and Central (0, 0) -> 520m
    for ax, top_z in ((-tube_w, 527.0), (0.0, 520.0)):
        b.add_cylinder("White_Concrete", (ax, 0.0, 442.1), 4.2, 3.2, 24.0, segs=12)
        b.add_ring_band("Emissive_Floodlight", ax, 0.0, 454.0, 4.0, band_h=12.0, segs=12)
        b.add_cylinder("White_Concrete", (ax, 0.0, 466.1), 2.0, 0.4, top_z - 466.1, segs=10)
        b.add_beacon((ax, 0.0, top_z + 0.6), 1.6)


def _add_hollywood_letter(b: LandmarkBuilder, ch, cx, cy, z0, h=13.7, w=9.2, depth=1.2):
    """Build crisp 3D block strokes + rear steel A-frame struts for each HOLLYWOOD capital letter."""
    t = 2.0  # stroke thickness
    # Each letter defined as list of (x0, z0_frac, x1, z1_frac) or box segments in [-0.5..0.5, 0..1]
    hw = w * 0.5
    if ch == "H":
        b.add_box_z("White_Marble", cx - hw + t * 0.5, cy, z0, z0 + h, t, depth)
        b.add_box_z("White_Marble", cx + hw - t * 0.5, cy, z0, z0 + h, t, depth)
        b.add_box_z("White_Marble", cx, cy, z0 + h * 0.44, z0 + h * 0.58, w, depth)
    elif ch == "O":
        b.add_box_z("White_Marble", cx - hw + t * 0.5, cy, z0, z0 + h, t, depth)
        b.add_box_z("White_Marble", cx + hw - t * 0.5, cy, z0, z0 + h, t, depth)
        b.add_box_z("White_Marble", cx, cy, z0, z0 + t, w, depth)
        b.add_box_z("White_Marble", cx, cy, z0 + h - t, z0 + h, w, depth)
    elif ch == "L":
        b.add_box_z("White_Marble", cx - hw + t * 0.5, cy, z0, z0 + h, t, depth)
        b.add_box_z("White_Marble", cx, cy, z0, z0 + t, w, depth)
    elif ch == "Y":
        b.add_box_z("White_Marble", cx, cy, z0, z0 + h * 0.52, t, depth)
        b.add_tube_between("White_Marble", (cx, cy, z0 + h * 0.48), (cx - hw + 0.8, cy, z0 + h), 1.05, 1.05, segs=4)
        b.add_tube_between("White_Marble", (cx, cy, z0 + h * 0.48), (cx + hw - 0.8, cy, z0 + h), 1.05, 1.05, segs=4)
    elif ch == "W":
        b.add_tube_between("White_Marble", (cx - hw, cy, z0 + h), (cx - hw * 0.45, cy, z0), 1.0, 1.0, segs=4)
        b.add_tube_between("White_Marble", (cx - hw * 0.45, cy, z0), (cx, cy, z0 + h * 0.65), 1.0, 1.0, segs=4)
        b.add_tube_between("White_Marble", (cx, cy, z0 + h * 0.65), (cx + hw * 0.45, cy, z0), 1.0, 1.0, segs=4)
        b.add_tube_between("White_Marble", (cx + hw * 0.45, cy, z0), (cx + hw, cy, z0 + h), 1.0, 1.0, segs=4)
    elif ch == "D":
        b.add_box_z("White_Marble", cx - hw + t * 0.5, cy, z0, z0 + h, t, depth)
        b.add_box_z("White_Marble", cx + hw - t * 0.5, cy, z0 + t, z0 + h - t, t, depth)
        b.add_box_z("White_Marble", cx - 0.6, cy, z0, z0 + t, w - 1.2, depth)
        b.add_box_z("White_Marble", cx - 0.6, cy, z0 + h - t, z0 + h, w - 1.2, depth)
    # Rear steel A-frame scaffolding struts
    b.add_tube_between("Dark_Steel", (cx, cy + 0.6, z0 + h * 0.82), (cx, cy + 5.8, z0), 0.32, 0.32, segs=5)
    b.add_tube_between("Dark_Steel", (cx, cy + 0.6, z0 + h * 0.35), (cx, cy + 5.8, z0), 0.28, 0.28, segs=5)


def build_la_hollywood_griffith(b: LandmarkBuilder):
    """Griffith Observatory (triple copper domes) + iconic HOLLYWOOD 106.7m hill sign."""
    # 1. Griffith Observatory centered at origin (25m H x 75m W x 45m D)
    b.add_box_z("White_Concrete", 0.0, 0.0, 0.0, 5.0, 82.0, 52.0)
    # Streamline Moderne gallery wings & central entrance rotunda
    b.add_box_z("White_Concrete", 0.0, 0.0, 5.0, 14.5, 68.0, 22.0)
    b.add_box_z("White_Concrete", 0.0, -14.0, 5.0, 14.5, 30.0, 24.0)
    b.add_window_bands("Emissive_Windows", 0.0, 0.0, 6.5, 13.0, 68.4, 22.4, count=1, band_h=2.4)
    # Large central 23m-diameter Samuel Oschatz Planetarium copper dome (South axis)
    b.add_cylinder("White_Concrete", (0.0, -14.0, 14.5), 12.2, 12.2, 3.2, segs=24)
    b.add_dome("Verdigris_Copper", (0.0, -14.0, 17.5), 11.8, 11.8, 8.2, u_segs=24, v_segs=8)
    # Flanking symmetric East (Zeiss) & West (Solar) 9m copper telescope domes
    for sx in (-28.0, 28.0):
        b.add_cylinder("White_Concrete", (sx, 0.0, 5.0), 5.8, 5.8, 12.5, segs=18)
        b.add_dome("Verdigris_Copper", (sx, 0.0, 17.5), 5.2, 5.2, 4.6, u_segs=18, v_segs=6)
    # North Plaza & 12m Astronomers Monument obelisk
    b.add_box_z("Stone_Limestone", 0.0, 26.0, 0.0, 1.5, 32.0, 28.0)
    b.add_cylinder("White_Concrete", (0.0, 30.0, 1.5), 2.2, 1.2, 11.5, segs=6, smooth=False)
    b.add_sphere("Gold_Leaf", (0.0, 30.0, 14.2), 1.4, 1.4, 1.4, u_segs=10, v_segs=6)

    # 2. Iconic HOLLYWOOD Sign (106.7m wide x 13.7m tall letters on stepped ridge North of observatory)
    sign_y = 68.0
    b.add_box_z("Turf_Green", 0.0, sign_y + 3.0, 0.0, 10.0, 118.0, 22.0)
    letters = "HOLLYWOOD"
    spacing = 11.8
    start_x = -0.5 * (len(letters) - 1) * spacing
    for idx, ch in enumerate(letters):
        lx = start_x + idx * spacing
        # Natural chaparral hill contour variation
        hill_z = 10.0 + 2.2 * math.sin(idx * 0.55)
        _add_hollywood_letter(b, ch, lx, sign_y, hill_z, h=13.7, w=9.2)
    b.add_cylinder("Dark_Steel", (0.0, sign_y + 12.0, 10.0), 0.6, 0.2, 22.0, segs=8)
    b.add_beacon((0.0, sign_y + 12.0, 32.5), 0.9)


def build_rio_christ(b: LandmarkBuilder):
    """Christ the Redeemer (46m total): Corcovado rock plinth, 8m octagonal pedestal, 30m cruciform statue."""
    # Corcovado Summit granite cliff outcrop & tiered viewing terrace (0m - 8m)
    b.add_cylinder("Granite_Grey", (0.0, 0.0, 0.0), 26.0, 20.0, 6.5, segs=12, smooth=False)
    b.add_cylinder("Stone_Limestone", (0.0, 0.0, 6.5), 18.0, 18.0, 1.8, segs=12, smooth=False)

    # 8m Chamfered Octagonal Art Deco Pedestal & Chapel (8m - 16m)
    b.add_cylinder("Granite_Grey", (0.0, 0.0, 8.3), 7.2, 6.4, 7.7, segs=8, rot_z=math.pi / 8.0, smooth=False)
    b.add_box_z("Emissive_Windows", 0.0, 6.5, 9.0, 13.5, 3.2, 1.0)

    # 30m Art Deco Soapstone Statue of Christ (16m - 46m)
    # Fluted Art Deco tunic & robe body (16m - 40.5m)
    body_rings = []
    for k in range(7):
        t = k / 6.0
        z = 16.0 + t * 24.5
        rx = 3.8 * (1.0 - 0.25 * t) + 0.6 * math.sin(t * math.pi)
        ry = 2.6 * (1.0 - 0.18 * t)
        ring = []
        for i in range(12):
            a = 2.0 * math.pi * i / 12.0
            flute = 1.0 + 0.08 * math.cos(6.0 * a)
            ring.append((rx * flute * math.cos(a), ry * flute * math.sin(a), z))
        body_rings.append(ring)
    b.add_prism("White_Marble", body_rings, smooth=True)

    # Iconic 28m Outstretched Horizontal Cruciform Arms (-14m to +14m at z = 38.5m)
    b.add_box_z("White_Marble", 0.0, 0.0, 36.8, 40.2, 28.0, 2.2)
    # Draped hanging cloak folds beneath the outstretched arms
    for sign in (-1.0, 1.0):
        b.add_poly_extrude(
            "White_Marble",
            [(sign * 2.5, -1.0), (sign * 12.0, -0.8), (sign * 12.0, 0.8), (sign * 2.5, 1.0)],
            33.5,
            37.2,
            scale_top=1.0,
        )
    # Sacred Heart emblem relief on center chest
    b.add_sphere("Emissive_Floodlight", (0.0, -2.5, 35.5), 1.0, 0.5, 1.2, u_segs=10, v_segs=6)

    # Neck & serene tilted Art Deco head (40.5m - 46m)
    b.add_cylinder("White_Marble", (0.0, 0.0, 40.0), 1.35, 1.2, 1.8, segs=10)
    b.add_sphere("White_Marble", (0.0, -0.5, 43.6), 1.85, 2.1, 2.5, u_segs=14, v_segs=10)
    b.add_beacon((0.0, 1.2, 46.2), 0.55)


def build_chichen_itza(b: LandmarkBuilder):
    """El Castillo / Temple of Kukulcan (30m H x 55.3m W x 55.3m D): 9 terraces, 4 staircases, temple."""
    # 9 stepped Talud-Tablero Mayan limestone terraces (0m - 24m)
    n_tiers = 9
    tier_h = 24.0 / n_tiers
    for k in range(n_tiers):
        z0 = k * tier_h
        z1 = z0 + tier_h
        w_bot = 55.3 - k * 4.15
        w_top = w_bot - 0.85
        # Chamfered-corner square platform (authentic rounded/beveled Maya corners)
        hb = w_bot * 0.5
        cb = hb * 0.86
        pts = [(-cb, -hb), (cb, -hb), (hb, -cb), (hb, cb), (cb, hb), (-cb, hb), (-hb, cb), (-hb, -cb)]
        b.add_poly_extrude("Stone_Limestone", pts, z0, z1, scale_top=w_top / w_bot)

    # Four axial 45-degree monumental balustrade staircases (North, South, East, West)
    for ang in (0.0, 0.5 * math.pi, math.pi, 1.5 * math.pi):
        ca, sa = math.cos(ang), math.sin(ang)
        # Stepped stair ramp body from outer base (29.5m) up to 9th terrace edge (10.5m, z = 24m)
        stair_w = 9.0
        for s in range(12):
            t0 = s / 12.0
            t1 = (s + 1) / 12.0
            r_mid = 29.0 * (1.0 - 0.5 * (t0 + t1)) + 10.0 * (0.5 * (t0 + t1))
            z_top = 24.0 * t1
            wx, wy = r_mid * ca, r_mid * sa
            b.add_box_z("Stone_Limestone", wx, wy, max(0.0, z_top - 3.2), z_top, 3.0, stair_w, rz=ang)
        # Flanking raised sloping stone balustrades (alfardas)
        for side in (-stair_w * 0.54, stair_w * 0.54):
            p0 = (29.8 * ca - side * sa, 29.8 * sa + side * ca, 0.8)
            p1 = (10.2 * ca - side * sa, 10.2 * sa + side * ca, 24.6)
            b.add_tube_between("Stone_Limestone", p0, p1, 0.95, 0.85, segs=6)

    # Two carved Kukulcan Feathered Serpent heads at base of North (+Y) staircase
    for sx in (-4.8, 4.8):
        b.add_box_z("Warm_Sandstone", sx, 31.0, 0.0, 3.0, 2.4, 3.8)
        b.add_box_z("Emissive_Floodlight", sx, 33.0, 0.6, 2.2, 1.6, 0.8)

    # 6m Summit Temple of Kukulcan (24m - 30m)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 24.0, 28.6, 13.5, 13.5)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 28.6, 30.0, 14.4, 14.4)
    # Warm torch-like interior glow in the 4 sanctuary doorways
    for ang in (0.0, 0.5 * math.pi, math.pi, 1.5 * math.pi):
        b.add_box_z("Emissive_Windows", 6.85 * math.cos(ang), 6.85 * math.sin(ang), 24.2, 27.6, 0.8, 4.2, rz=ang)


# ==============================================================================
# 9. REGION 7 — EUROPE & AFRICA (12 LANDMARKS)
# ==============================================================================

def build_paris_eiffel(b: LandmarkBuilder):
    """Eiffel Tower (330m): 4 curved puddle-iron legs, base arches, 3 observation decks, pinnacle."""
    # Exponentially curving leg profile from 125m square base (half-span 52m) to 276m summit (half-span 5m)
    def _eiffel_half(z):
        t = min(1.0, z / 276.0)
        return 51.0 * ((1.0 - t) ** 2.35) + 4.8

    # 4 corner Lutetian limestone masonry plinths (0m - 5m)
    for sx in (-51.0, 51.0):
        for sy in (-51.0, 51.0):
            b.add_box_z("Stone_Limestone", sx, sy, 0.0, 5.0, 18.0, 18.0)

    # 4 curved wrought-iron lattice legs & upper fused pyramidal shaft (3.5m - 276m, anchored in 5m plinths)
    steps = 18
    for s in range(steps):
        z0 = 3.5 + 272.5 * s / steps
        z1 = 3.5 + 272.5 * (s + 1) / steps
        o0, o1 = _eiffel_half(z0), _eiffel_half(z1)
        leg_r = max(1.1, 4.4 * ((1.0 - z0 / 276.0) ** 1.15))
        c0 = [(-o0, -o0, z0), (o0, -o0, z0), (o0, o0, z0), (-o0, o0, z0)]
        c1 = [(-o1, -o1, z1), (o1, -o1, z1), (o1, o1, z1), (-o1, o1, z1)]
        for i in range(4):
            ni = (i + 1) % 4
            b.add_tube_between("Eiffel_Bronze", c0[i], c1[i], leg_r, leg_r * 0.92, segs=8)
            # X-bracing between legs above 115m (fused shaft)
            if z0 >= 112.0:
                b.add_tube_between("Eiffel_Bronze", c0[i], c0[ni], leg_r * 0.45, leg_r * 0.45, segs=6)
                b.add_tube_between("Eiffel_Bronze", c0[i], c1[ni], leg_r * 0.38, leg_r * 0.38, segs=5)
                b.add_tube_between("Eiffel_Bronze", c0[ni], c1[i], leg_r * 0.38, leg_r * 0.38, segs=5)
                if s % 2 == 0:
                    b.add_tube_between("Emissive_Floodlight", c0[i], c0[ni], 0.35, 0.35, segs=4)

    # 4 decorative semicircular lattice arches spanning 74m below 1st platform (0m - 54m)
    for side in range(4):
        ang = side * 0.5 * math.pi
        ca, sa = math.cos(ang), math.sin(ang)
        pts = []
        for k in range(11):
            t = k / 10.0
            u = -36.0 + 72.0 * t
            z = 16.0 + 36.0 * math.sin(t * math.pi)
            d = _eiffel_half(z)
            lx, ly = u, -d
            pts.append((lx * ca - ly * sa, lx * sa + ly * ca, z))
        for k in range(10):
            b.add_tube_between("Eiffel_Bronze", pts[k], pts[k + 1], 1.8, 1.8, segs=6)

    # 1st Observation Platform (57m - 65m) with open central courtyard void (4 perimeter girders)
    o1st = _eiffel_half(57.0) + 5.0
    for sign in (-1.0, 1.0):
        b.add_box_z("Eiffel_Bronze", 0.0, sign * (o1st - 5.0), 56.0, 65.0, o1st * 2.0, 11.0)
        b.add_box_z("Eiffel_Bronze", sign * (o1st - 5.0), 0.0, 56.0, 65.0, 11.0, o1st * 2.0 - 20.0)
        b.add_box_z("Emissive_Windows", 0.0, sign * (o1st + 0.3), 58.0, 62.5, o1st * 1.9, 1.0)
        b.add_box_z("Emissive_Windows", sign * (o1st + 0.3), 0.0, 58.0, 62.5, 1.0, o1st * 1.9)

    # 2nd Observation Platform (114m - 124m)
    b.add_box_z("Eiffel_Bronze", 0.0, 0.0, 113.0, 123.0, 41.0, 41.0)
    b.add_box_z("Emissive_Windows", 0.0, 0.0, 115.5, 120.5, 41.6, 41.6)

    # 3rd Summit Observatory Deck & Campanile Cupola Lantern (274m - 306m)
    b.add_box_z("Eiffel_Bronze", 0.0, 0.0, 273.0, 283.0, 18.0, 18.0)
    b.add_box_z("Emissive_Windows", 0.0, 0.0, 275.0, 281.0, 18.5, 18.5)
    b.add_cylinder("Eiffel_Bronze", (0.0, 0.0, 283.0), 6.2, 4.2, 16.0, segs=12)
    b.add_dome("Emissive_Floodlight", (0.0, 0.0, 299.0), 4.4, 4.4, 5.5, u_segs=14, v_segs=6)

    # Broadcast Antenna Spire reaching 330m
    b.add_cylinder("Dark_Steel", (0.0, 0.0, 304.0), 1.8, 0.25, 26.0, segs=10)
    b.add_beacon((0.0, 0.0, 330.5), 1.5)


def build_paris_triomphe_louvre(b: LandmarkBuilder):
    """Arc de Triomphe (49.5m tetrapylon) & Louvre Glass Pyramid (21.6m) Paris landmark duo."""
    # 1. Arc de Triomphe centered at origin (49.5m H x 44.8m W x 22.2m D)
    # 4 corner piers forming intersecting Main (14.6m W x 29.2m H) & Transverse (8.4m W x 18.7m H) vaults
    for sx in (-15.0, 15.0):
        for sy in (-7.6, 7.6):
            b.add_box_z("Stone_Limestone", sx, sy, 0.0, 31.0, 14.8, 7.0)
    # Transverse vault bridges over E/W openings (18.7m - 31m)
    for sx in (-15.0, 15.0):
        b.add_box_z("Stone_Limestone", sx, 0.0, 18.7, 31.0, 14.8, 8.6)
    # Main barrel vault lintel, entablature, deep cornice & attic story (29.2m - 49.5m)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 29.2, 37.5, 44.8, 22.2)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 37.5, 40.5, 47.4, 24.8)  # Deep dentil cornice
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 40.5, 48.2, 43.8, 21.2)  # Attic story with shields
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 48.2, 49.5, 45.0, 22.4)  # Roof parapet
    # 4 colossal high-relief sculptural pier plaques + warm vault uplights
    for sx in (-15.0, 15.0):
        for sy in (-11.4, 11.4):
            b.add_box_z("White_Marble", sx, sy, 4.0, 17.0, 8.0, 1.4)
    b.add_box_z("Emissive_Floodlight", 0.0, 0.0, 28.4, 29.4, 13.8, 20.0)
    # Tomb of the Unknown Soldier & Eternal Flame beneath main vault
    b.add_cylinder("Granite_Grey", (0.0, 0.0, 0.0), 3.6, 3.6, 0.4, segs=16)
    b.add_sphere("Emissive_Windows", (0.0, 0.0, 1.4), 0.7, 0.7, 1.1, u_segs=8, v_segs=6)
    for sx in (-21.0, 21.0):
        b.add_beacon((sx, 0.0, 50.0), 0.65)

    # 2. I.M. Pei Louvre Glass Pyramid (offset 72m East, 21.6m H x 35.4m x 35.4m)
    lx = 72.0
    b.add_box_z("Stone_Limestone", lx, 0.0, 0.0, 0.6, 58.0, 58.0)
    # Triangular reflecting water basins flanking pyramid
    for ang in (0.0, 0.5 * math.pi, math.pi, 1.5 * math.pi):
        b.add_box_z("Water_Turquoise", lx + 23.0 * math.cos(ang), 23.0 * math.sin(ang), 0.5, 0.9, 12.0, 16.0, rz=ang)
    # Main 51-deg glass pyramid + glowing interior concourse + stainless space-frame mullions
    b.add_poly_extrude("Glass_Curtain", [(-17.7, -17.7), (17.7, -17.7), (17.7, 17.7), (-17.7, 17.7)], 0.6, 22.2, scale_top=0.01, offset_bottom=(lx, 0.0), offset_top=(lx, 0.0))
    b.add_poly_extrude("Emissive_Floodlight", [(-14.5, -14.5), (14.5, -14.5), (14.5, 14.5), (-14.5, 14.5)], 0.6, 18.2, scale_top=0.01, offset_bottom=(lx, 0.0), offset_top=(lx, 0.0))
    # Stainless edge & diamond grid mullions on the 4 pyramid faces
    apex = Vector((lx, 0.0, 22.3))
    base_c = [Vector((lx - 17.8, -17.8, 0.6)), Vector((lx + 17.8, -17.8, 0.6)), Vector((lx + 17.8, 17.8, 0.6)), Vector((lx - 17.8, 17.8, 0.6))]
    for i in range(4):
        ni = (i + 1) % 4
        b.add_tube_between("Silver_Steel", base_c[i], apex, 0.28, 0.18, segs=5)
        for k in range(1, 5):
            t = k / 5.0
            p0 = base_c[i].lerp(apex, t)
            p1 = base_c[ni].lerp(apex, t)
            b.add_tube_between("Silver_Steel", p0, p1, 0.18, 0.18, segs=4)
    # 3 miniature 5m satellite glass pyramids
    for ox, oy in ((-24.0, -24.0), (24.0, -24.0), (0.0, 26.0)):
        b.add_poly_extrude("Glass_Curtain", [(-4.0, -4.0), (4.0, -4.0), (4.0, 4.0), (-4.0, 4.0)], 0.6, 5.6, scale_top=0.02, offset_bottom=(lx + ox, oy), offset_top=(lx + ox, oy))


def build_london_shard(b: LandmarkBuilder):
    """The Shard London (309.6m): 8 angled overlapping glass shards + fractured open-air spire crown."""
    # Inner white-painted structural steel core & diagrid spire lattice visible inside top 66m crown
    b.add_cylinder("White_Concrete", (0.0, 0.0, 0.0), 16.0, 5.5, 272.0, segs=8, smooth=False)
    for k in range(8):
        a0 = 2.0 * math.pi * k / 8.0
        a1 = 2.0 * math.pi * (k + 1) / 8.0
        b.add_tube_between("Silver_Steel", (9.5 * math.cos(a0), 9.5 * math.sin(a0), 235.0), (4.8 * math.cos(a1), 4.8 * math.sin(a1), 296.0), 0.55, 0.45, segs=5)
        b.add_tube_between("Silver_Steel", (9.5 * math.cos(a1), 9.5 * math.sin(a1), 235.0), (4.8 * math.cos(a0), 4.8 * math.sin(a0), 296.0), 0.55, 0.45, segs=5)
    # Glowing icy-white internal crystalline crown beacon (238m - 294m)
    b.add_cylinder("Emissive_Floodlight", (0.0, 0.0, 238.0), 9.2, 4.2, 56.0, segs=8, smooth=False)

    # 8 distinct overlapping steeply tilted extra-white glass shard facades
    shard_heights = [309.6, 294.0, 304.0, 286.0, 301.0, 290.0, 306.5, 284.0]
    for i in range(8):
        ang = 2.0 * math.pi * i / 8.0
        ca, sa = math.cos(ang), math.sin(ang)
        tx, ty = -sa, ca  # tangent along shard width
        h_top = shard_heights[i]
        # Each shard leans inward from base radius ~28m to jagged top radius ~4.2m, extending slightly at edges
        r_bot = 28.0 + (i % 2) * 1.4
        r_top = 4.2 + (i % 3) * 0.6
        w_bot = 11.8
        w_top = 2.4
        th = 1.4
        # Build thick planar shard slab from 0m to h_top
        z_bot = 0.0 if (i % 2 == 0) else 6.0
        r0 = [
            (r_bot * ca - w_bot * tx, r_bot * sa - w_bot * ty, z_bot),
            (r_bot * ca + w_bot * tx, r_bot * sa + w_bot * ty, z_bot),
            ((r_bot - th) * ca + w_bot * tx, (r_bot - th) * sa + w_bot * ty, z_bot),
            ((r_bot - th) * ca - w_bot * tx, (r_bot - th) * sa - w_bot * ty, z_bot),
        ]
        # Jagged sloped top edge on each shard!
        dz_tip = 7.5 if (i % 2 == 0) else -6.5
        r1 = [
            (r_top * ca - w_top * tx, r_top * sa - w_top * ty, h_top),
            (r_top * ca + w_top * tx, r_top * sa + w_top * ty, h_top - abs(dz_tip)),
            ((r_top - th) * ca + w_top * tx, (r_top - th) * sa + w_top * ty, h_top - abs(dz_tip)),
            ((r_top - th) * ca - w_top * tx, (r_top - th) * sa - w_top * ty, h_top),
        ]
        b.add_prism("Glass_Curtain", [r0, r1], smooth=False)
        # Glowing champagne office/hotel/residence horizontal bands across lower 235m
        for k in range(1, 12):
            t = k / 12.0
            zz = 18.0 + t * 212.0
            rr = r_bot * (1.0 - t * 0.72) + 0.5
            ww = w_bot * 1.55 * (1.0 - t * 0.68)
            b.add_box("Emissive_Windows", (rr * ca, rr * sa, zz), (0.6, ww, 1.5), rz=ang)
        if h_top >= 304.0:
            b.add_beacon((r_top * ca, r_top * sa, h_top + 1.0), 1.3)


def build_london_towerbridge(b: LandmarkBuilder):
    """Tower Bridge London (65m H x 244m L x 19m W): twin Gothic towers, high walkways, suspension chains."""
    # Aligned along Y axis (-122m to +122m), central bascule span 61m -> twin towers at y = -37m and +37m
    tower_y = 37.0
    deck_z = 11.0

    # 1. Roadway & Central Double-Leaf Bascule Deck (11m height, 244m total length)
    b.add_box_z("TowerBridge_Blue", 0.0, 0.0, deck_z - 2.2, deck_z, 17.0, 244.0)
    b.add_box_z("Asphalt_Road", 0.0, 0.0, deck_z, deck_z + 0.5, 13.5, 244.0)
    for sx in (-7.8, 7.8):
        b.add_box_z("Emissive_Windows", sx, 0.0, deck_z + 1.2, deck_z + 2.0, 0.7, 236.0)

    # 2. Twin Masonry River Piers & 65m Victorian Gothic Granite Towers
    for ty in (-tower_y, tower_y):
        # Boat-shaped cutwater granite river pier (0m - 11.5m)
        b.add_ellipse_frustum("Granite_Grey", (0.0, ty, 0.0), 21.0, 11.5, 20.0, 10.5, 11.5, segs=12, smooth=False)
        # Main Cornish granite Neo-Gothic tower body (11m - 49m) with roadway arch portal
        b.add_rect_arch_portal("Stone_Limestone", 0.0, ty, 11.0, 38.0, 17.5, 14.5, 11.0, 9.5)
        b.add_window_bands("Emissive_Windows", 0.0, ty, 22.0, 46.0, 17.9, 14.9, count=3, band_h=2.0)
        # 4 octagonal corner Gothic turrets crowned by sharp slate spirelets
        for sx in (-8.4, 8.4):
            for sy in (-6.8, 6.8):
                b.add_cylinder("Stone_Limestone", (sx, ty + sy, 11.0), 2.3, 2.1, 41.0, segs=8, smooth=False)
                b.add_cylinder("Slate_Blue_Roof", (sx, ty + sy, 52.0), 2.4, 0.25, 8.5, segs=8, smooth=False)
                b.add_cylinder("Gold_Leaf", (sx, ty + sy, 60.5), 0.25, 0.08, 1.8, segs=6)
        # Steep pitched central Victorian chateau slate roof + 65m gilded finial spire
        b.add_poly_extrude("Slate_Blue_Roof", [(-8.2, -6.5), (8.2, -6.5), (8.2, 6.5), (-8.2, 6.5)], 49.0, 61.5, scale_top=0.14, offset_bottom=(0.0, ty), offset_top=(0.0, ty))
        b.add_cylinder("Gold_Leaf", (0.0, ty, 61.5), 0.55, 0.12, 3.5, segs=8)
        b.add_beacon((0.0, ty, 65.4), 0.9)

    # 3. Twin High-Level Pedestrian Walkways spanning 61m between towers at 43.5m height
    for sx in (-6.6, 6.6):
        b.add_box_z("TowerBridge_Blue", sx, 0.0, 41.5, 45.8, 3.2, 62.0)
        b.add_box_z("Emissive_Windows", sx, 0.0, 42.6, 44.8, 3.5, 58.0)

    # 4. Shoreward Suspension Chains, Tie-Rods & 18m Granite Abutment Towers
    for side in (-1.0, 1.0):
        abut_y = side * 118.0
        b.add_rect_arch_portal("Stone_Limestone", 0.0, abut_y, 0.0, 22.0, 19.0, 10.0, 11.5, 14.0)
        b.add_cylinder("Slate_Blue_Roof", (-7.5, abut_y, 22.0), 2.4, 0.3, 6.0, segs=8, smooth=False)
        b.add_cylinder("Slate_Blue_Roof", (7.5, abut_y, 22.0), 2.4, 0.3, 6.0, segs=8, smooth=False)
        p_hi_y = side * (tower_y + 6.5)
        p_lo_y = side * 116.0
        for sx in (-7.6, 7.6):
            # Curved rigid blue-and-white suspension chain
            b.add_parabolic_cable("TowerBridge_Blue", (sx, p_hi_y, 44.5), (sx, p_lo_y, 17.0), sag=12.5, radius=0.9, segs=12, tube_segs=6)
            # Vertical steel tie-rods holding up side deck spans
            for k in range(1, 8):
                t = k / 8.0
                yy = p_hi_y * (1.0 - t) + p_lo_y * t
                zz = 44.5 * (1.0 - t) + 17.0 * t - 4.0 * 12.5 * t * (1.0 - t)
                if zz > deck_z + 1.5:
                    b.add_tube_between("White_Concrete", (sx, yy, deck_z), (sx, yy, zz), 0.25, 0.25, segs=4)


def build_london_bigben_eye(b: LandmarkBuilder):
    """Elizabeth Tower / Big Ben (96m) & London Eye (135m cantilevered observation wheel) duo."""
    # 1. Elizabeth Tower / Big Ben centered at origin (96m x 15m x 15m) + Palace of Westminster wing
    b.add_box_z("Stone_Limestone", -22.0, 0.0, 0.0, 26.0, 34.0, 20.0)
    b.add_window_bands("Emissive_Windows", -22.0, 0.0, 5.0, 23.0, 34.4, 20.4, count=3, band_h=1.8)
    # Anston limestone Gothic shaft (0m - 50m)
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 0.0, 50.0, 12.4, 12.4)
    # Projecting four-sided Clock Stage (50m - 62.5m) with four 7m glowing circular clock dials!
    b.add_box_z("Stone_Limestone", 0.0, 0.0, 50.0, 62.5, 15.2, 15.2)
    b.add_box_z("Gold_Leaf", 0.0, 0.0, 49.5, 51.0, 15.8, 15.8)
    b.add_box_z("Gold_Leaf", 0.0, 0.0, 61.5, 63.0, 15.8, 15.8)
    for ang in (0.0, 0.5 * math.pi, math.pi, 1.5 * math.pi):
        ca, sa = math.cos(ang), math.sin(ang)
        # Circular glowing opal-glass clock face + gilded ring bezel
        b.add_sphere("Emissive_Windows", (7.65 * ca, 7.65 * sa, 56.2), 3.4 * abs(sa) + 0.4, 3.4 * abs(ca) + 0.4, 3.4, u_segs=16, v_segs=10)
    # Open Gothic Belfry (62.5m - 72m) & steep two-stage cast-iron spire + Ayrton Light (72m - 96m)
    b.add_box_z("Dark_Steel", 0.0, 0.0, 62.5, 72.0, 11.4, 11.4)
    for sx in (-5.4, 5.4):
        for sy in (-5.4, 5.4):
            b.add_box_z("Stone_Limestone", sx, sy, 62.5, 73.0, 1.8, 1.8)
    b.add_poly_extrude("Slate_Blue_Roof", [(-6.8, -6.8), (6.8, -6.8), (6.8, 6.8), (-6.8, 6.8)], 72.0, 82.0, scale_top=0.45)
    b.add_cylinder("Emissive_Windows", (0.0, 0.0, 82.0), 2.4, 2.2, 4.0, segs=8)  # Ayrton Light lantern
    b.add_poly_extrude("Slate_Blue_Roof", [(-2.8, -2.8), (2.8, -2.8), (2.8, 2.8), (-2.8, 2.8)], 86.0, 93.5, scale_top=0.1)
    b.add_cylinder("Gold_Leaf", (0.0, 0.0, 93.5), 0.35, 0.08, 2.5, segs=8)
    b.add_beacon((0.0, 0.0, 96.4), 0.85)

    # 2. London Eye Cantilevered Observation Wheel (offset 115m East, 135m H, 120m wheel diameter)
    ex = 115.0
    hub_z = 75.0
    wheel_r = 60.0
    # Single-sided 65-degree tilted A-frame white steel legs + rear tension anchor cables
    b.add_box_z("Granite_Grey", ex, -28.0, 0.0, 4.5, 42.0, 16.0)
    b.add_tube_between("White_Concrete", (ex - 16.0, -28.0, 3.0), (ex, -1.5, hub_z), 2.1, 1.6, segs=10)
    b.add_tube_between("White_Concrete", (ex + 16.0, -28.0, 3.0), (ex, -1.5, hub_z), 2.1, 1.6, segs=10)
    b.add_tube_between("White_Concrete", (ex - 10.0, -48.0, 2.0), (ex, -1.5, hub_z), 0.65, 0.65, segs=6)
    b.add_tube_between("White_Concrete", (ex + 10.0, -48.0, 2.0), (ex, -1.5, hub_z), 0.65, 0.65, segs=6)
    # Central spindle hub
    b.add_tube_between("Silver_Steel", (ex, -7.0, hub_z), (ex, 7.0, hub_z), 3.2, 3.2, segs=14)
    # Double-tubular 120m truss wheel rim (two parallel rings at y = -2.2 and y = +2.2)
    for ry in (-2.2, 2.2):
        b.add_torus("White_Concrete", (ex, ry, hub_z), wheel_r, wheel_r, 1.3, 1.3, major_segs=36, minor_segs=8, plane="XZ")
    b.add_torus("Emissive_Floodlight", (ex, 0.0, hub_z), wheel_r - 1.6, wheel_r - 1.6, 0.55, 0.55, major_segs=36, minor_segs=6, plane="XZ")
    # Bicycle-like tension spokes (16 radial pairs)
    for i in range(16):
        a = 2.0 * math.pi * i / 16.0
        px = ex + wheel_r * math.cos(a)
        pz = hub_z + wheel_r * math.sin(a)
        b.add_tube_between("Silver_Steel", (ex, -4.5, hub_z), (px, -2.0, pz), 0.25, 0.25, segs=4)
        b.add_tube_between("Silver_Steel", (ex, 4.5, hub_z), (px, 2.0, pz), 0.25, 0.25, segs=4)
    # All 32 ovoid glass passenger capsules mounted around exterior circumference!
    for i in range(32):
        a = 2.0 * math.pi * i / 32.0
        cx = ex + (wheel_r + 3.2) * math.cos(a)
        cz = hub_z + (wheel_r + 3.2) * math.sin(a)
        b.add_sphere("Glass_Curtain", (cx, 0.0, cz), 2.1, 3.2, 2.1, u_segs=10, v_segs=6)
        b.add_sphere("Emissive_Windows", (cx, 0.0, cz), 1.3, 2.2, 1.3, u_segs=8, v_segs=5)
    b.add_beacon((ex, 0.0, hub_z + wheel_r + 5.8), 1.3)


def build_rome_colosseum(b: LandmarkBuilder):
    """Roman Colosseum (48.5m H x 189m x 156m): asymmetrical broken outer ring, 3 arcade tiers, hypogeum."""
    rx_out, ry_out = 94.5, 78.0
    rx_mid, ry_mid = 82.0, 66.0
    rx_arena, ry_arena = 42.0, 26.0
    n_bays = 40

    # 1. Inner concentric arcade ring (continuous full 360 deg ellipse, 31m tall) + sloping Cavea bowl
    for i in range(n_bays):
        a0 = 2.0 * math.pi * i / n_bays
        a1 = 2.0 * math.pi * (i + 1) / n_bays
        am = 0.5 * (a0 + a1)
        # Inner ring wall piers & 2-story arches
        px, py = rx_mid * math.cos(a0), ry_mid * math.sin(a0)
        b.add_box_z("Stone_Limestone", px, py, 0.0, 31.0, 4.2, 4.2, rz=a0)
        mx, my = rx_mid * math.cos(am), ry_mid * math.sin(am)
        seg_w = math.hypot(rx_mid * (math.cos(a1) - math.cos(a0)), ry_mid * (math.sin(a1) - math.sin(a0)))
        for z_lintel in (12.5, 25.0):
            b.add_box_z("Stone_Limestone", mx, my, z_lintel, z_lintel + 3.6, 3.8, seg_w + 0.6, rz=am)
        # Glowing golden portal light inside every arch opening!
        b.add_box_z("Emissive_Floodlight", mx * 0.98, my * 0.98, 2.5, 11.5, 1.2, seg_w * 0.55, rz=am)
        b.add_box_z("Emissive_Floodlight", mx * 0.98, my * 0.98, 16.5, 24.5, 1.2, seg_w * 0.55, rz=am)

    # 2. Preserved Northern Half Outer Wall (full 4 stories = 48.5m, from angle -15 deg to +195 deg)
    for i in range(n_bays):
        a0 = 2.0 * math.pi * i / n_bays
        a1 = 2.0 * math.pi * (i + 1) / n_bays
        am = 0.5 * (a0 + a1)
        deg = math.degrees(am)
        # Authentic broken silhouette: full 48.5m on North (0..185 deg), stepped Stern/Valadier buttresses at ends
        if 0.0 <= deg <= 185.0:
            h_wall = 48.5
        elif 185.0 < deg <= 205.0 or 340.0 <= deg <= 360.0:
            h_wall = 36.0  # Triangular stepped brick conservation buttress wings
        else:
            continue
        px, py = rx_out * math.cos(a0), ry_out * math.sin(a0)
        b.add_box_z("Stone_Limestone", px, py, 0.0, h_wall, 4.6, 4.4, rz=a0)
        mx, my = rx_out * math.cos(am), ry_out * math.sin(am)
        seg_w = math.hypot(rx_out * (math.cos(a1) - math.cos(a0)), ry_out * (math.sin(a1) - math.sin(a0)))
        for z_lintel in (11.5, 23.0, 34.5):
            if z_lintel < h_wall - 3.0:
                b.add_box_z("Stone_Limestone", mx, my, z_lintel, z_lintel + 3.2, 4.2, seg_w + 0.6, rz=am)
                b.add_box_z("Emissive_Floodlight", mx * 0.97, my * 0.97, z_lintel - 8.0, z_lintel - 0.5, 1.0, seg_w * 0.5, rz=am)
        # 4th-story solid attic parapet on full 48.5m wall
        if h_wall > 45.0:
            b.add_box_z("Stone_Limestone", mx, my, 37.5, 48.5, 4.0, seg_w + 0.8, rz=am)

    # 3. Sloping Cavea Seating Bowl connecting inner ring down to elliptical arena
    bowl_rings = []
    for k in range(5):
        t = k / 4.0
        rx = rx_arena + (rx_mid - 2.0 - rx_arena) * t
        ry = ry_arena + (ry_mid - 2.0 - ry_arena) * t
        z = 4.5 + 24.5 * t
        bowl_rings.append([(rx * math.cos(2.0 * math.pi * i / 36), ry * math.sin(2.0 * math.pi * i / 36), z) for i in range(36)])
    b.add_prism("Red_Brick", bowl_rings, cap_bottom=False, cap_top=False, smooth=False)

    # 4. Sunken Arena Floor & Hypogeum Brick Labyrinth + East Reconstructed Timber Deck
    b.add_ellipse_frustum("Warm_Sandstone", (0.0, 0.0, 0.0), rx_arena + 2.0, ry_arena + 2.0, rx_arena + 2.0, ry_arena + 2.0, 1.2, segs=32)
    # Reconstructed wooden arena crescent deck on East (+X) third
    b.add_box_z("Stone_Limestone", 24.0, 0.0, 1.2, 4.6, 26.0, 36.0)
    # Concentric subterranean Hypogeum labyrinth brick walls on West/Center
    for scale in (0.35, 0.62, 0.86):
        for i in range(12):
            a0 = math.pi * 0.35 + math.pi * 1.3 * i / 12.0
            a1 = math.pi * 0.35 + math.pi * 1.3 * (i + 1) / 12.0
            p0 = (rx_arena * scale * math.cos(a0), ry_arena * scale * math.sin(a0), 2.8)
            p1 = (rx_arena * scale * math.cos(a1), ry_arena * scale * math.sin(a1), 2.8)
            b.add_tube_between("Red_Brick", p0, p1, 0.85, 0.85, segs=4)


def build_pisa_tower(b: LandmarkBuilder):
    """Leaning Tower of Pisa (56.7m): 3.97-degree South tilt, 6 open marble colonnade galleries, belfry."""
    # Sunken circular marble basin apron at ground
    b.add_cylinder("Stone_Limestone", (0.0, 0.0, 0.0), 12.5, 12.2, 1.0, segs=28)

    tilt = math.radians(3.97)
    st, ct = math.sin(tilt), math.cos(tilt)

    def _tilted(lx, ly, lz):
        # Lean Southward (-Y axis in Blender space) by 3.97 degrees
        return (lx, ly - lz * st, lz * ct)

    # Inner shadowed masonry core cylinder (0m - 48.5m)
    core_bot = [_tilted(5.8 * math.cos(2.0 * math.pi * i / 24), 5.8 * math.sin(2.0 * math.pi * i / 24), 0.0) for i in range(24)]
    core_top = [_tilted(5.5 * math.cos(2.0 * math.pi * i / 24), 5.5 * math.sin(2.0 * math.pi * i / 24), 48.5) for i in range(24)]
    b.add_prism("Stone_Limestone", [core_bot, core_top], smooth=True)

    # Ground story solid blind-arcade drum (0m - 11.2m, radius 7.75m)
    g0 = [_tilted(7.75 * math.cos(2.0 * math.pi * i / 24), 7.75 * math.sin(2.0 * math.pi * i / 24), 0.0) for i in range(24)]
    g1 = [_tilted(7.75 * math.cos(2.0 * math.pi * i / 24), 7.75 * math.sin(2.0 * math.pi * i / 24), 11.2) for i in range(24)]
    b.add_prism("White_Marble", [g0, g1], smooth=True)

    # 6 Stacked Open-Colonnade Loggia Galleries (Stories 2-7, 11.2m - 48.4m)
    n_tiers = 6
    tier_h = (48.4 - 11.2) / n_tiers
    n_cols = 24
    for tier in range(n_tiers):
        z0 = 11.2 + tier * tier_h
        z1 = z0 + tier_h
        # Continuous projecting marble cornice slab at top of each gallery
        c0 = [_tilted(7.9 * math.cos(2.0 * math.pi * i / 24), 7.9 * math.sin(2.0 * math.pi * i / 24), z1 - 1.1) for i in range(24)]
        c1 = [_tilted(8.05 * math.cos(2.0 * math.pi * i / 24), 8.05 * math.sin(2.0 * math.pi * i / 24), z1) for i in range(24)]
        b.add_prism("White_Marble", [c0, c1], smooth=True)
        # Warm hidden ring glow inside each open loggia colonnade
        gl0 = [_tilted(6.1 * math.cos(2.0 * math.pi * i / 18), 6.1 * math.sin(2.0 * math.pi * i / 18), z0 + 1.4) for i in range(18)]
        gl1 = [_tilted(6.1 * math.cos(2.0 * math.pi * i / 18), 6.1 * math.sin(2.0 * math.pi * i / 18), z1 - 1.8) for i in range(18)]
        b.add_prism("Emissive_Floodlight", [gl0, gl1], cap_bottom=False, cap_top=False, smooth=True)
        # 24 slender perimeter marble columns per gallery
        for i in range(n_cols):
            a = 2.0 * math.pi * i / n_cols
            p_b = _tilted(7.45 * math.cos(a), 7.45 * math.sin(a), z0)
            p_t = _tilted(7.45 * math.cos(a), 7.45 * math.sin(a), z1 - 1.0)
            b.add_tube_between("White_Marble", p_b, p_t, 0.28, 0.26, segs=6)

    # 8th-Story Belfry Chamber (48.4m - 56.7m, smaller diameter, slightly straightened banana-curve)
    bx, by, bz = _tilted(0.0, 0.0, 48.4)
    b.add_cylinder("White_Marble", (bx, by, bz), 5.6, 5.6, 7.6, segs=20)
    b.add_ring_band("Emissive_Windows", bx, by, bz + 3.8, 5.75, band_h=2.8, segs=20)
    b.add_cylinder("White_Marble", (bx, by, bz + 7.4), 6.0, 6.0, 1.0, segs=20)
    b.add_beacon((bx, by, bz + 8.9), 0.55)


def _add_sagrada_spindle_tower(b: LandmarkBuilder, cx, cy, z0, z_top, r_base, finial_mat="Gold_Leaf", segs=12):
    """Build one organic Gaudí parabolic spindle ('corn-cob') tower with finial."""
    levels = 8
    rings = []
    for k in range(levels + 1):
        t = k / levels
        z = z0 + t * (z_top - z0)
        # Parabolic taper with slight organic mid-swell
        r = r_base * ((1.0 - 0.72 * (t ** 1.15)) + 0.06 * math.sin(t * math.pi))
        rings.append([(cx + r * math.cos(2.0 * math.pi * i / segs), cy + r * math.sin(2.0 * math.pi * i / segs), z) for i in range(segs)])
    b.add_prism("Warm_Sandstone", rings, smooth=True)
    # Glowing vertical louver light bands
    b.add_ring_band("Emissive_Windows", cx, cy, z0 + (z_top - z0) * 0.55, r_base * 0.68, band_h=2.2, segs=segs)
    # Polychrome trencadis mosaic pinnacle finial
    b.add_cylinder(finial_mat, (cx, cy, z_top - 0.5), r_base * 0.36, r_base * 0.12, 8.5, segs=8)
    b.add_sphere(finial_mat, (cx, cy, z_top + 8.2), r_base * 0.28, r_base * 0.28, r_base * 0.34, u_segs=8, v_segs=6)


def build_barcelona_sagrada(b: LandmarkBuilder):
    """Sagrada Familia (172.5m): cruciform basilica + all 18 organic parabolic spindle towers & summit cross."""
    # Cruciform Basilica Nave (90m along Y) & Transept (60m along X) + Apse (0m - 45m)
    b.add_box_z("Warm_Sandstone", 0.0, 0.0, 0.0, 42.0, 32.0, 86.0)
    b.add_box_z("Warm_Sandstone", 0.0, 0.0, 0.0, 42.0, 60.0, 28.0)
    b.add_cylinder("Warm_Sandstone", (0.0, 40.0, 0.0), 17.0, 16.0, 38.0, segs=14)
    # Stained-glass nave rose windows glowing along flanks
    b.add_window_bands("Emissive_Windows", 0.0, 0.0, 12.0, 34.0, 32.6, 86.6, count=2, band_h=3.2)

    # 12 Apostle Bell Towers (98m - 115m): 3 facades x 4 spindle towers each
    # East Nativity Facade (+X), West Passion Facade (-X), South Glory Facade (-Y)
    # East Nativity (4 towers)
    for idx, ty in enumerate((-11.0, -3.8, 3.8, 11.0)):
        h = 107.0 if idx in (1, 2) else 98.0
        _add_sagrada_spindle_tower(b, 27.0, ty, 32.0, h, 3.6, finial_mat="Gold_Leaf")
    # West Passion (4 towers)
    for idx, ty in enumerate((-11.0, -3.8, 3.8, 11.0)):
        h = 112.0 if idx in (1, 2) else 102.0
        _add_sagrada_spindle_tower(b, -27.0, ty, 32.0, h, 3.6, finial_mat="Vermilion_Red")
    # South Glory (4 towers)
    for idx, tx in enumerate((-11.5, -3.9, 3.9, 11.5)):
        h = 115.0 if idx in (1, 2) else 104.0
        _add_sagrada_spindle_tower(b, tx, -41.0, 32.0, h, 3.7, finial_mat="Gold_Leaf")

    # 4 Evangelist Towers surrounding central crossing (135m each)
    for sx in (-12.5, 12.5):
        for sy in (-12.5, 12.5):
            _add_sagrada_spindle_tower(b, sx, sy, 36.0, 130.0, 4.8, finial_mat="Gold_Leaf")

    # 138m Apse Tower of the Virgin Mary (North, +Y) crowned by glowing 12-pointed morning star!
    _add_sagrada_spindle_tower(b, 0.0, 29.0, 36.0, 130.0, 6.2, finial_mat="White_Marble")
    b.add_sphere("Emissive_Windows", (0.0, 29.0, 139.0), 3.8, 3.8, 3.8, u_segs=12, v_segs=8)

    # 172.5m Central 12-sided Hyperboloid Tower of Jesus Christ + 17m Four-Armed White & Gold Cross!
    _add_sagrada_spindle_tower(b, 0.0, 0.0, 38.0, 155.5, 10.5, finial_mat="White_Marble", segs=12)
    # 17m four-armed enameled white-and-gold ceramic summit cross (155.5m - 172.5m)
    b.add_box_z("Emissive_Windows", 0.0, 0.0, 155.5, 172.5, 3.4, 3.4)
    b.add_box_z("Emissive_Windows", 0.0, 0.0, 163.0, 166.5, 13.5, 3.4)
    b.add_box_z("Emissive_Windows", 0.0, 0.0, 163.0, 166.5, 3.4, 13.5)
    b.add_beacon((0.0, 0.0, 173.2), 1.3)


def build_berlin_tv_gate(b: LandmarkBuilder):
    """Berliner Fernsehturm (368m) & Brandenburg Gate (26m x 65.5m) Berlin landmark duo."""
    # 1. Berliner Fernsehturm centered at origin (368m)
    # Folded white zig-zag tent-roof base pavilion (0m - 16m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 0.0), 32.0, 24.0, 9.0, segs=12, smooth=False)
    b.add_cylinder("Dark_Glass", (0.0, 0.0, 0.0), 28.0, 28.0, 7.0, segs=12, smooth=False)
    # Tapered circular reinforced concrete needle shaft (0m - 250m)
    b.add_cylinder("White_Concrete", (0.0, 0.0, 0.0), 8.2, 4.5, 250.0, segs=20)

    # Iconic 32m Disco-Ball Faceted Stainless-Steel Sphere (200m - 232m, center at 216m)
    b.add_sphere("Silver_Steel", (0.0, 0.0, 216.0), 16.0, 16.0, 16.0, u_segs=24, v_segs=14, smooth=False)
    # Twin 360-degree observation & Telecafe revolving restaurant glowing window bands
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 207.5, 14.3, band_h=2.4, segs=24)
    b.add_ring_band("Emissive_Windows", 0.0, 0.0, 212.5, 15.8, band_h=2.4, segs=24)

    # 118m Red-and-White Striped Broadcast Antenna Mast (250m - 368m)
    mast_bands = [
        (250.0, 274.0, 3.2, 2.5, "Bridge_International_Orange"),
        (274.0, 298.0, 2.5, 1.9, "White_Concrete"),
        (298.0, 322.0, 1.9, 1.3, "Bridge_International_Orange"),
        (322.0, 346.0, 1.3, 0.8, "White_Concrete"),
        (346.0, 368.0, 0.8, 0.25, "Bridge_International_Orange"),
    ]
    for z0, z1, r0, r1, mat in mast_bands:
        b.add_cylinder(mat, (0.0, 0.0, z0), r0, r1, z1 - z0, segs=12)
    for zb in (250.0, 310.0, 368.5):
        b.add_beacon((0.0, 0.0, zb), 1.4 if zb > 350 else 1.0)

    # 2. Brandenburg Gate (offset 85m West, 26m H x 65.5m W x 11m D)
    gx = -85.0
    # 12 fluted Doric sandstone columns (6 front, 6 back) forming 5 passages
    col_xs = (-19.0, -11.8, -4.4, 4.4, 11.8, 19.0)
    for cx in col_xs:
        for cy in (-4.2, 4.2):
            b.add_cylinder("Stone_Limestone", (gx + cx, cy, 0.0), 0.95, 0.82, 15.0, segs=10)
        b.add_box_z("Stone_Limestone", gx + cx, 0.0, 0.0, 15.0, 1.2, 7.6)
    # Twin Doric guardhouse wing pavilions on East & West ends
    for sx in (-27.5, 27.5):
        b.add_box_z("Stone_Limestone", gx + sx, 0.0, 0.0, 14.5, 10.5, 11.0)
    # Entablature & stepped central attic pedestal (15m - 21.5m)
    b.add_box_z("Stone_Limestone", gx, 0.0, 15.0, 18.8, 46.0, 11.4)
    b.add_box_z("Stone_Limestone", gx, 0.0, 18.8, 21.8, 20.0, 9.6)
    b.add_box_z("Emissive_Floodlight", gx, -5.8, 15.5, 18.2, 42.0, 0.5)
    # Verdigris green bronze Quadriga (chariot + 4 horses + Victoria) on attic (21.8m - 26.5m)
    for hx in (-3.6, -1.2, 1.2, 3.6):
        b.add_box_z("Verdigris_Copper", gx + hx, -1.5, 21.8, 25.0, 1.1, 3.8)
    b.add_box_z("Verdigris_Copper", gx, 2.0, 21.8, 26.4, 4.5, 3.0)


def build_bavaria_neuschwanstein(b: LandmarkBuilder):
    """Neuschwanstein Castle (90m H incl. 25m cliff x 150m L x 60m W): fairytale Bavarian turrets & Palas."""
    # 1. 25m Rocky Alpine Dolomite Crag Plinth & Battered Retaining Walls (0m - 25m)
    b.add_poly_extrude("Granite_Grey", [(-78.0, -32.0), (78.0, -28.0), (74.0, 28.0), (-74.0, 32.0)], 0.0, 25.0, scale_top=0.84)
    b.add_box_z("Turf_Green", 0.0, 0.0, 24.5, 25.5, 126.0, 44.0)

    # 2. East Red-Brick Gatehouse (Torbau, x = +52m) with twin conical slate stair turrets
    b.add_box_z("Red_Brick", 52.0, 0.0, 25.0, 38.0, 16.0, 24.0)
    b.add_pagoda_roof("Slate_Blue_Roof", 52.0, 0.0, 37.5, 17.0, 25.0, 7.5, eave_flare=1.06, ridge_ratio=0.8)
    for sy in (-12.5, 12.5):
        b.add_cylinder("Red_Brick", (56.0, sy, 25.0), 3.4, 3.2, 18.0, segs=12)
        b.add_cylinder("Slate_Blue_Roof", (56.0, sy, 43.0), 3.8, 0.25, 10.5, segs=12)

    # 3. 45m Square Watchtower (Viereckturm) & Knights' House (Ritterhaus) arcade (x = +12m)
    b.add_box_z("White_Marble", 24.0, 11.0, 25.0, 62.0, 11.0, 11.0)
    b.add_pagoda_roof("Slate_Blue_Roof", 24.0, 11.0, 61.5, 12.0, 12.0, 8.5, eave_flare=1.08, ridge_ratio=0.5)
    b.add_box_z("White_Marble", 12.0, -10.0, 25.0, 43.0, 44.0, 13.0)
    b.add_pagoda_roof("Slate_Blue_Roof", 12.0, -10.0, 42.5, 45.0, 14.0, 7.0, eave_flare=1.05, ridge_ratio=0.85)
    b.add_window_bands("Emissive_Windows", 12.0, -10.0, 28.0, 40.0, 44.4, 13.4, count=2, band_h=1.6)

    # 4. Five-Story Palas Royal Residence Hall (West End, x = -30m, 25m - 68m)
    b.add_box_z("White_Marble", -30.0, 0.0, 25.0, 56.0, 48.0, 28.0)
    b.add_window_bands("Emissive_Windows", -30.0, 0.0, 29.0, 52.0, 48.5, 28.5, count=4, band_h=1.8)
    # Steep double-gabled Bavarian slate-blue Palas roof
    b.add_pagoda_roof("Slate_Blue_Roof", -30.0, 0.0, 55.5, 49.0, 29.0, 15.0, eave_flare=1.06, ridge_ratio=0.82)

    # 5. Tallest 65m Circular North Stair Tower (z = 25 -> 90m) & Octagonal South Main Tower + Turrets
    towers = [
        (-48.0, 14.0, 4.6, 44.0, 21.0, 14),   # Tallest North circular stair tower -> 90m apex!
        (-16.0, -15.0, 5.2, 38.0, 19.0, 8),   # Octagonal South main tower -> 82m
        (-54.0, -11.0, 3.4, 34.0, 14.0, 12),  # West alpine corner turret
        (-4.0, 15.0, 3.6, 36.0, 15.0, 12),    # Courtyard stair turret
    ]
    for tx, ty, rad, shaft_h, roof_h, segs in towers:
        b.add_cylinder("White_Marble", (tx, ty, 25.0), rad, rad * 0.94, shaft_h, segs=segs)
        b.add_cylinder("Slate_Blue_Roof", (tx, ty, 25.0 + shaft_h), rad * 1.16, 0.25, roof_h, segs=segs)
        b.add_ring_band("Emissive_Windows", tx, ty, 25.0 + shaft_h - 3.5, rad * 1.02, band_h=1.6, segs=segs)
    b.add_beacon((-48.0, 14.0, 90.4), 0.75)


def build_athens_parthenon(b: LandmarkBuilder):
    """Acropolis Parthenon (20m H incl. 6.3m rock x 69.5m L x 30.9m W): 46 outer + 12 inner Doric columns."""
    # 1. 6.3m Acropolis limestone rock outcrop plinth
    b.add_poly_extrude("Granite_Grey", [(-42.0, -23.0), (42.0, -23.0), (40.0, 23.0), (-40.0, 23.0)], 0.0, 6.3, scale_top=0.92)

    # 2. Three-stepped Pentelic marble Crepidoma & Stylobate (69.5m x 30.9m, z = 6.3m - 8.1m)
    for step in range(3):
        b.add_box_z("Stone_Limestone", 0.0, 0.0, 6.3 + step * 0.6, 6.9 + step * 0.6, 71.5 - step * 1.0, 32.9 - step * 1.0)
    z_styl = 8.1

    # 3. Full Octastyle Peripteral Doric Colonnade (8 x 17 = 46 outer fluted columns, 10.4m tall)
    xs = [-33.0 + 66.0 * i / 16.0 for i in range(17)]
    ys = [-14.0 + 28.0 * j / 7.0 for j in range(8)]
    col_h = 10.4
    for i, cx in enumerate(xs):
        for j, cy in enumerate(ys):
            if i in (0, 16) or j in (0, 7):
                # Fluted Doric shaft with entasis taper + echinus/abacus capital
                b.add_cylinder("Stone_Limestone", (cx, cy, z_styl), 0.95, 0.74, col_h - 0.8, segs=12)
                b.add_cylinder("Stone_Limestone", (cx, cy, z_styl + col_h - 0.8), 0.74, 1.08, 0.45, segs=12)
                b.add_box_z("Stone_Limestone", cx, cy, z_styl + col_h - 0.35, z_styl + col_h, 2.2, 2.2)

    # 4. Inner Hexastyle Pronaos/Opisthodomos Porches (6 columns each end) & open-roofed Cella walls
    for end_x in (-24.5, 24.5):
        for j in range(6):
            cy = -10.0 + 20.0 * j / 5.0
            b.add_cylinder("Stone_Limestone", (end_x, cy, z_styl), 0.82, 0.66, col_h - 0.6, segs=10)
    # Partially preserved inner cella ashlar walls (leaving open sky roof)
    b.add_box_z("Stone_Limestone", 0.0, -9.8, z_styl, z_styl + 7.2, 42.0, 1.4)
    b.add_box_z("Stone_Limestone", 0.0, 9.8, z_styl, z_styl + 7.2, 42.0, 1.4)
    b.add_box_z("Stone_Limestone", -21.0, 0.0, z_styl, z_styl + 8.5, 1.6, 20.0)
    b.add_box_z("Emissive_Floodlight", 0.0, 0.0, z_styl + 0.2, z_styl + 1.0, 62.0, 24.0)

    # 5. Architrave, Doric Frieze (z = 18.5m - 20.6m) & East/West Triangular Pediments
    z_ent = z_styl + col_h
    for sy in (-14.0, 14.0):
        b.add_box_z("Stone_Limestone", 0.0, sy, z_ent, z_ent + 2.1, 68.5, 2.2)
    for sx in (-33.0, 33.0):
        b.add_box_z("Stone_Limestone", sx, 0.0, z_ent, z_ent + 2.1, 2.2, 30.2)
        # Partially preserved classical triangular marble pediment gable on East & West facades
        ped_front = [
            (sx - 1.1, -15.2, z_ent + 2.1),
            (sx - 1.1, 15.2, z_ent + 2.1),
            (sx - 1.1, 0.0, z_ent + 5.6),
        ]
        ped_back = [
            (sx + 1.1, -15.2, z_ent + 2.1),
            (sx + 1.1, 15.2, z_ent + 2.1),
            (sx + 1.1, 0.0, z_ent + 5.6),
        ]
        b.add_prism("Stone_Limestone", [ped_front, ped_back], smooth=False)


def _add_stepped_pyramid(b: LandmarkBuilder, mat, cx, cy, base_w, height, steps=12, truncate=0.04, cap_mat=None, cap_frac=0.0):
    """Build a Giza stepped limestone pyramid with optional smooth Tura limestone apex cap."""
    step_h = height / steps
    for s in range(steps):
        t0 = s / steps
        t1 = (s + 1) / steps
        z0 = t0 * height
        z1 = t1 * height
        w0 = base_w * (1.0 - (1.0 - truncate) * t0)
        w1 = base_w * (1.0 - (1.0 - truncate) * t1)
        use_mat = cap_mat if (cap_mat and t0 >= (1.0 - cap_frac)) else mat
        h0 = w0 * 0.5
        pts = [(-h0, -h0), (h0, -h0), (h0, h0), (-h0, h0)]
        b.add_poly_extrude(use_mat, pts, z0, z1, scale_top=max(0.01, w1 / w0), offset_bottom=(cx, cy), offset_top=(cx, cy))


def build_cairo_giza(b: LandmarkBuilder):
    """Great Pyramids of Giza (Khufu, Khafre, Menkaure + 3 Queen Pyramids) & Great Sphinx."""
    # Desert plateau sand base apron
    b.add_box_z("Warm_Sandstone", 0.0, 0.0, 0.0, 0.6, 560.0, 560.0)

    # 1. Great Pyramid of Khufu (138.8m H x 230.3m x 230.3m) — flat truncated summit + North chevron entry
    _add_stepped_pyramid(b, "Warm_Sandstone", 120.0, 125.0, 230.3, 138.8, steps=14, truncate=0.05)
    b.add_box_z("Emissive_Windows", 120.0, 240.0, 12.0, 20.0, 14.0, 4.0)
    b.add_box_z("Emissive_Floodlight", 120.0, 125.0, 0.6, 2.2, 234.0, 234.0)

    # 2. Pyramid of Khafre (136.4m H x 215.3m x 215.3m) — iconic smooth pale Tura limestone apex cap!
    _add_stepped_pyramid(b, "Warm_Sandstone", -45.0, -35.0, 215.3, 136.4, steps=14, truncate=0.015, cap_mat="White_Marble", cap_frac=0.25)

    # 3. Pyramid of Menkaure (65m H x 108.5m x 108.5m) + 3 Queen's Pyramids (20m each)
    _add_stepped_pyramid(b, "Warm_Sandstone", -195.0, -180.0, 108.5, 65.0, steps=10, truncate=0.03)
    for qx in (-228.0, -195.0, -162.0):
        _add_stepped_pyramid(b, "Warm_Sandstone", qx, -258.0, 32.0, 20.0, steps=6, truncate=0.05)

    # 4. The Great Sphinx of Giza (20m H x 19m W x 73m L, East of Khafre facing East +X)
    sx, sy = 135.0, -140.0
    # Sunken quarry enclosure perimeter
    b.add_box_z("Stone_Limestone", sx, sy, 0.6, 2.0, 84.0, 30.0)
    # Recumbent lion body & hindquarters (along X axis)
    b.add_box_z("Warm_Sandstone", sx - 8.0, sy, 2.0, 13.5, 42.0, 15.0)
    b.add_sphere("Warm_Sandstone", (sx - 26.0, sy, 8.2), 9.0, 8.0, 6.2, u_segs=12, v_segs=8)
    # Extended massive front lion paws facing East (+X) + Dream Stele between paws
    for py in (-5.8, 5.8):
        b.add_box_z("Warm_Sandstone", sx + 22.0, sy + py, 2.0, 5.2, 26.0, 4.4)
    b.add_box_z("Stone_Limestone", sx + 18.0, sy, 2.0, 6.8, 1.6, 4.2)  # Dream Stele
    # Chest, neck, Pharaoh's sculpted face & broad striped Nemes royal headdress (up to 20.5m)
    b.add_box_z("Warm_Sandstone", sx + 10.0, sy, 11.0, 16.5, 11.0, 12.5)
    b.add_box_z("Stone_Limestone", sx + 11.5, sy, 14.5, 20.6, 9.2, 13.8)  # Broad Nemes headdress
    b.add_sphere("Warm_Sandstone", (sx + 15.8, sy, 17.6), 3.6, 3.8, 3.8, u_segs=12, v_segs=8)
    b.add_box_z("Emissive_Floodlight", sx + 20.0, sy, 2.2, 3.4, 8.0, 12.0)


# ==============================================================================
# 10. COMPLETE 50-LANDMARK REGISTRY & GLB EXPORT PIPELINE
# ==============================================================================

LANDMARK_BUILDERS = {
    # Region 1: Taiwan (6)
    "taipei_101": build_taipei_101,
    "taipei_cks": build_taipei_cks,
    "taipei_grand_hotel": build_taipei_grand_hotel,
    "kaohsiung_85": build_kaohsiung_85,
    "kaohsiung_music": build_kaohsiung_music,
    "taichung_opera": build_taichung_opera,
    # Region 2: Japan & Korea (5)
    "tokyo_skytree": build_tokyo_skytree,
    "tokyo_tower": build_tokyo_tower,
    "osaka_castle": build_osaka_castle,
    "fuji_torii": build_fuji_torii,
    "seoul_lotte": build_seoul_lotte,
    # Region 3: China, Hong Kong & Macau (6)
    "shanghai_pearl": build_shanghai_pearl,
    "shanghai_tower": build_shanghai_tower,
    "gz_canton": build_gz_canton,
    "beijing_cctv": build_beijing_cctv,
    "hk_icc_ifc": build_hk_icc_ifc,
    "macau_tower": build_macau_tower,
    # Region 4: Southeast & South Asia (4)
    "sg_mbs": build_sg_mbs,
    "kl_petronas": build_kl_petronas,
    "bangkok_mahanakhon": build_bangkok_mahanakhon,
    "agra_taj_mahal": build_agra_taj_mahal,
    # Region 5: Middle East & Oceania (5)
    "dubai_burj": build_dubai_burj,
    "dubai_burj_alarab": build_dubai_burj_alarab,
    "dubai_future": build_dubai_future,
    "sydney_opera": build_sydney_opera,
    "sydney_bridge": build_sydney_bridge,
    # Region 6: North & South America (12)
    "golden_gate": build_golden_gate,
    "sf_transamerica": build_sf_transamerica,
    "nyc_owtc": build_nyc_owtc,
    "nyc_empire": build_nyc_empire,
    "nyc_chrysler": build_nyc_chrysler,
    "nyc_liberty": build_nyc_liberty,
    "seattle_needle": build_seattle_needle,
    "toronto_cn": build_toronto_cn,
    "chicago_willis": build_chicago_willis,
    "la_hollywood_griffith": build_la_hollywood_griffith,
    "rio_christ": build_rio_christ,
    "chichen_itza": build_chichen_itza,
    # Region 7: Europe & Africa (12)
    "paris_eiffel": build_paris_eiffel,
    "paris_triomphe_louvre": build_paris_triomphe_louvre,
    "london_shard": build_london_shard,
    "london_towerbridge": build_london_towerbridge,
    "london_bigben_eye": build_london_bigben_eye,
    "rome_colosseum": build_rome_colosseum,
    "pisa_tower": build_pisa_tower,
    "barcelona_sagrada": build_barcelona_sagrada,
    "berlin_tv_gate": build_berlin_tv_gate,
    "bavaria_neuschwanstein": build_bavaria_neuschwanstein,
    "athens_parthenon": build_athens_parthenon,
    "cairo_giza": build_cairo_giza,
}


def reset_scene():
    """Reset Blender scene cleanly to metric 1:1 scale before building each landmark."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    if hasattr(bpy.data, "orphans_purge"):
        try:
            bpy.data.orphans_purge(do_recursive=True)
        except TypeError:
            bpy.data.orphans_purge()


def resolve_requested_landmarks():
    """Determine which landmark IDs to build from CLI args (after --) or SKYBOUND_LANDMARKS env."""
    if "--" in sys.argv:
        cli_ids = [arg.strip() for arg in sys.argv[sys.argv.index("--") + 1 :] if arg.strip()]
        if cli_ids and not (len(cli_ids) == 1 and cli_ids[0].upper() == "ALL"):
            return cli_ids

    env_val = os.environ.get("SKYBOUND_LANDMARKS", "ALL").strip()
    if not env_val or env_val.upper() == "ALL":
        return list(LANDMARK_BUILDERS.keys())
    return [tok.strip() for tok in env_val.split(",") if tok.strip()]


def export_landmark(landmark_id, builder_fn, out_dir: Path):
    """Build a single landmark in a fresh scene and export as Binary glTF 2.0 (.glb)."""
    t0 = time.perf_counter()
    reset_scene()
    materials = create_material_library()
    builder = LandmarkBuilder(landmark_id, materials)
    builder_fn(builder)
    objs = builder.finalize()

    tri_count = 0
    for obj in objs:
        if obj.type == "MESH":
            obj.select_set(True)
            tri_count += sum(max(0, len(p.vertices) - 2) for p in obj.data.polygons)

    out_path = out_dir / f"{landmark_id}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        export_draco_mesh_compression_enable=False,
        export_yup=True,
    )
    dt = time.perf_counter() - t0
    size_kb = out_path.stat().st_size / 1024.0 if out_path.exists() else 0.0
    print(
        f"[SKYBOUND] Exported {landmark_id:<24s} | {len(objs):2d} meshes | "
        f"{tri_count:6d} tris | {size_kb:7.1f} KB | {dt:.2f}s -> {out_path}"
    )


def main():
    script_dir = Path(__file__).resolve().parent
    out_dir = (script_dir / ".." / "dist" / "models" / "landmarks").resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    requested = resolve_requested_landmarks()
    unknown = [lid for lid in requested if lid not in LANDMARK_BUILDERS]
    if unknown:
        print(f"[SKYBOUND][WARN] Ignoring unknown landmark IDs: {', '.join(unknown)}")
    targets = [lid for lid in requested if lid in LANDMARK_BUILDERS]

    print(
        f"[SKYBOUND] Building {len(targets)} / {len(LANDMARK_BUILDERS)} world landmarks "
        f"-> {out_dir}"
    )
    t_start = time.perf_counter()
    for idx, lid in enumerate(targets, 1):
        print(f"[SKYBOUND] ({idx:02d}/{len(targets):02d}) Building {lid}...")
        export_landmark(lid, LANDMARK_BUILDERS[lid], out_dir)
    print(f"[SKYBOUND] Done! Built {len(targets)} GLB models in {time.perf_counter() - t_start:.2f}s.")


if __name__ == "__main__":
    main()
