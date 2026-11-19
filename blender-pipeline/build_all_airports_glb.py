#!/usr/bin/env python3
"""
SKYBOUND GLOBAL — Complete 62-Airport Procedural Architectural GLB Builder
==========================================================================
Blender 3.6 – 4.3+ compatible `bpy` / `bmesh` pipeline generating low-poly PBR
3D airport complexes (terminals, iconic ATCT control towers, aviation beacons,
8 articulated jetways, and apron markings) for all 62 SKYBOUND GLOBAL airports.

Usage:
    # Build all 62 airports:
    blender -b --python build_all_airports_glb.py

    # Build a subset via environment variable:
    SKYBOUND_AIRPORTS="RCTP,WSSS,KJFK,CVN78" blender -b --python build_all_airports_glb.py

    # Or via CLI argument after `--`:
    blender -b --python build_all_airports_glb.py -- --airports RCTP,KLAX,EGLL

Output:
    ../dist/models/airports/<CODE>.glb  (relative to this script)
    Override output folder with env var SKYBOUND_OUT_DIR if desired.

Scene Hierarchy per GLB (Y-Up, 1 unit = 1 meter):
    Airport_<CODE>_Root
      ├── Terminal_Main
      ├── Control_Tower
      ├── Tower_Beacon_Light
      ├── Apron_Ground
      └── Jetway_01 .. Jetway_08
"""

import math
import os
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector


# =============================================================================
# 1. COMPLETE 62-AIRPORT INVENTORY (sourced from scratch_inventory.json)
# =============================================================================

AIRPORTS = [
    # --- Taiwan & Carrier (11) ---
    {"code": "RCSS", "name": "松山", "region": "tw", "lat": 25.069593055555554, "lon": 121.55252361111111, "elevation": 4.11, "heading": 1.6095426361891707, "length": 4000},
    {"code": "RCYU", "name": "花蓮", "region": "tw", "lat": 24.02370416666667, "lon": 121.61693194444445, "elevation": 14.48, "heading": 3.6004397139391022, "length": 2751},
    {"code": "RCTP", "name": "桃園", "region": "tw", "lat": 25.083695833333334, "lon": 121.22971383333334, "elevation": 20.88, "heading": 0.8566075968788169, "length": 3660},
    {"code": "RCMQ", "name": "臺中", "region": "tw", "lat": 24.265061166666666, "lon": 120.620718, "elevation": 200.56, "heading": 3.083822255348781, "length": 3659},
    {"code": "RCKH", "name": "高雄", "region": "tw", "lat": 22.577043, "lon": 120.35095283333334, "elevation": 7.93, "heading": 1.6039575825827888, "length": 3150},
    {"code": "RCFN", "name": "臺東", "region": "tw", "lat": 22.754872166666665, "lon": 121.10165, "elevation": 41.61, "heading": 0.6743952229706089, "length": 2438},
    {"code": "RCBS", "name": "金門", "region": "tw", "lat": 24.42793055, "lon": 118.35890278333333, "elevation": 17.07, "heading": 1.1063642128392055, "length": 3004},
    {"code": "RCQC", "name": "澎湖", "region": "tw", "lat": 23.568623666666667, "lon": 119.62823883333333, "elevation": 22.71, "heading": 0.3179989897133668, "length": 3000},
    {"code": "RCGI", "name": "綠島", "region": "tw", "lat": 22.673229166666665, "lon": 121.46619444444444, "elevation": 8.38, "heading": 2.8654815659242905, "length": 917},
    {"code": "RCLY", "name": "蘭嶼", "region": "tw", "lat": 22.02861111111111, "lon": 121.53384722222222, "elevation": 12.95, "heading": 5.409822549481623, "length": 1132},
    {"code": "CVN78", "name": "福特號航空母艦", "region": "tw", "lat": 24.35, "lon": 122.15, "elevation": 18.5, "heading": 0, "length": 333},
    # --- East Asia (15) ---
    {"code": "RJAA", "name": "東京成田", "region": "ea", "lat": 35.758855555555556, "lon": 140.37951527777778, "elevation": 41, "heading": 5.7510344182465145, "length": 4000},
    {"code": "RJTT", "name": "東京羽田", "region": "ea", "lat": 35.5494, "lon": 139.7798, "elevation": 6.4, "heading": 5.88175957922089, "length": 3360},
    {"code": "RJBB", "name": "大阪關西", "region": "ea", "lat": 34.4347, "lon": 135.244, "elevation": 5.2, "heading": 1.0297442586766543, "length": 4000},
    {"code": "VHHH", "name": "香港赤鱲角", "region": "ea", "lat": 22.308055555555555, "lon": 113.91833333333334, "elevation": 9, "heading": 1.239183768915974, "length": 3800},
    {"code": "ROAH", "name": "沖繩那霸", "region": "ea", "lat": 26.195833333333333, "lon": 127.64583333333333, "elevation": 3.5, "heading": 3.193952531149623, "length": 3000},
    {"code": "RKSI", "name": "首爾仁川", "region": "ea", "lat": 37.4602, "lon": 126.4407, "elevation": 7, "heading": 5.811946409141117, "length": 4000},
    {"code": "ZSPD", "name": "上海浦東", "region": "ea", "lat": 31.1434, "lon": 121.8052, "elevation": 4, "heading": 2.9146998508305306, "length": 4000},
    {"code": "ZBAA", "name": "北京首都", "region": "ea", "lat": 40.0799, "lon": 116.6031, "elevation": 35.4, "heading": 6.265732014659642, "length": 3800},
    {"code": "ZGGG", "name": "廣州白雲", "region": "ea", "lat": 23.3924, "lon": 113.2988, "elevation": 15.2, "heading": 0.3316125578789226, "length": 3800},
    {"code": "ZGSZ", "name": "深圳寶安", "region": "ea", "lat": 22.6393, "lon": 113.8107, "elevation": 4, "heading": 2.670353755551324, "length": 3800},
    {"code": "VMMC", "name": "澳門國際", "region": "ea", "lat": 22.1496, "lon": 113.5915, "elevation": 6.1, "heading": 2.792526803190927, "length": 3360},
    {"code": "RJCC", "name": "札幌新千歲", "region": "ea", "lat": 42.7752, "lon": 141.6923, "elevation": 25, "heading": 0.08726646259971647, "length": 3000},
    {"code": "RJFF", "name": "福岡機場", "region": "ea", "lat": 33.5859, "lon": 130.4507, "elevation": 9.4, "heading": 2.740166925631097, "length": 2800},
    {"code": "RJOO", "name": "大阪伊丹", "region": "ea", "lat": 34.7855, "lon": 135.4382, "elevation": 15.2, "heading": 2.356194490192345, "length": 3000},
    {"code": "RKPC", "name": "濟州國際", "region": "ea", "lat": 33.5113, "lon": 126.493, "elevation": 36, "heading": 1.1868238913561442, "length": 3180},
    # --- Southeast & South Asia (9) ---
    {"code": "WSSS", "name": "新加坡樟宜", "region": "sea", "lat": 1.3592, "lon": 103.9893, "elevation": 6.7, "heading": 0.40142572795869574, "length": 4000},
    {"code": "RPLL", "name": "馬尼拉尼諾伊", "region": "sea", "lat": 14.5086, "lon": 121.0194, "elevation": 22.9, "heading": 1.064650843716541, "length": 3737},
    {"code": "VTBS", "name": "曼谷蘇凡納布", "region": "sea", "lat": 13.69, "lon": 100.7501, "elevation": 2.1, "heading": 0.2617993877991494, "length": 4000},
    {"code": "WMKK", "name": "吉隆坡國際", "region": "sea", "lat": 2.762835, "lon": 101.7120015, "elevation": 21, "heading": 2.548180707911721, "length": 4124},
    {"code": "WIII", "name": "雅加達蘇加諾哈達", "region": "sea", "lat": -6.13646, "lon": 106.659, "elevation": 10.4, "heading": 1.1868238913561442, "length": 3660},
    {"code": "VVNB", "name": "河內內排", "region": "sea", "lat": 21.2212, "lon": 105.8072, "elevation": 12.2, "heading": 1.9198621771937625, "length": 3800},
    {"code": "VVTS", "name": "胡志明新山一", "region": "sea", "lat": 10.8188, "lon": 106.6519, "elevation": 10.1, "heading": 1.2217304763960306, "length": 3800},
    {"code": "VIDP", "name": "新德里英迪拉甘地", "region": "sea", "lat": 28.5562, "lon": 77.1, "elevation": 237.1, "heading": 1.8151424220741028, "length": 4430},
    {"code": "VABB", "name": "孟買賈特拉帕蒂", "region": "sea", "lat": 19.0887, "lon": 72.8679, "elevation": 11.9, "heading": 1.53588974175501, "length": 3448},
    # --- Middle East (3) ---
    {"code": "OMDB", "name": "杜拜國際", "region": "me", "lat": 25.2528, "lon": 55.3644, "elevation": 19, "heading": 2.111848394913139, "length": 4000},
    {"code": "OTHH", "name": "杜哈哈馬德", "region": "me", "lat": 25.2731, "lon": 51.6081, "elevation": 4, "heading": 2.792526803190927, "length": 4850},
    {"code": "LTFM", "name": "伊斯坦堡新機場", "region": "me", "lat": 41.2753, "lon": 28.7519, "elevation": 99.1, "heading": 2.9670597283903604, "length": 4100},
    # --- Europe (7) ---
    {"code": "EGLL", "name": "倫敦希斯洛", "region": "eu", "lat": 51.47, "lon": -0.4543, "elevation": 25.3, "heading": 4.71238898038469, "length": 3902},
    {"code": "LFPG", "name": "巴黎戴高樂", "region": "eu", "lat": 49.0097, "lon": 2.5479, "elevation": 119.5, "heading": 1.5009831567151233, "length": 4200},
    {"code": "EDDF", "name": "法蘭克福", "region": "eu", "lat": 50.0379, "lon": 8.5622, "elevation": 110.9, "heading": 1.1868238913561442, "length": 4000},
    {"code": "EHAM", "name": "阿姆斯特丹史基浦", "region": "eu", "lat": 52.3105, "lon": 4.7683, "elevation": -3.4, "heading": 3.193952531149623, "length": 3800},
    {"code": "LSZH", "name": "蘇黎世國際", "region": "eu", "lat": 47.4647, "lon": 8.5492, "elevation": 431.6, "heading": 2.705260340591211, "length": 3700},
    {"code": "LIRF", "name": "羅馬費米奇諾", "region": "eu", "lat": 41.8003, "lon": 12.2389, "elevation": 4.6, "heading": 2.844886680750757, "length": 3900},
    {"code": "LEMD", "name": "馬德里巴拉哈斯", "region": "eu", "lat": 40.4983, "lon": -3.5676, "elevation": 609, "heading": 2.4958208303518914, "length": 4179},
    # --- North America (9) ---
    {"code": "KJFK", "name": "紐約甘迺迪", "region": "na", "lat": 40.6413, "lon": -73.7781, "elevation": 4, "heading": 2.3387411976724013, "length": 4423},
    {"code": "KLAX", "name": "洛杉磯國際", "region": "na", "lat": 33.9416, "lon": -118.4085, "elevation": 38.4, "heading": 1.2217304763960306, "length": 3685},
    {"code": "KSFO", "name": "舊金山國際", "region": "na", "lat": 37.6213, "lon": -122.379, "elevation": 4, "heading": 1.8151424220741028, "length": 3618},
    {"code": "KORD", "name": "芝加哥歐海爾", "region": "na", "lat": 41.9742, "lon": -87.9073, "elevation": 206.7, "heading": 1.5707963267948966, "length": 3963},
    {"code": "KSEA", "name": "西雅圖塔科馬", "region": "na", "lat": 47.4502, "lon": -122.3088, "elevation": 132, "heading": 2.8623399732707, "length": 3627},
    {"code": "PANC", "name": "安克拉治泰德史蒂文斯", "region": "na", "lat": 61.1743, "lon": -149.9964, "elevation": 46, "heading": 1.239183768915974, "length": 3531},
    {"code": "PHNL", "name": "檀香山丹尼爾井上", "region": "na", "lat": 21.3187, "lon": -157.9225, "elevation": 4, "heading": 1.3788101090755203, "length": 3753},
    {"code": "CYVR", "name": "溫哥華國際", "region": "na", "lat": 49.1967, "lon": -123.1815, "elevation": 4.3, "heading": 1.4486232791552935, "length": 3505},
    {"code": "CYYZ", "name": "多倫多皮爾遜", "region": "na", "lat": 43.6777, "lon": -79.6248, "elevation": 173.4, "heading": 0.9948376736367678, "length": 3389},
    # --- Oceania (3) ---
    {"code": "YSSY", "name": "雪梨金斯福德史密斯", "region": "oc", "lat": -33.9399, "lon": 151.1753, "elevation": 6.4, "heading": 2.9321531433504737, "length": 3962},
    {"code": "YMML", "name": "墨爾本圖拉馬林", "region": "oc", "lat": -37.669, "lon": 144.841, "elevation": 132.3, "heading": 2.792526803190927, "length": 3657},
    {"code": "NZAA", "name": "奧克蘭國際", "region": "oc", "lat": -37.0082, "lon": 174.785, "elevation": 7, "heading": 0.890117918517108, "length": 3635},
    # --- South America & Africa (5) ---
    {"code": "SBGR", "name": "聖保羅瓜魯柳斯", "region": "sa", "lat": -23.4356, "lon": -46.4731, "elevation": 750, "heading": 1.5707963267948966, "length": 3700},
    {"code": "MMMX", "name": "墨西哥城貝尼托華雷斯", "region": "sa", "lat": 19.4363, "lon": -99.0721, "elevation": 2230, "heading": 0.9075712110370514, "length": 3985},
    {"code": "SCEL", "name": "聖地牙哥阿圖羅梅里諾", "region": "sa", "lat": -33.393, "lon": -70.7858, "elevation": 474, "heading": 3.01941960595019, "length": 3800},
    {"code": "HECA", "name": "開羅國際", "region": "sa", "lat": 30.1219, "lon": 31.4056, "elevation": 116.4, "heading": 0.8726646259971648, "length": 4000},
    {"code": "FAOR", "name": "約翰尼斯堡奧利弗坦博", "region": "sa", "lat": -26.1367, "lon": 28.2411, "elevation": 1694, "heading": 0.5759586531581288, "length": 4418},
]

AIRPORT_MAP = {a["code"]: a for a in AIRPORTS}


# =============================================================================
# 2. BLENDER 3.6–4.3+ SAFE MATERIAL & SCENE UTILITIES
# =============================================================================

def set_bsdf_input(bsdf, names, value):
    """Safely assign a Principled BSDF socket across Blender 3.6–4.3+ APIs."""
    for name in names:
        sock = bsdf.inputs.get(name)
        if sock is not None:
            sock.default_value = value
            return True
    return False


def create_pbr_material(
    name,
    base_color,
    metallic=0.0,
    roughness=0.5,
    emission_color=None,
    emission_strength=0.0,
):
    """Create or retrieve a Principled BSDF PBR material safe for Blender 3.6–4.3+."""
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing

    mat = bpy.data.materials.new(name=name)
    if not mat.use_nodes:
        mat.use_nodes = True

    nt = mat.node_tree
    bsdf = None
    for node in nt.nodes:
        if node.type == "BSDF_PRINCIPLED":
            bsdf = node
            break
    if bsdf is None:
        nt.nodes.clear()
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out_node = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(bsdf.outputs["BSDF"], out_node.inputs["Surface"])

    set_bsdf_input(bsdf, ("Base Color",), base_color)
    set_bsdf_input(bsdf, ("Metallic",), metallic)
    set_bsdf_input(bsdf, ("Roughness",), roughness)

    if emission_color is not None and emission_strength > 0.0:
        # Blender 4.0+ uses "Emission Color"; Blender 3.6 uses "Emission"
        set_bsdf_input(bsdf, ("Emission Color", "Emission"), emission_color)
        set_bsdf_input(bsdf, ("Emission Strength",), emission_strength)
    else:
        set_bsdf_input(bsdf, ("Emission Strength",), 0.0)

    return mat


MATERIAL_SPECS = {
    # Core required materials
    "Terminal_White": dict(
        base_color=(0.88, 0.89, 0.90, 1.0), metallic=0.06, roughness=0.44
    ),
    "Terminal_Metal": dict(
        base_color=(0.74, 0.77, 0.81, 1.0), metallic=0.78, roughness=0.26
    ),
    "Terminal_Glass_Emissive": dict(
        base_color=(0.35, 0.58, 0.78, 1.0),
        metallic=0.18,
        roughness=0.14,
        emission_color=(1.0, 0.86, 0.56, 1.0),
        emission_strength=2.0,
    ),
    "Tower_Beacon_Emissive": dict(
        base_color=(1.0, 0.10, 0.10, 1.0),
        metallic=0.0,
        roughness=0.20,
        emission_color=(1.0, 0.10, 0.10, 1.0),
        emission_strength=6.5,
    ),
    "Concrete_Apron": dict(
        base_color=(0.36, 0.38, 0.40, 1.0), metallic=0.0, roughness=0.86
    ),
    "Accent_Red": dict(
        base_color=(0.76, 0.14, 0.12, 1.0), metallic=0.15, roughness=0.36
    ),
    "Accent_Gold": dict(
        base_color=(0.84, 0.62, 0.24, 1.0), metallic=0.62, roughness=0.30
    ),
    "Accent_Blue": dict(
        base_color=(0.12, 0.40, 0.68, 1.0), metallic=0.25, roughness=0.30
    ),
    "Jetway_Steel": dict(
        base_color=(0.68, 0.71, 0.75, 1.0), metallic=0.62, roughness=0.36
    ),
    # Architectural palette extensions
    "Accent_Orange": dict(
        base_color=(0.88, 0.40, 0.12, 1.0), metallic=0.18, roughness=0.34
    ),
    "Accent_Yellow": dict(
        base_color=(0.95, 0.76, 0.08, 1.0), metallic=0.10, roughness=0.35
    ),
    "Accent_Green": dict(
        base_color=(0.14, 0.58, 0.42, 1.0), metallic=0.20, roughness=0.34
    ),
    "Accent_Charcoal": dict(
        base_color=(0.16, 0.18, 0.20, 1.0), metallic=0.35, roughness=0.58
    ),
    "Naval_Haze_Gray": dict(
        base_color=(0.35, 0.39, 0.42, 1.0), metallic=0.38, roughness=0.56
    ),
    "Terracotta_Tile": dict(
        base_color=(0.64, 0.24, 0.16, 1.0), metallic=0.05, roughness=0.62
    ),
    "Sandstone_Beige": dict(
        base_color=(0.76, 0.68, 0.54, 1.0), metallic=0.04, roughness=0.66
    ),
    "Glass_Cyan_Emissive": dict(
        base_color=(0.24, 0.78, 0.95, 1.0),
        metallic=0.12,
        roughness=0.12,
        emission_color=(0.28, 0.88, 1.0, 1.0),
        emission_strength=3.0,
    ),
    "Glass_Magenta_Emissive": dict(
        base_color=(0.82, 0.25, 0.76, 1.0),
        metallic=0.12,
        roughness=0.14,
        emission_color=(0.92, 0.30, 0.85, 1.0),
        emission_strength=2.6,
    ),
}


def build_material_library():
    """Ensure all PBR materials exist in bpy.data.materials and return dict."""
    mats = {}
    for name, cfg in MATERIAL_SPECS.items():
        mats[name] = create_pbr_material(name, **cfg)
    return mats


def clear_scene():
    """Remove all objects and orphan geometry between airport exports."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for cam in list(bpy.data.cameras):
        bpy.data.cameras.remove(cam, do_unlink=True)
    for light in list(bpy.data.lights):
        bpy.data.lights.remove(light, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)


# =============================================================================
# 3. BMESH ARCHITECTURAL GEOMETRY ENGINE
# =============================================================================

class MeshBuilder:
    """Fast, Blender 3.6–4.3+ safe BMesh builder with multi-material tracking."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mat_order = []
        self.mat_to_idx = {}

    def mat_idx(self, mat_name):
        idx = self.mat_to_idx.get(mat_name)
        if idx is None:
            idx = len(self.mat_order)
            self.mat_order.append(mat_name)
            self.mat_to_idx[mat_name] = idx
        return idx

    @staticmethod
    def _tag_faces_from_verts(verts, m_idx):
        seen = set()
        for v in verts:
            for f in v.link_faces:
                if f not in seen:
                    f.material_index = m_idx
                    seen.add(f)

    def _safe_face(self, verts, m_idx):
        if len(verts) < 3:
            return None
        try:
            f = self.bm.faces.new(verts)
            f.material_index = m_idx
            return f
        except ValueError:
            return None

    def add_box(self, center, size, mat="Terminal_White", rot_euler=(0.0, 0.0, 0.0)):
        cx, cy, cz = center
        sx, sy, sz = size
        if sx <= 1e-4 or sy <= 1e-4 or sz <= 1e-4:
            return
        m4 = (
            Matrix.Translation((cx, cy, cz))
            @ Euler(rot_euler, "XYZ").to_matrix().to_4x4()
            @ Matrix.Diagonal((sx, sy, sz, 1.0))
        )
        res = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m4)
        self._tag_faces_from_verts(res["verts"], self.mat_idx(mat))

    def add_cylinder(
        self,
        center,
        r_bottom,
        r_top,
        height,
        segs=16,
        mat="Terminal_White",
        rot_euler=(0.0, 0.0, 0.0),
    ):
        if height <= 1e-4:
            return
        m4 = (
            Matrix.Translation(center)
            @ Euler(rot_euler, "XYZ").to_matrix().to_4x4()
        )
        res = bmesh.ops.create_cone(
            self.bm,
            cap_ends=True,
            cap_tris=False,
            segments=max(3, int(segs)),
            radius1=max(0.01, float(r_bottom)),
            radius2=max(0.01, float(r_top)),
            depth=float(height),
            matrix=m4,
        )
        self._tag_faces_from_verts(res["verts"], self.mat_idx(mat))

    def add_sphere(
        self,
        center,
        radius,
        segs=16,
        rings=10,
        mat="Terminal_White",
        scale=(1.0, 1.0, 1.0),
    ):
        m4 = (
            Matrix.Translation(center)
            @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
        )
        res = bmesh.ops.create_uvsphere(
            self.bm,
            u_segments=max(6, int(segs)),
            v_segments=max(4, int(rings)),
            radius=max(0.01, float(radius)),
            matrix=m4,
        )
        self._tag_faces_from_verts(res["verts"], self.mat_idx(mat))

    def add_tube(self, p0, p1, radius, segs=8, mat="Terminal_Metal", r_top=None):
        v0 = Vector(p0)
        v1 = Vector(p1)
        diff = v1 - v0
        length = diff.length
        if length <= 1e-4:
            return
        mid = (v0 + v1) * 0.5
        quat = Vector((0.0, 0.0, 1.0)).rotation_difference(diff.normalized())
        m4 = Matrix.Translation(mid) @ quat.to_matrix().to_4x4()
        r1 = max(0.01, float(radius))
        r2 = r1 if r_top is None else max(0.01, float(r_top))
        res = bmesh.ops.create_cone(
            self.bm,
            cap_ends=True,
            cap_tris=False,
            segments=max(4, int(segs)),
            radius1=r1,
            radius2=r2,
            depth=length,
            matrix=m4,
        )
        self._tag_faces_from_verts(res["verts"], self.mat_idx(mat))

    def add_prism(self, pts_2d, z0, z1, mat="Terminal_White"):
        """Extrude a 2D polygon [(x, y), ...] from z0 to z1."""
        n = len(pts_2d)
        if n < 3 or abs(z1 - z0) <= 1e-4:
            return
        m_idx = self.mat_idx(mat)
        bot = [self.bm.verts.new((float(x), float(y), float(z0))) for x, y in pts_2d]
        top = [self.bm.verts.new((float(x), float(y), float(z1))) for x, y in pts_2d]
        for i in range(n):
            j = (i + 1) % n
            self._safe_face([bot[i], bot[j], top[j], top[i]], m_idx)
        self._safe_face(list(reversed(bot)), m_idx)
        self._safe_face(top, m_idx)

    def add_parametric_roof(
        self,
        x_range,
        y_range,
        nx,
        ny,
        z_func,
        thickness=1.6,
        mat_top="Terminal_Metal",
        mat_bottom=None,
    ):
        """
        Build a solid manifold thin-shell roof over x_range=(x0,x1), y_range=(y0,y1)
        where z_func(u, v) returns centerline Z for u,v in [0, 1].
        """
        x0, x1 = x_range
        y0, y1 = y_range
        nx = max(2, int(nx))
        ny = max(2, int(ny))
        half_t = max(0.15, float(thickness)) * 0.5
        m_top = self.mat_idx(mat_top)
        m_bot = self.mat_idx(mat_bottom if mat_bottom else mat_top)

        top_grid = []
        bot_grid = []
        for i in range(nx + 1):
            u = i / nx
            x = x0 + (x1 - x0) * u
            t_row = []
            b_row = []
            for j in range(ny + 1):
                v = j / ny
                y = y0 + (y1 - y0) * v
                z = float(z_func(u, v))
                t_row.append(self.bm.verts.new((x, y, z + half_t)))
                b_row.append(self.bm.verts.new((x, y, z - half_t)))
            top_grid.append(t_row)
            bot_grid.append(b_row)

        for i in range(nx):
            for j in range(ny):
                self._safe_face(
                    [top_grid[i][j], top_grid[i + 1][j], top_grid[i + 1][j + 1], top_grid[i][j + 1]],
                    m_top,
                )
                self._safe_face(
                    [bot_grid[i][j], bot_grid[i][j + 1], bot_grid[i + 1][j + 1], bot_grid[i + 1][j]],
                    m_bot,
                )

        # Perimeter fascia walls
        for i in range(nx):
            self._safe_face(
                [bot_grid[i][0], bot_grid[i + 1][0], top_grid[i + 1][0], top_grid[i][0]],
                m_top,
            )
            self._safe_face(
                [bot_grid[i + 1][ny], bot_grid[i][ny], top_grid[i][ny], top_grid[i + 1][ny]],
                m_top,
            )
        for j in range(ny):
            self._safe_face(
                [bot_grid[0][j + 1], bot_grid[0][j], top_grid[0][j], top_grid[0][j + 1]],
                m_top,
            )
            self._safe_face(
                [bot_grid[nx][j], bot_grid[nx][j + 1], top_grid[nx][j + 1], top_grid[nx][j]],
                m_top,
            )

    def add_parabolic_arch(
        self, p0, p1, apex_z, radius=1.6, segs=18, mat="Terminal_White"
    ):
        """Construct a parabolic arch tubular rib from p0 to p1 peaking at apex_z."""
        v0 = Vector(p0)
        v1 = Vector(p1)
        pts = []
        for i in range(segs + 1):
            t = i / segs
            p = v0.lerp(v1, t)
            base_z = v0.z * (1.0 - t) + v1.z * t
            p.z = base_z + (apex_z - base_z) * 4.0 * t * (1.0 - t)
            pts.append(p)
        for i in range(segs):
            self.add_tube(pts[i], pts[i + 1], radius=radius, segs=8, mat=mat)

    def add_curved_concourse_arc(
        self,
        center_xy,
        radius,
        angle_start,
        angle_end,
        width,
        height,
        segs=20,
        roof_mat="Terminal_Metal",
        wall_mat="Terminal_White",
        glass_mat="Terminal_Glass_Emissive",
    ):
        """Build a sweeping curved concourse ring segment with glowing curtain walls."""
        cx, cy = center_xy
        r_in = max(2.0, radius - width * 0.5)
        r_out = radius + width * 0.5
        for i in range(segs):
            a0 = angle_start + (angle_end - angle_start) * (i / segs)
            a1 = angle_start + (angle_end - angle_start) * ((i + 1) / segs)
            p_in0 = (cx + math.cos(a0) * r_in, cy + math.sin(a0) * r_in)
            p_out0 = (cx + math.cos(a0) * r_out, cy + math.sin(a0) * r_out)
            p_out1 = (cx + math.cos(a1) * r_out, cy + math.sin(a1) * r_out)
            p_in1 = (cx + math.cos(a1) * r_in, cy + math.sin(a1) * r_in)
            quad = [p_in0, p_out0, p_out1, p_in1]
            # Base plinth
            self.add_prism(quad, 0.0, height * 0.22, mat=wall_mat)
            # Glowing glazing band
            self.add_prism(quad, height * 0.22, height * 0.84, mat=glass_mat)
            # Overhanging roof cap
            r_in_r = max(1.5, r_in - 2.2)
            r_out_r = r_out + 2.2
            r_quad = [
                (cx + math.cos(a0) * r_in_r, cy + math.sin(a0) * r_in_r),
                (cx + math.cos(a0) * r_out_r, cy + math.sin(a0) * r_out_r),
                (cx + math.cos(a1) * r_out_r, cy + math.sin(a1) * r_out_r),
                (cx + math.cos(a1) * r_in_r, cy + math.sin(a1) * r_in_r),
            ]
            self.add_prism(r_quad, height * 0.84, height, mat=roof_mat)

    def add_pier(
        self,
        p0_xy,
        p1_xy,
        width=24.0,
        height=13.0,
        roof_mat="Terminal_Metal",
        wall_mat="Terminal_White",
        glass_mat="Terminal_Glass_Emissive",
        rotunda_end=False,
    ):
        """Add an oriented concourse finger pier between two 2D points."""
        v0 = Vector((p0_xy[0], p0_xy[1], 0.0))
        v1 = Vector((p1_xy[0], p1_xy[1], 0.0))
        diff = v1 - v0
        length = diff.length
        if length < 1.0:
            return
        mid = (v0 + v1) * 0.5
        ang = math.atan2(diff.y, diff.x)
        # Base
        self.add_box((mid.x, mid.y, height * 0.14), (length, width, height * 0.28), mat=wall_mat, rot_euler=(0, 0, ang))
        # Glass mid-section
        self.add_box((mid.x, mid.y, height * 0.54), (length * 0.98, width * 0.94, height * 0.54), mat=glass_mat, rot_euler=(0, 0, ang))
        # Roof overhang
        self.add_box((mid.x, mid.y, height * 0.92), (length + 3.0, width + 3.4, height * 0.20), mat=roof_mat, rot_euler=(0, 0, ang))
        if rotunda_end:
            r = width * 0.72
            self.add_cylinder((v1.x, v1.y, height * 0.14), r, r, height * 0.28, segs=14, mat=wall_mat)
            self.add_cylinder((v1.x, v1.y, height * 0.54), r * 0.96, r * 0.96, height * 0.54, segs=14, mat=glass_mat)
            self.add_cylinder((v1.x, v1.y, height * 0.92), r * 1.12, r * 1.04, height * 0.22, segs=14, mat=roof_mat)

    def add_fighter_shelter(self, center_xy, rot_z=0.0, scale=1.0):
        """Hardened Concrete Aircraft Shelter (HAS) for dual-use civil/military bases."""
        cx, cy = center_xy
        w = 24.0 * scale
        d = 32.0 * scale
        h = 10.5 * scale
        segs = 10
        cos_r = math.cos(rot_z)
        sin_r = math.sin(rot_z)

        def xform(lx, ly, lz):
            return (cx + lx * cos_r - ly * sin_r, cy + lx * sin_r + ly * cos_r, lz)

        m_shell = self.mat_idx("Concrete_Apron")
        m_door = self.mat_idx("Accent_Charcoal")
        front_ring = []
        back_ring = []
        for i in range(segs + 1):
            ang = math.pi * (i / segs)
            lx = math.cos(ang) * (w * 0.5)
            lz = math.sin(ang) * h
            front_ring.append(self.bm.verts.new(xform(lx, -d * 0.5, lz)))
            back_ring.append(self.bm.verts.new(xform(lx, d * 0.5, lz)))
        for i in range(segs):
            self._safe_face([front_ring[i], front_ring[i + 1], back_ring[i + 1], back_ring[i]], m_shell)
        self._safe_face(front_ring, m_door)
        self._safe_face(list(reversed(back_ring)), m_shell)

    def add_toroidal_dome(
        self,
        center_xy,
        rx=75.0,
        ry=60.0,
        z_base=0.0,
        height=38.0,
        oculus_r=14.0,
        segs_u=28,
        segs_v=10,
        mat_shell="Terminal_Glass_Emissive",
        mat_ribs="Terminal_Metal",
        mat_vortex="Glass_Cyan_Emissive",
    ):
        """Jewel Changi toroidal glass gridshell dome with central Rain Vortex funnel."""
        cx, cy = center_xy
        m_shell = self.mat_idx(mat_shell)
        rings = []
        for iv in range(segs_v + 1):
            t = iv / segs_v  # 0 = outer rim, 1 = inner oculus funnel bottom
            if t < 0.72:
                # Outer dome curve rising from z_base to peak, then dipping to oculus lip
                s = t / 0.72
                rad_scale = 1.0 - s * (1.0 - oculus_r / rx)
                z = z_base + height * math.sin(s * math.pi * 0.85) + 4.0 * s
            else:
                # Funnel dipping down into central Rain Vortex
                s = (t - 0.72) / 0.28
                rad_scale = (oculus_r / rx) * (1.0 - 0.58 * s)
                z = z_base + height * (0.62 - 0.35 * s)
            ring = []
            for iu in range(segs_u):
                ang = (2.0 * math.pi * iu) / segs_u
                x = cx + math.cos(ang) * rx * rad_scale
                y = cy + math.sin(ang) * ry * rad_scale
                ring.append(self.bm.verts.new((x, y, z)))
            rings.append(ring)

        for iv in range(segs_v):
            for iu in range(segs_u):
                iu2 = (iu + 1) % segs_u
                self._safe_face(
                    [rings[iv][iu], rings[iv][iu2], rings[iv + 1][iu2], rings[iv + 1][iu]],
                    m_shell,
                )

        # Structural diagrid meridian ribs
        for iu in range(0, segs_u, 2):
            ang = (2.0 * math.pi * iu) / segs_u
            p_out = (cx + math.cos(ang) * rx, cy + math.sin(ang) * ry, z_base + 1.0)
            p_mid = (cx + math.cos(ang) * rx * 0.58, cy + math.sin(ang) * ry * 0.58, z_base + height * 1.01)
            p_in = (cx + math.cos(ang) * oculus_r, cy + math.sin(ang) * oculus_r * (ry / rx), z_base + height * 0.65)
            self.add_tube(p_out, p_mid, radius=0.9, segs=6, mat=mat_ribs)
            self.add_tube(p_mid, p_in, radius=0.8, segs=6, mat=mat_ribs)

        # Glowing central Rain Vortex waterfall column
        self.add_cylinder((cx, cy, z_base + height * 0.36), 3.6, 5.2, height * 0.72, segs=16, mat=mat_vortex)
        self.add_cylinder((cx, cy, z_base + 1.0), 12.0, 12.0, 2.0, segs=20, mat=mat_vortex)

    def to_object(self, name, parent, materials_dict):
        """Finalize BMesh into a Blender Object with outward normals and clean materials."""
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()

        for mat_name in self.mat_order:
            mat = materials_dict.get(mat_name) or materials_dict["Terminal_White"]
            mesh.materials.append(mat)

        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if parent is not None:
            obj.parent = parent
        return obj


# =============================================================================
# 4. REUSABLE APRON, JETWAY & ICONIC CONTROL TOWER LIBRARIES
# =============================================================================

def build_apron(width=340.0, depth=220.0, offset_y=-40.0, deck_mat="Concrete_Apron", stripe_count=8):
    """Build concrete apron deck with yellow taxi lead-in lines and red safety zones."""
    bm = MeshBuilder()
    bm.add_box((0.0, offset_y, -0.35), (width, depth, 0.70), mat=deck_mat)
    # Main parallel taxilane yellow line
    taxi_y = offset_y - depth * 0.28
    bm.add_box((0.0, taxi_y, 0.04), (width * 0.92, 1.4, 0.08), mat="Accent_Yellow")
    # Lead-in stand stripes and red equipment boxes
    span = width * 0.78
    for i in range(stripe_count):
        t = (i / max(1, stripe_count - 1)) - 0.5
        x = t * span
        bm.add_box((x, taxi_y + 24.0, 0.04), (0.9, 46.0, 0.08), mat="Accent_Yellow")
        bm.add_box((x, taxi_y + 42.0, 0.04), (10.0, 1.0, 0.08), mat="Accent_Red")
    return bm


def build_jetway_object(name, parent, materials_dict, base_xyz, angle_rad, length=32.0, style="standard", accent_mat="Jetway_Steel"):
    """Create a single articulated passenger boarding bridge (Jetway_01..Jetway_08)."""
    bm = MeshBuilder()
    bx, by, bz = base_xyz
    dx = math.cos(angle_rad)
    dy = math.sin(angle_rad)

    if style == "carrier_station":
        # Naval deck-edge elevator / EMALS jet blast deflector / brow gangway
        bm.add_box((bx, by, bz), (18.0, 14.0, 1.6), mat="Naval_Haze_Gray", rot_euler=(0, 0, angle_rad))
        bm.add_box((bx, by, bz + 0.9), (16.0, 12.0, 0.3), mat="Accent_Charcoal", rot_euler=(0, 0, angle_rad))
        bm.add_box((bx + dx * 6.0, by + dy * 6.0, bz + 1.4), (1.2, 12.0, 1.0), mat="Accent_Yellow", rot_euler=(0, 0, angle_rad))
        return bm.to_object(name, parent, materials_dict)

    if style == "stol_canopy":
        # Compact island walk-on rain canopy & boarding stairs
        mid_x = bx + dx * (length * 0.5)
        mid_y = by + dy * (length * 0.5)
        bm.add_box((mid_x, mid_y, bz + 3.4), (length, 3.6, 0.45), mat=accent_mat, rot_euler=(0, 0, angle_rad))
        for f in (0.15, 0.5, 0.85):
            px = bx + dx * (length * f)
            py = by + dy * (length * f)
            bm.add_cylinder((px, py, bz + 1.6), 0.25, 0.25, 3.2, segs=6, mat="Terminal_White")
        return bm.to_object(name, parent, materials_dict)

    # Standard / widebody articulated glass-and-steel boarding bridge
    deck_z = bz + 5.4
    # Terminal-side rotunda pillar
    bm.add_cylinder((bx, by, bz + 3.5), 2.3, 2.3, 7.0, segs=12, mat="Terminal_White")
    bm.add_cylinder((bx, by, bz + 6.9), 2.5, 2.5, 0.6, segs=12, mat=accent_mat)

    # Telescopic bridge body (two stepped segments)
    seg1_len = length * 0.55
    seg2_len = length * 0.45
    m1_x = bx + dx * (seg1_len * 0.5)
    m1_y = by + dy * (seg1_len * 0.5)
    bm.add_box((m1_x, m1_y, deck_z), (seg1_len, 3.4, 3.2), mat=accent_mat, rot_euler=(0, 0, angle_rad))
    bm.add_box((m1_x, m1_y, deck_z + 0.15), (seg1_len * 0.90, 3.55, 1.45), mat="Terminal_Glass_Emissive", rot_euler=(0, 0, angle_rad))

    m2_x = bx + dx * (seg1_len + seg2_len * 0.48)
    m2_y = by + dy * (seg1_len + seg2_len * 0.48)
    bm.add_box((m2_x, m2_y, deck_z), (seg2_len, 2.9, 2.8), mat="Jetway_Steel", rot_euler=(0, 0, angle_rad))
    bm.add_box((m2_x, m2_y, deck_z + 0.1), (seg2_len * 0.88, 3.05, 1.25), mat="Terminal_Glass_Emissive", rot_euler=(0, 0, angle_rad))

    # Support drive-column bogie near aircraft end
    leg_x = bx + dx * (length * 0.84)
    leg_y = by + dy * (length * 0.84)
    bm.add_cylinder((leg_x, leg_y, bz + 2.4), 0.55, 0.65, 4.8, segs=8, mat="Accent_Charcoal")
    bm.add_box((leg_x, leg_y, bz + 0.55), (2.4, 3.8, 1.1), mat="Accent_Charcoal", rot_euler=(0, 0, angle_rad))

    # Aircraft docking cab / accordion canopy
    cab_x = bx + dx * (length + 1.5)
    cab_y = by + dy * (length + 1.5)
    bm.add_cylinder((cab_x, cab_y, deck_z), 2.1, 2.1, 3.1, segs=10, mat="Accent_Charcoal")

    return bm.to_object(name, parent, materials_dict)


def make_linear_jetways(x_min, x_max, y_base, angle_rad=-math.pi * 0.5, length=32.0, count=8, style="standard", accent_mat="Jetway_Steel"):
    """Generate evenly spaced jetway specs along a linear concourse face."""
    specs = []
    for i in range(count):
        t = i / max(1, count - 1)
        x = x_min + (x_max - x_min) * t
        specs.append(((x, y_base, 0.0), angle_rad, length, style, accent_mat))
    return specs


def make_radial_jetways(center_xy, radius, a_start, a_end, length=30.0, count=8, style="standard", accent_mat="Jetway_Steel"):
    """Generate jetway specs fanning radially around a circular/arc concourse."""
    cx, cy = center_xy
    specs = []
    for i in range(count):
        t = i / max(1, count - 1)
        ang = a_start + (a_end - a_start) * t
        bx = cx + math.cos(ang) * radius
        by = cy + math.sin(ang) * radius
        specs.append(((bx, by, 0.0), ang, length, style, accent_mat))
    return specs


# --- Iconic Control Tower Generators ---

def build_tower_classic(
    pos_xy,
    height=52.0,
    shaft_r=4.2,
    cab_r=7.5,
    segs=8,
    shaft_mat="Terminal_White",
    band_mat="Accent_Red",
    striped_bands=0,
    dual_cab=False,
    radome=True,
):
    """Versatile octagonal/cylindrical ATCT with optional aviation bands & dual cabs."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    # Base plinth building
    bm.add_box((tx, ty, 3.5), (shaft_r * 3.2, shaft_r * 2.8, 7.0), mat=shaft_mat)

    shaft_top = height - (12.0 if dual_cab else 8.5)
    if striped_bands > 0:
        band_h = (shaft_top - 7.0) / striped_bands
        for i in range(striped_bands):
            z_mid = 7.0 + band_h * (i + 0.5)
            mat = band_mat if (i % 2 == 1) else shaft_mat
            r1 = shaft_r * (1.0 - 0.14 * (i / striped_bands))
            r2 = shaft_r * (1.0 - 0.14 * ((i + 1) / striped_bands))
            bm.add_cylinder((tx, ty, z_mid), r1, r2, band_h, segs=segs, mat=mat)
    else:
        bm.add_cylinder((tx, ty, 7.0 + (shaft_top - 7.0) * 0.5), shaft_r, shaft_r * 0.85, shaft_top - 7.0, segs=segs, mat=shaft_mat)
        # Upper accent collar
        bm.add_cylinder((tx, ty, shaft_top - 1.5), shaft_r * 0.90, shaft_r * 1.15, 3.0, segs=segs, mat=band_mat)

    if dual_cab:
        # Lower apron control deck
        bm.add_cylinder((tx, ty, shaft_top + 1.4), shaft_r * 0.95, cab_r * 0.86, 2.2, segs=segs, mat=shaft_mat)
        bm.add_cylinder((tx, ty, shaft_top + 3.6), cab_r * 0.84, cab_r * 0.92, 2.4, segs=segs, mat="Terminal_Glass_Emissive")
        bm.add_cylinder((tx, ty, shaft_top + 5.2), cab_r * 0.95, shaft_r * 0.95, 1.2, segs=segs, mat=shaft_mat)
        cab_base = shaft_top + 6.0
    else:
        cab_base = shaft_top

    # Primary flared cab collar + glass + roof
    bm.add_cylinder((tx, ty, cab_base + 1.2), shaft_r * 0.95, cab_r * 0.95, 2.4, segs=segs, mat=shaft_mat)
    bm.add_cylinder((tx, ty, cab_base + 4.0), cab_r * 0.94, cab_r * 1.10, 3.4, segs=segs, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty, cab_base + 6.2), cab_r * 1.18, cab_r * 0.92, 1.4, segs=segs, mat="Terminal_Metal")

    top_z = cab_base + 6.9
    if radome:
        bm.add_sphere((tx, ty, top_z + 2.2), 2.4, segs=14, rings=8, mat="Terminal_White")
        top_z += 4.6
    bm.add_cylinder((tx, ty, top_z + 1.8), 0.25, 0.12, 3.6, segs=6, mat="Terminal_Metal")
    return bm, (tx, ty, top_z + 3.8)


def build_tower_changi_goblet(pos_xy, height=81.0):
    """WSSS iconic 81m double-tiered circular goblet ATCT."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    bm.add_cylinder((tx, ty, 3.5), 11.0, 9.0, 7.0, segs=20, mat="Terminal_White")
    bm.add_cylinder((tx, ty, 34.0), 4.6, 3.8, 56.0, segs=20, mat="Terminal_White")
    # Lower goblet bowl
    bm.add_cylinder((tx, ty, 64.5), 4.0, 12.2, 5.5, segs=24, mat="Terminal_White")
    bm.add_cylinder((tx, ty, 68.5), 11.8, 12.6, 2.8, segs=24, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty, 70.6), 13.0, 9.0, 1.6, segs=24, mat="Terminal_Metal")
    # Upper goblet crown
    bm.add_cylinder((tx, ty, 73.2), 7.5, 10.6, 3.6, segs=24, mat="Terminal_White")
    bm.add_cylinder((tx, ty, 76.6), 10.2, 11.2, 3.4, segs=24, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty, 79.2), 11.8, 8.5, 1.8, segs=24, mat="Terminal_Metal")
    bm.add_sphere((tx, ty, 81.8), 2.6, segs=14, rings=8, mat="Terminal_White")
    return bm, (tx, ty, 84.8)


def build_tower_heathrow_masts(pos_xy, height=87.0):
    """EGLL iconic 87m cylindrical tower with 3 bright yellow guy-masts & frustum cab."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    bm.add_cylinder((tx, ty, 3.0), 10.0, 9.0, 6.0, segs=16, mat="Terminal_White")
    bm.add_cylinder((tx, ty, 39.0), 3.4, 3.0, 68.0, segs=18, mat="Terminal_Metal")
    # 3 bright yellow guy-masts and tension cables
    for k in range(3):
        ang = math.radians(k * 120.0 + 30.0)
        mx = tx + math.cos(ang) * 14.0
        my = ty + math.sin(ang) * 14.0
        bm.add_cylinder((mx, my, 32.0), 1.0, 0.7, 64.0, segs=10, mat="Accent_Yellow")
        # Tension cables from mast to central shaft
        bm.add_tube((mx, my, 62.0), (tx + math.cos(ang) * 3.2, ty + math.sin(ang) * 3.2, 72.0), 0.35, 6, "Terminal_Metal")
        bm.add_tube((mx, my, 42.0), (tx + math.cos(ang) * 3.2, ty + math.sin(ang) * 3.2, 54.0), 0.30, 6, "Terminal_Metal")
        bm.add_tube((mx, my, 60.0), (tx + math.cos(ang) * 3.2, ty + math.sin(ang) * 3.2, 22.0), 0.30, 6, "Terminal_Metal")
    # Inverted frustum cone cab
    bm.add_cylinder((tx, ty, 76.0), 4.2, 10.5, 6.5, segs=16, mat="Terminal_Metal")
    bm.add_cylinder((tx, ty, 81.5), 10.0, 12.2, 4.8, segs=16, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty, 84.8), 12.8, 10.0, 1.8, segs=16, mat="Terminal_Metal")
    bm.add_cylinder((tx, ty, 87.2), 0.35, 0.15, 3.2, segs=6, mat="Accent_Yellow")
    return bm, (tx, ty, 89.0)


def build_tower_crescent_fins(pos_xy, height=87.0):
    """OMDB 87m dual white crescent-blade architectural fins hugging central shaft."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    bm.add_cylinder((tx, ty, 38.0), 4.8, 4.0, 76.0, segs=18, mat="Terminal_Metal")
    # Two curved crescent fins on opposite sides
    for side in (-1.0, 1.0):
        segs = 14
        for i in range(segs):
            t0 = i / segs
            t1 = (i + 1) / segs
            z0, z1 = t0 * (height - 4.0), t1 * (height - 4.0)
            off0 = side * (5.0 + 6.5 * math.sin(t0 * math.pi))
            off1 = side * (5.0 + 6.5 * math.sin(t1 * math.pi))
            bm.add_tube((tx + off0, ty, z0), (tx + off1, ty, z1), radius=1.8 * (1.0 - 0.3 * t0), segs=6, mat="Terminal_White")
    # Double-deck blue glass cab
    bm.add_cylinder((tx, ty, height - 10.5), 5.0, 9.8, 3.2, segs=16, mat="Terminal_White")
    bm.add_cylinder((tx, ty, height - 6.8), 9.4, 10.4, 4.2, segs=16, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty, height - 3.6), 10.8, 8.2, 2.2, segs=16, mat="Terminal_Metal")
    bm.add_sphere((tx, ty, height - 0.5), 2.5, segs=12, rings=8, mat="Terminal_White")
    return bm, (tx, ty, height + 2.4)


def build_tower_tulip_pininfarina(pos_xy, height=90.0):
    """LTFM Pininfarina 90m sculpted aerodynamic tulip blossom ATCT."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    # Sculpted curved organic double-stem flaring into tulip head
    segs = 14
    for i in range(segs):
        t0 = i / segs
        t1 = (i + 1) / segs
        z0 = t0 * (height - 14.0)
        z1 = t1 * (height - 14.0)
        r0 = 6.2 - 2.2 * math.sin(t0 * math.pi * 0.85) + 3.2 * (t0 ** 3)
        r1 = 6.2 - 2.2 * math.sin(t1 * math.pi * 0.85) + 3.2 * (t1 ** 3)
        bm.add_cylinder((tx, ty, (z0 + z1) * 0.5), r0, r1, (z1 - z0) + 0.1, segs=18, mat="Terminal_White")
    # Tulip blossom elliptical glass cab
    bm.add_sphere((tx, ty, height - 10.0), 10.2, segs=18, rings=10, mat="Terminal_White", scale=(1.25, 0.85, 0.72))
    bm.add_cylinder((tx, ty, height - 7.0), 9.6, 10.6, 4.5, segs=18, mat="Terminal_Glass_Emissive")
    bm.add_sphere((tx, ty, height - 3.4), 10.0, segs=18, rings=8, mat="Terminal_White", scale=(1.25, 0.85, 0.38))
    return bm, (tx, ty, height + 1.0)


def build_tower_sfo_torch(pos_xy, height=67.0):
    """KSFO 67m metallic spiralling Torch ATCT with vertical glass cascade."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    segs = 12
    for i in range(segs):
        t0 = i / segs
        t1 = (i + 1) / segs
        z0, z1 = t0 * (height - 10.0), t1 * (height - 10.0)
        r0 = 4.5 + 4.8 * (t0 ** 1.6)
        r1 = 4.5 + 4.8 * (t1 ** 1.6)
        bm.add_cylinder((tx, ty, (z0 + z1) * 0.5), r0, r1, (z1 - z0) + 0.1, segs=18, mat="Terminal_Metal")
    # Vertical glowing glass slot on the front
    bm.add_box((tx, ty - 5.8, (height - 10.0) * 0.5), (2.4, 2.2, height - 12.0), mat="Terminal_Glass_Emissive")
    # Sweeping cantilevered cab
    bm.add_cylinder((tx, ty - 1.5, height - 6.5), 9.2, 11.0, 4.6, segs=18, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty - 1.5, height - 3.2), 11.6, 8.8, 2.0, segs=18, mat="Terminal_Metal")
    return bm, (tx, ty - 1.5, height - 1.5)


def build_tower_braced_frame(pos_xy, height=106.0):
    """RJAA Narita 106m external dark-gray steel braced mega-frame ATCT."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    bm.add_cylinder((tx, ty, (height - 14.0) * 0.5), 4.6, 4.2, height - 14.0, segs=12, mat="Terminal_White")
    # 4 corner steel exo-columns with diagonal X-bracing
    off = 6.2
    corners = [(-off, -off), (off, -off), (off, off), (-off, off)]
    for cx, cy in corners:
        bm.add_cylinder((tx + cx, ty + cy, (height - 14.0) * 0.5), 0.85, 0.75, height - 14.0, segs=8, mat="Accent_Charcoal")
    tiers = 5
    tier_h = (height - 16.0) / tiers
    for t in range(tiers):
        z0 = t * tier_h
        z1 = (t + 1) * tier_h
        for k in range(4):
            c0 = corners[k]
            c1 = corners[(k + 1) % 4]
            bm.add_tube((tx + c0[0], ty + c0[1], z0), (tx + c1[0], ty + c1[1], z1), 0.42, 6, "Accent_Charcoal")
            bm.add_tube((tx + c1[0], ty + c1[1], z0), (tx + c0[0], ty + c0[1], z1), 0.42, 6, "Accent_Charcoal")
    # Two-tier flared octagonal glass cab + twin radomes
    bm.add_cylinder((tx, ty, height - 11.0), 7.5, 11.2, 4.0, segs=8, mat="Terminal_Metal")
    bm.add_cylinder((tx, ty, height - 6.8), 10.8, 12.2, 4.5, segs=8, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty, height - 3.6), 12.8, 10.5, 2.0, segs=8, mat="Terminal_Metal")
    bm.add_sphere((tx - 3.6, ty, height - 0.6), 2.3, segs=12, rings=8, mat="Terminal_White")
    bm.add_sphere((tx + 3.6, ty, height - 0.6), 2.3, segs=12, rings=8, mat="Terminal_White")
    return bm, (tx, ty, height + 2.4)


def build_tower_cable_mast(pos_xy, height=116.0):
    """RJTT Haneda 116m silver cylindrical mast with cable-stayed aerodynamic fin."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    bm.add_cylinder((tx, ty, 4.0), 9.5, 8.5, 8.0, segs=16, mat="Terminal_Metal")
    bm.add_cylinder((tx, ty, 52.0), 4.8, 4.0, 92.0, segs=20, mat="Terminal_Metal")
    # Side aerodynamic mast spine + cable stays
    bm.add_cylinder((tx + 6.5, ty, 58.0), 1.1, 0.65, 114.0, segs=10, mat="Terminal_White")
    for z in (30.0, 52.0, 74.0, 96.0):
        bm.add_tube((tx + 6.5, ty, z + 12.0), (tx + 3.8, ty, z), 0.30, 6, "Terminal_Metal")
    # Elevated panoramic dual cab
    bm.add_cylinder((tx, ty, 100.0), 4.8, 10.8, 4.5, segs=20, mat="Terminal_Metal")
    bm.add_cylinder((tx, ty, 104.5), 10.4, 11.6, 4.5, segs=20, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty, 107.8), 12.2, 9.0, 2.0, segs=20, mat="Terminal_Metal")
    bm.add_cylinder((tx, ty, 112.0), 0.4, 0.15, 7.5, segs=6, mat="Accent_Red")
    return bm, (tx, ty, 116.2)


def build_tower_minaret_torch(pos_xy, height=130.0):
    """WMKK 130m Olympic-torch / Islamic minaret-inspired flared spire ATCT."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    bm.add_cylinder((tx, ty, 5.0), 12.0, 9.0, 10.0, segs=16, mat="Terminal_White")
    bm.add_cylinder((tx, ty, 55.0), 6.2, 3.8, 92.0, segs=16, mat="Terminal_White")
    # Flared torch rings
    bm.add_cylinder((tx, ty, 102.0), 4.0, 10.8, 6.0, segs=16, mat="Terminal_White")
    bm.add_cylinder((tx, ty, 106.8), 10.2, 11.2, 3.6, segs=16, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty, 111.2), 11.6, 7.2, 4.5, segs=16, mat="Accent_Gold")
    bm.add_cylinder((tx, ty, 115.6), 7.4, 9.2, 3.8, segs=16, mat="Terminal_Glass_Emissive")
    # Minaret spire pinnacle
    bm.add_cylinder((tx, ty, 123.5), 6.2, 0.4, 13.0, segs=12, mat="Terminal_Metal")
    return bm, (tx, ty, 130.5)


def build_tower_sydney_spiral(pos_xy, height=48.0):
    """YSSY Ken Woolley 48m ATCT with exposed external spiral staircase & diagonal stays."""
    bm = MeshBuilder()
    tx, ty = pos_xy
    bm.add_cylinder((tx, ty, 20.0), 3.2, 2.8, 40.0, segs=16, mat="Terminal_White")
    # Exposed helical spiral staircase wrapping shaft
    turns = 3.0
    steps = 30
    prev = None
    for i in range(steps + 1):
        t = i / steps
        ang = t * turns * 2.0 * math.pi
        p = (tx + math.cos(ang) * 4.4, ty + math.sin(ang) * 4.4, 2.0 + t * 34.0)
        if prev is not None:
            bm.add_tube(prev, p, radius=0.95, segs=6, mat="Terminal_Metal")
        prev = p
    # Diagonal cable stays
    for k in range(3):
        ang = math.radians(k * 120.0)
        bm.add_tube((tx + math.cos(ang) * 10.0, ty + math.sin(ang) * 10.0, 0.0), (tx + math.cos(ang) * 3.0, ty + math.sin(ang) * 3.0, 36.0), 0.30, 6, "Terminal_Metal")
    # Offset futurist pod-and-disc cab
    bm.add_cylinder((tx + 2.0, ty, 40.5), 4.2, 8.8, 3.5, segs=16, mat="Terminal_White")
    bm.add_cylinder((tx + 2.0, ty, 44.0), 8.5, 9.5, 3.4, segs=16, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx + 2.0, ty, 46.5), 10.0, 7.2, 1.6, segs=16, mat="Terminal_Metal")
    return bm, (tx + 2.0, ty, 48.2)


def build_tower_special_sculpted(pos_xy, height=98.0, style="sail_fin"):
    """Sculpted specialty towers: RKSI sail_fin, ZSPD three_rib, VIDP twisted, VABB diagrid, HECA lotus, OTHH crescent_arch, KLAX sail, EHAM flared, RJBB twin_pillar."""
    bm = MeshBuilder()
    tx, ty = pos_xy

    if style == "twin_pillar":
        # RJBB Kansai 86m twin-pillar skybridge tower
        bm.add_cylinder((tx - 6.5, ty, (height - 12.0) * 0.5), 3.0, 2.6, height - 12.0, segs=12, mat="Terminal_Metal")
        bm.add_cylinder((tx + 6.5, ty, (height - 12.0) * 0.5), 3.0, 2.6, height - 12.0, segs=12, mat="Terminal_Metal")
        for z in (22.0, 44.0, 64.0):
            bm.add_box((tx, ty, z), (13.0, 3.6, 2.6), mat="Terminal_White")
        bm.add_cylinder((tx, ty, height - 9.0), 9.5, 10.8, 4.4, segs=20, mat="Terminal_Glass_Emissive")
        bm.add_cylinder((tx, ty, height - 5.8), 11.4, 8.5, 2.0, segs=20, mat="Terminal_Metal")
        return bm, (tx, ty, height - 4.0)

    if style == "crescent_arch":
        # OTHH Doha 85m sweeping parabolic crescent spine
        segs = 14
        prev = None
        for i in range(segs + 1):
            t = i / segs
            z = t * (height - 8.0)
            x_off = -12.0 * math.sin(t * math.pi * 0.85)
            p = (tx + x_off, ty, z)
            if prev is not None:
                bm.add_tube(prev, p, radius=3.4 - 0.8 * t, segs=10, mat="Terminal_White")
            prev = p
        bm.add_cylinder((tx - 4.0, ty, height - 7.5), 8.2, 9.6, 4.2, segs=6, mat="Terminal_Glass_Emissive")
        bm.add_cylinder((tx - 4.0, ty, height - 4.5), 10.2, 7.6, 1.8, segs=6, mat="Terminal_Metal")
        return bm, (tx - 4.0, ty, height - 2.6)

    if style == "three_rib":
        # ZSPD Pudong 102m 3 outward-flaring white ribs
        bm.add_cylinder((tx, ty, (height - 12.0) * 0.5), 3.8, 3.4, height - 12.0, segs=16, mat="Terminal_Metal")
        for k in range(3):
            ang = math.radians(k * 120.0)
            bm.add_tube(
                (tx + math.cos(ang) * 9.0, ty + math.sin(ang) * 9.0, 0.0),
                (tx + math.cos(ang) * 4.5, ty + math.sin(ang) * 4.5, height - 12.0),
                radius=1.5,
                segs=8,
                mat="Terminal_White",
            )
        bm.add_cylinder((tx, ty, height - 9.5), 7.5, 11.0, 4.2, segs=20, mat="Terminal_White")
        bm.add_cylinder((tx, ty, height - 5.5), 10.6, 11.6, 4.2, segs=20, mat="Terminal_Glass_Emissive")
        bm.add_cylinder((tx, ty, height - 2.4), 12.0, 9.0, 2.0, segs=20, mat="Terminal_Metal")
        return bm, (tx, ty, height)

    if style == "diagrid_lattice":
        # VABB Mumbai 85m hyperbolic paraboloid diagrid steel lattice exoskeleton
        bm.add_cylinder((tx, ty, (height - 12.0) * 0.5), 3.8, 3.6, height - 12.0, segs=14, mat="Terminal_White")
        for k in range(12):
            a0 = (2.0 * math.pi * k) / 12.0
            a1 = a0 + 0.9
            p0 = (tx + math.cos(a0) * 10.0, ty + math.sin(a0) * 10.0, 0.0)
            p1 = (tx + math.cos(a1) * 9.0, ty + math.sin(a1) * 9.0, height - 12.0)
            bm.add_tube(p0, p1, radius=0.45, segs=6, mat="Terminal_White")
            p2 = (tx + math.cos(a0 - 0.9) * 9.0, ty + math.sin(a0 - 0.9) * 9.0, height - 12.0)
            bm.add_tube(p0, p2, radius=0.45, segs=6, mat="Terminal_White")
        bm.add_cylinder((tx, ty, height - 8.5), 8.5, 10.4, 5.2, segs=16, mat="Terminal_Glass_Emissive")
        bm.add_cylinder((tx, ty, height - 5.0), 10.8, 7.6, 2.0, segs=16, mat="Terminal_Metal")
        return bm, (tx, ty, height - 3.0)

    if style == "twisted":
        # VIDP New Delhi 102m helical twisted tower
        tiers = 14
        th = (height - 12.0) / tiers
        for i in range(tiers):
            z = th * (i + 0.5)
            bm.add_box((tx, ty, z), (8.2, 6.2, th + 0.1), mat="Terminal_White", rot_euler=(0, 0, i * 0.12))
        bm.add_cylinder((tx, ty, height - 9.0), 7.2, 10.6, 3.6, segs=8, mat="Terminal_White")
        bm.add_cylinder((tx, ty, height - 5.4), 10.2, 11.4, 4.2, segs=8, mat="Terminal_Glass_Emissive")
        bm.add_cylinder((tx, ty, height - 2.4), 12.0, 8.8, 1.8, segs=8, mat="Terminal_Metal")
        return bm, (tx, ty, height)

    if style == "lotus":
        # HECA 112m / VVNB 95m fluted lotus-calyx column
        bm.add_cylinder((tx, ty, (height - 14.0) * 0.5), 5.6, 4.0, height - 14.0, segs=12, mat="Sandstone_Beige")
        for k in range(8):
            ang = (2.0 * math.pi * k) / 8.0
            bm.add_tube(
                (tx + math.cos(ang) * 4.4, ty + math.sin(ang) * 4.4, height - 24.0),
                (tx + math.cos(ang) * 9.8, ty + math.sin(ang) * 9.8, height - 9.0),
                radius=1.1,
                segs=6,
                mat="Terminal_White",
            )
        bm.add_cylinder((tx, ty, height - 7.5), 9.6, 11.0, 4.5, segs=12, mat="Terminal_Glass_Emissive")
        bm.add_cylinder((tx, ty, height - 4.2), 11.6, 8.5, 2.0, segs=12, mat="Accent_Gold")
        return bm, (tx, ty, height - 2.2)

    if style == "flared_schiphol":
        # EHAM 101m charcoal-grey & sky-blue dramatic flared cab
        bm.add_cylinder((tx, ty, 32.0), 5.4, 4.2, 64.0, segs=16, mat="Accent_Charcoal")
        bm.add_cylinder((tx, ty, 74.0), 4.2, 8.5, 20.0, segs=16, mat="Accent_Blue")
        bm.add_cylinder((tx, ty, 88.0), 8.5, 13.0, 8.0, segs=8, mat="Terminal_Metal")
        bm.add_cylinder((tx, ty, 94.5), 12.6, 14.2, 5.2, segs=8, mat="Terminal_Glass_Emissive")
        bm.add_cylinder((tx, ty, 98.2), 14.8, 11.0, 2.2, segs=8, mat="Terminal_Metal")
        return bm, (tx, ty, 101.2)

    if style == "lax_sail":
        # KLAX 84m sail-curved metallic + terracotta concrete shaft + sunvisor cab
        bm.add_box((tx, ty, 35.0), (14.0, 7.5, 70.0), mat="Terminal_Metal")
        bm.add_box((tx - 5.5, ty, 35.0), (3.5, 8.2, 70.0), mat="Terracotta_Tile")
        bm.add_cylinder((tx, ty - 1.0, 73.5), 7.5, 11.5, 5.0, segs=14, mat="Terminal_White")
        bm.add_cylinder((tx, ty - 1.0, 78.2), 11.0, 12.2, 4.6, segs=14, mat="Terminal_Glass_Emissive")
        bm.add_cylinder((tx, ty - 1.0, 81.8), 14.2, 11.0, 2.2, segs=14, mat="Terminal_Metal")
        return bm, (tx, ty - 1.0, 84.5)

    # Default: RKSI sail-finned aerodynamic elliptical tower
    bm.add_cylinder((tx, ty, (height - 14.0) * 0.5), 6.2, 4.4, height - 14.0, segs=16, mat="Terminal_White")
    # Sweeping vertical sail fins
    bm.add_box((tx - 6.0, ty, (height - 16.0) * 0.5), (1.8, 9.5, height - 18.0), mat="Terminal_Metal")
    bm.add_box((tx + 6.0, ty, (height - 16.0) * 0.5), (1.8, 9.5, height - 18.0), mat="Terminal_Metal")
    bm.add_cylinder((tx, ty, height - 10.5), 6.5, 11.0, 4.0, segs=16, mat="Terminal_White")
    bm.add_cylinder((tx, ty, height - 6.2), 10.6, 11.8, 4.8, segs=16, mat="Terminal_Glass_Emissive")
    bm.add_cylinder((tx, ty, height - 2.8), 12.4, 9.0, 2.0, segs=16, mat="Terminal_Metal")
    return bm, (tx, ty, height)


# =============================================================================
# 5. BESPOKE ARCHITECTURAL AIRPORT BUILDERS (ALL 62 AIRPORTS)
# =============================================================================

# --- TAIWAN & CARRIER (11) ---

def build_RCTP(spec):
    """RCTP Taiwan Taoyuan: Saarinen catenary wing eaves T1 + T2 space-frame + T3 wave canopy + 65m red/white dual-cab ATCT."""
    t = MeshBuilder()
    # Terminal 1 (Center): Saarinen sweeping catenary roof with dramatic upward-curving wing eaves
    t.add_box((0.0, 18.0, 4.0), (140.0, 56.0, 8.0), mat="Terminal_White")
    t.add_box((0.0, 18.0, 11.0), (136.0, 52.0, 6.5), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-82.0, 82.0), (-16.0, 52.0), 20, 12,
        lambda u, v: 15.5 + 9.5 * ((v - 0.5) * 2.0) ** 2 + 3.2 * math.cos((u - 0.5) * math.pi),
        thickness=1.8, mat_top="Terminal_White", mat_bottom="Accent_Gold",
    )
    # Bronze diagonal cable-truss skylight wings on T1
    for x in (-64.0, -32.0, 0.0, 32.0, 64.0):
        t.add_tube((x, -12.0, 0.0), (x, -15.0, 24.5), 0.75, 6, "Accent_Gold")
        t.add_tube((x, 48.0, 0.0), (x, 51.0, 24.5), 0.75, 6, "Accent_Gold")

    # Terminal 2 (East): Exposed tubular steel space-frame H-layout concourses
    t.add_box((155.0, 18.0, 8.5), (110.0, 64.0, 17.0), mat="Terminal_Glass_Emissive")
    t.add_box((155.0, 18.0, 18.0), (118.0, 70.0, 2.2), mat="Terminal_Metal")
    t.add_pier((110.0, 0.0), (110.0, -52.0), width=22.0, height=13.0, roof_mat="Terminal_Metal")
    t.add_pier((195.0, 0.0), (195.0, -52.0), width=22.0, height=13.0, roof_mat="Terminal_Metal")

    # Terminal 3 (West): Undulating double-curved wave roof canopy + 4 banyan mega-columns + golden wave ceiling
    t.add_box((-155.0, 18.0, 7.5), (116.0, 66.0, 15.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-220.0, -90.0), (-20.0, 56.0), 20, 10,
        lambda u, v: 18.0 + 4.5 * math.sin(u * math.pi * 3.0) * math.cos((v - 0.5) * math.pi),
        thickness=2.0, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )
    for mx in (-195.0, -168.0, -142.0, -115.0):
        t.add_cylinder((mx, 18.0, 9.0), 3.2, 5.8, 18.0, segs=10, mat="Accent_Gold")

    # PMS Skytrain elevated guideway linking T1–T2–T3
    t.add_box((0.0, 58.0, 9.5), (360.0, 5.5, 2.2), mat="Terminal_Metal")

    tower, beacon = build_tower_classic(
        (78.0, -26.0), height=65.0, shaft_r=4.8, cab_r=8.2, segs=16,
        shaft_mat="Terminal_White", band_mat="Accent_Red", striped_bands=6, dual_cab=True, radome=True,
    )
    apron = build_apron(width=480.0, depth=240.0, offset_y=-65.0)
    jetways = make_linear_jetways(-190.0, 190.0, -16.0, -math.pi * 0.5, length=34.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RCSS(spec):
    """RCSS Taipei Songshan: Orange/silver stepped T1/T2 roofline + cantilevered canopy + 42m green-glass octagonal ATCT."""
    t = MeshBuilder()
    # Stepped T1 & T2 linear complex (320m)
    t.add_box((0.0, 15.0, 4.5), (300.0, 52.0, 9.0), mat="Terminal_White")
    t.add_box((0.0, 15.0, 11.5), (296.0, 48.0, 6.0), mat="Terminal_Glass_Emissive")
    # Signature metallic silver and warm orange-accented stepped horizontal roofline
    t.add_box((0.0, 15.0, 15.6), (312.0, 58.0, 2.2), mat="Terminal_Metal")
    t.add_box((0.0, 15.0, 17.4), (316.0, 60.0, 1.4), mat="Accent_Orange")
    t.add_box((0.0, 18.0, 19.8), (190.0, 40.0, 3.4), mat="Terminal_Metal")
    t.add_box((0.0, 18.0, 21.8), (194.0, 42.0, 1.0), mat="Accent_Orange")
    # Deep cantilevered landside drop-off canopy
    t.add_box((0.0, 49.0, 8.0), (240.0, 16.0, 1.4), mat="Terminal_Metal")
    for x in range(-110, 115, 22):
        t.add_cylinder((float(x), 54.0, 4.0), 0.7, 0.7, 8.0, segs=8, mat="Terminal_White")
    # East-side ROCAF Songshan VIP arched steel hangar
    t.add_fighter_shelter((190.0, 12.0), rot_z=0.0, scale=1.45)

    tower, beacon = build_tower_classic(
        (25.0, 44.0), height=42.0, shaft_r=4.2, cab_r=7.2, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Orange", striped_bands=0, dual_cab=False, radome=True,
    )
    apron = build_apron(width=380.0, depth=200.0, offset_y=-55.0)
    jetways = make_linear_jetways(-125.0, 125.0, -11.0, -math.pi * 0.5, length=30.0, count=8, accent_mat="Accent_Orange")
    return t, tower, beacon, apron, jetways


def build_RCKH(spec):
    """RCKH Kaohsiung: 400m linear East-West terminal + central elevated pyramidal glass skylight atrium + 48m octagonal ATCT."""
    t = MeshBuilder()
    # West (Domestic) & East (International) wings linked by elevated glass skywalk
    t.add_box((-110.0, 16.0, 7.0), (150.0, 46.0, 14.0), mat="Terminal_Metal")
    t.add_box((-110.0, 16.0, 7.5), (146.0, 47.5, 7.0), mat="Terminal_Glass_Emissive")
    t.add_box((110.0, 16.0, 7.5), (165.0, 50.0, 15.0), mat="Terminal_Metal")
    t.add_box((110.0, 16.0, 8.0), (160.0, 51.5, 7.5), mat="Terminal_Glass_Emissive")
    # Central elevated glass pedestrian skywalk & stepped pyramidal skylight atrium
    t.add_box((0.0, 16.0, 11.0), (80.0, 32.0, 10.0), mat="Terminal_Glass_Emissive")
    t.add_cylinder((0.0, 16.0, 22.0), 26.0, 4.0, 12.0, segs=4, mat="Terminal_Glass_Emissive", rot_euler=(0, 0, math.pi * 0.25))
    t.add_cylinder((0.0, 16.0, 16.2), 28.0, 26.0, 1.6, segs=4, mat="Terminal_Metal", rot_euler=(0, 0, math.pi * 0.25))

    tower, beacon = build_tower_classic(
        (-12.0, 52.0), height=48.0, shaft_r=4.4, cab_r=7.6, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Green", radome=True,
    )
    apron = build_apron(width=420.0, depth=210.0, offset_y=-55.0)
    jetways = make_linear_jetways(-165.0, 165.0, -9.0, -math.pi * 0.5, length=31.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RCMQ(spec):
    """RCMQ Taichung CCK: Asymmetric sweeping wave roof + inclined V-struts + hardened IDF fighter shelters."""
    t = MeshBuilder()
    t.add_box((0.0, 16.0, 5.0), (220.0, 48.0, 10.0), mat="Terminal_White")
    t.add_box((0.0, 16.0, 9.0), (216.0, 49.5, 7.5), mat="Terminal_Glass_Emissive")
    # Sweeping asymmetric silver-white soaring wing wave roof
    t.add_parametric_roof(
        (-122.0, 122.0), (-16.0, 48.0), 20, 10,
        lambda u, v: 15.0 + 7.5 * math.sin(u * math.pi) * (0.4 + 0.6 * v) + 3.5 * math.sin(u * math.pi * 2.0),
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    # Inclined V-shaped steel struts along airside facade
    for x in range(-100, 105, 25):
        t.add_tube((float(x), -10.0, 0.0), (float(x) - 5.0, -14.0, 16.0), 0.55, 6, "Terminal_Metal")
        t.add_tube((float(x), -10.0, 0.0), (float(x) + 5.0, -14.0, 16.0), 0.55, 6, "Terminal_Metal")
    # 6 Hardened Fighter Aircraft Shelters (ROCAF CCK IDF base)
    for i in range(6):
        sx = -175.0 - (i % 2) * 38.0
        sy = -10.0 - (i // 2) * 42.0
        t.add_fighter_shelter((sx, sy), rot_z=math.pi * 0.5, scale=1.0)

    tower, beacon = build_tower_classic(
        (138.0, 12.0), height=40.0, shaft_r=4.0, cab_r=7.0, segs=6,
        shaft_mat="Terminal_White", band_mat="Accent_Blue", radome=True,
    )
    apron = build_apron(width=440.0, depth=220.0, offset_y=-60.0)
    jetways = make_linear_jetways(-95.0, 95.0, -9.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RCBS(spec):
    """RCBS Kinmen: Traditional Minnan red-brick swallowtail curved roof ridges atop modern glass terminal."""
    t = MeshBuilder()
    t.add_box((0.0, 16.0, 4.5), (195.0, 42.0, 9.0), mat="Terracotta_Tile")
    t.add_box((0.0, 16.0, 8.0), (190.0, 43.5, 7.2), mat="Terminal_Glass_Emissive")
    # Three interlocking Minnan "Swallowtail" (燕尾脊) upward-curving red-brick roofs
    for cx, span, h_base in ((-62.0, 56.0, 13.0), (0.0, 74.0, 15.5), (62.0, 56.0, 13.0)):
        t.add_parametric_roof(
            (cx - span * 0.5, cx + span * 0.5), (-10.0, 42.0), 16, 10,
            lambda u, v, hb=h_base: hb
            + 5.5 * (1.0 - abs(v - 0.5) * 2.0)
            + 4.8 * ((u - 0.5) * 2.0) ** 4,
            thickness=1.2, mat_top="Terracotta_Tile", mat_bottom="Accent_Gold",
        )
        # Sculpted swallowtail ridge beam
        t.add_tube((cx - span * 0.52, 16.0, h_base + 10.6), (cx, 16.0, h_base + 5.8), 0.75, 6, "Accent_Red")
        t.add_tube((cx, 16.0, h_base + 5.8), (cx + span * 0.52, 16.0, h_base + 10.6), 0.75, 6, "Accent_Red")

    tower, beacon = build_tower_classic(
        (118.0, 22.0), height=34.0, shaft_r=3.6, cab_r=6.4, segs=8,
        shaft_mat="Terminal_White", band_mat="Terracotta_Tile", radome=True,
    )
    apron = build_apron(width=300.0, depth=180.0, offset_y=-50.0)
    jetways = make_linear_jetways(-80.0, 80.0, -6.0, -math.pi * 0.5, length=26.0, count=8, accent_mat="Terracotta_Tile")
    return t, tower, beacon, apron, jetways


def build_RCLY(spec):
    """RCLY Lanyu (Orchid Island): Tao plank-boat (Tatala) upturned prow gables in red/white/black geometric motif."""
    t = MeshBuilder()
    # Compact 68m indigenous cultural terminal
    t.add_box((0.0, 12.0, 4.2), (66.0, 24.0, 8.4), mat="Terminal_White")
    t.add_box((0.0, 12.0, 4.8), (62.0, 25.2, 5.2), mat="Terminal_Glass_Emissive")
    # Tao plank-boat upturned prow roof silhouette
    t.add_parametric_roof(
        (-40.0, 40.0), (-4.0, 28.0), 20, 8,
        lambda u, v: 9.2
        + 3.0 * (1.0 - abs(v - 0.5) * 2.0)
        + 7.2 * ((u - 0.5) * 2.0) ** 4,
        thickness=1.1, mat_top="Terminal_White", mat_bottom="Accent_Charcoal",
    )
    # Bold red, white, and charcoal geometric motif bands along both boat prows
    for side in (-1.0, 1.0):
        t.add_tube((side * 28.0, 12.0, 11.5), (side * 42.0, 12.0, 20.5), 1.0, 6, "Accent_Red")
        t.add_box((side * 34.0, 12.0, 10.0), (5.0, 22.0, 1.2), mat="Accent_Charcoal")
        t.add_box((side * 22.0, 12.0, 9.2), (6.0, 25.0, 0.9), mat="Accent_Red")
    t.add_box((0.0, 12.0, 9.2), (18.0, 25.6, 1.0), mat="Accent_Red")
    t.add_box((0.0, 12.0, 8.2), (18.0, 25.6, 0.8), mat="Accent_Charcoal")

    tower, beacon = build_tower_classic(
        (42.0, 16.0), height=20.0, shaft_r=2.8, cab_r=4.8, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Red", striped_bands=4, radome=False,
    )
    apron = build_apron(width=170.0, depth=130.0, offset_y=-35.0, stripe_count=4)
    jetways = make_linear_jetways(-42.0, 42.0, -2.0, -math.pi * 0.5, length=12.0, count=8, style="stol_canopy", accent_mat="Accent_Red")
    return t, tower, beacon, apron, jetways


def build_CVN78(spec):
    """CVN78 USS Gerald R. Ford Supercarrier: 333m x 78m hull, 9-deg angled deck, 4 EMALS tracks, 3 AAG wires, stealth aft-starboard Island."""
    t = MeshBuilder()
    # Lower hull (waterline 41m beam -> flared hangar deck)
    hull_pts = [
        (-162.0, -14.0), (-110.0, -20.5), (120.0, -20.5), (160.0, -16.0),
        (160.0, 16.0), (120.0, 20.5), (-110.0, 20.5), (-162.0, 14.0),
    ]
    t.add_prism(hull_pts, -18.0, -3.0, mat="Naval_Haze_Gray")
    # Sponson / upper hull flare
    sponson_pts = [
        (-166.5, -20.0), (-90.0, -30.0), (110.0, -36.0), (164.0, -28.0),
        (164.0, 32.0), (95.0, 39.0), (-70.0, 39.0), (-166.5, 24.0),
    ]
    t.add_prism(sponson_pts, -3.0, -0.4, mat="Naval_Haze_Gray")

    # 333m x 78m Flight Deck surface at Z = 0.0 (runway datum)
    deck_main = [
        (-166.5, -22.0), (166.5, -22.0), (166.5, 22.0), (-166.5, 22.0),
    ]
    t.add_prism(deck_main, -0.6, 0.0, mat="Accent_Charcoal")
    # Port-side 9-degree angled recovery deck overhang
    ang_rad = math.radians(9.0)
    t.add_box((22.0, 12.0, -0.3), (235.0, 34.0, 0.6), mat="Accent_Charcoal", rot_euler=(0, 0, ang_rad))
    # Starboard waist extension
    t.add_box((10.0, -26.0, -0.3), (220.0, 16.0, 0.6), mat="Accent_Charcoal")

    # White/Yellow foul lines & centerline along angled recovery runway
    t.add_box((22.0, 12.0, 0.05), (228.0, 1.0, 0.08), mat="Terminal_White", rot_euler=(0, 0, ang_rad))
    t.add_box((22.0, 26.5, 0.05), (222.0, 0.7, 0.08), mat="Accent_Yellow", rot_euler=(0, 0, ang_rad))
    t.add_box((22.0, -2.5, 0.05), (222.0, 0.7, 0.08), mat="Accent_Yellow", rot_euler=(0, 0, ang_rad))

    # 4 EMALS Catapult Tracks (2 bow + 2 waist) with Jet Blast Deflectors (JBDs)
    for cx, cy, clen, rot in (
        (-102.0, -8.0, 92.0, 0.0),
        (-102.0, 6.0, 92.0, 0.0),
        (-28.0, 18.0, 88.0, ang_rad),
        (-20.0, 27.0, 82.0, ang_rad),
    ):
        t.add_box((cx, cy, 0.05), (clen, 0.65, 0.08), mat="Terminal_Metal", rot_euler=(0, 0, rot))
        # Pop-up JBD panel at aft end of each catapult
        t.add_box((cx + clen * 0.48, cy, 0.8), (2.2, 7.5, 1.4), mat="Accent_Yellow", rot_euler=(0, -0.45, rot))

    # 3 AAG (Advanced Arresting Gear) cross-deck pendant wires
    for wx in (88.0, 102.0, 116.0):
        t.add_box((wx, 18.0, 0.06), (0.35, 28.0, 0.08), mat="Accent_Red", rot_euler=(0, 0, ang_rad))

    # Port-side IFLOLS Optical Landing System ("Meatball") light box
    t.add_box((55.0, 35.5, 2.2), (3.5, 4.0, 2.6), mat="Glass_Cyan_Emissive")

    # Stealth Aft-Starboard Island Superstructure (Control_Tower)
    tw = MeshBuilder()
    ix, iy = 86.0, -29.0
    tw.add_box((ix, iy, 7.5), (30.0, 11.5, 15.0), mat="Naval_Haze_Gray")
    # Faceted stealth upper tower + Dual Band Radar (DBR) flat phased-array panels
    tw.add_cylinder((ix, iy, 19.5), 8.2, 6.4, 9.5, segs=6, mat="Naval_Haze_Gray")
    for ang_deg in (30.0, 150.0, 270.0):
        a = math.radians(ang_deg)
        tw.add_box((ix + math.cos(a) * 6.8, iy + math.sin(a) * 6.8, 20.0), (4.4, 0.6, 4.4), mat="Accent_Charcoal", rot_euler=(0, 0, a + math.pi * 0.5))
    # Pri-Fly cantilevered tactical glass cab
    tw.add_box((ix - 8.0, iy + 4.5, 12.5), (12.0, 4.5, 3.2), mat="Terminal_Glass_Emissive")
    tw.add_box((ix, iy + 5.2, 16.5), (14.0, 3.8, 2.6), mat="Terminal_Glass_Emissive")
    # Stealth lattice mast + TACAN/Satcom domes
    tw.add_cylinder((ix + 2.0, iy, 31.0), 1.8, 0.5, 14.0, segs=6, mat="Naval_Haze_Gray")
    tw.add_sphere((ix - 5.0, iy, 25.5), 1.8, segs=10, rings=6, mat="Terminal_White")
    beacon = (ix + 2.0, iy, 38.6)

    # Sea-surface apron datum plane beneath hull
    apron = MeshBuilder()
    apron.add_box((0.0, 0.0, -18.5), (420.0, 180.0, 0.6), mat="Accent_Blue")

    # Map Jetway_01..08 to 3 deck-edge aircraft elevators + starboard crew brows & deck service pads
    jetways = [
        ((-42.0, -35.0, -0.3), -math.pi * 0.5, 16.0, "carrier_station", "Naval_Haze_Gray"),
        ((28.0, -35.0, -0.3), -math.pi * 0.5, 16.0, "carrier_station", "Naval_Haze_Gray"),
        ((122.0, -33.0, -0.3), -math.pi * 0.5, 16.0, "carrier_station", "Naval_Haze_Gray"),
        ((134.0, 26.0, -0.3), math.pi * 0.5, 16.0, "carrier_station", "Naval_Haze_Gray"),
        ((-120.0, -24.0, -0.3), -math.pi * 0.5, 14.0, "carrier_station", "Naval_Haze_Gray"),
        ((-80.0, 26.0, -0.3), math.pi * 0.5, 14.0, "carrier_station", "Naval_Haze_Gray"),
        ((48.0, -34.0, -0.3), -math.pi * 0.5, 14.0, "carrier_station", "Naval_Haze_Gray"),
        ((148.0, -24.0, -0.3), -math.pi * 0.5, 14.0, "carrier_station", "Naval_Haze_Gray"),
    ]
    return t, tw, beacon, apron, jetways


def build_RCYU(spec):
    """RCYU Hualien: Aboriginal Amis double-pitched roof + Chiashan hardened fighter shelters."""
    t = MeshBuilder()
    t.add_box((0.0, 16.0, 5.0), (175.0, 44.0, 10.0), mat="Terminal_White")
    t.add_box((0.0, 16.0, 6.5), (170.0, 45.2, 6.5), mat="Terminal_Glass_Emissive")
    # Double-pitched slate-blue/terracotta roof
    t.add_parametric_roof(
        (-96.0, 96.0), (-12.0, 44.0), 14, 10,
        lambda u, v: 11.5 + 8.5 * (1.0 - abs(v - 0.5) * 2.0) + 1.5 * math.cos((u - 0.5) * math.pi),
        thickness=1.2, mat_top="Accent_Blue", mat_bottom="Terracotta_Tile",
    )
    # 6 Chiashan hardened concrete fighter shelters
    for i in range(6):
        t.add_fighter_shelter((-155.0 - (i % 2) * 36.0, -5.0 - (i // 2) * 38.0), rot_z=math.pi * 0.5, scale=0.95)

    tower, beacon = build_tower_classic(
        (106.0, 18.0), height=36.0, shaft_r=3.6, cab_r=6.5, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Blue", radome=True,
    )
    apron = build_apron(width=340.0, depth=190.0, offset_y=-50.0)
    jetways = make_linear_jetways(-72.0, 72.0, -7.0, -math.pi * 0.5, length=26.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RCFN(spec):
    """RCFN Taitung: Tropical white colonnades + terracotta hip roof + 28m attached tower."""
    t = MeshBuilder()
    t.add_box((0.0, 14.0, 4.5), (135.0, 36.0, 9.0), mat="Terminal_White")
    t.add_box((0.0, 14.0, 5.2), (130.0, 37.2, 5.6), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-74.0, 74.0), (-8.0, 36.0), 12, 8,
        lambda u, v: 9.8 + 5.2 * (1.0 - max(abs(u - 0.5) * 1.4, abs(v - 0.5) * 2.0)),
        thickness=1.1, mat_top="Terracotta_Tile", mat_bottom="Terminal_White",
    )
    tower, beacon = build_tower_classic(
        (74.0, 18.0), height=28.0, shaft_r=3.2, cab_r=5.6, segs=8,
        shaft_mat="Terminal_White", band_mat="Terracotta_Tile", radome=False,
    )
    apron = build_apron(width=240.0, depth=160.0, offset_y=-45.0, stripe_count=6)
    jetways = make_linear_jetways(-56.0, 56.0, -5.0, -math.pi * 0.5, length=22.0, count=8, style="standard")
    return t, tower, beacon, apron, jetways


def build_RCQC(spec):
    """RCQC Penghu: Coral-white ocean-wave roof over dark basalt stone piers + military alert hangars."""
    t = MeshBuilder()
    t.add_box((0.0, 15.0, 3.0), (185.0, 42.0, 6.0), mat="Accent_Charcoal")
    t.add_box((0.0, 15.0, 8.2), (180.0, 43.2, 6.5), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-102.0, 102.0), (-10.0, 40.0), 18, 8,
        lambda u, v: 13.0 + 4.0 * math.sin(u * math.pi * 3.0) + 2.5 * math.sin(v * math.pi),
        thickness=1.3, mat_top="Terminal_White", mat_bottom="Accent_Blue",
    )
    t.add_fighter_shelter((-145.0, -15.0), rot_z=math.pi * 0.5, scale=0.95)
    t.add_fighter_shelter((-145.0, -52.0), rot_z=math.pi * 0.5, scale=0.95)
    tower, beacon = build_tower_classic(
        (112.0, 18.0), height=35.0, shaft_r=3.5, cab_r=6.4, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Blue", radome=True,
    )
    apron = build_apron(width=320.0, depth=180.0, offset_y=-50.0)
    jetways = make_linear_jetways(-76.0, 76.0, -7.0, -math.pi * 0.5, length=26.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RCGI(spec):
    """RCGI Green Island: Compact coastal STOL whitewashed terminal with turquoise trim + 19m mini-tower."""
    t = MeshBuilder()
    t.add_box((0.0, 12.0, 4.0), (58.0, 22.0, 8.0), mat="Terminal_White")
    t.add_box((0.0, 12.0, 4.4), (54.0, 23.0, 4.8), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-33.0, 33.0), (-2.0, 26.0), 12, 6,
        lambda u, v: 8.8 + 1.8 * math.sin(u * math.pi * 2.0) + 1.2 * math.sin(v * math.pi),
        thickness=0.9, mat_top="Accent_Blue", mat_bottom="Terminal_White",
    )
    tower, beacon = build_tower_classic(
        (32.0, 14.0), height=19.0, shaft_r=2.5, cab_r=4.6, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Blue", radome=False,
    )
    apron = build_apron(width=160.0, depth=120.0, offset_y=-35.0, stripe_count=4)
    jetways = make_linear_jetways(-38.0, 38.0, -1.0, -math.pi * 0.5, length=11.0, count=8, style="stol_canopy", accent_mat="Accent_Blue")
    return t, tower, beacon, apron, jetways


# --- EAST ASIA (15) ---

def build_RJTT(spec):
    """RJTT Tokyo Haneda: Edo-wave roof T3 + sweeping parallel concourses + 116m silver cable-stayed mast ATCT."""
    t = MeshBuilder()
    # Main T3 International Hall with ascending airflow Edo-wave roof
    t.add_box((0.0, 22.0, 7.5), (280.0, 62.0, 15.0), mat="Terminal_White")
    t.add_box((0.0, 22.0, 9.5), (276.0, 64.0, 10.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-152.0, 152.0), (-16.0, 60.0), 24, 10,
        lambda u, v: 18.0 + 6.5 * math.sin(u * math.pi * 2.0) * math.sin(v * math.pi) + 4.0 * v,
        thickness=1.8, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )
    # Bay-facing sweeping wing piers
    t.add_pier((-120.0, 0.0), (-185.0, -45.0), width=24.0, height=13.5, roof_mat="Terminal_Metal")
    t.add_pier((120.0, 0.0), (185.0, -45.0), width=24.0, height=13.5, roof_mat="Terminal_Metal")
    # Tokyo Monorail elevated track stub at landside
    t.add_box((0.0, 70.0, 10.0), (340.0, 5.0, 2.2), mat="Terminal_Metal")

    tower, beacon = build_tower_cable_mast((135.0, 48.0), height=116.0)
    apron = build_apron(width=460.0, depth=230.0, offset_y=-65.0)
    jetways = make_linear_jetways(-155.0, 155.0, -14.0, -math.pi * 0.5, length=34.0, count=8, accent_mat="Accent_Blue")
    return t, tower, beacon, apron, jetways


def build_RJAA(spec):
    """RJAA Tokyo Narita: Circular satellite rotundas (North/South wings) + linear T2 + 106m braced steel ATCT."""
    t = MeshBuilder()
    # Central main spine
    t.add_box((0.0, 28.0, 8.0), (260.0, 50.0, 16.0), mat="Terminal_White")
    t.add_box((0.0, 28.0, 9.5), (255.0, 52.0, 9.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, 28.0, 17.5), (268.0, 56.0, 2.5), mat="Terminal_Metal")
    # Iconic Narita Circular Satellite Rotundas connected by angled bridges
    for sx, sy in ((-150.0, -28.0), (-55.0, -40.0), (55.0, -40.0), (150.0, -28.0)):
        t.add_pier((sx * 0.65, 6.0), (sx, sy), width=16.0, height=12.0)
        t.add_cylinder((sx, sy, 4.5), 26.0, 26.0, 9.0, segs=18, mat="Terminal_White")
        t.add_cylinder((sx, sy, 10.5), 25.0, 25.0, 5.5, segs=18, mat="Terminal_Glass_Emissive")
        t.add_cylinder((sx, sy, 14.5), 28.0, 22.0, 2.8, segs=18, mat="Terminal_Metal")

    tower, beacon = build_tower_braced_frame((0.0, 62.0), height=106.0)
    apron = build_apron(width=460.0, depth=240.0, offset_y=-70.0)
    jetways = [
        ((-172.0, -42.0, 0.0), -2.4, 30.0, "standard", "Jetway_Steel"),
        ((-138.0, -52.0, 0.0), -1.3, 30.0, "standard", "Jetway_Steel"),
        ((-76.0, -56.0, 0.0), -2.1, 30.0, "standard", "Jetway_Steel"),
        ((-36.0, -60.0, 0.0), -1.2, 30.0, "standard", "Jetway_Steel"),
        ((36.0, -60.0, 0.0), -1.9, 30.0, "standard", "Jetway_Steel"),
        ((76.0, -56.0, 0.0), -1.0, 30.0, "standard", "Jetway_Steel"),
        ((138.0, -52.0, 0.0), -1.8, 30.0, "standard", "Jetway_Steel"),
        ((172.0, -42.0, 0.0), -0.7, 30.0, "standard", "Jetway_Steel"),
    ]
    return t, tower, beacon, apron, jetways


def build_RJBB(spec):
    """RJBB Osaka Kansai: Renzo Piano monumental stainless-steel aerodynamic airfoil wing + 86m twin-pillar ATCT."""
    t = MeshBuilder()
    # Central 4-story canyon hall + ultra-long 480m sweeping airfoil wing concourses
    t.add_box((0.0, 18.0, 9.0), (140.0, 68.0, 18.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, 10.0, 5.5), (460.0, 32.0, 11.0), mat="Terminal_Glass_Emissive")
    # Renzo Piano continuous airfoil cross-section stainless-steel roof
    t.add_parametric_roof(
        (-245.0, 245.0), (-18.0, 54.0), 32, 12,
        lambda u, v: (12.0 + 13.0 * math.exp(-((u - 0.5) * 4.2) ** 2))
        + 6.5 * math.sin(v * math.pi) * (1.0 - 0.35 * v),
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    # Wing Shuttle track inside canyon
    t.add_box((0.0, -8.0, 6.0), (450.0, 4.5, 1.5), mat="Accent_Charcoal")

    tower, beacon = build_tower_special_sculpted((0.0, -110.0), height=86.0, style="twin_pillar")
    apron = build_apron(width=520.0, depth=240.0, offset_y=-65.0)
    jetways = make_linear_jetways(-210.0, 210.0, -14.0, -math.pi * 0.5, length=32.0, count=8)
    return t, tower, beacon, apron, jetways


def build_VHHH(spec):
    """VHHH Hong Kong: Norman Foster barrel-vaulted Y-terminal + 28m-high SkyBridge over taxiway + 86m ATCT."""
    t = MeshBuilder()
    # Central spine + Y-shaped forked concourses with modular barrel-vaulted roof bays
    t.add_box((0.0, 22.0, 8.5), (260.0, 56.0, 17.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-138.0, 138.0), (-12.0, 56.0), 28, 8,
        lambda u, v: 18.0 + 4.8 * abs(math.sin(u * math.pi * 7.0)),
        thickness=1.5, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    # Y-fork diagonal piers
    t.add_pier((-125.0, 18.0), (-210.0, -48.0), width=26.0, height=15.0)
    t.add_pier((125.0, 18.0), (210.0, -48.0), width=26.0, height=15.0)

    # Iconic 28m-high clear-span SkyBridge spanning over taxiway to Midfield Satellite Concourse
    t.add_box((0.0, -52.0, 31.0), (22.0, 110.0, 7.5), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, -52.0, 35.5), (24.0, 114.0, 1.8), mat="Terminal_Metal")
    # SkyBridge end support cores (leaving clear 75m taxiway underpass for A380!)
    t.add_box((0.0, -4.0, 16.0), (20.0, 14.0, 32.0), mat="Terminal_White")
    t.add_box((0.0, -102.0, 16.0), (20.0, 14.0, 32.0), mat="Terminal_White")
    # Midfield Satellite Concourse
    t.add_box((0.0, -122.0, 8.0), (150.0, 32.0, 16.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, -122.0, 17.0), (156.0, 36.0, 2.0), mat="Terminal_Metal")

    tower, beacon = build_tower_classic(
        (95.0, -68.0), height=86.0, shaft_r=4.6, cab_r=8.8, segs=18,
        shaft_mat="Terminal_Metal", band_mat="Terminal_White", radome=True,
    )
    apron = build_apron(width=480.0, depth=270.0, offset_y=-60.0)
    jetways = [
        ((-165.0, -28.0, 0.0), -2.2, 32.0, "standard", "Jetway_Steel"),
        ((-110.0, -8.0, 0.0), -1.57, 32.0, "standard", "Jetway_Steel"),
        ((-55.0, -8.0, 0.0), -1.57, 32.0, "standard", "Jetway_Steel"),
        ((55.0, -8.0, 0.0), -1.57, 32.0, "standard", "Jetway_Steel"),
        ((110.0, -8.0, 0.0), -1.57, 32.0, "standard", "Jetway_Steel"),
        ((165.0, -28.0, 0.0), -0.94, 32.0, "standard", "Jetway_Steel"),
        ((-48.0, -138.0, 0.0), -1.57, 30.0, "standard", "Jetway_Steel"),
        ((48.0, -138.0, 0.0), -1.57, 30.0, "standard", "Jetway_Steel"),
    ]
    return t, tower, beacon, apron, jetways


def build_RKSI(spec):
    """RKSI Seoul Incheon: Fentress crescent-arc temple-eave catenary bird-wing roof + steel masts + 100m sail-finned ATCT."""
    t = MeshBuilder()
    # Crescent arc concourse wings
    t.add_curved_concourse_arc((0.0, -165.0), 195.0, math.radians(48.0), math.radians(132.0), width=42.0, height=16.5, segs=22)
    # Central sweeping bird-wing catenary roof suspended by external steel masts
    t.add_parametric_roof(
        (-130.0, 130.0), (2.0, 62.0), 24, 10,
        lambda u, v: 18.0 + 9.0 * math.cos((u - 0.5) * math.pi) + 6.5 * ((v - 0.5) * 2.0) ** 2,
        thickness=1.8, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    # External steel masts and catenary tension cables
    for mx in (-78.0, -26.0, 26.0, 78.0):
        t.add_cylinder((mx, 32.0, 22.0), 0.9, 0.5, 44.0, segs=8, mat="Terminal_Metal")
        t.add_tube((mx, 32.0, 42.0), (mx, 2.0, 25.0), 0.30, 6, "Terminal_Metal")
        t.add_tube((mx, 32.0, 42.0), (mx, 62.0, 25.0), 0.30, 6, "Terminal_Metal")

    tower, beacon = build_tower_special_sculpted((0.0, -52.0), height=100.0, style="sail_fin")
    apron = build_apron(width=460.0, depth=240.0, offset_y=-65.0)
    jetways = make_radial_jetways((0.0, -165.0), 172.0, math.radians(126.0), math.radians(54.0), length=34.0, count=8)
    # Flip angles inward toward the apron (south)
    jetways = [(p, ang + math.pi, l, st, am) for (p, ang, l, st, am) in jetways]
    return t, tower, beacon, apron, jetways


def build_ZSPD(spec):
    """ZSPD Shanghai Pudong: Paul Andreu parallel undulating gull-wing wave vaults + H-satellite + 102m 3-rib ATCT."""
    t = MeshBuilder()
    # Parallel T1 & T2 undulating silver gull-wing wave roofs
    for y_off in (36.0, -78.0):
        t.add_box((0.0, y_off, 7.5), (320.0, 44.0, 15.0), mat="Terminal_Glass_Emissive")
        t.add_parametric_roof(
            (-172.0, 172.0), (y_off - 28.0, y_off + 28.0), 28, 10,
            lambda u, v: 16.5 + 6.5 * math.sin(u * math.pi * 5.0) * math.sin(v * math.pi) + 3.0 * ((v - 0.5) * 2.0) ** 2,
            thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
        )
    # Central Maglev/Metro glass hub link
    t.add_sphere((0.0, -21.0, 4.0), 26.0, segs=18, rings=8, mat="Terminal_Glass_Emissive", scale=(1.4, 0.85, 0.55))

    tower, beacon = build_tower_special_sculpted((110.0, -21.0), height=102.0, style="three_rib")
    apron = build_apron(width=460.0, depth=260.0, offset_y=-45.0)
    jetways = (
        make_linear_jetways(-140.0, 140.0, 12.0, -math.pi * 0.5, length=30.0, count=4)
        + make_linear_jetways(-140.0, 140.0, -102.0, -math.pi * 0.5, length=30.0, count=4)
    )
    return t, tower, beacon, apron, jetways


def build_ZBAA(spec):
    """ZBAA Beijing Capital T3: Norman Foster golden-crimson dragon-scale double-curved roof + 98m cylindrical ATCT."""
    t = MeshBuilder()
    # Dragon-shaped T3 processor + tapered flaring wings
    t.add_box((0.0, 24.0, 8.5), (290.0, 62.0, 17.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-168.0, 168.0), (-16.0, 64.0), 26, 12,
        lambda u, v: 18.0 + 9.0 * math.sin(u * math.pi) * math.sin(v * math.pi) + 2.5 * math.cos(u * math.pi * 6.0),
        thickness=2.0, mat_top="Accent_Gold", mat_bottom="Accent_Red",
    )
    # Imperial red-and-gold colonnade columns & diverging dragon claws
    for x in range(-135, 140, 30):
        t.add_cylinder((float(x), -10.0, 9.0), 1.3, 1.3, 18.0, segs=8, mat="Accent_Red")
    t.add_pier((-115.0, 0.0), (-195.0, -68.0), width=26.0, height=14.0, roof_mat="Accent_Gold", wall_mat="Accent_Red")
    t.add_pier((115.0, 0.0), (195.0, -68.0), width=26.0, height=14.0, roof_mat="Accent_Gold", wall_mat="Accent_Red")

    tower, beacon = build_tower_classic(
        (0.0, -62.0), height=98.0, shaft_r=4.6, cab_r=9.0, segs=20,
        shaft_mat="Terminal_White", band_mat="Accent_Gold", dual_cab=True, radome=True,
    )
    apron = build_apron(width=480.0, depth=250.0, offset_y=-65.0)
    jetways = make_linear_jetways(-155.0, 155.0, -12.0, -math.pi * 0.5, length=34.0, count=8, accent_mat="Accent_Gold")
    return t, tower, beacon, apron, jetways


def build_ZGSZ(spec):
    """ZGSZ Shenzhen Bao'an T3: Studio Fuksas organic Manta-Ray biomorphic honeycomb shell + 98m teardrop ATCT."""
    t = MeshBuilder()
    # Central Manta-Ray fuselage spine + double-cross sweeping wings
    t.add_box((0.0, -15.0, 7.0), (54.0, 210.0, 14.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-36.0, 36.0), (-125.0, 95.0), 14, 24,
        lambda u, v: 14.0 + 9.0 * math.sin(u * math.pi) * (0.65 + 0.35 * math.sin(v * math.pi)),
        thickness=1.8, mat_top="Terminal_White", mat_bottom="Glass_Cyan_Emissive",
    )
    # Sweeping manta-ray pectoral wings (North & South crosses)
    for wy, wspan in ((30.0, 280.0), (-50.0, 220.0)):
        t.add_box((0.0, wy, 6.5), (wspan - 18.0, 32.0, 13.0), mat="Terminal_Glass_Emissive")
        t.add_parametric_roof(
            (-wspan * 0.5, wspan * 0.5), (wy - 22.0, wy + 22.0), 22, 8,
            lambda u, v: 13.5 + 6.5 * math.sin(u * math.pi) * math.sin(v * math.pi),
            thickness=1.5, mat_top="Terminal_White", mat_bottom="Glass_Cyan_Emissive",
        )

    tower, beacon = build_tower_classic(
        (95.0, -110.0), height=98.0, shaft_r=4.6, cab_r=8.6, segs=20,
        shaft_mat="Terminal_White", band_mat="Terminal_Metal", radome=True,
    )
    apron = build_apron(width=420.0, depth=280.0, offset_y=-35.0)
    jetways = [
        ((-115.0, 12.0, 0.0), -1.57, 30.0, "standard", "Terminal_White"),
        ((-65.0, 12.0, 0.0), -1.57, 30.0, "standard", "Terminal_White"),
        ((65.0, 12.0, 0.0), -1.57, 30.0, "standard", "Terminal_White"),
        ((115.0, 12.0, 0.0), -1.57, 30.0, "standard", "Terminal_White"),
        ((-88.0, -68.0, 0.0), -1.57, 30.0, "standard", "Terminal_White"),
        ((-45.0, -68.0, 0.0), -1.57, 30.0, "standard", "Terminal_White"),
        ((45.0, -68.0, 0.0), -1.57, 30.0, "standard", "Terminal_White"),
        ((88.0, -68.0, 0.0), -1.57, 30.0, "standard", "Terminal_White"),
    ]
    return t, tower, beacon, apron, jetways


def build_ZGGG(spec):
    """ZGGG Guangzhou Baiyun: Cloud Ribbon undulating monocoque roof + radiating PTFE piers + 112m hourglass ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 20.0, 8.0), (280.0, 56.0, 16.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-152.0, 152.0), (-14.0, 54.0), 24, 10,
        lambda u, v: 17.5 + 5.5 * math.sin(u * math.pi * 3.0) * math.sin(v * math.pi),
        thickness=1.8, mat_top="Terminal_White", mat_bottom="Terminal_Metal",
    )
    t.add_pier((-90.0, -4.0), (-145.0, -62.0), width=24.0, height=13.5, roof_mat="Terminal_White")
    t.add_pier((90.0, -4.0), (145.0, -62.0), width=24.0, height=13.5, roof_mat="Terminal_White")
    tower, beacon = build_tower_minaret_torch((0.0, -56.0), height=112.0)
    apron = build_apron(width=440.0, depth=230.0, offset_y=-60.0)
    jetways = make_linear_jetways(-135.0, 135.0, -10.0, -math.pi * 0.5, length=32.0, count=8)
    return t, tower, beacon, apron, jetways


def build_ROAH(spec):
    """ROAH Okinawa Naha: Ryukyu ocean-wave curved roof + twin finger piers + JASDF shelters + 52m turquoise tower."""
    t = MeshBuilder()
    t.add_box((0.0, 18.0, 7.0), (260.0, 48.0, 14.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-138.0, 138.0), (-10.0, 46.0), 22, 8,
        lambda u, v: 15.0 + 4.5 * math.sin(u * math.pi * 4.0) * math.sin(v * math.pi),
        thickness=1.4, mat_top="Terminal_White", mat_bottom="Accent_Blue",
    )
    t.add_pier((-85.0, -4.0), (-85.0, -56.0), width=22.0, height=12.5, roof_mat="Terminal_White")
    t.add_pier((85.0, -4.0), (85.0, -56.0), width=22.0, height=12.5, roof_mat="Terminal_White")
    t.add_fighter_shelter((175.0, -25.0), rot_z=-math.pi * 0.5, scale=0.95)
    t.add_fighter_shelter((175.0, -62.0), rot_z=-math.pi * 0.5, scale=0.95)
    tower, beacon = build_tower_classic(
        (0.0, 52.0), height=52.0, shaft_r=4.2, cab_r=7.6, segs=12,
        shaft_mat="Terminal_White", band_mat="Accent_Blue", striped_bands=4, radome=True,
    )
    apron = build_apron(width=400.0, depth=210.0, offset_y=-55.0)
    jetways = make_linear_jetways(-120.0, 120.0, -10.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_VMMC(spec):
    """VMMC Macau: Barrel-vaulted coastal terminal + twin sea-crossing taxiway causeway bridges."""
    t = MeshBuilder()
    t.add_box((0.0, 16.0, 6.5), (210.0, 44.0, 13.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-112.0, 112.0), (-10.0, 42.0), 18, 10,
        lambda u, v: 13.5 + 5.5 * math.sin(v * math.pi),
        thickness=1.4, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    # Twin elevated concrete taxiway causeway bridges extending seaward
    for bx in (-75.0, 75.0):
        t.add_box((bx, -105.0, 2.5), (26.0, 95.0, 2.2), mat="Concrete_Apron")
        for py in (-70.0, -95.0, -120.0, -145.0):
            t.add_cylinder((bx, py, -3.0), 2.8, 2.8, 10.0, segs=8, mat="Terminal_White")
    tower, beacon = build_tower_classic(
        (124.0, 18.0), height=46.0, shaft_r=3.8, cab_r=7.0, segs=12,
        shaft_mat="Terminal_White", band_mat="Accent_Blue", radome=True,
    )
    apron = build_apron(width=340.0, depth=190.0, offset_y=-50.0)
    jetways = make_linear_jetways(-92.0, 92.0, -8.0, -math.pi * 0.5, length=28.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RJCC(spec):
    """RJCC Sapporo New Chitose: Iconic 180-deg semicircular C-shaped horseshoe terminal + 62m red/white winterized ATCT."""
    t = MeshBuilder()
    t.add_curved_concourse_arc((0.0, 10.0), 115.0, math.radians(-175.0), math.radians(-5.0), width=36.0, height=15.0, segs=24)
    # West international wing linked by indoor skybridge
    t.add_box((-165.0, 24.0, 7.5), (85.0, 44.0, 15.0), mat="Terminal_Glass_Emissive")
    t.add_box((-165.0, 24.0, 16.0), (92.0, 50.0, 2.0), mat="Terminal_Metal")
    t.add_pier((-122.0, 15.0), (-95.0, 10.0), width=14.0, height=11.0)
    tower, beacon = build_tower_classic(
        (0.0, 48.0), height=62.0, shaft_r=4.2, cab_r=7.8, segs=12,
        shaft_mat="Terminal_White", band_mat="Accent_Red", striped_bands=4, radome=True,
    )
    apron = build_apron(width=420.0, depth=260.0, offset_y=-75.0)
    jetways = make_radial_jetways((0.0, 10.0), 134.0, math.radians(-162.0), math.radians(-18.0), length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RJFF(spec):
    """RJFF Fukuoka: Softly curving glass concourse with rooftop viewing deck + wave-roof terminal + 68m ATCT."""
    t = MeshBuilder()
    t.add_curved_concourse_arc((0.0, 180.0), 165.0, math.radians(-130.0), math.radians(-50.0), width=42.0, height=15.5, segs=18)
    # Open-air rooftop viewing deck canopy
    t.add_parametric_roof(
        (-85.0, 85.0), (5.0, 42.0), 16, 8,
        lambda u, v: 17.5 + 3.5 * math.sin(u * math.pi * 2.0),
        thickness=1.2, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )
    tower, beacon = build_tower_classic(
        (135.0, 35.0), height=68.0, shaft_r=4.4, cab_r=8.0, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Charcoal", radome=True,
    )
    apron = build_apron(width=380.0, depth=210.0, offset_y=-55.0)
    jetways = make_linear_jetways(-115.0, 115.0, -8.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RJOO(spec):
    """RJOO Osaka Itami: Central block + 4 Y-angled North/South finger piers + La Sora wood rooftop deck + 53m ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 22.0, 7.5), (270.0, 46.0, 15.0), mat="Terminal_White")
    t.add_box((0.0, 22.0, 8.5), (266.0, 47.5, 8.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, 22.0, 15.8), (240.0, 36.0, 1.0), mat="Accent_Gold")
    for x0, x1 in ((-110.0, -140.0), (-45.0, -60.0), (45.0, 60.0), (110.0, 140.0)):
        t.add_pier((x0, 0.0), (x1, -54.0), width=18.0, height=12.0)
    tower, beacon = build_tower_classic(
        (0.0, 56.0), height=53.0, shaft_r=4.2, cab_r=7.6, segs=12,
        shaft_mat="Terminal_Metal", band_mat="Accent_Green", dual_cab=True, radome=True,
    )
    apron = build_apron(width=400.0, depth=210.0, offset_y=-55.0)
    jetways = make_linear_jetways(-130.0, 130.0, -28.0, -math.pi * 0.5, length=28.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RKPC(spec):
    """RKPC Jeju: L-curved white ocean-wave roof over dark volcanic basalt stone base + 58m flared blue-cab ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 18.0, 3.5), (250.0, 46.0, 7.0), mat="Accent_Charcoal")
    t.add_box((0.0, 18.0, 9.5), (245.0, 47.2, 6.5), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-132.0, 132.0), (-10.0, 46.0), 22, 8,
        lambda u, v: 14.5 + 4.8 * math.sin(u * math.pi * 3.0) * math.sin(v * math.pi),
        thickness=1.4, mat_top="Terminal_White", mat_bottom="Terminal_Metal",
    )
    tower, beacon = build_tower_classic(
        (145.0, 22.0), height=58.0, shaft_r=4.2, cab_r=7.6, segs=14,
        shaft_mat="Terminal_White", band_mat="Accent_Blue", radome=True,
    )
    apron = build_apron(width=380.0, depth=200.0, offset_y=-50.0)
    jetways = make_linear_jetways(-115.0, 115.0, -8.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


# --- SOUTHEAST & SOUTH ASIA (9) ---

def build_WSSS(spec):
    """WSSS Singapore Changi: Jewel Changi 150m toroidal glass gridshell dome + Rain Vortex oculus + U-terminals + 81m double-goblet ATCT."""
    t = MeshBuilder()
    # Jewel Changi iconic 150m x 120m toroidal glass gridshell dome with Rain Vortex
    t.add_toroidal_dome(
        (0.0, 32.0), rx=75.0, ry=60.0, z_base=0.0, height=38.0, oculus_r=14.0,
        segs_u=28, segs_v=10, mat_shell="Terminal_Glass_Emissive", mat_ribs="Terminal_Metal", mat_vortex="Glass_Cyan_Emissive",
    )
    # Surrounding U-shaped horseshoe concourses (T1, T2, T3)
    t.add_box((0.0, -48.0, 8.0), (260.0, 34.0, 16.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, -48.0, 17.0), (272.0, 42.0, 2.2), mat="Terminal_Metal")
    t.add_pier((-132.0, -38.0), (-152.0, 58.0), width=32.0, height=16.0, roof_mat="Terminal_Metal")
    t.add_pier((132.0, -38.0), (152.0, 58.0), width=32.0, height=16.0, roof_mat="Terminal_Metal")
    # Skytrain viaduct slicing across Jewel
    t.add_box((0.0, 32.0, 16.0), (290.0, 5.5, 2.4), mat="Terminal_Metal")

    tower, beacon = build_tower_changi_goblet((0.0, -108.0), height=81.0)
    apron = build_apron(width=480.0, depth=260.0, offset_y=-65.0)
    jetways = make_linear_jetways(-115.0, 115.0, -66.0, -math.pi * 0.5, length=34.0, count=8)
    return t, tower, beacon, apron, jetways


def build_VTBS(spec):
    """VTBS Bangkok Suvarnabhumi: Helmut Jahn cantilevered steel super-truss roof + PTFE tubular bays + 132m ultra-tall dual-cab ATCT."""
    t = MeshBuilder()
    # Monumental 300m main hall with 8 gigantic cantilevered steel super-trusses
    t.add_box((0.0, 24.0, 9.0), (280.0, 74.0, 18.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-154.0, 154.0), (-20.0, 68.0), 24, 8,
        lambda u, v: 20.0 + 3.2 * abs(math.sin(u * math.pi * 8.0)),
        thickness=1.6, mat_top="Terminal_White", mat_bottom="Terminal_Metal",
    )
    # 8 Super-truss arches spanning above the canopy
    for i in range(8):
        x = -135.0 + i * (270.0 / 7.0)
        t.add_parabolic_arch((x, -26.0, 18.0), (x, 74.0, 18.0), apex_z=30.0, radius=1.2, segs=12, mat="Terminal_Metal")
    # Translucent PTFE tubular concourse wings (Concourses A–G)
    t.add_cylinder((-145.0, -48.0, 8.5), 11.5, 11.5, 130.0, segs=14, mat="Terminal_Glass_Emissive", rot_euler=(0.0, math.pi * 0.5, 0.0))
    t.add_cylinder((145.0, -48.0, 8.5), 11.5, 11.5, 130.0, segs=14, mat="Terminal_Glass_Emissive", rot_euler=(0.0, math.pi * 0.5, 0.0))
    t.add_pier((-75.0, -10.0), (-75.0, -48.0), width=22.0, height=13.0, roof_mat="Terminal_White")
    t.add_pier((75.0, -10.0), (75.0, -48.0), width=22.0, height=13.0, roof_mat="Terminal_White")

    tower, beacon = build_tower_classic(
        (0.0, -96.0), height=132.0, shaft_r=5.2, cab_r=9.4, segs=20,
        shaft_mat="Terminal_White", band_mat="Accent_Gold", dual_cab=True, radome=True,
    )
    apron = build_apron(width=480.0, depth=250.0, offset_y=-65.0)
    jetways = make_linear_jetways(-190.0, 190.0, -60.0, -math.pi * 0.5, length=34.0, count=8, accent_mat="Accent_Gold")
    return t, tower, beacon, apron, jetways


def build_WMKK(spec):
    """WMKK Kuala Lumpur KLIA: Kisho Kurokawa hyperbolic-paraboloid Islamic shell domes + 4-arm Satellite A + 130m minaret ATCT."""
    t = MeshBuilder()
    # Main Terminal: Grid of interlocking Islamic hyperbolic-paraboloid tent shells
    t.add_box((0.0, 32.0, 7.5), (240.0, 76.0, 15.0), mat="Terminal_Glass_Emissive")
    for ix in (-80.0, 0.0, 80.0):
        for iy in (10.0, 54.0):
            t.add_parametric_roof(
                (ix - 39.0, ix + 39.0), (iy - 21.0, iy + 21.0), 10, 8,
                lambda u, v: 15.5 + 8.5 * math.sin(u * math.pi) * math.sin(v * math.pi),
                thickness=1.2, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
            )
            t.add_cylinder((ix, iy, 8.0), 2.0, 3.8, 16.0, segs=10, mat="Terminal_White")

    # Cross-shaped 4-armed Satellite A with central rainforest glass dome
    sat_y = -76.0
    t.add_pier((-110.0, sat_y), (110.0, sat_y), width=24.0, height=13.5, roof_mat="Terminal_Metal")
    t.add_pier((0.0, sat_y - 68.0), (0.0, sat_y + 42.0), width=24.0, height=13.5, roof_mat="Terminal_Metal")
    t.add_sphere((0.0, sat_y, 14.0), 24.0, segs=18, rings=10, mat="Terminal_Glass_Emissive", scale=(1.0, 1.0, 0.65))

    tower, beacon = build_tower_minaret_torch((148.0, -20.0), height=130.0)
    apron = build_apron(width=460.0, depth=260.0, offset_y=-55.0)
    jetways = (
        make_linear_jetways(-105.0, -30.0, sat_y - 14.0, -math.pi * 0.5, length=30.0, count=4)
        + make_linear_jetways(30.0, 105.0, sat_y - 14.0, -math.pi * 0.5, length=30.0, count=4)
    )
    return t, tower, beacon, apron, jetways


def build_WIII(spec):
    """WIII Jakarta: Javanese Joglo tiered terracotta pyramidal pavilions + sweeping modern T3 Ultimate."""
    t = MeshBuilder()
    # Sweeping T3 Ultimate concourse
    t.add_box((0.0, 24.0, 7.5), (270.0, 48.0, 15.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-145.0, 145.0), (-6.0, 54.0), 20, 8,
        lambda u, v: 16.0 + 4.5 * math.sin(u * math.pi * 3.0),
        thickness=1.4, mat_top="Terminal_White", mat_bottom="Terminal_Metal",
    )
    # Javanese Joglo tiered terracotta pyramidal boarding pavilions along apron
    for jx in (-110.0, -38.0, 38.0, 110.0):
        t.add_box((jx, -24.0, 5.5), (36.0, 32.0, 11.0), mat="Terminal_Glass_Emissive")
        t.add_cylinder((jx, -24.0, 14.0), 26.0, 14.0, 6.0, segs=4, mat="Terracotta_Tile", rot_euler=(0, 0, math.pi * 0.25))
        t.add_cylinder((jx, -24.0, 20.5), 14.0, 2.0, 7.0, segs=4, mat="Terracotta_Tile", rot_euler=(0, 0, math.pi * 0.25))

    tower, beacon = build_tower_classic(
        (0.0, 68.0), height=75.0, shaft_r=4.6, cab_r=8.2, segs=8,
        shaft_mat="Terminal_White", band_mat="Terracotta_Tile", radome=True,
    )
    apron = build_apron(width=440.0, depth=230.0, offset_y=-60.0)
    jetways = make_linear_jetways(-125.0, 125.0, -40.0, -math.pi * 0.5, length=30.0, count=8, accent_mat="Terracotta_Tile")
    return t, tower, beacon, apron, jetways


def build_VABB(spec):
    """VABB Mumbai CSMIA: SOM X-shaped T2 coffered waffle canopy + Peacock mega-columns + 85m hyperbolic diagrid lattice ATCT."""
    t = MeshBuilder()
    # X-shaped 4-level terminal piers
    t.add_pier((-145.0, -65.0), (145.0, 65.0), width=32.0, height=16.5, roof_mat="Terminal_Metal")
    t.add_pier((-145.0, 65.0), (145.0, -65.0), width=32.0, height=16.5, roof_mat="Terminal_Metal")
    # Central monumental coffered waffle roof canopy with flaring peacock mushroom columns
    t.add_box((0.0, 0.0, 19.0), (160.0, 110.0, 3.2), mat="Accent_Gold")
    t.add_box((0.0, 0.0, 10.0), (130.0, 82.0, 16.0), mat="Terminal_Glass_Emissive")
    for cx in (-48.0, 0.0, 48.0):
        for cy in (-28.0, 28.0):
            t.add_cylinder((cx, cy, 9.0), 2.4, 7.5, 18.0, segs=12, mat="Terminal_White")

    tower, beacon = build_tower_special_sculpted((0.0, -102.0), height=85.0, style="diagrid_lattice")
    apron = build_apron(width=440.0, depth=250.0, offset_y=-45.0)
    jetways = (
        make_linear_jetways(-140.0, -40.0, -56.0, -math.pi * 0.5, length=30.0, count=4, accent_mat="Accent_Gold")
        + make_linear_jetways(40.0, 140.0, -56.0, -math.pi * 0.5, length=30.0, count=4, accent_mat="Accent_Gold")
    )
    return t, tower, beacon, apron, jetways


def build_VIDP(spec):
    """VIDP New Delhi IGI: Mammoth T3 H-layout piers + arched aluminum canopy + 102m helical twisted ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 26.0, 9.0), (290.0, 64.0, 18.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-156.0, 156.0), (-12.0, 64.0), 20, 10,
        lambda u, v: 18.5 + 5.5 * math.sin(v * math.pi),
        thickness=1.8, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )
    for px in (-120.0, -40.0, 40.0, 120.0):
        t.add_pier((px, -4.0), (px, -64.0), width=22.0, height=13.5, roof_mat="Terminal_Metal")
    tower, beacon = build_tower_special_sculpted((0.0, -96.0), height=102.0, style="twisted")
    apron = build_apron(width=460.0, depth=240.0, offset_y=-65.0)
    jetways = make_linear_jetways(-140.0, 140.0, -64.0, -math.pi * 0.5, length=32.0, count=8)
    return t, tower, beacon, apron, jetways


def build_VVNB(spec):
    """VVNB Hanoi Noi Bai: Symmetrical gull-wing T2 roof + 95m lotus-bud fluted ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 20.0, 7.5), (280.0, 48.0, 15.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-152.0, 152.0), (-10.0, 50.0), 24, 10,
        lambda u, v: 15.5 + 8.0 * math.sin(abs(u - 0.5) * 2.0 * math.pi) * math.sin(v * math.pi) + 3.0 * v,
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    tower, beacon = build_tower_special_sculpted((155.0, -10.0), height=95.0, style="lotus")
    apron = build_apron(width=420.0, depth=210.0, offset_y=-55.0)
    jetways = make_linear_jetways(-130.0, 130.0, -8.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_VVTS(spec):
    """VVTS Ho Chi Minh Tan Son Nhat: Split-wing V-curved metallic roof + Ao Dai ribbon canopy + 68m ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 18.0, 7.5), (270.0, 52.0, 15.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-146.0, 146.0), (-14.0, 50.0), 22, 10,
        lambda u, v: 16.0 + 6.5 * abs(u - 0.5) * 2.0 + 3.5 * math.sin(v * math.pi),
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )
    tower, beacon = build_tower_classic(
        (152.0, 10.0), height=68.0, shaft_r=4.4, cab_r=8.0, segs=16,
        shaft_mat="Terminal_White", band_mat="Accent_Green", radome=True,
    )
    apron = build_apron(width=420.0, depth=210.0, offset_y=-55.0)
    jetways = make_linear_jetways(-125.0, 125.0, -10.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_RPLL(spec):
    """RPLL Manila NAIA: Locsin Brutalist upturned concrete eaves T1 + curved multi-vault T3 + 62m checkered ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 20.0, 7.5), (260.0, 52.0, 15.0), mat="Terminal_White")
    t.add_box((0.0, 20.0, 8.0), (254.0, 53.5, 8.0), mat="Terminal_Glass_Emissive")
    # Upturned cantilevered Brutalist eaves
    t.add_parametric_roof(
        (-140.0, 140.0), (-14.0, 54.0), 18, 10,
        lambda u, v: 16.0 + 6.0 * ((v - 0.5) * 2.0) ** 2,
        thickness=2.0, mat_top="Terminal_White", mat_bottom="Concrete_Apron",
    )
    t.add_pier((0.0, -6.0), (-55.0, -60.0), width=22.0, height=13.0)
    t.add_pier((0.0, -6.0), (55.0, -60.0), width=22.0, height=13.0)
    tower, beacon = build_tower_classic(
        (145.0, 22.0), height=62.0, shaft_r=4.2, cab_r=7.8, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Red", striped_bands=4, radome=True,
    )
    apron = build_apron(width=420.0, depth=220.0, offset_y=-55.0)
    jetways = make_linear_jetways(-120.0, 120.0, -12.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


# --- MIDDLE EAST (3) ---

def build_OMDB(spec):
    """OMDB Dubai International: Paul Andreu 460m silver aerodynamic cigar/teardrop concourse + 87m dual crescent-fin ATCT."""
    t = MeshBuilder()
    # Monumental aerodynamic cigar-shaped teardrop vaulted concourse shell
    t.add_box((0.0, 16.0, 8.5), (420.0, 56.0, 17.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-230.0, 230.0), (-18.0, 50.0), 32, 12,
        lambda u, v: 11.0 + 16.5 * math.sin(u * math.pi) ** 0.55 * math.sin(v * math.pi) ** 0.75,
        thickness=1.8, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )
    # Desert solar shading external structural ribs along the cigar length
    for i in range(13):
        x = -200.0 + i * (400.0 / 12.0)
        scale_h = math.sin(((x + 230.0) / 460.0) * math.pi) ** 0.55
        t.add_parabolic_arch((x, -19.0, 0.0), (x, 51.0, 0.0), apex_z=12.0 + 17.5 * scale_h, radius=0.9, segs=12, mat="Terminal_Metal")

    tower, beacon = build_tower_crescent_fins((0.0, -82.0), height=87.0)
    apron = build_apron(width=520.0, depth=240.0, offset_y=-60.0, deck_mat="Sandstone_Beige")
    jetways = make_linear_jetways(-185.0, 185.0, -14.0, -math.pi * 0.5, length=34.0, count=8, accent_mat="Accent_Gold")
    return t, tower, beacon, apron, jetways


def build_OTHH(spec):
    """OTHH Doha Hamad: HOK desert-dune/ocean-wave roof + Y-node Orchard glass dome + 85m crescent-arch ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 22.0, 8.0), (280.0, 58.0, 16.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-152.0, 152.0), (-14.0, 58.0), 26, 12,
        lambda u, v: 17.0 + 7.5 * math.sin(u * math.pi * 2.5) * math.sin(v * math.pi) + 3.0 * math.cos(v * math.pi),
        thickness=1.8, mat_top="Terminal_Metal", mat_bottom="Sandstone_Beige",
    )
    # Y-shaped North Node ("The Orchard") with circular tropical garden glass dome
    t.add_pier((0.0, -8.0), (-110.0, -78.0), width=24.0, height=14.0, roof_mat="Terminal_Metal")
    t.add_pier((0.0, -8.0), (110.0, -78.0), width=24.0, height=14.0, roof_mat="Terminal_Metal")
    t.add_sphere((0.0, -24.0, 12.0), 28.0, segs=20, rings=10, mat="Terminal_Glass_Emissive", scale=(1.1, 1.0, 0.72))

    tower, beacon = build_tower_special_sculpted((135.0, -45.0), height=85.0, style="crescent_arch")
    apron = build_apron(width=460.0, depth=250.0, offset_y=-65.0, deck_mat="Sandstone_Beige")
    jetways = make_linear_jetways(-135.0, 135.0, -14.0, -math.pi * 0.5, length=32.0, count=8)
    return t, tower, beacon, apron, jetways


def build_LTFM(spec):
    """LTFM Istanbul Airport: Ottoman multi-domed megaterminal + 5 radial piers + Pininfarina 90m Tulip ATCT."""
    t = MeshBuilder()
    # Main modular Ottoman geometric multi-vaulted roof megaterminal
    t.add_box((0.0, 26.0, 9.0), (260.0, 96.0, 18.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, 26.0, 19.0), (270.0, 104.0, 2.2), mat="Terminal_Metal")
    # Repeating Ottoman domed/pyramidal skylight roof grid
    for gx in (-96.0, -48.0, 0.0, 48.0, 96.0):
        for gy in (0.0, 52.0):
            t.add_sphere((gx, gy, 19.5), 22.0, segs=12, rings=6, mat="Terminal_Metal", scale=(1.0, 1.0, 0.42))
            t.add_cylinder((gx, gy, 27.0), 7.0, 5.0, 2.2, segs=8, mat="Terminal_Glass_Emissive")
    # 5 radial finger piers
    for ang_deg in (-145.0, -118.0, -90.0, -62.0, -35.0):
        a = math.radians(ang_deg)
        p0 = (math.cos(a) * 55.0, -10.0)
        p1 = (math.cos(a) * 165.0, -10.0 + math.sin(a) * 115.0)
        t.add_pier(p0, p1, width=20.0, height=13.5, roof_mat="Terminal_Metal")

    tower, beacon = build_tower_tulip_pininfarina((165.0, -45.0), height=90.0)
    apron = build_apron(width=480.0, depth=260.0, offset_y=-65.0)
    jetways = make_linear_jetways(-155.0, 155.0, -62.0, -math.pi * 0.5, length=32.0, count=8, accent_mat="Accent_Red")
    return t, tower, beacon, apron, jetways


# --- EUROPE (7) ---

def build_EGLL(spec):
    """EGLL London Heathrow T5: Richard Rogers exposed exterior V-frame trusses & waveform roof + 87m yellow-masted cone ATCT."""
    t = MeshBuilder()
    # T5A column-free transparent mega-box with single-span undulating waveform roof
    t.add_box((0.0, 20.0, 9.5), (270.0, 74.0, 19.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-150.0, 150.0), (-24.0, 64.0), 22, 12,
        lambda u, v: 20.5 + 6.5 * math.sin(v * math.pi),
        thickness=1.8, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    # Exposed exterior structural steel V-frames along both long facades
    for i in range(11):
        x = -130.0 + i * 26.0
        for fy, dy_out in ((-18.0, -8.0), (58.0, 8.0)):
            t.add_tube((x, fy + dy_out, 0.0), (x - 8.0, fy, 20.5), 0.75, 6, "Accent_Charcoal")
            t.add_tube((x, fy + dy_out, 0.0), (x + 8.0, fy, 20.5), 0.75, 6, "Accent_Charcoal")
    # Satellite T5B parallel concourse
    t.add_box((0.0, -88.0, 7.5), (220.0, 34.0, 15.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, -88.0, 16.0), (228.0, 38.0, 2.0), mat="Terminal_Metal")

    tower, beacon = build_tower_heathrow_masts((168.0, -32.0), height=87.0)
    apron = build_apron(width=460.0, depth=260.0, offset_y=-50.0)
    jetways = (
        make_linear_jetways(-120.0, 120.0, -18.0, -math.pi * 0.5, length=30.0, count=4)
        + make_linear_jetways(-95.0, 95.0, -106.0, -math.pi * 0.5, length=30.0, count=4)
    )
    return t, tower, beacon, apron, jetways


def build_LFPG(spec):
    """LFPG Paris CDG: Paul Andreu T1 circular Brutalist Camembert drum + 7 octopus satellite pods + T2E parabolic vault + 85m ATCT."""
    t = MeshBuilder()
    # Iconic T1 circular multi-tiered "Camembert" concrete drum with central courtyard
    cx, cy = -75.0, 10.0
    t.add_curved_concourse_arc((cx, cy), 44.0, 0.0, 2.0 * math.pi, width=24.0, height=22.0, segs=24, roof_mat="Terminal_White", wall_mat="Concrete_Apron")
    # 7 trapezoidal octopus satellite pods around T1
    for k in range(7):
        ang = (2.0 * math.pi * k) / 7.0
        sx = cx + math.cos(ang) * 96.0
        sy = cy + math.sin(ang) * 96.0
        t.add_box((sx, sy, 6.5), (28.0, 20.0, 13.0), mat="Terminal_White", rot_euler=(0, 0, ang))
        t.add_box((sx, sy, 8.0), (29.0, 18.0, 5.5), mat="Terminal_Glass_Emissive", rot_euler=(0, 0, ang))
        # Underground-to-above connector stub
        t.add_tube((cx + math.cos(ang) * 56.0, cy + math.sin(ang) * 56.0, 3.0), (sx, sy, 4.0), 3.2, 8, "Concrete_Apron")

    # T2E sweeping parabolic barrel-vaulted glass concourse (East side)
    t.add_box((135.0, 10.0, 7.5), (160.0, 38.0, 15.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (52.0, 218.0), (-12.0, 32.0), 18, 12,
        lambda u, v: 13.0 + 9.0 * math.sin(v * math.pi),
        thickness=1.4, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )

    tower, beacon = build_tower_classic(
        (45.0, -56.0), height=85.0, shaft_r=4.6, cab_r=9.2, segs=18,
        shaft_mat="Terminal_White", band_mat="Terminal_Metal", dual_cab=True, radome=True,
    )
    apron = build_apron(width=500.0, depth=260.0, offset_y=-35.0)
    jetways = [
        ((cx + math.cos(math.radians(-140)) * 112.0, cy + math.sin(math.radians(-140)) * 112.0, 0.0), math.radians(-140), 28.0, "standard", "Jetway_Steel"),
        ((cx + math.cos(math.radians(-90)) * 112.0, cy + math.sin(math.radians(-90)) * 112.0, 0.0), math.radians(-90), 28.0, "standard", "Jetway_Steel"),
        ((cx + math.cos(math.radians(-40)) * 112.0, cy + math.sin(math.radians(-40)) * 112.0, 0.0), math.radians(-40), 28.0, "standard", "Jetway_Steel"),
        ((cx + math.cos(math.radians(170)) * 112.0, cy + math.sin(math.radians(170)) * 112.0, 0.0), math.radians(170), 28.0, "standard", "Jetway_Steel"),
        ((78.0, -10.0, 0.0), -math.pi * 0.5, 30.0, "standard", "Jetway_Steel"),
        ((116.0, -10.0, 0.0), -math.pi * 0.5, 30.0, "standard", "Jetway_Steel"),
        ((154.0, -10.0, 0.0), -math.pi * 0.5, 30.0, "standard", "Jetway_Steel"),
        ((192.0, -10.0, 0.0), -math.pi * 0.5, 30.0, "standard", "Jetway_Steel"),
    ]
    return t, tower, beacon, apron, jetways


def build_EDDF(spec):
    """EDDF Frankfurt: T1 boomerang Pier A-Plus + circular knuckle rotundas + aerodynamic ship-like 'The Squaire' + 70m DFS ATCT."""
    t = MeshBuilder()
    # T1 main concourse + circular knuckle rotundas + boomerang Pier A-Plus
    t.add_box((0.0, 10.0, 8.0), (260.0, 44.0, 16.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, 10.0, 17.0), (268.0, 48.0, 2.2), mat="Terminal_Metal")
    t.add_pier((-125.0, 8.0), (-215.0, -35.0), width=26.0, height=14.0, rotunda_end=True)
    t.add_pier((125.0, 8.0), (205.0, -30.0), width=26.0, height=14.0, rotunda_end=True)
    # Iconic 320m aerodynamic ship-like "The Squaire" (Airrail Center) behind T1
    t.add_box((0.0, 82.0, 14.0), (280.0, 46.0, 24.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-160.0, 160.0), (54.0, 110.0), 22, 10,
        lambda u, v: 26.0 + 8.0 * math.sin(u * math.pi) * math.sin(v * math.pi),
        thickness=1.8, mat_top="Terminal_Metal", mat_bottom="Accent_Charcoal",
    )
    # Elevated pedestrian skybridge linking T1 and The Squaire
    t.add_box((0.0, 46.0, 12.0), (24.0, 32.0, 6.0), mat="Terminal_Glass_Emissive")

    tower, beacon = build_tower_classic(
        (115.0, -56.0), height=70.0, shaft_r=4.6, cab_r=8.6, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Charcoal", radome=True,
    )
    apron = build_apron(width=500.0, depth=260.0, offset_y=-45.0)
    jetways = make_linear_jetways(-165.0, 165.0, -14.0, -math.pi * 0.5, length=32.0, count=8)
    return t, tower, beacon, apron, jetways


def build_LEMD(spec):
    """LEMD Madrid-Barajas T4: Richard Rogers undulating bamboo M-wave roof + rainbow spectral Y-struts + 72m flared cone ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 18.0, 8.0), (340.0, 56.0, 16.0), mat="Terminal_Glass_Emissive")
    # Signature undulating M-wave gull-wing roof with warm golden bamboo soffit
    t.add_parametric_roof(
        (-182.0, 182.0), (-18.0, 54.0), 32, 12,
        lambda u, v: 18.0 + 5.8 * math.sin(u * math.pi * 6.0) + 3.2 * math.cos(v * math.pi * 2.0),
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )
    # Iconic Rainbow Spectral Y-shaped branching tree steel struts (Red -> Orange -> Yellow -> Green -> Blue)
    rainbow = ["Accent_Red", "Accent_Orange", "Accent_Yellow", "Accent_Green", "Accent_Blue"]
    for i in range(15):
        x = -168.0 + i * 24.0
        c_mat = rainbow[int((i / 15.0) * len(rainbow)) % len(rainbow)]
        # Y-trunk + dual upward forks supporting the undulating eaves
        t.add_cylinder((x, -12.0, 4.5), 0.75, 0.75, 9.0, segs=8, mat=c_mat)
        t.add_tube((x, -12.0, 9.0), (x - 5.5, -14.0, 18.5), 0.55, 6, c_mat)
        t.add_tube((x, -12.0, 9.0), (x + 5.5, -14.0, 18.5), 0.55, 6, c_mat)

    tower, beacon = build_tower_classic(
        (188.0, -25.0), height=72.0, shaft_r=4.2, cab_r=8.6, segs=18,
        shaft_mat="Terminal_White", band_mat="Accent_Yellow", dual_cab=True, radome=True,
    )
    apron = build_apron(width=460.0, depth=220.0, offset_y=-55.0)
    jetways = make_linear_jetways(-155.0, 155.0, -14.0, -math.pi * 0.5, length=32.0, count=8, accent_mat="Accent_Yellow")
    return t, tower, beacon, apron, jetways


def build_EHAM(spec):
    """EHAM Amsterdam Schiphol: Wedge single-terminal plaza + 5 radial spoke piers + 101m charcoal/sky-blue flared ATCT."""
    t = MeshBuilder()
    # Wedge-shaped main Schiphol Plaza hall with upward-sloping cantilevered canopy
    t.add_box((0.0, 26.0, 8.0), (220.0, 62.0, 16.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-120.0, 120.0), (-10.0, 62.0), 16, 8,
        lambda u, v: 16.5 + 7.5 * v,
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )
    # 5 radial finger piers branching out like spokes with circular tips
    for ang_deg in (-150.0, -120.0, -90.0, -60.0, -30.0):
        a = math.radians(ang_deg)
        p0 = (math.cos(a) * 45.0, 0.0)
        p1 = (math.cos(a) * 160.0, math.sin(a) * 125.0)
        t.add_pier(p0, p1, width=20.0, height=13.0, rotunda_end=True)

    tower, beacon = build_tower_special_sculpted((135.0, 42.0), height=101.0, style="flared_schiphol")
    apron = build_apron(width=460.0, depth=260.0, offset_y=-65.0)
    jetways = make_linear_jetways(-150.0, 150.0, -68.0, -math.pi * 0.5, length=30.0, count=8, accent_mat="Accent_Blue")
    return t, tower, beacon, apron, jetways


def build_LSZH(spec):
    """LSZH Zurich: Curved bow Airside Center + midfield airfoil Dock E + 62m sapphire-blue glass cylindrical ATCT."""
    t = MeshBuilder()
    t.add_curved_concourse_arc((0.0, 150.0), 140.0, math.radians(-128.0), math.radians(-52.0), width=40.0, height=16.0, segs=18)
    # Midfield Dock E concourse with sleek airfoil roof
    t.add_box((0.0, -82.0, 7.0), (230.0, 32.0, 14.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-122.0, 122.0), (-104.0, -60.0), 18, 8,
        lambda u, v: 14.5 + 4.2 * math.sin(v * math.pi),
        thickness=1.4, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    tower, beacon = build_tower_classic(
        (0.0, 18.0), height=62.0, shaft_r=4.8, cab_r=8.2, segs=20,
        shaft_mat="Accent_Blue", band_mat="Terminal_White", striped_bands=6, radome=True,
    )
    apron = build_apron(width=420.0, depth=240.0, offset_y=-55.0)
    jetways = make_linear_jetways(-105.0, 105.0, -100.0, -math.pi * 0.5, length=30.0, count=8, accent_mat="Accent_Red")
    return t, tower, beacon, apron, jetways


def build_LIRF(spec):
    """LIRF Rome Fiumicino: Travertine pilasters + dark glass 'La Nuvola' hall + vaulted Pier E + 75m red-white checkerboard ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 22.0, 8.0), (260.0, 56.0, 16.0), mat="Sandstone_Beige")
    t.add_box((0.0, 22.0, 9.0), (240.0, 58.0, 11.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-136.0, 136.0), (-10.0, 54.0), 18, 10,
        lambda u, v: 17.5 + 5.0 * math.sin(v * math.pi),
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Sandstone_Beige",
    )
    t.add_pier((0.0, -6.0), (0.0, -82.0), width=26.0, height=13.5, rotunda_end=True)
    tower, beacon = build_tower_classic(
        (142.0, -18.0), height=75.0, shaft_r=4.6, cab_r=8.6, segs=18,
        shaft_mat="Terminal_White", band_mat="Accent_Red", striped_bands=6, dual_cab=True, radome=True,
    )
    apron = build_apron(width=440.0, depth=240.0, offset_y=-60.0)
    jetways = make_linear_jetways(-120.0, 120.0, -10.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


# --- NORTH AMERICA (9) ---

def build_KJFK(spec):
    """KJFK New York JFK: Eero Saarinen TWA Flight Center thin-shell concrete bird wings + T4 dual piers + 98m flared FAA ATCT."""
    t = MeshBuilder()
    # 1) Eero Saarinen iconic Jet-Age TWA Flight Center (West landmark wing)
    tx, ty = -125.0, 26.0
    t.add_cylinder((tx, ty, 6.5), 34.0, 42.0, 13.0, segs=18, mat="Terminal_Glass_Emissive")
    # Dramatic thin-shell white concrete bird wings soaring upward on both sides
    t.add_parametric_roof(
        (tx - 64.0, tx + 64.0), (ty - 40.0, ty + 40.0), 22, 14,
        lambda u, v: 13.0
        + 16.0 * ((u - 0.5) * 2.0) ** 2 * (1.0 - 0.5 * abs(v - 0.5) * 2.0)
        + 5.5 * math.cos((u - 0.5) * math.pi) * math.cos((v - 0.5) * math.pi),
        thickness=1.6, mat_top="Terminal_White", mat_bottom="Terminal_White",
    )
    # Twin red-carpeted cylindrical departure tubes extending from TWA
    t.add_cylinder((tx - 18.0, ty - 48.0, 6.5), 4.2, 4.2, 42.0, segs=12, mat="Terminal_White", rot_euler=(math.pi * 0.5, 0.0, 0.25))
    t.add_cylinder((tx + 18.0, ty - 48.0, 6.5), 4.2, 4.2, 42.0, segs=12, mat="Terminal_White", rot_euler=(math.pi * 0.5, 0.0, -0.25))

    # 2) Modern Terminal 4 headhouse + dual-finger Concourses A & B (East)
    t.add_box((85.0, 28.0, 9.0), (190.0, 56.0, 18.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-15.0, 185.0), (-4.0, 60.0), 18, 8,
        lambda u, v: 18.5 + 4.5 * math.sin(v * math.pi),
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    t.add_pier((25.0, 0.0), (25.0, -96.0), width=26.0, height=14.0, roof_mat="Terminal_Metal")
    t.add_pier((145.0, 0.0), (145.0, -110.0), width=26.0, height=14.0, roof_mat="Terminal_Metal")

    tower, beacon = build_tower_classic(
        (-28.0, -44.0), height=98.0, shaft_r=4.8, cab_r=9.2, segs=16,
        shaft_mat="Terminal_White", band_mat="Accent_Charcoal", dual_cab=False, radome=True,
    )
    apron = build_apron(width=500.0, depth=270.0, offset_y=-55.0)
    jetways = [
        ((10.0, -25.0, 0.0), math.pi, 30.0, "standard", "Jetway_Steel"),
        ((10.0, -58.0, 0.0), math.pi, 30.0, "standard", "Jetway_Steel"),
        ((10.0, -88.0, 0.0), math.pi, 30.0, "standard", "Jetway_Steel"),
        ((40.0, -68.0, 0.0), 0.0, 30.0, "standard", "Jetway_Steel"),
        ((130.0, -35.0, 0.0), math.pi, 30.0, "standard", "Jetway_Steel"),
        ((130.0, -78.0, 0.0), math.pi, 30.0, "standard", "Jetway_Steel"),
        ((160.0, -35.0, 0.0), 0.0, 30.0, "standard", "Jetway_Steel"),
        ((160.0, -78.0, 0.0), 0.0, 30.0, "standard", "Jetway_Steel"),
    ]
    return t, tower, beacon, apron, jetways


def build_KLAX(spec):
    """KLAX Los Angeles: Googie Theme Building crossed parabolic arches + saucer + 15 illuminated 30m gateway pylons + TBIT wave roof + 84m sail ATCT."""
    t = MeshBuilder()
    # 1) Tom Bradley International Terminal (TBIT) with Pacific breaking-wave roofs
    t.add_box((0.0, -22.0, 8.5), (300.0, 52.0, 17.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-162.0, 162.0), (-54.0, 10.0), 28, 12,
        lambda u, v: 18.0 + 8.5 * math.sin(u * math.pi * 3.0) * (1.0 - 0.5 * v) + 4.5 * math.sin(v * math.pi),
        thickness=1.8, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )

    # 2) Iconic Googie Theme Building: two intersecting 41m white parabolic arches suspending flying saucer disc
    gx, gy = 0.0, 62.0
    t.add_parabolic_arch((gx - 42.0, gy, 0.0), (gx + 42.0, gy, 0.0), apex_z=41.0, radius=2.2, segs=18, mat="Terminal_White")
    t.add_parabolic_arch((gx, gy - 42.0, 0.0), (gx, gy + 42.0, 0.0), apex_z=41.0, radius=2.2, segs=18, mat="Terminal_White")
    # Central core & suspended flying-saucer observation restaurant disc
    t.add_cylinder((gx, gy, 11.0), 7.5, 6.5, 22.0, segs=16, mat="Terminal_White")
    t.add_cylinder((gx, gy, 21.5), 22.0, 26.0, 2.8, segs=24, mat="Terminal_White")
    t.add_cylinder((gx, gy, 24.4), 25.0, 25.0, 3.2, segs=24, mat="Glass_Magenta_Emissive")
    t.add_cylinder((gx, gy, 27.2), 26.0, 16.0, 2.8, segs=24, mat="Terminal_White")

    # 3) 15 illuminated 30m cylindrical translucent glass gateway light pylons
    pylon_mats = ("Glass_Cyan_Emissive", "Glass_Magenta_Emissive", "Terminal_Glass_Emissive")
    for k in range(15):
        ang = math.radians(-165.0 + k * 11.5)
        px = 115.0 + math.cos(ang) * 42.0
        py = 64.0 + math.sin(ang) * 28.0
        h_p = 22.0 + 10.0 * math.sin((k / 14.0) * math.pi)
        t.add_cylinder((px, py, h_p * 0.5), 1.9, 1.5, h_p, segs=10, mat=pylon_mats[k % 3])

    tower, beacon = build_tower_special_sculpted((-76.0, 62.0), height=84.0, style="lax_sail")
    apron = build_apron(width=460.0, depth=250.0, offset_y=-65.0)
    jetways = make_linear_jetways(-135.0, 135.0, -50.0, -math.pi * 0.5, length=34.0, count=8)
    return t, tower, beacon, apron, jetways


def build_KSFO(spec):
    """KSFO San Francisco: SOM 250m double-cantilevered inverted-truss butterfly wing roof + radial piers + 67m flared Torch ATCT."""
    t = MeshBuilder()
    # Main SOM International Terminal Hall (250m)
    t.add_box((0.0, 22.0, 9.0), (250.0, 62.0, 18.0), mat="Terminal_Glass_Emissive")
    # Monumental double-cantilevered butterfly gull-wing roof
    t.add_parametric_roof(
        (-138.0, 138.0), (-18.0, 62.0), 26, 12,
        lambda u, v: 20.0
        + 10.5 * ((u - 0.5) * 2.0) ** 2 * (1.0 - 0.35 * abs(v - 0.5) * 2.0)
        + 4.0 * math.cos((u - 0.5) * math.pi),
        thickness=1.8, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    # Exposed white inverted bowstring steel trusses over roof
    for x in range(-105, 110, 30):
        t.add_parabolic_arch((float(x), -16.0, 22.0), (float(x), 60.0, 22.0), apex_z=32.5, radius=0.85, segs=12, mat="Terminal_White")
    # Boarding Areas A & G radial finger piers
    t.add_pier((-110.0, -6.0), (-175.0, -78.0), width=24.0, height=13.5, roof_mat="Terminal_Metal")
    t.add_pier((110.0, -6.0), (175.0, -78.0), width=24.0, height=13.5, roof_mat="Terminal_Metal")

    tower, beacon = build_tower_sfo_torch((0.0, -68.0), height=67.0)
    apron = build_apron(width=460.0, depth=240.0, offset_y=-60.0)
    jetways = make_linear_jetways(-145.0, 145.0, -14.0, -math.pi * 0.5, length=32.0, count=8)
    return t, tower, beacon, apron, jetways


def build_KORD(spec):
    """KORD Chicago O'Hare: Helmut Jahn T1 parallel barrel-vaulted steel/glass Concourses B & C railway-shed arches + 77m ATCT."""
    t = MeshBuilder()
    # Two parallel 340m barrel-vaulted steel-and-glass concourses (B & C) separated by taxilane alley
    for cy in (36.0, -62.0):
        t.add_box((0.0, cy, 6.5), (330.0, 36.0, 13.0), mat="Terminal_Glass_Emissive")
        t.add_parametric_roof(
            (-170.0, 170.0), (cy - 20.0, cy + 20.0), 26, 10,
            lambda u, v: 13.0 + 7.5 * math.sin(v * math.pi) + 1.5 * math.cos(u * math.pi * 12.0),
            thickness=1.2, mat_top="Terminal_Glass_Emissive", mat_bottom="Terminal_Metal",
        )
        # Exposed steel barrel-vault rib frames
        for x in range(-150, 155, 30):
            t.add_parabolic_arch((float(x), cy - 20.0, 12.0), (float(x), cy + 20.0, 12.0), apex_z=21.5, radius=0.65, segs=10, mat="Accent_Charcoal")

    tower, beacon = build_tower_classic(
        (0.0, 96.0), height=77.0, shaft_r=5.0, cab_r=9.4, segs=6,
        shaft_mat="Terminal_White", band_mat="Accent_Blue", radome=True,
    )
    apron = build_apron(width=460.0, depth=260.0, offset_y=-30.0)
    jetways = (
        make_linear_jetways(-145.0, 145.0, 16.0, -math.pi * 0.5, length=28.0, count=4, accent_mat="Accent_Blue")
        + make_linear_jetways(-145.0, 145.0, -82.0, -math.pi * 0.5, length=28.0, count=4, accent_mat="Accent_Blue")
    )
    return t, tower, beacon, apron, jetways


def build_KSEA(spec):
    """KSEA Seattle-Tacoma: Crescent concave glass Central Terminal + 26m-high cable-stayed IAF Aerial Bridge over taxiway + 82m ATCT."""
    t = MeshBuilder()
    # Crescent Central Terminal with concave glass curtain wall
    t.add_curved_concourse_arc((0.0, 145.0), 130.0, math.radians(-132.0), math.radians(-48.0), width=42.0, height=18.5, segs=18)
    t.add_pier((-92.0, 32.0), (-155.0, -35.0), width=22.0, height=13.5)
    t.add_pier((92.0, 32.0), (155.0, -35.0), width=22.0, height=13.5)
    # South Satellite (S) across active taxiway
    t.add_box((0.0, -108.0, 7.5), (170.0, 34.0, 15.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, -108.0, 16.0), (176.0, 38.0, 2.0), mat="Terminal_Metal")
    # Landmark 26m-high cable-stayed IAF Aerial Walkway Bridge spanning directly over taxiway
    t.add_box((0.0, -45.0, 28.5), (16.0, 108.0, 6.5), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, -45.0, 32.2), (18.0, 112.0, 1.4), mat="Terminal_Metal")
    # Cable-stayed bridge A-pylon & stay cables
    t.add_box((0.0, -90.0, 18.0), (16.0, 10.0, 36.0), mat="Terminal_White")
    t.add_box((0.0, 4.0, 18.0), (16.0, 10.0, 36.0), mat="Terminal_White")
    t.add_tube((-8.0, -90.0, 48.0), (0.0, -90.0, 56.0), 1.0, 8, "Terminal_White")
    t.add_tube((8.0, -90.0, 48.0), (0.0, -90.0, 56.0), 1.0, 8, "Terminal_White")
    t.add_cylinder((-8.0, -90.0, 24.0), 1.2, 1.0, 48.0, segs=8, mat="Terminal_White")
    t.add_cylinder((8.0, -90.0, 24.0), 1.2, 1.0, 48.0, segs=8, mat="Terminal_White")
    for dy in (-65.0, -45.0, -25.0):
        t.add_tube((0.0, -90.0, 55.0), (-7.5, dy, 32.0), 0.25, 6, "Terminal_Metal")
        t.add_tube((0.0, -90.0, 55.0), (7.5, dy, 32.0), 0.25, 6, "Terminal_Metal")

    tower, beacon = build_tower_classic(
        (110.0, 55.0), height=82.0, shaft_r=4.6, cab_r=8.4, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Green", radome=True,
    )
    apron = build_apron(width=460.0, depth=260.0, offset_y=-55.0)
    jetways = (
        make_linear_jetways(-140.0, -35.0, -8.0, -math.pi * 0.5, length=30.0, count=4, accent_mat="Accent_Green")
        + make_linear_jetways(-72.0, 72.0, -126.0, -math.pi * 0.5, length=30.0, count=4, accent_mat="Accent_Green")
    )
    return t, tower, beacon, apron, jetways


def build_CYYZ(spec):
    """CYYZ Toronto Pearson: Moshe Safdie T1 18-bay stepped vaulted crescent + circular Hammerhead Pier F rotunda + 62m ATCT."""
    t = MeshBuilder()
    # Stepped vaulted crescent main hall
    t.add_curved_concourse_arc((0.0, 140.0), 130.0, math.radians(-135.0), math.radians(-45.0), width=42.0, height=17.0, segs=18)
    # Pier F extending south into massive circular "Hammerhead" rotunda
    t.add_pier((0.0, 10.0), (0.0, -68.0), width=26.0, height=14.0)
    t.add_cylinder((0.0, -92.0, 4.5), 42.0, 42.0, 9.0, segs=24, mat="Terminal_White")
    t.add_cylinder((0.0, -92.0, 11.0), 40.5, 40.5, 6.5, segs=24, mat="Terminal_Glass_Emissive")
    t.add_cylinder((0.0, -92.0, 15.5), 44.0, 38.0, 2.8, segs=24, mat="Terminal_Metal")

    tower, beacon = build_tower_classic(
        (118.0, 28.0), height=62.0, shaft_r=4.2, cab_r=8.0, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Red", dual_cab=True, radome=True,
    )
    apron = build_apron(width=440.0, depth=260.0, offset_y=-65.0)
    jetways = make_radial_jetways((0.0, -92.0), 43.0, math.radians(-210.0), math.radians(30.0), length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_PANC(spec):
    """PANC Anchorage: Jagged glacier-silhouette South Terminal + wide-span polar cargo sorting hub + 64m cold-climate ATCT."""
    t = MeshBuilder()
    t.add_box((-35.0, 18.0, 7.5), (210.0, 48.0, 15.0), mat="Terminal_Glass_Emissive")
    # Jagged glacier-inspired sawtooth roof
    t.add_parametric_roof(
        (-146.0, 76.0), (-10.0, 46.0), 20, 8,
        lambda u, v: 15.5 + 7.0 * abs(math.sin(u * math.pi * 4.0)) * (0.5 + 0.5 * v),
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Accent_Blue",
    )
    # Polar widebody cargo sorting warehouse on east flank
    t.add_box((150.0, 24.0, 8.0), (110.0, 62.0, 16.0), mat="Terminal_White")
    t.add_box((150.0, 24.0, 16.8), (114.0, 66.0, 1.8), mat="Accent_Blue")
    tower, beacon = build_tower_classic(
        (78.0, 56.0), height=64.0, shaft_r=4.4, cab_r=8.0, segs=6,
        shaft_mat="Terminal_Metal", band_mat="Accent_Blue", radome=True,
    )
    apron = build_apron(width=440.0, depth=220.0, offset_y=-55.0)
    jetways = make_linear_jetways(-130.0, 65.0, -8.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_PHNL(spec):
    """PHNL Honolulu: Polynesian pitched pavilion roofs + Mauka surfboard ocean-wave roof + 79m coral-white ATCT."""
    t = MeshBuilder()
    # Main Overseas Terminal with Polynesian hip pavilions
    for px in (-95.0, 0.0, 95.0):
        t.add_box((px, 24.0, 6.0), (74.0, 44.0, 12.0), mat="Sandstone_Beige")
        t.add_box((px, 24.0, 7.0), (70.0, 45.5, 6.5), mat="Terminal_Glass_Emissive")
        t.add_cylinder((px, 24.0, 15.5), 42.0, 12.0, 7.0, segs=4, mat="Terracotta_Tile", rot_euler=(0, 0, math.pi * 0.25))
    # Mauka Concourse wave roof wing
    t.add_box((0.0, -28.0, 6.5), (240.0, 32.0, 13.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-128.0, 128.0), (-48.0, -8.0), 22, 8,
        lambda u, v: 13.5 + 4.5 * math.sin(u * math.pi * 3.0) * math.sin(v * math.pi),
        thickness=1.4, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    tower, beacon = build_tower_classic(
        (150.0, -10.0), height=79.0, shaft_r=4.6, cab_r=8.6, segs=12,
        shaft_mat="Sandstone_Beige", band_mat="Accent_Blue", dual_cab=True, radome=True,
    )
    apron = build_apron(width=440.0, depth=230.0, offset_y=-60.0, deck_mat="Sandstone_Beige")
    jetways = make_linear_jetways(-112.0, 112.0, -46.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_CYVR(spec):
    """CYVR Vancouver: Coast Salish stepped timber eaves + teal coastal glass + Pier D glazed drum atrium + 65m white ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 20.0, 7.5), (270.0, 52.0, 15.0), mat="Terminal_Glass_Emissive")
    # Multi-tiered Coast Salish stepped roof with warm cedar soffits
    t.add_box((0.0, 20.0, 16.0), (282.0, 58.0, 2.0), mat="Accent_Charcoal")
    t.add_box((0.0, 22.0, 19.5), (210.0, 42.0, 3.8), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, 22.0, 22.2), (222.0, 48.0, 2.0), mat="Accent_Gold")
    # Pier D glazed forest drum rotunda
    t.add_pier((85.0, -6.0), (115.0, -68.0), width=24.0, height=13.5, rotunda_end=True)
    tower, beacon = build_tower_classic(
        (-138.0, -30.0), height=65.0, shaft_r=4.2, cab_r=8.4, segs=16,
        shaft_mat="Terminal_White", band_mat="Accent_Green", radome=True,
    )
    apron = build_apron(width=420.0, depth=230.0, offset_y=-55.0)
    jetways = make_linear_jetways(-120.0, 120.0, -8.0, -math.pi * 0.5, length=30.0, count=8, accent_mat="Accent_Green")
    return t, tower, beacon, apron, jetways


# --- OCEANIA, SOUTH AMERICA & AFRICA (8) ---

def build_YSSY(spec):
    """YSSY Sydney: T1 curved plaza + twin sweeping corrugated wave Piers B & C + Ken Woolley 48m external spiral staircase ATCT."""
    t = MeshBuilder()
    # Central departure hall + twin sweeping arc corrugated wave piers
    t.add_box((0.0, 28.0, 8.0), (180.0, 52.0, 16.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-98.0, 98.0), (-2.0, 58.0), 18, 10,
        lambda u, v: 16.8 + 4.5 * math.sin(u * math.pi * 3.0) * math.sin(v * math.pi),
        thickness=1.4, mat_top="Terminal_Metal", mat_bottom="Terminal_White",
    )
    # Twin curved Piers B & C with semi-circular tip pods
    t.add_pier((-75.0, 4.0), (-155.0, -72.0), width=26.0, height=13.5, roof_mat="Terminal_Metal", rotunda_end=True)
    t.add_pier((75.0, 4.0), (155.0, -72.0), width=26.0, height=13.5, roof_mat="Terminal_Metal", rotunda_end=True)

    tower, beacon = build_tower_sydney_spiral((0.0, -68.0), height=48.0)
    apron = build_apron(width=460.0, depth=240.0, offset_y=-55.0)
    jetways = [
        ((-140.0, -40.0, 0.0), -2.35, 30.0, "standard", "Accent_Red"),
        ((-108.0, -18.0, 0.0), -2.25, 30.0, "standard", "Accent_Red"),
        ((-75.0, -22.0, 0.0), -0.8, 30.0, "standard", "Accent_Red"),
        ((-155.0, -90.0, 0.0), -1.57, 30.0, "standard", "Accent_Red"),
        ((75.0, -22.0, 0.0), -2.35, 30.0, "standard", "Accent_Red"),
        ((108.0, -18.0, 0.0), -0.9, 30.0, "standard", "Accent_Red"),
        ((140.0, -40.0, 0.0), -0.8, 30.0, "standard", "Accent_Red"),
        ((155.0, -90.0, 0.0), -1.57, 30.0, "standard", "Accent_Red"),
    ]
    return t, tower, beacon, apron, jetways


def build_MMMX(spec):
    """MMMX Mexico City: Francisco Serrano T2 Aztec chiselled-concrete circular drum rotunda + symmetrical L-piers + 58m conical ATCT."""
    t = MeshBuilder()
    # Monumental circular Aztec hammered-concrete drum rotunda with open central courtyard
    t.add_curved_concourse_arc((0.0, 26.0), 48.0, 0.0, 2.0 * math.pi, width=26.0, height=19.0, segs=24, roof_mat="Terminal_White", wall_mat="Sandstone_Beige")
    # Symmetrical thick L-shaped North & South finger piers embracing circular apron
    t.add_pier((-58.0, 26.0), (-155.0, 26.0), width=26.0, height=14.0, roof_mat="Terminal_White", wall_mat="Sandstone_Beige")
    t.add_pier((-145.0, 26.0), (-145.0, -82.0), width=26.0, height=14.0, roof_mat="Terminal_White", wall_mat="Sandstone_Beige")
    t.add_pier((58.0, 26.0), (155.0, 26.0), width=26.0, height=14.0, roof_mat="Terminal_White", wall_mat="Sandstone_Beige")
    t.add_pier((145.0, 26.0), (145.0, -82.0), width=26.0, height=14.0, roof_mat="Terminal_White", wall_mat="Sandstone_Beige")

    tower, beacon = build_tower_classic(
        (0.0, -78.0), height=58.0, shaft_r=4.2, cab_r=8.2, segs=18,
        shaft_mat="Terminal_White", band_mat="Accent_Blue", dual_cab=True, radome=True,
    )
    apron = build_apron(width=440.0, depth=240.0, offset_y=-45.0)
    jetways = [
        ((-130.0, -6.0, 0.0), 0.0, 28.0, "standard", "Accent_Blue"),
        ((-130.0, -36.0, 0.0), 0.0, 28.0, "standard", "Accent_Blue"),
        ((-130.0, -66.0, 0.0), 0.0, 28.0, "standard", "Accent_Blue"),
        ((-160.0, -45.0, 0.0), math.pi, 28.0, "standard", "Accent_Blue"),
        ((130.0, -6.0, 0.0), math.pi, 28.0, "standard", "Accent_Blue"),
        ((130.0, -36.0, 0.0), math.pi, 28.0, "standard", "Accent_Blue"),
        ((130.0, -66.0, 0.0), math.pi, 28.0, "standard", "Accent_Blue"),
        ((160.0, -45.0, 0.0), 0.0, 28.0, "standard", "Accent_Blue"),
    ]
    return t, tower, beacon, apron, jetways


def build_YMML(spec):
    """YMML Melbourne: Unified crescent terminal + angular T2 boomerang T-head Pier D + 78m chamfered white ATCT."""
    t = MeshBuilder()
    t.add_curved_concourse_arc((0.0, 155.0), 140.0, math.radians(-130.0), math.radians(-50.0), width=40.0, height=15.5, segs=18)
    # Protruding T2 boomerang hammerhead pier
    t.add_pier((0.0, 18.0), (0.0, -66.0), width=24.0, height=13.5, roof_mat="Accent_Charcoal")
    t.add_pier((-92.0, -82.0), (0.0, -66.0), width=22.0, height=13.5, roof_mat="Accent_Charcoal")
    t.add_pier((0.0, -66.0), (92.0, -82.0), width=22.0, height=13.5, roof_mat="Accent_Charcoal")
    tower, beacon = build_tower_classic(
        (132.0, 22.0), height=78.0, shaft_r=4.6, cab_r=8.4, segs=6,
        shaft_mat="Terminal_White", band_mat="Accent_Charcoal", radome=False,
    )
    apron = build_apron(width=440.0, depth=240.0, offset_y=-60.0)
    jetways = make_linear_jetways(-85.0, 85.0, -88.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_NZAA(spec):
    """NZAA Auckland: Pacific stingray wave-wing roof + Pier A & Y-pronged Pier B + 48m white octagonal ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 20.0, 7.5), (250.0, 48.0, 15.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-136.0, 136.0), (-12.0, 52.0), 22, 10,
        lambda u, v: 15.5 + 5.8 * math.sin(u * math.pi * 2.0) * math.sin(v * math.pi),
        thickness=1.4, mat_top="Terminal_White", mat_bottom="Accent_Gold",
    )
    t.add_pier((-95.0, -4.0), (-95.0, -66.0), width=22.0, height=13.0, rotunda_end=True)
    t.add_pier((95.0, -4.0), (140.0, -66.0), width=22.0, height=13.0)
    tower, beacon = build_tower_classic(
        (145.0, 24.0), height=48.0, shaft_r=4.0, cab_r=7.6, segs=8,
        shaft_mat="Terminal_White", band_mat="Accent_Green", radome=True,
    )
    apron = build_apron(width=420.0, depth=220.0, offset_y=-55.0)
    jetways = make_linear_jetways(-120.0, 120.0, -10.0, -math.pi * 0.5, length=30.0, count=8, accent_mat="Accent_Green")
    return t, tower, beacon, apron, jetways


def build_SBGR(spec):
    """SBGR Sao Paulo Guarulhos: T1/T2 4 winged butterfly piers + T3 S-curved wave hall with Brazilian timber soffit + 66m ATCT."""
    t = MeshBuilder()
    # T3 S-curved wave hall
    t.add_box((0.0, 22.0, 8.0), (280.0, 54.0, 16.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-150.0, 150.0), (-12.0, 56.0), 24, 10,
        lambda u, v: 17.0 + 5.5 * math.sin(u * math.pi * 2.0) + 3.5 * math.sin(v * math.pi),
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Accent_Gold",
    )
    # 4 iconic winged finger piers
    for px in (-112.0, -38.0, 38.0, 112.0):
        t.add_pier((px, -6.0), (px, -66.0), width=22.0, height=13.5, roof_mat="Terminal_White")
    tower, beacon = build_tower_classic(
        (158.0, -20.0), height=66.0, shaft_r=4.4, cab_r=8.2, segs=6,
        shaft_mat="Terminal_White", band_mat="Accent_Red", dual_cab=True, radome=True,
    )
    apron = build_apron(width=440.0, depth=230.0, offset_y=-55.0)
    jetways = make_linear_jetways(-125.0, 125.0, -68.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_SCEL(spec):
    """SCEL Santiago: ADPi Andean wave-wing processor + 4 boomerang Espigones piers + 65m seismic buttress ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 24.0, 8.0), (260.0, 56.0, 16.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-142.0, 142.0), (-12.0, 60.0), 24, 10,
        lambda u, v: 17.0 + 6.5 * math.sin(u * math.pi * 3.0) * math.sin(v * math.pi),
        thickness=1.6, mat_top="Terminal_Metal", mat_bottom="Terracotta_Tile",
    )
    for x0, x1 in ((-110.0, -155.0), (-38.0, -65.0), (38.0, 65.0), (110.0, 155.0)):
        t.add_pier((x0, -6.0), (x1, -68.0), width=20.0, height=13.0, roof_mat="Terminal_Metal")
    tower, beacon = build_tower_classic(
        (0.0, -86.0), height=65.0, shaft_r=4.4, cab_r=8.2, segs=8,
        shaft_mat="Terminal_White", band_mat="Terracotta_Tile", radome=True,
    )
    apron = build_apron(width=440.0, depth=240.0, offset_y=-60.0)
    jetways = make_linear_jetways(-145.0, 145.0, -70.0, -math.pi * 0.5, length=30.0, count=8)
    return t, tower, beacon, apron, jetways


def build_HECA(spec):
    """HECA Cairo: Sahara sandstone sunshade canopy + circular skylight domes + V-piers + 112m Egyptian Lotus-Column ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 22.0, 8.0), (260.0, 60.0, 16.0), mat="Sandstone_Beige")
    t.add_box((0.0, 22.0, 9.0), (245.0, 61.5, 9.0), mat="Terminal_Glass_Emissive")
    t.add_box((0.0, 22.0, 17.5), (274.0, 68.0, 2.2), mat="Accent_Gold")
    for dx in (-80.0, 0.0, 80.0):
        t.add_sphere((dx, 22.0, 18.5), 18.0, segs=16, rings=8, mat="Terminal_Glass_Emissive", scale=(1.0, 1.0, 0.45))
    t.add_pier((-65.0, -8.0), (-135.0, -78.0), width=24.0, height=13.5, roof_mat="Sandstone_Beige")
    t.add_pier((65.0, -8.0), (135.0, -78.0), width=24.0, height=13.5, roof_mat="Sandstone_Beige")
    tower, beacon = build_tower_special_sculpted((0.0, -78.0), height=112.0, style="lotus")
    apron = build_apron(width=450.0, depth=240.0, offset_y=-60.0, deck_mat="Sandstone_Beige")
    jetways = make_linear_jetways(-120.0, 120.0, -14.0, -math.pi * 0.5, length=32.0, count=8, accent_mat="Sandstone_Beige")
    return t, tower, beacon, apron, jetways


def build_FAOR(spec):
    """FAOR Johannesburg O.R. Tambo: Central bowstring barrel-vault atrium + curved Pier A + 60m terracotta-banded ATCT."""
    t = MeshBuilder()
    t.add_box((0.0, 24.0, 8.5), (250.0, 56.0, 17.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-132.0, 132.0), (-10.0, 58.0), 20, 10,
        lambda u, v: 17.0 + 7.5 * math.sin(v * math.pi),
        thickness=1.5, mat_top="Terminal_Metal", mat_bottom="Terracotta_Tile",
    )
    for x in range(-110, 115, 28):
        t.add_parabolic_arch((float(x), -10.0, 16.0), (float(x), 58.0, 16.0), apex_z=26.5, radius=0.8, segs=10, mat="Terminal_Metal")
    t.add_curved_concourse_arc((0.0, -110.0), 105.0, math.radians(38.0), math.radians(142.0), width=26.0, height=14.0, segs=16)
    tower, beacon = build_tower_classic(
        (145.0, 12.0), height=60.0, shaft_r=4.4, cab_r=8.2, segs=6,
        shaft_mat="Terminal_White", band_mat="Terracotta_Tile", dual_cab=True, radome=True,
    )
    apron = build_apron(width=440.0, depth=240.0, offset_y=-55.0)
    jetways = make_linear_jetways(-115.0, 115.0, -12.0, -math.pi * 0.5, length=32.0, count=8, accent_mat="Terracotta_Tile")
    return t, tower, beacon, apron, jetways


# --- SMART REGIONAL FALLBACK BUILDER (safety net for any future ICAO code) ---

def build_regional_smart(spec):
    """Smart regional architectural builder adapting to region & runway length."""
    region = spec.get("region", "ea")
    runway_len = float(spec.get("length", 3500))
    scale = max(0.55, min(1.15, runway_len / 3600.0))

    palette = {
        "tw": ("Terminal_White", "Accent_Orange", "Concrete_Apron", 44.0),
        "ea": ("Terminal_Metal", "Accent_Blue", "Concrete_Apron", 68.0),
        "sea": ("Terminal_White", "Accent_Gold", "Concrete_Apron", 72.0),
        "me": ("Terminal_Metal", "Accent_Gold", "Sandstone_Beige", 82.0),
        "eu": ("Terminal_Metal", "Accent_Charcoal", "Concrete_Apron", 70.0),
        "na": ("Terminal_Metal", "Accent_Blue", "Concrete_Apron", 74.0),
        "oc": ("Terminal_White", "Accent_Green", "Concrete_Apron", 56.0),
        "sa": ("Sandstone_Beige", "Terracotta_Tile", "Concrete_Apron", 62.0),
    }
    roof_mat, accent_mat, apron_mat, base_tower_h = palette.get(
        region, ("Terminal_Metal", "Accent_Blue", "Concrete_Apron", 60.0)
    )

    span = 260.0 * scale
    depth = 52.0 * scale
    t = MeshBuilder()
    t.add_box((0.0, 20.0, 7.5), (span, depth, 15.0), mat="Terminal_Glass_Emissive")
    t.add_parametric_roof(
        (-span * 0.54, span * 0.54), (20.0 - depth * 0.62, 20.0 + depth * 0.62), 20, 10,
        lambda u, v: 15.5 + 4.8 * math.sin(u * math.pi * 2.0) * math.sin(v * math.pi),
        thickness=1.5, mat_top=roof_mat, mat_bottom=accent_mat,
    )
    tower, beacon = build_tower_classic(
        (span * 0.52, 22.0), height=base_tower_h * max(0.7, scale), shaft_r=4.2, cab_r=7.8, segs=8,
        shaft_mat="Terminal_White", band_mat=accent_mat, radome=True,
    )
    apron = build_apron(width=span * 1.65, depth=210.0, offset_y=-55.0, deck_mat=apron_mat)
    jetways = make_linear_jetways(-span * 0.44, span * 0.44, 20.0 - depth * 0.52, -math.pi * 0.5, length=30.0 * scale, count=8, accent_mat=accent_mat)
    return t, tower, beacon, apron, jetways


# =============================================================================
# 6. BUILDER DISPATCH REGISTRY (ALL 62 BESPOKE ARCHITECTURAL BUILDERS)
# =============================================================================

BESPOKE_BUILDERS = {
    # Taiwan & Carrier (11)
    "RCTP": build_RCTP,
    "RCSS": build_RCSS,
    "RCKH": build_RCKH,
    "RCMQ": build_RCMQ,
    "RCBS": build_RCBS,
    "RCLY": build_RCLY,
    "CVN78": build_CVN78,
    "RCYU": build_RCYU,
    "RCFN": build_RCFN,
    "RCQC": build_RCQC,
    "RCGI": build_RCGI,
    # East Asia (15)
    "RJAA": build_RJAA,
    "RJTT": build_RJTT,
    "RJBB": build_RJBB,
    "VHHH": build_VHHH,
    "ROAH": build_ROAH,
    "RKSI": build_RKSI,
    "ZSPD": build_ZSPD,
    "ZBAA": build_ZBAA,
    "ZGGG": build_ZGGG,
    "ZGSZ": build_ZGSZ,
    "VMMC": build_VMMC,
    "RJCC": build_RJCC,
    "RJFF": build_RJFF,
    "RJOO": build_RJOO,
    "RKPC": build_RKPC,
    # Southeast & South Asia (9)
    "WSSS": build_WSSS,
    "RPLL": build_RPLL,
    "VTBS": build_VTBS,
    "WMKK": build_WMKK,
    "WIII": build_WIII,
    "VVNB": build_VVNB,
    "VVTS": build_VVTS,
    "VIDP": build_VIDP,
    "VABB": build_VABB,
    # Middle East (3)
    "OMDB": build_OMDB,
    "OTHH": build_OTHH,
    "LTFM": build_LTFM,
    # Europe (7)
    "EGLL": build_EGLL,
    "LFPG": build_LFPG,
    "EDDF": build_EDDF,
    "EHAM": build_EHAM,
    "LSZH": build_LSZH,
    "LIRF": build_LIRF,
    "LEMD": build_LEMD,
    # North America (9)
    "KJFK": build_KJFK,
    "KLAX": build_KLAX,
    "KSFO": build_KSFO,
    "KORD": build_KORD,
    "KSEA": build_KSEA,
    "PANC": build_PANC,
    "PHNL": build_PHNL,
    "CYVR": build_CYVR,
    "CYYZ": build_CYYZ,
    # Oceania, South America & Africa (8)
    "YSSY": build_YSSY,
    "YMML": build_YMML,
    "NZAA": build_NZAA,
    "SBGR": build_SBGR,
    "MMMX": build_MMMX,
    "SCEL": build_SCEL,
    "HECA": build_HECA,
    "FAOR": build_FAOR,
}


# =============================================================================
# 7. SCENE ASSEMBLY & GLB EXPORT ORCHESTRATOR
# =============================================================================

def count_scene_triangles():
    total = 0
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.data is not None:
            for poly in obj.data.polygons:
                total += max(1, len(poly.vertices) - 2)
    return total


def build_and_export_airport(spec, out_dir):
    """Build a single airport complex with all required named sub-objects and export GLB."""
    code = spec["code"]
    clear_scene()
    materials = build_material_library()

    # Create root empty node
    root = bpy.data.objects.new(f"Airport_{code}_Root", None)
    bpy.context.scene.collection.objects.link(root)

    builder_fn = BESPOKE_BUILDERS.get(code, build_regional_smart)
    terminal_bm, tower_bm, beacon_xyz, apron_bm, jetway_specs = builder_fn(spec)

    # 1. Terminal_Main
    terminal_bm.to_object("Terminal_Main", root, materials)

    # 2. Control_Tower
    tower_bm.to_object("Control_Tower", root, materials)

    # 3. Tower_Beacon_Light
    beacon_bm = MeshBuilder()
    beacon_bm.add_sphere(beacon_xyz, radius=1.35, segs=12, rings=8, mat="Tower_Beacon_Emissive")
    beacon_bm.to_object("Tower_Beacon_Light", root, materials)

    # 4. Apron_Ground
    apron_bm.to_object("Apron_Ground", root, materials)

    # 5. Jetway_01 .. Jetway_08 (strictly 8 named objects guaranteed)
    if len(jetway_specs) < 8:
        pad = make_linear_jetways(-100.0, 100.0, -15.0, -math.pi * 0.5, length=28.0, count=8)
        jetway_specs = list(jetway_specs) + pad[len(jetway_specs):8]
    for idx in range(8):
        base_xyz, angle_rad, length, style, accent_mat = jetway_specs[idx]
        jw_name = f"Jetway_{idx + 1:02d}"
        build_jetway_object(
            jw_name,
            root,
            materials,
            base_xyz=base_xyz,
            angle_rad=angle_rad,
            length=length,
            style=style,
            accent_mat=accent_mat,
        )

    tris = count_scene_triangles()
    out_path = Path(out_dir) / f"{code}.glb"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        export_draco_mesh_compression_enable=False,
        export_yup=True,
    )
    return out_path, tris


def resolve_selected_airports():
    """Determine which airports to build from SKYBOUND_AIRPORTS env var or CLI `--airports`."""
    raw = os.environ.get("SKYBOUND_AIRPORTS", "ALL").strip()

    # Optional CLI override after `--`: e.g. `-- --airports RCTP,WSSS`
    if "--" in sys.argv:
        extra = sys.argv[sys.argv.index("--") + 1 :]
        for i, tok in enumerate(extra):
            if tok == "--airports" and i + 1 < len(extra):
                raw = extra[i + 1].strip()
            elif tok.startswith("--airports="):
                raw = tok.split("=", 1)[1].strip()

    if not raw or raw.upper() == "ALL":
        return list(AIRPORTS)

    selected = []
    seen = set()
    for token in raw.split(","):
        code = token.strip().upper()
        if not code or code in seen:
            continue
        if code in AIRPORT_MAP:
            selected.append(AIRPORT_MAP[code])
            seen.add(code)
        else:
            print(f"[WARN] Unknown ICAO code '{code}' ignored (not in 62-airport inventory).")
    return selected


def main():
    script_dir = Path(__file__).resolve().parent
    default_out = script_dir.parent / "dist" / "models" / "airports"
    out_dir = Path(os.environ.get("SKYBOUND_OUT_DIR", str(default_out))).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    targets = resolve_selected_airports()
    if not targets:
        print("[ERROR] No valid airports selected for export.")
        sys.exit(1)

    print(
        f"[SKYBOUND] Blender {bpy.app.version_string} | Exporting {len(targets)} / {len(AIRPORTS)} airports -> {out_dir}"
    )

    exported = []
    for idx, spec in enumerate(targets, start=1):
        code = spec["code"]
        name = spec["name"]
        out_path, tris = build_and_export_airport(spec, out_dir)
        size_kb = out_path.stat().st_size / 1024.0 if out_path.exists() else 0.0
        print(f"  [{idx:02d}/{len(targets):02d}] {code:<5s} ({name}) -> {out_path.name} | {tris:,} tris | {size_kb:.1f} KB")
        exported.append((code, out_path, tris))

    print(f"[SKYBOUND] Done! Successfully exported {len(exported)} airport GLB files to {out_dir}")


if __name__ == "__main__":
    main()
