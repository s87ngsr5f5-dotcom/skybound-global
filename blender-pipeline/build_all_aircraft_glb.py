#!/usr/bin/env python3
"""
SKYBOUND GLOBAL — Production 100-Aircraft Procedural Blender GLB Pipeline
=========================================================================

Generates realistic, game-ready 3D `.glb` models for all 100 aircraft and
helicopters in the SKYBOUND GLOBAL fleet using pure Blender `bmesh` geometry
(NACA 4-digit airfoil lofted wings, multi-station lofted fuselages, recessed
turbofan nacelles with animated fan blade hubs, turboprop hubs, turkey-feather
afterburner nozzles, retractable tricycle/bogie/skid landing gear, and
dedicated architectural presets across all 6 airframe classes).

Coordinate System & Engine Conventions (`dist/downloaded-aircraft.js`):
  - Scale: 1 Blender unit = 1 real-world meter.
  - Blender build axes: +Y = Nose Forward, +X = Starboard Right, +Z = Dorsal Up.
  - Exported with `export_yup=True`, mapping cleanly to Three.js:
      * Nose faces -Z (forward)
      * Dorsal faces +Y (up)
      * Starboard faces +X (right)
      * Lowest tire/skid contact sits at Y = 0.0 (Blender Z = 0.0)
  - Separate named sub-objects for game animation & gear toggling:
      * `Fuselage`
      * `Canopy_Glass` or `Windshield_Glass`
      * `Wings` (fixed-wing & AH-64 stub wings)
      * `Landing_Gear`, `Tires`
      * `Nozzle_L`, `Nozzle_R` (fighters & jet trainers)
      * `Fan_Blades_1..N` (turbofan airliners, cargo jets, business jets)
      * `Propeller_Hub_1..N` (piston & turboprop aircraft)
      * `Main_Rotor_Hub`, `Tail_Rotor` (helicopters)
      * `Wing_Fold_Outer_L`, `Wing_Fold_Outer_R`, `Tailhook` (`fa18c`, `f14b`)

Compatibility:
  - Blender 3.6 LTS through Blender 4.3+ (handles Principled BSDF input renames,
    smooth shading API changes, and EEVEE/glTF alpha blend differences).

Usage:
  # Export top 16 flagship hero aircraft (default):
  blender --background --python blender-pipeline/build_all_aircraft_glb.py

  # Export ALL 100 aircraft and helicopters:
  SKYBOUND_AIRCRAFT=ALL blender --background --python blender-pipeline/build_all_aircraft_glb.py

  # Export specific aircraft by comma-separated IDs:
  SKYBOUND_AIRCRAFT=fa18c,b773,an124,hondajet,ah64 blender --background --python blender-pipeline/build_all_aircraft_glb.py
"""

from __future__ import annotations

import math
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

try:
    import bpy
    import bmesh
    from mathutils import Euler, Matrix, Vector
    HAS_BPY = True
except ImportError:
    bpy = None  # type: ignore[assignment]
    bmesh = None  # type: ignore[assignment]
    Euler = Matrix = Vector = None  # type: ignore[assignment]
    HAS_BPY = False


# =============================================================================
# 1. LIVERY PALETTE HELPERS & 100-AIRCRAFT MASTER CATALOG
# =============================================================================

def _rgb(hex_str: str) -> Tuple[float, float, float]:
    """Convert #RRGGBB hex string to linear-space RGB tuple for Blender PBR."""
    h = hex_str.lstrip("#")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0

    def to_lin(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (to_lin(r), to_lin(g), to_lin(b))


def _livery(
    primary: str,
    secondary: str,
    accent: str,
    belly: str = "#cfd6dc",
    radome: str = "#dfe4e8",
    glass: str = "#1a2836",
    finish: str = "gloss",
) -> Dict[str, Any]:
    return {
        "primary": _rgb(primary),
        "secondary": _rgb(secondary),
        "accent": _rgb(accent),
        "belly": _rgb(belly),
        "radome": _rgb(radome),
        "glass": _rgb(glass),
        "finish": finish,
    }


def _spec(
    ac_id: str,
    name: str,
    role: str,
    preset_class: str,
    length: float,
    span: float,
    height: float,
    engines: int,
    propulsion: str,
    wing_pos: str,
    tail_type: str,
    gear_type: str,
    livery: Dict[str, Any],
    features: Sequence[str] = (),
    fuselage_radius: Optional[float] = None,
    prop_blades: int = 4,
    rotor_blades: int = 4,
) -> Dict[str, Any]:
    return {
        "id": ac_id,
        "name": name,
        "role": role,
        "preset_class": preset_class,
        "length": float(length),
        "span": float(span),
        "height": float(height),
        "engines": int(engines),
        "propulsion": propulsion,
        "wing_pos": wing_pos,
        "tail_type": tail_type,
        "gear_type": gear_type,
        "livery": livery,
        "features": tuple(features),
        "fuselage_radius": fuselage_radius,
        "prop_blades": int(prop_blades),
        "rotor_blades": int(rotor_blades),
    }


# Reusable aviation liveries
LIV_USN_GHOST = _livery("#8d969e", "#6f7982", "#26323e", "#adb4ba", "#7c838a", "#26313d", "matte")
LIV_ROCAF_GRAY = _livery("#7e8994", "#5c6873", "#2b3845", "#9ca6af", "#687078", "#5c4d24", "matte")
LIV_USAF_VIPER = _livery("#6d7782", "#515b66", "#d89a2b", "#969fa8", "#5b626b", "#5c4d24", "matte")
LIV_STEALTH_F22 = _livery("#6e767e", "#525a62", "#3f474f", "#8a9199", "#5c636b", "#7a5e22", "stealth")
LIV_STEALTH_F35 = _livery("#4d535a", "#3c4249", "#6a7178", "#555c63", "#494f56", "#7a5e22", "stealth")
LIV_EURO_GRAY = _livery("#848d95", "#68717a", "#3b4652", "#9da5ac", "#707880", "#22303c", "matte")
LIV_FLANKER_BLUE = _livery("#7999b2", "#4e718c", "#d64538", "#9cb8cc", "#dce2e6", "#23323e", "matte")
LIV_MIG_GRAY = _livery("#869092", "#657173", "#b83c32", "#a2abac", "#5d6468", "#222e38", "matte")
LIV_TRAINER_RED = _livery("#e8edf2", "#c8262e", "#1e3a66", "#d2d9e0", "#22262b", "#1d2a36", "gloss")
LIV_TRAINER_HAWK = _livery("#1f242b", "#c92a2a", "#f0b429", "#2a3038", "#181c22", "#1e2c38", "gloss")
LIV_AT3_TIGER = _livery("#f0f3f6", "#c62828", "#1d4485", "#dce2e8", "#1f242a", "#1e2c38", "gloss")

LIV_AIRBUS_HOUSE = _livery("#f4f6f8", "#0b3c78", "#0098d8", "#d7dfe6", "#eef2f5", "#15222e", "gloss")
LIV_BOEING_HOUSE = _livery("#f5f7fa", "#0039a6", "#00a0df", "#d8e0e8", "#eef2f6", "#15222e", "gloss")
LIV_CHINA_AIRLINES = _livery("#f6f7f9", "#1d3b72", "#d84a7e", "#dce2e8", "#eff2f5", "#15222e", "gloss")
LIV_EVA_AIR = _livery("#f5f7f6", "#00693e", "#f37021", "#dbe2de", "#eff3f1", "#15222e", "gloss")
LIV_STARLUX = _livery("#f6f4ef", "#3c322b", "#b69864", "#dfd9cf", "#f0ede6", "#16202b", "gloss")
LIV_EMBRAER = _livery("#f5f7f9", "#0c4da2", "#d89c28", "#d8dfe6", "#eef2f5", "#15222e", "gloss")
LIV_REGIONAL_PROP = _livery("#f5f6f8", "#1a4e8a", "#e05a2b", "#d5dce2", "#262b30", "#162430", "gloss")

LIV_ATLAS_CARGO = _livery("#f4f5f7", "#003b71", "#d4a024", "#d6dce2", "#edf0f4", "#15222e", "gloss")
LIV_ANTONOV = _livery("#eef1f4", "#1b5ea8", "#f2c12e", "#cfd7df", "#e5e9ee", "#172730", "gloss")
LIV_FEDEX_STYLE = _livery("#f4f5f7", "#4d148c", "#ff6600", "#d8dde3", "#eceff3", "#15222e", "gloss")
LIV_UPS_STYLE = _livery("#f4f4f2", "#3b2314", "#d9a01b", "#d6d4ce", "#eae8e2", "#16222c", "gloss")
LIV_MIL_AMC_GRAY = _livery("#6d757c", "#565e65", "#3d444b", "#7a8289", "#525960", "#1a2630", "matte")

LIV_BIZ_LUXURY = _livery("#f6f7f9", "#1d2d44", "#c49a45", "#d9dfe5", "#f0f2f5", "#14202b", "gloss")
LIV_BIZ_HONDA = _livery("#f5f7fa", "#005baa", "#b8c4d0", "#d7dfe6", "#eef2f6", "#14222e", "gloss")
LIV_BIZ_FALCON = _livery("#f6f7f8", "#1f3a60", "#b32428", "#dce1e6", "#f0f2f4", "#14202b", "gloss")

LIV_GA_CLASSIC = _livery("#f6f7f8", "#1d4f91", "#c62828", "#d7dde3", "#2b3036", "#182736", "gloss")
LIV_GA_COMPOSITE = _livery("#f7f8fa", "#214e78", "#e07a22", "#dce1e6", "#f0f2f5", "#192938", "gloss")
LIV_GA_AEROBAT = _livery("#f4f5f7", "#c91e26", "#1c2229", "#d6dbe0", "#c91e26", "#1b2936", "gloss")

LIV_HELO_CIV = _livery("#f3f5f7", "#18477d", "#e34234", "#ced6dd", "#20252b", "#162534", "gloss")
LIV_HELO_SAR = _livery("#eef1f4", "#d83828", "#f0b429", "#5c6670", "#22262b", "#172633", "gloss")
LIV_HELO_BLACKHAWK = _livery("#444b45", "#353b36", "#232824", "#4d544e", "#2b302c", "#182328", "matte")
LIV_HELO_APACHE = _livery("#41473c", "#33382f", "#242821", "#484e43", "#2c3029", "#192420", "matte")


# Complete 100-aircraft catalog covering EVERY entry in scratch_inventory.json
AIRCRAFT_CATALOG: Dict[str, Dict[str, Any]] = {
    # =========================================================================
    # CLASS 1: FIGHTERS & TRAINERS (20)
    # =========================================================================
    "fa18c": _spec(
        "fa18c", "F/A-18C Hornet", "fighter", "fighter",
        17.07, 11.43, 4.66, 2, "jet", "mid", "twin_canted", "carrier_tricycle",
        LIV_USN_GHOST,
        features=("lex", "louvers", "wing_fold", "tailhook", "tip_rails", "bubble_canopy"),
        fuselage_radius=0.84,
    ),
    "f16v": _spec(
        "f16v", "F-16V 戰隼", "fighter", "fighter",
        15.02, 9.44, 5.09, 1, "jet", "mid", "conventional", "tricycle",
        LIV_ROCAF_GRAY,
        features=("chin_intake", "ventral_fins", "cft_spine", "tip_rails", "bubble_canopy"),
        fuselage_radius=0.76,
    ),
    "sf16": _spec(
        "sf16", "F-16C Fighting Falcon", "fighter", "fighter",
        14.80, 9.80, 5.09, 1, "jet", "mid", "conventional", "tricycle",
        LIV_USAF_VIPER,
        features=("chin_intake", "ventral_fins", "tip_rails", "bubble_canopy"),
        fuselage_radius=0.74,
    ),
    "f14b": _spec(
        "f14b", "F-14B Tomcat", "fighter", "fighter",
        19.10, 19.55, 4.88, 2, "jet", "variable", "twin_vertical", "carrier_tricycle",
        LIV_USN_GHOST,
        features=("pancake", "wing_fold", "tailhook", "ventral_fins", "tandem_canopy"),
        fuselage_radius=1.18,
    ),
    "f22a": _spec(
        "f22a", "F-22A Raptor", "fighter", "fighter",
        18.90, 13.56, 5.08, 2, "jet", "mid", "twin_canted", "tricycle",
        LIV_STEALTH_F22,
        features=("diamond_chine", "caret_intakes", "tvc_2d", "bubble_canopy"),
        fuselage_radius=1.06,
    ),
    "f35a": _spec(
        "f35a", "F-35A Lightning II", "fighter", "fighter",
        15.67, 10.70, 4.38, 1, "jet", "mid", "twin_canted", "tricycle",
        LIV_STEALTH_F35,
        features=("diamond_chine", "dsi_intakes", "serrated_nozzle", "bubble_canopy"),
        fuselage_radius=0.92,
    ),
    "fck1": _spec(
        "fck1", "F-CK-1 經國號", "fighter", "fighter",
        14.02, 9.44, 4.42, 2, "jet", "mid", "conventional", "tricycle",
        LIV_ROCAF_GRAY,
        features=("lex", "tip_rails", "bubble_canopy"),
        fuselage_radius=0.76,
    ),
    "m2000": _spec(
        "m2000", "幻象 2000-5 · Mirage", "fighter", "fighter",
        14.30, 9.10, 5.20, 1, "jet", "delta", "tailless", "tricycle",
        LIV_ROCAF_GRAY,
        features=("shock_cones", "refuel_probe", "bubble_canopy"),
        fuselage_radius=0.78,
    ),
    "rafalec": _spec(
        "rafalec", "Dassault Rafale C", "fighter", "fighter",
        15.30, 10.90, 5.34, 2, "jet", "canard_delta", "tailless", "tricycle",
        LIV_EURO_GRAY,
        features=("canards", "refuel_probe", "tip_rails", "bubble_canopy"),
        fuselage_radius=0.84,
    ),
    "typhoon": _spec(
        "typhoon", "Eurofighter Typhoon", "fighter", "fighter",
        15.96, 10.95, 5.28, 2, "jet", "canard_delta", "tailless", "tricycle",
        LIV_EURO_GRAY,
        features=("canards", "chin_intake", "bubble_canopy"),
        fuselage_radius=0.86,
    ),
    "gripenc": _spec(
        "gripenc", "Saab JAS 39C Gripen", "fighter", "fighter",
        14.10, 8.40, 4.50, 1, "jet", "canard_delta", "tailless", "tricycle",
        LIV_EURO_GRAY,
        features=("canards", "tip_rails", "bubble_canopy"),
        fuselage_radius=0.72,
    ),
    "f15c": _spec(
        "f15c", "F-15C Eagle", "fighter", "fighter",
        19.43, 13.05, 5.63, 2, "jet", "high", "twin_vertical", "tricycle",
        LIV_USN_GHOST,
        features=("pancake", "bubble_canopy"),
        fuselage_radius=1.08,
    ),
    "sf15": _spec(
        "sf15", "F-15 Eagle", "fighter", "fighter",
        19.46, 13.04, 5.63, 2, "jet", "high", "twin_vertical", "tricycle",
        LIV_USAF_VIPER,
        features=("pancake", "bubble_canopy"),
        fuselage_radius=1.08,
    ),
    "su27": _spec(
        "su27", "Sukhoi Su-27", "fighter", "fighter",
        21.94, 14.70, 5.92, 2, "jet", "mid", "twin_vertical", "tricycle",
        LIV_FLANKER_BLUE,
        features=("pancake", "lex", "ventral_fins", "tip_rails", "bubble_canopy"),
        fuselage_radius=1.12,
    ),
    "mig29": _spec(
        "mig29", "Mikoyan MiG-29", "fighter", "fighter",
        17.32, 11.36, 4.73, 2, "jet", "mid", "twin_canted", "tricycle",
        LIV_MIG_GRAY,
        features=("pancake", "lex", "bubble_canopy"),
        fuselage_radius=0.94,
    ),
    "f5e": _spec(
        "f5e", "Northrop F-5E Tiger II", "fighter", "fighter",
        14.46, 8.12, 4.08, 2, "jet", "low", "conventional", "tricycle",
        LIV_ROCAF_GRAY,
        features=("lex", "tip_rails", "bubble_canopy"),
        fuselage_radius=0.68,
    ),
    "f104g": _spec(
        "f104g", "F-104G Starfighter", "fighter", "fighter",
        16.66, 6.68, 4.09, 1, "jet", "mid", "t_tail", "tricycle",
        LIV_EURO_GRAY,
        features=("shock_cones", "ventral_fins", "tip_rails", "bubble_canopy"),
        fuselage_radius=0.66,
    ),
    "t50": _spec(
        "t50", "KAI T-50 Golden Eagle", "fighter", "fighter",
        13.14, 9.45, 4.91, 1, "jet", "mid", "conventional", "tricycle",
        LIV_TRAINER_RED,
        features=("lex", "tandem_canopy"),
        fuselage_radius=0.72,
    ),
    "hawk": _spec(
        "hawk", "BAE Hawk T2", "fighter", "fighter",
        12.43, 9.94, 3.98, 1, "jet", "low", "conventional", "tricycle",
        LIV_TRAINER_HAWK,
        features=("tandem_canopy",),
        fuselage_radius=0.68,
    ),
    "at3": _spec(
        "at3", "AIDC AT-3 自強號", "fighter", "fighter",
        12.90, 10.46, 4.36, 2, "jet", "low", "conventional", "tricycle",
        LIV_AT3_TIGER,
        features=("tandem_canopy",),
        fuselage_radius=0.72,
    ),

    # =========================================================================
    # CLASS 2: COMMERCIAL WIDEBODY & NARROWBODY AIRLINERS (27)
    # =========================================================================
    "sa380": _spec(
        "sa380", "Airbus A380-800", "passenger", "airliner",
        72.72, 79.75, 24.09, 4, "turbofan", "low", "conventional", "quad_body_16",
        LIV_AIRBUS_HOUSE,
        features=("double_deck", "wingtip_fences"),
        fuselage_radius=3.58,
    ),
    "b744": _spec(
        "b744", "Boeing 747-400", "passenger", "airliner",
        70.67, 64.44, 19.41, 4, "turbofan", "low", "conventional", "quad_body_16",
        LIV_CHINA_AIRLINES,
        features=("hump_long", "winglets"),
        fuselage_radius=3.25,
    ),
    "b773": _spec(
        "b773", "Boeing 777-300ER", "passenger", "airliner",
        73.86, 64.80, 18.51, 2, "turbofan", "low", "conventional", "multi_bogie_6",
        LIV_EVA_AIR,
        features=("raked_tips",),
        fuselage_radius=3.10,
    ),
    "b772": _spec(
        "b772", "Boeing 777-200ER", "passenger", "airliner",
        63.73, 60.93, 18.51, 2, "turbofan", "low", "conventional", "multi_bogie_6",
        LIV_BOEING_HOUSE,
        features=(),
        fuselage_radius=3.10,
    ),
    "b788": _spec(
        "b788", "Boeing 787-8", "passenger", "airliner",
        56.72, 60.12, 16.92, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_BOEING_HOUSE,
        features=("chevron", "raked_tips"),
        fuselage_radius=2.88,
    ),
    "b789": _spec(
        "b789", "Boeing 787-9", "passenger", "airliner",
        62.81, 60.12, 17.02, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_EVA_AIR,
        features=("chevron", "raked_tips"),
        fuselage_radius=2.88,
    ),
    "b78x": _spec(
        "b78x", "Boeing 787-10", "passenger", "airliner",
        68.28, 60.12, 17.02, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_EVA_AIR,
        features=("chevron", "raked_tips"),
        fuselage_radius=2.88,
    ),
    "a359": _spec(
        "a359", "Airbus A350-900", "passenger", "airliner",
        66.80, 64.75, 17.05, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_STARLUX,
        features=("zorro_mask", "sharklets"),
        fuselage_radius=2.98,
    ),
    "a35k": _spec(
        "a35k", "Airbus A350-1000", "passenger", "airliner",
        73.79, 64.75, 17.08, 2, "turbofan", "low", "conventional", "multi_bogie_6",
        LIV_STARLUX,
        features=("zorro_mask", "sharklets"),
        fuselage_radius=2.98,
    ),
    "a333": _spec(
        "a333", "Airbus A330-300", "passenger", "airliner",
        63.66, 60.30, 16.79, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_CHINA_AIRLINES,
        features=("winglets",),
        fuselage_radius=2.82,
    ),
    "a339": _spec(
        "a339", "Airbus A330-900", "passenger", "airliner",
        63.66, 64.00, 16.79, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_STARLUX,
        features=("zorro_mask", "sharklets"),
        fuselage_radius=2.82,
    ),
    "a343": _spec(
        "a343", "Airbus A340-300", "passenger", "airliner",
        63.69, 60.30, 16.91, 4, "turbofan", "low", "conventional", "tricycle",
        LIV_AIRBUS_HOUSE,
        features=("winglets",),
        fuselage_radius=2.82,
    ),
    "a346": _spec(
        "a346", "Airbus A340-600", "passenger", "airliner",
        75.36, 63.45, 17.22, 4, "turbofan", "low", "conventional", "tricycle",
        LIV_AIRBUS_HOUSE,
        features=("winglets",),
        fuselage_radius=2.82,
    ),
    "a318": _spec(
        "a318", "Airbus A318-100", "passenger", "airliner",
        31.44, 34.10, 12.56, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_AIRBUS_HOUSE,
        features=("wingtip_fences",),
        fuselage_radius=1.98,
    ),
    "a319": _spec(
        "a319", "Airbus A319-100", "passenger", "airliner",
        33.84, 34.10, 11.76, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_AIRBUS_HOUSE,
        features=("wingtip_fences",),
        fuselage_radius=1.98,
    ),
    "a320neo": _spec(
        "a320neo", "Airbus A320neo", "passenger", "airliner",
        37.58, 35.80, 11.76, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_AIRBUS_HOUSE,
        features=("sharklets",),
        fuselage_radius=1.98,
    ),
    "a321neo": _spec(
        "a321neo", "Airbus A321neo", "passenger", "airliner",
        44.51, 35.80, 11.76, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_STARLUX,
        features=("zorro_mask", "sharklets"),
        fuselage_radius=1.98,
    ),
    "b738": _spec(
        "b738", "Boeing 737-800", "passenger", "airliner",
        39.47, 35.80, 12.55, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_CHINA_AIRLINES,
        features=("winglets",),
        fuselage_radius=1.88,
    ),
    "b739": _spec(
        "b739", "Boeing 737-900ER", "passenger", "airliner",
        42.11, 35.80, 12.55, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_BOEING_HOUSE,
        features=("winglets",),
        fuselage_radius=1.88,
    ),
    "b38m": _spec(
        "b38m", "Boeing 737 MAX 8", "passenger", "airliner",
        39.47, 35.92, 12.30, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_BOEING_HOUSE,
        features=("split_scimitar", "chevron"),
        fuselage_radius=1.88,
    ),
    "b752": _spec(
        "b752", "Boeing 757-200", "passenger", "airliner",
        47.32, 38.05, 13.56, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_BOEING_HOUSE,
        features=("winglets",),
        fuselage_radius=1.88,
    ),
    "b763er": _spec(
        "b763er", "Boeing 767-300ER", "passenger", "airliner",
        54.94, 47.57, 15.85, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_BOEING_HOUSE,
        features=("winglets",),
        fuselage_radius=2.52,
    ),
    "a223": _spec(
        "a223", "Airbus A220-300", "passenger", "airliner",
        38.70, 35.10, 11.50, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_AIRBUS_HOUSE,
        features=("winglets",),
        fuselage_radius=1.75,
    ),
    "e190e2": _spec(
        "e190e2", "Embraer E190-E2", "passenger", "airliner",
        36.24, 33.72, 10.96, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_EMBRAER,
        features=("raked_tips",),
        fuselage_radius=1.52,
    ),
    "e195e2": _spec(
        "e195e2", "Embraer E195-E2", "passenger", "airliner",
        41.60, 35.12, 10.91, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_EMBRAER,
        features=("raked_tips",),
        fuselage_radius=1.52,
    ),
    "atr72": _spec(
        "atr72", "ATR 72-600", "passenger", "airliner",
        27.17, 27.05, 7.65, 2, "turboprop", "high", "t_tail", "sponson_bogie",
        LIV_REGIONAL_PROP,
        features=(),
        fuselage_radius=1.40,
        prop_blades=6,
    ),
    "atr42": _spec(
        "atr42", "ATR 42-600", "passenger", "airliner",
        22.67, 24.57, 7.59, 2, "turboprop", "high", "t_tail", "sponson_bogie",
        LIV_REGIONAL_PROP,
        features=(),
        fuselage_radius=1.40,
        prop_blades=6,
    ),

    # =========================================================================
    # CLASS 3: CARGO FREIGHTERS & MILITARY AIRLIFTERS (13)
    # =========================================================================
    "sf748": _spec(
        "sf748", "Boeing 747-8F · Atlas", "cargo", "cargo",
        76.30, 68.40, 19.40, 4, "turbofan", "low", "conventional", "quad_body_16",
        LIV_ATLAS_CARGO,
        features=("hump_short", "nose_visor", "chevron", "raked_tips", "windowless_cargo"),
        fuselage_radius=3.25,
    ),
    "an124": _spec(
        "an124", "Antonov An-124-100 Ruslan", "cargo", "cargo",
        69.10, 73.30, 20.78, 4, "turbofan", "high", "conventional", "an124_24",
        LIV_ANTONOV,
        features=("anhedral_high", "nose_visor", "aft_ramp_cargo", "windowless_cargo"),
        fuselage_radius=3.75,
    ),
    "c17": _spec(
        "c17", "Boeing C-17 Globemaster III", "cargo", "cargo",
        53.04, 51.75, 16.79, 4, "turbofan", "high", "t_tail", "sponson_bogie",
        LIV_MIL_AMC_GRAY,
        features=("winglets", "aft_ramp_cargo", "windowless_cargo"),
        fuselage_radius=3.25,
    ),
    "c130j": _spec(
        "c130j", "Lockheed Martin C-130J", "cargo", "cargo",
        29.79, 40.41, 11.84, 4, "turboprop", "high", "conventional", "sponson_bogie",
        LIV_MIL_AMC_GRAY,
        features=("aft_ramp_cargo", "windowless_cargo"),
        fuselage_radius=2.12,
        prop_blades=6,
    ),
    "a400m": _spec(
        "a400m", "Airbus A400M", "cargo", "cargo",
        45.10, 42.40, 14.70, 4, "turboprop", "high", "t_tail", "sponson_bogie",
        LIV_MIL_AMC_GRAY,
        features=("aft_ramp_cargo", "windowless_cargo"),
        fuselage_radius=2.82,
        prop_blades=8,
    ),
    "md11f": _spec(
        "md11f", "McDonnell Douglas MD-11F", "cargo", "cargo",
        61.21, 51.66, 17.60, 3, "turbofan", "low", "conventional", "tricycle",
        LIV_FEDEX_STYLE,
        features=("trijet_tail", "winglets", "windowless_cargo"),
        fuselage_radius=3.01,
    ),
    "dc10f": _spec(
        "dc10f", "McDonnell Douglas DC-10-30F", "cargo", "cargo",
        55.55, 50.40, 17.70, 3, "turbofan", "low", "conventional", "tricycle",
        LIV_FEDEX_STYLE,
        features=("trijet_tail", "windowless_cargo"),
        fuselage_radius=3.01,
    ),
    "b77f": _spec(
        "b77f", "Boeing 777F", "cargo", "cargo",
        63.73, 64.80, 18.60, 2, "turbofan", "low", "conventional", "multi_bogie_6",
        LIV_CHINA_AIRLINES,
        features=("raked_tips", "windowless_cargo"),
        fuselage_radius=3.10,
    ),
    "b763f": _spec(
        "b763f", "Boeing 767-300F", "cargo", "cargo",
        54.94, 47.57, 15.85, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_UPS_STYLE,
        features=("winglets", "windowless_cargo"),
        fuselage_radius=2.52,
    ),
    "b752f": _spec(
        "b752f", "Boeing 757-200PF", "cargo", "cargo",
        47.32, 38.05, 13.56, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_UPS_STYLE,
        features=("winglets", "windowless_cargo"),
        fuselage_radius=1.88,
    ),
    "b738bcf": _spec(
        "b738bcf", "Boeing 737-800BCF", "cargo", "cargo",
        39.47, 35.80, 12.55, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_ATLAS_CARGO,
        features=("winglets", "windowless_cargo"),
        fuselage_radius=1.88,
    ),
    "a306f": _spec(
        "a306f", "Airbus A300-600F", "cargo", "cargo",
        54.08, 44.84, 16.54, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_FEDEX_STYLE,
        features=("wingtip_fences", "windowless_cargo"),
        fuselage_radius=2.82,
    ),
    "a332f": _spec(
        "a332f", "Airbus A330-200F", "cargo", "cargo",
        58.82, 60.30, 16.90, 2, "turbofan", "low", "conventional", "tricycle",
        LIV_AIRBUS_HOUSE,
        features=("winglets", "windowless_cargo"),
        fuselage_radius=2.82,
    ),

    # =========================================================================
    # CLASS 4: REGIONAL TURBOPROPS & BUSINESS JETS (15)
    # =========================================================================
    "q400": _spec(
        "q400", "De Havilland Dash 8-400", "passenger", "regional_biz",
        32.84, 28.42, 8.34, 2, "turboprop", "high", "t_tail", "tricycle",
        LIV_REGIONAL_PROP,
        features=(),
        fuselage_radius=1.34,
        prop_blades=6,
    ),
    "twotter": _spec(
        "twotter", "DHC-6 Twin Otter", "regional", "regional_biz",
        15.77, 19.81, 5.94, 2, "turboprop", "high", "conventional", "fixed_tricycle",
        LIV_REGIONAL_PROP,
        features=("strut_braced",),
        fuselage_radius=0.92,
        prop_blades=3,
    ),
    "dornier228": _spec(
        "dornier228", "Dornier 228", "passenger", "regional_biz",
        16.56, 16.97, 4.86, 2, "turboprop", "high", "conventional", "sponson_bogie",
        LIV_REGIONAL_PROP,
        features=(),
        fuselage_radius=0.86,
        prop_blades=5,
    ),
    "saab340": _spec(
        "saab340", "Saab 340B", "passenger", "regional_biz",
        19.73, 21.44, 6.97, 2, "turboprop", "low", "conventional", "tricycle",
        LIV_REGIONAL_PROP,
        features=(),
        fuselage_radius=1.16,
        prop_blades=4,
    ),
    "c208": _spec(
        "c208", "Cessna 208B Grand Caravan", "regional", "regional_biz",
        12.67, 15.88, 4.53, 1, "turboprop", "high", "conventional", "fixed_tricycle",
        LIV_GA_CLASSIC,
        features=("strut_braced", "cargo_pod"),
        fuselage_radius=0.88,
        prop_blades=3,
    ),
    "cj4": _spec(
        "cj4", "Cessna Citation CJ4", "passenger", "regional_biz",
        16.26, 15.49, 4.69, 2, "turbofan", "low", "cruciform", "tricycle",
        LIV_BIZ_LUXURY,
        features=(),
        fuselage_radius=0.84,
    ),
    "phenom300": _spec(
        "phenom300", "Embraer Phenom 300E", "passenger", "regional_biz",
        15.90, 16.20, 5.10, 2, "turbofan", "low", "t_tail", "tricycle",
        LIV_EMBRAER,
        features=("winglets",),
        fuselage_radius=0.84,
    ),
    "g650": _spec(
        "g650", "Gulfstream G650ER", "passenger", "regional_biz",
        30.41, 30.36, 7.72, 2, "turbofan", "low", "t_tail", "tricycle",
        LIV_BIZ_LUXURY,
        features=("winglets", "oval_windows"),
        fuselage_radius=1.32,
    ),
    "g700": _spec(
        "g700", "Gulfstream G700", "passenger", "regional_biz",
        33.48, 31.39, 7.75, 2, "turbofan", "low", "t_tail", "tricycle",
        LIV_BIZ_LUXURY,
        features=("winglets", "oval_windows"),
        fuselage_radius=1.32,
    ),
    "global7500": _spec(
        "global7500", "Bombardier Global 7500", "passenger", "regional_biz",
        33.80, 31.70, 8.20, 2, "turbofan", "low", "t_tail", "tricycle",
        LIV_BIZ_LUXURY,
        features=("winglets",),
        fuselage_radius=1.34,
    ),
    "challenger350": _spec(
        "challenger350", "Bombardier Challenger 350", "passenger", "regional_biz",
        20.90, 21.00, 6.10, 2, "turbofan", "low", "t_tail", "tricycle",
        LIV_BIZ_LUXURY,
        features=("winglets",),
        fuselage_radius=1.14,
    ),
    "falcon7x": _spec(
        "falcon7x", "Dassault Falcon 7X", "passenger", "regional_biz",
        23.38, 26.21, 7.83, 3, "turbofan", "low", "cruciform", "tricycle",
        LIV_BIZ_FALCON,
        features=("trijet_sduct", "winglets"),
        fuselage_radius=1.22,
    ),
    "falcon8x": _spec(
        "falcon8x", "Dassault Falcon 8X", "passenger", "regional_biz",
        24.46, 26.29, 7.94, 3, "turbofan", "low", "cruciform", "tricycle",
        LIV_BIZ_FALCON,
        features=("trijet_sduct", "winglets"),
        fuselage_radius=1.22,
    ),
    "hondajet": _spec(
        "hondajet", "HondaJet Elite II", "passenger", "regional_biz",
        12.99, 12.12, 4.54, 2, "turbofan", "low", "t_tail", "tricycle",
        LIV_BIZ_HONDA,
        features=("otwem",),
        fuselage_radius=0.80,
    ),
    "lear75": _spec(
        "lear75", "Learjet 75", "passenger", "regional_biz",
        17.68, 15.51, 4.31, 2, "turbofan", "low", "t_tail", "tricycle",
        LIV_BIZ_LUXURY,
        features=("winglets", "ventral_fins"),
        fuselage_radius=0.82,
    ),

    # =========================================================================
    # CLASS 5: GENERAL AVIATION & TURBOPROP TRAINERS (17)
    # =========================================================================
    "c172s": _spec(
        "c172s", "Cessna 172S", "ga", "ga_trainer",
        8.28, 11.00, 2.72, 1, "piston", "high", "conventional", "fixed_tricycle",
        LIV_GA_CLASSIC,
        features=("strut_braced",),
        fuselage_radius=0.62,
        prop_blades=2,
    ),
    "c152": _spec(
        "c152", "Cessna 152", "ga", "ga_trainer",
        7.34, 10.16, 2.59, 1, "piston", "high", "conventional", "fixed_tricycle",
        LIV_GA_CLASSIC,
        features=("strut_braced",),
        fuselage_radius=0.56,
        prop_blades=2,
    ),
    "c182": _spec(
        "c182", "Cessna 182T", "ga", "ga_trainer",
        8.84, 10.97, 2.84, 1, "piston", "high", "conventional", "fixed_tricycle",
        LIV_GA_CLASSIC,
        features=("strut_braced",),
        fuselage_radius=0.66,
        prop_blades=3,
    ),
    "c206": _spec(
        "c206", "Cessna 206H", "ga", "ga_trainer",
        8.61, 10.97, 2.83, 1, "piston", "high", "conventional", "fixed_tricycle",
        LIV_GA_CLASSIC,
        features=("strut_braced",),
        fuselage_radius=0.68,
        prop_blades=3,
    ),
    "p2006t": _spec(
        "p2006t", "Tecnam P2006T", "ga", "ga_trainer",
        8.70, 11.40, 2.58, 2, "piston", "high", "conventional", "tricycle",
        LIV_GA_COMPOSITE,
        features=(),
        fuselage_radius=0.66,
        prop_blades=2,
    ),
    "pa28": _spec(
        "pa28", "Piper PA-28 Archer", "ga", "ga_trainer",
        7.32, 10.80, 2.25, 1, "piston", "low", "conventional", "wheel_pants",
        LIV_GA_CLASSIC,
        features=(),
        fuselage_radius=0.62,
        prop_blades=2,
    ),
    "da40": _spec(
        "da40", "Diamond DA40 NG", "ga", "ga_trainer",
        8.06, 11.94, 1.97, 1, "piston", "low", "t_tail", "wheel_pants",
        LIV_GA_COMPOSITE,
        features=("winglets", "bubble_canopy"),
        fuselage_radius=0.60,
        prop_blades=3,
    ),
    "da42": _spec(
        "da42", "Diamond DA42", "ga", "ga_trainer",
        8.56, 13.42, 2.49, 2, "piston", "low", "t_tail", "tricycle",
        LIV_GA_COMPOSITE,
        features=("winglets", "bubble_canopy"),
        fuselage_radius=0.62,
        prop_blades=3,
    ),
    "da20": _spec(
        "da20", "Diamond DA20", "ga", "ga_trainer",
        7.16, 10.87, 2.18, 1, "piston", "low", "t_tail", "wheel_pants",
        LIV_GA_COMPOSITE,
        features=("bubble_canopy",),
        fuselage_radius=0.56,
        prop_blades=2,
    ),
    "g58": _spec(
        "g58", "Beechcraft Baron G58", "ga", "ga_trainer",
        9.09, 11.53, 2.97, 2, "piston", "low", "conventional", "tricycle",
        LIV_GA_CLASSIC,
        features=(),
        fuselage_radius=0.68,
        prop_blades=3,
    ),
    "sr22": _spec(
        "sr22", "Cirrus SR22", "ga", "ga_trainer",
        7.92, 11.68, 2.72, 1, "piston", "low", "conventional", "wheel_pants",
        LIV_GA_COMPOSITE,
        features=("winglets",),
        fuselage_radius=0.64,
        prop_blades=3,
    ),
    "bonanza": _spec(
        "bonanza", "Beechcraft Bonanza G36", "ga", "ga_trainer",
        8.38, 10.21, 2.62, 1, "piston", "low", "conventional", "tricycle",
        LIV_GA_CLASSIC,
        features=(),
        fuselage_radius=0.64,
        prop_blades=3,
    ),
    "extra330": _spec(
        "extra330", "Extra 330SC", "ga", "ga_trainer",
        6.88, 7.50, 2.62, 1, "piston", "mid", "conventional", "taildragger",
        LIV_GA_AEROBAT,
        features=("bubble_canopy",),
        fuselage_radius=0.48,
        prop_blades=3,
    ),
    "pc21": _spec(
        "pc21", "Pilatus PC-21", "ga", "ga_trainer",
        11.23, 9.11, 3.74, 1, "turboprop", "low", "conventional", "tricycle",
        LIV_TRAINER_RED,
        features=("tandem_canopy", "ventral_fins"),
        fuselage_radius=0.64,
        prop_blades=5,
    ),
    "tbm930": _spec(
        "tbm930", "Daher TBM 930", "ga", "ga_trainer",
        10.74, 12.83, 4.36, 1, "turboprop", "low", "conventional", "tricycle",
        LIV_BIZ_LUXURY,
        features=("winglets",),
        fuselage_radius=0.72,
        prop_blades=5,
    ),
    "pc12": _spec(
        "pc12", "Pilatus PC-12 NGX", "ga", "ga_trainer",
        14.40, 16.28, 4.26, 1, "turboprop", "low", "t_tail", "tricycle",
        LIV_BIZ_LUXURY,
        features=("winglets", "ventral_fins"),
        fuselage_radius=0.86,
        prop_blades=5,
    ),
    "king350": _spec(
        "king350", "Beechcraft King Air 350", "ga", "ga_trainer",
        14.22, 17.65, 4.37, 2, "turboprop", "low", "t_tail", "tricycle",
        LIV_BIZ_LUXURY,
        features=("winglets",),
        fuselage_radius=0.86,
        prop_blades=4,
    ),

    # =========================================================================
    # CLASS 6: HELICOPTERS (8)
    # =========================================================================
    "r44": _spec(
        "r44", "Robinson R44 Raven II", "helicopter", "helicopter",
        11.66, 10.06, 3.28, 1, "rotor", "none", "conventional_helo", "skids",
        LIV_HELO_CIV,
        features=("bubble_canopy",),
        fuselage_radius=0.72,
        rotor_blades=2,
    ),
    "bell206": _spec(
        "bell206", "Bell 206B JetRanger", "helicopter", "helicopter",
        11.82, 10.16, 2.91, 1, "rotor", "none", "conventional_helo", "skids",
        LIV_HELO_CIV,
        features=("bubble_canopy",),
        fuselage_radius=0.74,
        rotor_blades=2,
    ),
    "h145": _spec(
        "h145", "Airbus H145", "helicopter", "helicopter",
        13.54, 10.80, 3.95, 2, "rotor", "none", "fenestron", "skids",
        LIV_HELO_SAR,
        features=("fenestron", "bubble_canopy"),
        fuselage_radius=0.88,
        rotor_blades=5,
    ),
    "s92": _spec(
        "s92", "Sikorsky S-92A", "helicopter", "helicopter",
        20.88, 17.17, 4.71, 2, "rotor", "none", "conventional_helo", "helo_tricycle",
        LIV_HELO_SAR,
        features=("rear_ramp",),
        fuselage_radius=1.28,
        rotor_blades=4,
    ),
    "sh6": _spec(
        "sh6", "SKYBOUND H6 · 巡遊直升機", "helicopter", "helicopter",
        11.60, 10.50, 3.15, 1, "rotor", "none", "conventional_helo", "skids",
        LIV_HELO_CIV,
        features=("bubble_canopy",),
        fuselage_radius=0.78,
        rotor_blades=4,
    ),
    "aw101": _spec(
        "aw101", "AW101 Merlin · 搜救巡邏直升機", "helicopter", "helicopter",
        22.40, 18.80, 6.62, 3, "rotor", "none", "conventional_helo", "helo_tricycle",
        LIV_HELO_SAR,
        features=("rear_ramp",),
        fuselage_radius=1.42,
        rotor_blades=5,
    ),
    "uh60": _spec(
        "uh60", "UH-60M 黑鷹直升機 · 戰術搜救", "helicopter", "helicopter",
        19.20, 16.40, 5.13, 2, "rotor", "none", "canted_helo", "helo_tailwheel",
        LIV_HELO_BLACKHAWK,
        features=("canted_tail_rotor",),
        fuselage_radius=1.18,
        rotor_blades=4,
    ),
    "ah64": _spec(
        "ah64", "AH-64E 阿帕契守護者 · 重型攻擊直升機", "helicopter", "helicopter",
        17.60, 14.60, 4.95, 2, "rotor", "stub", "scissor_helo", "helo_tailwheel",
        LIV_HELO_APACHE,
        features=("longbow_radar", "apache_weapons", "chin_gun", "tandem_canopy"),
        fuselage_radius=0.82,
        rotor_blades=4,
    ),
}

# Top 16 flagship models spanning all 6 airframe classes
HERO_AIRCRAFT_IDS: Tuple[str, ...] = (
    "fa18c", "f16v", "f14b", "f22a", "f35a",
    "sa380", "b773", "b744", "a359", "b789",
    "sf748", "an124", "c17",
    "hondajet", "c172s", "ah64",
)


# =============================================================================
# 2. BLENDER 3.6–4.3+ COMPATIBILITY & PBR MATERIAL LIBRARY
# =============================================================================

def clear_scene() -> None:
    """Cleanly purge all objects, meshes, and materials between exports."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for col in list(bpy.data.collections):
        if col != bpy.context.scene.collection:
            bpy.data.collections.remove(col)


def set_bsdf_input(bsdf: Any, candidates: Sequence[str], value: Any) -> None:
    """Set Principled BSDF socket across Blender 3.6 and 4.0–4.3+ naming."""
    for name in candidates:
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = value
            return


def create_pbr_material(
    name: str,
    color: Tuple[float, float, float],
    metallic: float = 0.0,
    roughness: float = 0.45,
    coat: float = 0.0,
    alpha: float = 1.0,
    transmission: float = 0.0,
    emission: Optional[Tuple[float, float, float]] = None,
    emission_strength: float = 0.0,
) -> Any:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")

    set_bsdf_input(bsdf, ("Base Color",), (color[0], color[1], color[2], 1.0))
    set_bsdf_input(bsdf, ("Metallic",), metallic)
    set_bsdf_input(bsdf, ("Roughness",), roughness)
    set_bsdf_input(bsdf, ("Specular IOR Level", "Specular"), 0.5)
    if coat > 0.0:
        set_bsdf_input(bsdf, ("Coat Weight", "Clearcoat"), coat)
        set_bsdf_input(bsdf, ("Coat Roughness", "Clearcoat Roughness"), 0.08)
    if alpha < 1.0:
        set_bsdf_input(bsdf, ("Alpha",), alpha)
        if hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"
    if transmission > 0.0:
        set_bsdf_input(bsdf, ("Transmission Weight", "Transmission"), transmission)
        set_bsdf_input(bsdf, ("IOR",), 1.49)
    if emission is not None and emission_strength > 0.0:
        set_bsdf_input(
            bsdf,
            ("Emission Color", "Emission"),
            (emission[0], emission[1], emission[2], 1.0),
        )
        set_bsdf_input(bsdf, ("Emission Strength",), emission_strength)
    return mat


class MaterialLibrary:
    """Per-aircraft PBR material bundle exported cleanly to glTF 2.0."""

    def __init__(self, spec: Dict[str, Any]) -> None:
        liv = spec["livery"]
        finish = liv["finish"]
        if finish == "gloss":
            p_rough, p_metal, p_coat = 0.24, 0.08, 0.45
        elif finish == "stealth":
            p_rough, p_metal, p_coat = 0.58, 0.28, 0.05
        else:  # matte tactical
            p_rough, p_metal, p_coat = 0.62, 0.14, 0.0

        self.primary = create_pbr_material("Mat_Primary", liv["primary"], p_metal, p_rough, p_coat)
        self.secondary = create_pbr_material("Mat_Secondary", liv["secondary"], p_metal + 0.04, p_rough + 0.04, p_coat * 0.8)
        self.accent = create_pbr_material("Mat_Accent", liv["accent"], 0.15, p_rough, p_coat * 0.6)
        self.belly = create_pbr_material("Mat_Belly", liv["belly"], 0.16, p_rough + 0.08, p_coat * 0.4)
        self.radome = create_pbr_material("Mat_Radome", liv["radome"], 0.04, 0.48, 0.1)
        self.glass = create_pbr_material(
            "Mat_Glass",
            liv["glass"],
            metallic=0.18,
            roughness=0.06,
            coat=0.9,
            alpha=0.58,
            transmission=0.35,
        )
        self.chrome = create_pbr_material("Mat_Chrome", _rgb("#cfd6dc"), metallic=0.92, roughness=0.18)
        self.titanium = create_pbr_material("Mat_Titanium_Hot", _rgb("#535861"), metallic=0.88, roughness=0.34)
        self.burner_glow = create_pbr_material(
            "Mat_Burner_Inner", _rgb("#232024"), metallic=0.6, roughness=0.55,
            emission=_rgb("#ff6820"), emission_strength=0.35,
        )
        self.dark_intake = create_pbr_material("Mat_Dark_Intake", _rgb("#15191e"), metallic=0.12, roughness=0.78)
        self.tire = create_pbr_material("Mat_Rubber_Tire", _rgb("#16191d"), metallic=0.0, roughness=0.88)
        self.blade = create_pbr_material("Mat_Composite_Blade", _rgb("#22272e"), metallic=0.25, roughness=0.38)
        self.weapon = create_pbr_material("Mat_Ordnance", _rgb("#363d34"), metallic=0.25, roughness=0.55)
        self.nav_red = create_pbr_material(
            "Mat_Nav_Red", _rgb("#d91e26"), 0.0, 0.2,
            emission=_rgb("#ff2222"), emission_strength=2.5,
        )
        self.nav_green = create_pbr_material(
            "Mat_Nav_Green", _rgb("#18b852"), 0.0, 0.2,
            emission=_rgb("#20ff66"), emission_strength=2.5,
        )
        self.nav_white = create_pbr_material(
            "Mat_Nav_White", _rgb("#f2f6ff"), 0.0, 0.2,
            emission=_rgb("#ffffff"), emission_strength=2.0,
        )


# =============================================================================
# 3. PURE BMESH AEROSPACE GEOMETRY PRIMITIVES & LOFTING KERNELS
# =============================================================================

def _assign_mat(obj: Any, mats: Sequence[Any]) -> None:
    obj.data.materials.clear()
    for m in mats:
        obj.data.materials.append(m)


def finalize_mesh_object(
    name: str,
    bm: Any,
    materials: Sequence[Any],
    location: Tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotation_euler: Tuple[float, float, float] = (0.0, 0.0, 0.0),
    smooth: bool = True,
) -> Any:
    """Convert a BMesh into a scene Mesh Object with clean normals & smooth shading."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = smooth

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()

    if len(mesh.polygons) > 0:
        mesh.polygons.foreach_set("use_smooth", [smooth] * len(mesh.polygons))
    if hasattr(mesh, "use_auto_smooth"):
        mesh.use_auto_smooth = smooth
        if hasattr(mesh, "auto_smooth_angle"):
            mesh.auto_smooth_angle = math.radians(42.0)

    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation_euler
    _assign_mat(obj, materials)
    return obj


def _set_verts_mat(verts: Sequence[Any], mat_idx: int) -> None:
    """Assign material index to all faces strictly belonging to `verts` in O(k)."""
    vset = set(verts)
    visited = set()
    for v in verts:
        for f in v.link_faces:
            if f not in visited:
                visited.add(f)
                if all(fv in vset for fv in f.verts):
                    f.material_index = mat_idx


def bm_add_box(
    bm: Any,
    center: Tuple[float, float, float],
    size: Tuple[float, float, float],
    rot_deg: Tuple[float, float, float] = (0.0, 0.0, 0.0),
    mat_idx: int = 0,
) -> List[Any]:
    mat = (
        Matrix.Translation(Vector(center))
        @ Euler(tuple(math.radians(a) for a in rot_deg), "XYZ").to_matrix().to_4x4()
        @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
    )
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=mat)
    verts = res["verts"]
    _set_verts_mat(verts, mat_idx)
    return verts


def bm_add_cylinder(
    bm: Any,
    p0: Tuple[float, float, float],
    p1: Tuple[float, float, float],
    r0: float,
    r1: Optional[float] = None,
    segments: int = 16,
    cap_ends: bool = True,
    mat_idx: int = 0,
) -> List[Any]:
    """Create a cylinder/frustum connecting arbitrary 3D points p0 -> p1."""
    if r1 is None:
        r1 = r0
    v0 = Vector(p0)
    v1 = Vector(p1)
    delta = v1 - v0
    length = delta.length
    if length < 1e-5:
        return []
    mid = (v0 + v1) * 0.5
    quat = delta.normalized().to_track_quat("Z", "Y")
    mat = Matrix.Translation(mid) @ quat.to_matrix().to_4x4()
    res = bmesh.ops.create_cone(
        bm,
        cap_ends=cap_ends,
        cap_tris=False,
        segments=segments,
        radius1=max(1e-4, r0),
        radius2=max(1e-4, r1),
        depth=length,
        matrix=mat,
    )
    verts = res["verts"]
    _set_verts_mat(verts, mat_idx)
    return verts


def bm_add_ellipsoid(
    bm: Any,
    center: Tuple[float, float, float],
    radii: Tuple[float, float, float],
    u_segs: int = 16,
    v_rings: int = 10,
    rot_deg: Tuple[float, float, float] = (0.0, 0.0, 0.0),
    mat_idx: int = 0,
) -> List[Any]:
    mat = (
        Matrix.Translation(Vector(center))
        @ Euler(tuple(math.radians(a) for a in rot_deg), "XYZ").to_matrix().to_4x4()
        @ Matrix.Diagonal((radii[0], radii[1], radii[2], 1.0))
    )
    res = bmesh.ops.create_uvsphere(
        bm, u_segments=u_segs, v_segments=v_rings, radius=1.0, matrix=mat
    )
    verts = res["verts"]
    _set_verts_mat(verts, mat_idx)
    return verts


def bm_add_tire(
    bm: Any,
    center: Tuple[float, float, float],
    radius: float,
    width: float,
    axle_axis: str = "X",
    segments: int = 20,
    mat_idx: int = 0,
) -> None:
    """Create a realistic rounded aircraft tire with sidewall profile."""
    cx, cy, cz = center
    profile = [
        (-width * 0.50, radius * 0.42),
        (-width * 0.50, radius * 0.78),
        (-width * 0.36, radius * 0.96),
        (-width * 0.14, radius * 1.00),
        (width * 0.14, radius * 1.00),
        (width * 0.36, radius * 0.96),
        (width * 0.50, radius * 0.78),
        (width * 0.50, radius * 0.42),
    ]
    rings = []
    for axial, rad in profile:
        ring = []
        for i in range(segments):
            ang = 2.0 * math.pi * i / segments
            ca, sa = math.cos(ang), math.sin(ang)
            if axle_axis == "X":
                pt = (cx + axial, cy + rad * ca, cz + rad * sa)
            elif axle_axis == "Y":
                pt = (cx + rad * ca, cy + axial, cz + rad * sa)
            else:
                pt = (cx + rad * ca, cy + rad * sa, cz + axial)
            ring.append(bm.verts.new(pt))
        rings.append(ring)

    # Connect rings around tire circumference
    for r_idx in range(len(rings) - 1):
        r0 = rings[r_idx]
        r1 = rings[r_idx + 1]
        for i in range(segments):
            j = (i + 1) % segments
            try:
                f = bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
                f.material_index = mat_idx
            except ValueError:
                pass

    # Cap inner hub discs
    for end_ring in (rings[0], rings[-1]):
        try:
            f = bm.faces.new(end_ring)
            f.material_index = mat_idx
        except ValueError:
            pass


def naca4_airfoil_coords(
    m_camber: float = 0.02,
    p_pos: float = 0.4,
    thickness: float = 0.12,
    n_half: int = 12,
) -> List[Tuple[float, float]]:
    """
    Generate closed NACA 4-digit airfoil loop in normalized chord coordinates:
      u in [0..1] (0 = leading edge, 1 = trailing edge), v = thickness ordinate.
    Ordered cleanly around the perimeter: TE -> upper surface -> LE -> lower surface.
    """
    # Cosine spacing concentrates resolution at leading and trailing edges
    betas = [math.pi * i / n_half for i in range(n_half + 1)]
    xs = [0.5 * (1.0 - math.cos(b)) for b in betas]

    upper: List[Tuple[float, float]] = []
    lower: List[Tuple[float, float]] = []
    for x in xs:
        yt = 5.0 * thickness * (
            0.2969 * math.sqrt(max(0.0, x))
            - 0.1260 * x
            - 0.3516 * x * x
            + 0.2843 * x ** 3
            - 0.1036 * x ** 4
        )
        if m_camber > 0.0 and 0.0 < p_pos < 1.0:
            if x < p_pos:
                yc = (m_camber / (p_pos * p_pos)) * (2.0 * p_pos * x - x * x)
                dyc = (2.0 * m_camber / (p_pos * p_pos)) * (p_pos - x)
            else:
                yc = (m_camber / ((1.0 - p_pos) ** 2)) * (
                    (1.0 - 2.0 * p_pos) + 2.0 * p_pos * x - x * x
                )
                dyc = (2.0 * m_camber / ((1.0 - p_pos) ** 2)) * (p_pos - x)
            theta = math.atan(dyc)
        else:
            yc = 0.0
            theta = 0.0

        xu = x - yt * math.sin(theta)
        zu = yc + yt * math.cos(theta)
        xl = x + yt * math.sin(theta)
        zl = yc - yt * math.cos(theta)
        upper.append((xu, zu))
        lower.append((xl, zl))

    # Build continuous loop without duplicate LE/TE vertices
    loop: List[Tuple[float, float]] = []
    # TE to LE along upper
    for pt in reversed(upper):
        loop.append(pt)
    # LE+1 to TE-1 along lower
    for pt in lower[1:-1]:
        loop.append(pt)
    return loop


def build_airfoil_wing(
    bm: Any,
    stations: Sequence[Tuple[float, float, float, float, float, float]],
    side: int = 1,
    naca_camber: float = 0.02,
    naca_p: float = 0.4,
    n_half: int = 10,
    mat_idx: int = 0,
    cap_root: bool = True,
    cap_tip: bool = True,
    vertical: bool = False,
    cant_deg: float = 0.0,
) -> List[List[Any]]:
    """
    Loft a true NACA 4-digit airfoil wing or tail surface across span stations.

    Each station is:
      (span_dist, chord, le_y, z_or_x_offset, thickness_ratio, twist_deg)

    - For horizontal wings (`vertical=False`):
        X = side * span_dist
        Y = le_y - u * chord   (+Y is forward nose!)
        Z = z_or_x_offset + v * chord
    - For vertical fins (`vertical=True`):
        Z = span_dist (height above fin root base)
        X = z_or_x_offset + v * chord + (span_dist - root_z) * tan(cant)
        Y = le_y - u * chord
    """
    rings: List[List[Any]] = []
    cant_rad = math.radians(cant_deg) * side
    root_span = stations[0][0]

    for s_dist, chord, le_y, offset, t_ratio, twist_deg in stations:
        coords = naca4_airfoil_coords(
            m_camber=0.0 if vertical else naca_camber,
            p_pos=naca_p,
            thickness=max(0.035, t_ratio),
            n_half=n_half,
        )
        tw = math.radians(twist_deg)
        ctw, stw = math.cos(tw), math.sin(tw)
        ring = []
        for u, v in coords:
            # Twist about quarter-chord
            du = u - 0.25
            u_rot = 0.25 + du * ctw - v * stw
            v_rot = du * stw + v * ctw
            y_pos = le_y - u_rot * chord
            if not vertical:
                x_pos = side * s_dist
                z_pos = offset + v_rot * chord
            else:
                dh = s_dist - root_span
                x_pos = offset + v_rot * chord * math.cos(cant_rad) + dh * math.sin(cant_rad)
                z_pos = root_span + dh * math.cos(cant_rad) - v_rot * chord * math.sin(cant_rad)
            ring.append(bm.verts.new((x_pos, y_pos, z_pos)))
        rings.append(ring)

    n_pts = len(rings[0])
    for r_i in range(len(rings) - 1):
        r0 = rings[r_i]
        r1 = rings[r_i + 1]
        for i in range(n_pts):
            j = (i + 1) % n_pts
            verts = (r0[i], r0[j], r1[j], r1[i]) if side >= 0 else (r0[j], r0[i], r1[i], r1[j])
            try:
                f = bm.faces.new(verts)
                f.material_index = mat_idx
            except ValueError:
                pass

    if cap_root and len(rings) > 0:
        try:
            f = bm.faces.new(list(reversed(rings[0])) if side >= 0 else list(rings[0]))
            f.material_index = mat_idx
        except ValueError:
            pass
    if cap_tip and len(rings) > 0:
        try:
            f = bm.faces.new(list(rings[-1]) if side >= 0 else list(reversed(rings[-1])))
            f.material_index = mat_idx
        except ValueError:
            pass

    return rings


def _fuselage_ring_point(
    theta: float,
    rx: float,
    rz_top: float,
    rz_bot: float,
    z_center: float,
    shape: str,
) -> Tuple[float, float]:
    """Compute cross-section (x, z) at angle theta in [0..2pi)."""
    ct = math.cos(theta)
    st = math.sin(theta)
    rz = rz_top if st >= 0.0 else rz_bot

    if shape == "ellipse":
        return rx * ct, z_center + rz * st

    if shape == "superellipse":
        # Slightly squared-off pressurized hull / cabin
        p = 0.84
        sx = math.copysign(abs(ct) ** p, ct)
        sz = math.copysign(abs(st) ** p, st)
        return rx * sx, z_center + rz * sz

    if shape == "double_deck":
        # Pear-shaped tall double-deck oval (A380)
        bulge = 1.0 + 0.08 * math.sin(theta) if st > 0 else 1.0 - 0.04 * abs(st)
        return rx * ct * bulge, z_center + rz * st

    if shape == "hump":
        # Boeing 747 upper deck hump smoothly blended onto main circular deck
        if st > 0.20:
            hump_w = 0.72 + 0.28 * (1.0 - (st - 0.20) / 0.80)
            x = rx * ct * hump_w
            z = z_center + rz * st
            return x, z
        return rx * ct, z_center + rz * st

    if shape == "diamond_chine":
        # Stealth radar-deflecting faceted diamond-chine cross-section (F-22 / F-35)
        if st >= 0.0:
            # Crisp lateral chine edges with sloped dorsal deck
            x = rx * math.copysign(abs(ct) ** 0.78, ct)
            z = z_center + rz_top * (st ** 0.85)
        else:
            # Flat faceted stealth belly
            x = rx * math.copysign(abs(ct) ** 0.78, ct)
            z = z_center - rz_bot * (abs(st) ** 0.55)
        return x, z

    if shape == "pancake":
        # Wide blended twin-engine lifting body (F-14 / F-15 / Su-27 / MiG-29)
        p_x = 0.72
        p_z = 0.90 if st >= 0.0 else 0.55
        x = rx * math.copysign(abs(ct) ** p_x, ct)
        z = z_center + (rz_top if st >= 0.0 else -rz_bot) * (abs(st) ** p_z)
        return x, z

    if shape == "box_cargo":
        # Wide flat-floor military/heavy freighter hull (An-124 / C-17 / C-130J / A400M)
        if st < 0.0:
            p = 0.52  # flat cargo floor
        else:
            p = 0.78  # arched crown
        x = rx * math.copysign(abs(ct) ** p, ct)
        z = z_center + (rz_top if st >= 0.0 else -rz_bot) * (abs(st) ** p)
        return x, z

    if shape == "apache_armor":
        # Narrow armored faceted tandem fuselage (AH-64)
        p = 0.62
        x = rx * math.copysign(abs(ct) ** p, ct)
        z = z_center + (rz_top if st >= 0.0 else -rz_bot) * (abs(st) ** 0.70)
        return x, z

    if shape == "teardrop_helo":
        p = 0.86
        x = rx * math.copysign(abs(ct) ** p, ct)
        z = z_center + (rz_top if st >= 0.0 else -rz_bot) * (abs(st) ** p)
        return x, z

    return rx * ct, z_center + rz * st


def build_lofted_fuselage(
    bm: Any,
    stations: Sequence[Tuple[float, float, float, float, float, str, int]],
    n_ring: int = 28,
) -> List[List[Any]]:
    """
    Loft a multi-station fuselage along +Y (nose) -> -Y (tail).
    Each station: (y, rx, rz_top, rz_bot, z_center, shape, mat_idx)
    First and last stations are cleanly sealed to apex poles.
    """
    rings: List[List[Any]] = []
    ring_mats: List[int] = []

    for y, rx, rz_top, rz_bot, z_c, shape, mat_idx in stations:
        ring = []
        rx_s = max(0.015, rx)
        rzt_s = max(0.015, rz_top)
        rzb_s = max(0.015, rz_bot)
        for i in range(n_ring):
            theta = 2.0 * math.pi * i / n_ring
            x, z = _fuselage_ring_point(theta, rx_s, rzt_s, rzb_s, z_c, shape)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
        ring_mats.append(mat_idx)

    # Loft longitudinal bands
    for r_i in range(len(rings) - 1):
        r0 = rings[r_i]
        r1 = rings[r_i + 1]
        m_idx = ring_mats[r_i]
        for i in range(n_ring):
            j = (i + 1) % n_ring
            try:
                f = bm.faces.new((r0[i], r1[i], r1[j], r0[j]))
                # Belly material override for lower hemisphere when primary is 0
                theta_mid = 2.0 * math.pi * (i + 0.5) / n_ring
                if m_idx == 0 and math.sin(theta_mid) < -0.45:
                    f.material_index = 3  # Mat_Belly slot
                else:
                    f.material_index = m_idx
            except ValueError:
                pass

    # Cap nose pole (station 0) and tail pole (station -1)
    y0, _, _, _, z0, _, m0 = stations[0]
    y_end, _, _, _, z_end, _, m_end = stations[-1]
    nose_tip = bm.verts.new((0.0, y0 + 0.04, z0))
    tail_tip = bm.verts.new((0.0, y_end - 0.04, z_end))
    for i in range(n_ring):
        j = (i + 1) % n_ring
        try:
            fn = bm.faces.new((rings[0][j], rings[0][i], nose_tip))
            fn.material_index = m0
        except ValueError:
            pass
        try:
            ft = bm.faces.new((rings[-1][i], rings[-1][j], tail_tip))
            ft.material_index = m_end
        except ValueError:
            pass

    return rings


def add_wingtip_device(
    bm: Any,
    tip_station: Tuple[float, float, float, float, float, float],
    side: int,
    features: Sequence[str],
    wing_span: float,
    mat_idx: int = 1,
) -> None:
    """Attach Sharklets, canted winglets, Split-Scimitar tips, fences, or raked tips."""
    s_dist, chord, le_y, z_off, t_ratio, _ = tip_station
    if "sharklets" in features:
        h = max(0.95, wing_span * 0.042)
        wl_stations = [
            (s_dist, chord, le_y, z_off, t_ratio, 0.0),
            (s_dist + h * 0.22, chord * 0.78, le_y - chord * 0.22, z_off + h * 0.28, 0.08, 0.0),
            (s_dist + h * 0.42, chord * 0.52, le_y - chord * 0.55, z_off + h * 0.68, 0.07, 0.0),
            (s_dist + h * 0.54, chord * 0.24, le_y - chord * 0.86, z_off + h * 1.00, 0.06, 0.0),
        ]
        build_airfoil_wing(bm, wl_stations, side=side, mat_idx=mat_idx, cap_root=False)
    elif "split_scimitar" in features:
        h = max(1.10, wing_span * 0.045)
        up_st = [
            (s_dist, chord, le_y, z_off, t_ratio, 0.0),
            (s_dist + h * 0.35, chord * 0.45, le_y - chord * 0.52, z_off + h * 0.92, 0.07, 0.0),
            (s_dist + h * 0.44, chord * 0.16, le_y - chord * 0.80, z_off + h * 1.15, 0.05, 0.0),
        ]
        dn_st = [
            (s_dist, chord * 0.85, le_y - chord * 0.10, z_off, t_ratio, 0.0),
            (s_dist + h * 0.28, chord * 0.22, le_y - chord * 0.65, z_off - h * 0.58, 0.05, 0.0),
        ]
        build_airfoil_wing(bm, up_st, side=side, mat_idx=mat_idx, cap_root=False)
        build_airfoil_wing(bm, dn_st, side=side, mat_idx=mat_idx, cap_root=False)
    elif "winglets" in features:
        h = max(0.55, wing_span * 0.036)
        wl_stations = [
            (s_dist, chord, le_y, z_off, t_ratio, 0.0),
            (s_dist + h * 0.28, chord * 0.55, le_y - chord * 0.42, z_off + h * 0.72, 0.07, 0.0),
            (s_dist + h * 0.38, chord * 0.26, le_y - chord * 0.74, z_off + h * 1.00, 0.06, 0.0),
        ]
        build_airfoil_wing(bm, wl_stations, side=side, mat_idx=mat_idx, cap_root=False)
    elif "raked_tips" in features:
        ext = wing_span * 0.052
        rk_stations = [
            (s_dist, chord, le_y, z_off, t_ratio, 0.0),
            (s_dist + ext * 0.55, chord * 0.58, le_y - ext * 0.72, z_off + ext * 0.18, 0.07, 0.0),
            (s_dist + ext, chord * 0.18, le_y - ext * 1.38, z_off + ext * 0.34, 0.05, 0.0),
        ]
        build_airfoil_wing(bm, rk_stations, side=side, mat_idx=mat_idx, cap_root=False)
    elif "wingtip_fences" in features:
        h = max(0.65, wing_span * 0.028)
        up_st = [
            (s_dist, chord * 0.92, le_y - chord * 0.04, z_off, 0.06, 0.0),
            (s_dist + 0.06, chord * 0.48, le_y - chord * 0.42, z_off + h * 0.75, 0.05, 0.0),
        ]
        dn_st = [
            (s_dist, chord * 0.85, le_y - chord * 0.08, z_off, 0.06, 0.0),
            (s_dist + 0.06, chord * 0.42, le_y - chord * 0.44, z_off - h * 0.55, 0.05, 0.0),
        ]
        build_airfoil_wing(bm, up_st, side=side, mat_idx=mat_idx, cap_root=False)
        build_airfoil_wing(bm, dn_st, side=side, mat_idx=mat_idx, cap_root=False)


def add_nav_light(bm: Any, pos: Tuple[float, float, float], radius: float, mat_idx: int) -> None:
    bm_add_ellipsoid(bm, pos, (radius, radius * 1.3, radius), u_segs=10, v_rings=6, mat_idx=mat_idx)


# =============================================================================
# 4. ENGINE NACELLES, ANIMATED FAN BLADES, PROPELLER HUBS & AFTERBURNER NOZZLES
# =============================================================================

def build_turbofan_nacelle(
    bm: Any,
    cx: float,
    cy_front: float,
    cz: float,
    radius: float,
    length: float,
    chevron: bool = False,
    pylon_top: Optional[Tuple[float, float, float]] = None,
    pylon_side: Optional[Tuple[float, float, float]] = None,
    mat_cowl: int = 0,
    mat_lip: int = 4,
    mat_dark: int = 5,
    mat_hot: int = 6,
    mat_pylon: int = 1,
) -> float:
    """
    Build a contoured high-bypass turbofan nacelle with recessed intake lip,
    optional serrated chevron bypass exit, hot core exhaust cone, and pylon.
    Returns `cy_fan` (world Y coordinate for placing `Fan_Blades_i`).
    """
    n_ring = 24
    # Nacelle outer loft stations (y_rel from cy_front going aft, r_outer)
    outer_profile = [
        (0.00, radius * 0.86, mat_lip),
        (-length * 0.05, radius * 0.98, mat_lip),
        (-length * 0.14, radius * 1.04, mat_cowl),
        (-length * 0.42, radius * 1.03, mat_cowl),
        (-length * 0.72, radius * 0.94, mat_cowl),
        (-length * 0.86, radius * 0.82, mat_cowl),
    ]
    rings = []
    mats = []
    for y_rel, rad, m_i in outer_profile:
        ring = []
        for i in range(n_ring):
            ang = 2.0 * math.pi * i / n_ring
            # Sawtooth chevron edge on final bypass ring
            y_jit = 0.0
            if chevron and y_rel == outer_profile[-1][0]:
                y_jit = -length * 0.055 if (i % 2 == 0) else length * 0.02
            ring.append(bm.verts.new((cx + rad * math.cos(ang), cy_front + y_rel + y_jit, cz + rad * math.sin(ang))))
        rings.append(ring)
        mats.append(m_i)

    for r_i in range(len(rings) - 1):
        r0, r1 = rings[r_i], rings[r_i + 1]
        for i in range(n_ring):
            j = (i + 1) % n_ring
            try:
                f = bm.faces.new((r0[i], r1[i], r1[j], r0[j]))
                f.material_index = mats[r_i]
            except ValueError:
                pass

    # Recessed intake barrel curving inward to fan face
    cy_fan = cy_front - length * 0.24
    inner_front = [
        bm.verts.new((cx + radius * 0.82 * math.cos(2.0 * math.pi * i / n_ring), cy_front - length * 0.03, cz + radius * 0.82 * math.sin(2.0 * math.pi * i / n_ring)))
        for i in range(n_ring)
    ]
    inner_back = [
        bm.verts.new((cx + radius * 0.80 * math.cos(2.0 * math.pi * i / n_ring), cy_fan - length * 0.08, cz + radius * 0.80 * math.sin(2.0 * math.pi * i / n_ring)))
        for i in range(n_ring)
    ]
    for i in range(n_ring):
        j = (i + 1) % n_ring
        try:
            f1 = bm.faces.new((rings[0][i], rings[0][j], inner_front[j], inner_front[i]))
            f1.material_index = mat_lip
            f2 = bm.faces.new((inner_front[i], inner_front[j], inner_back[j], inner_back[i]))
            f2.material_index = mat_dark
        except ValueError:
            pass
    # Dark backing disc behind fan blades
    try:
        fb = bm.faces.new(list(reversed(inner_back)))
        fb.material_index = mat_dark
    except ValueError:
        pass

    # Core hot exhaust cowl + center plug cone
    bm_add_cylinder(
        bm,
        (cx, cy_front - length * 0.82, cz),
        (cx, cy_front - length * 1.06, cz),
        radius * 0.62,
        radius * 0.44,
        segments=18,
        cap_ends=True,
        mat_idx=mat_hot,
    )
    bm_add_cylinder(
        bm,
        (cx, cy_front - length * 1.02, cz),
        (cx, cy_front - length * 1.24, cz),
        radius * 0.28,
        radius * 0.03,
        segments=14,
        cap_ends=True,
        mat_idx=mat_hot,
    )

    # Aerodynamic pylon connecting nacelle to wing or fuselage
    if pylon_top is not None:
        tx, ty, tz = pylon_top
        p_w = radius * 0.24
        p_len = length * 0.82
        p_mid_y = (cy_front - length * 0.42 + ty) * 0.5
        p_mid_z = (cz + radius * 0.88 + tz) * 0.5
        p_h = max(0.12, abs(tz - (cz + radius * 0.72)))
        bm_add_box(bm, ((cx + tx) * 0.5, p_mid_y, p_mid_z), (p_w, p_len, p_h), mat_idx=mat_pylon)

    if pylon_side is not None:
        sx, sy, sz = pylon_side
        span_p = abs(cx - sx)
        bm_add_box(
            bm,
            ((cx + sx) * 0.5, (cy_front - length * 0.45 + sy) * 0.5, (cz + sz) * 0.5),
            (max(0.10, span_p), length * 0.66, radius * 0.28),
            mat_idx=mat_pylon,
        )

    return cy_fan


def create_fan_blades_object(
    index: int,
    cx: float,
    cy_fan: float,
    cz: float,
    radius: float,
    mats: MaterialLibrary,
    blade_count: int = 20,
) -> Any:
    """Create separate `Fan_Blades_<index>` object pivoted at spinner center."""
    bm = bmesh.new()
    hub_r = radius * 0.26
    blade_r = radius * 0.79

    # Aerodynamic conical spinner (mat 0 = chrome/spinner, mat 1 = carbon blades)
    bm_add_cylinder(
        bm,
        (0.0, -radius * 0.14, 0.0),
        (0.0, radius * 0.34, 0.0),
        hub_r,
        radius * 0.02,
        segments=14,
        cap_ends=True,
        mat_idx=0,
    )

    # Pitched wide-chord titanium/composite fan blades
    for i in range(blade_count):
        ang = 2.0 * math.pi * i / blade_count
        ca, sa = math.cos(ang), math.sin(ang)
        mid_r = (hub_r * 0.85 + blade_r) * 0.5
        b_len = blade_r - hub_r * 0.85
        b_chord = (2.0 * math.pi * mid_r / blade_count) * 0.82
        b_thick = max(0.012, radius * 0.022)

        # Build blade rotated radially & pitched 32 deg
        mat = (
            Matrix.Rotation(ang, 4, "Y")
            @ Matrix.Translation(Vector((mid_r, 0.0, 0.0)))
            @ Matrix.Rotation(math.radians(32.0), 4, "X")
            @ Matrix.Diagonal((b_len, b_chord, b_thick, 1.0))
        )
        res = bmesh.ops.create_cube(bm, size=1.0, matrix=mat)
        vset = set(res["verts"])
        for f in bm.faces:
            if all(v in vset for v in f.verts):
                f.material_index = 1

    return finalize_mesh_object(
        f"Fan_Blades_{index}",
        bm,
        [mats.chrome, mats.blade],
        location=(cx, cy_fan, cz),
        smooth=True,
    )


def create_propeller_hub_object(
    index: int,
    cx: float,
    cy_prop: float,
    cz: float,
    prop_radius: float,
    blade_count: int,
    mats: MaterialLibrary,
    scimitar: bool = False,
) -> Any:
    """Create separate `Propeller_Hub_<index>` object pivoted at hub center."""
    bm = bmesh.new()
    spin_r = max(0.11, prop_radius * 0.14)
    spin_l = spin_r * 2.25

    # Spinner cone pointing +Y forward (mat 0 = chrome/spinner, mat 1 = composite blade, mat 2 = tip accent)
    bm_add_cylinder(
        bm,
        (0.0, -spin_l * 0.25, 0.0),
        (0.0, spin_l * 0.75, 0.0),
        spin_r,
        spin_r * 0.08,
        segments=14,
        cap_ends=True,
        mat_idx=0,
    )

    for i in range(blade_count):
        ang = 2.0 * math.pi * i / blade_count
        rot_m = Matrix.Rotation(ang, 4, "Y")
        n_segs = 5
        blade_rings = []
        for s in range(n_segs + 1):
            frac = s / n_segs
            r_pos = spin_r * 0.7 + frac * (prop_radius - spin_r * 0.7)
            chord = prop_radius * (0.115 * math.sin(math.pi * (0.18 + 0.78 * frac)))
            thick = chord * (0.24 - 0.15 * frac)
            pitch = math.radians(38.0 - 20.0 * frac)
            sweep = -prop_radius * 0.06 * (frac ** 2) if scimitar else 0.0

            # 6-point airfoil blade section
            pts = [
                (0.5 * chord, 0.0),
                (0.1 * chord, 0.5 * thick),
                (-0.5 * chord, 0.1 * thick),
                (-0.5 * chord, -0.1 * thick),
                (0.1 * chord, -0.5 * thick),
            ]
            ring = []
            cp, sp = math.cos(pitch), math.sin(pitch)
            for u, v in pts:
                y_loc = u * sp + v * cp
                z_loc = u * cp - v * sp + sweep
                p = rot_m @ Vector((r_pos, y_loc, z_loc))
                ring.append(bm.verts.new(p))
            blade_rings.append(ring)

        for s in range(n_segs):
            r0, r1 = blade_rings[s], blade_rings[s + 1]
            m_idx = 2 if s == n_segs - 1 else 1
            for k in range(len(r0)):
                kn = (k + 1) % len(r0)
                try:
                    f = bm.faces.new((r0[k], r0[kn], r1[kn], r1[k]))
                    f.material_index = m_idx
                except ValueError:
                    pass
        try:
            ft = bm.faces.new(blade_rings[-1])
            ft.material_index = 2
        except ValueError:
            pass

    return finalize_mesh_object(
        f"Propeller_Hub_{index}",
        bm,
        [mats.chrome, mats.blade, mats.accent],
        location=(cx, cy_prop, cz),
        smooth=True,
    )


def create_turkey_feather_nozzle(
    name: str,
    cx: float,
    cy_front: float,
    cz: float,
    radius: float,
    length: float,
    style: str,
    mats: MaterialLibrary,
) -> Any:
    """
    Create fighter afterburner exhaust nozzle (`Nozzle_L` / `Nozzle_R`).
    Styles:
      - 'standard': 16 articulated titanium turkey-feather petals (F404/F110/AL-31)
      - 'tvc_2d': rectangular stealth 2D thrust-vectoring wedge paddles (F-22A)
      - 'serrated': sawtooth radar-absorbent chevron petals (F-35A F135)
    """
    bm = bmesh.new()

    if style == "tvc_2d":
        # Rectangular 2D TVC shroud + upper/lower vectoring paddles
        w = radius * 2.15
        h = radius * 1.12
        # Outer shroud sides
        bm_add_box(bm, (-w * 0.48, -length * 0.45, 0.0), (w * 0.14, length * 0.95, h * 1.10), mat_idx=0)
        bm_add_box(bm, (w * 0.48, -length * 0.45, 0.0), (w * 0.14, length * 0.95, h * 1.10), mat_idx=0)
        # Upper & lower angled vectoring paddles
        bm_add_box(bm, (0.0, -length * 0.50, h * 0.44), (w * 0.96, length * 1.05, h * 0.16), rot_deg=(7.0, 0.0, 0.0), mat_idx=0)
        bm_add_box(bm, (0.0, -length * 0.50, -h * 0.44), (w * 0.96, length * 1.05, h * 0.16), rot_deg=(-7.0, 0.0, 0.0), mat_idx=0)
        # Recessed burner interior
        bm_add_box(bm, (0.0, -length * 0.20, 0.0), (w * 0.78, length * 0.30, h * 0.68), mat_idx=1)
        bm_add_box(bm, (0.0, -length * 0.08, 0.0), (w * 0.66, length * 0.12, h * 0.52), mat_idx=2)
    else:
        n_petals = 14 if style == "serrated" else 16
        # Convergent outer collar
        bm_add_cylinder(bm, (0.0, 0.0, 0.0), (0.0, -length * 0.35, 0.0), radius * 1.04, radius * 0.96, segments=20, cap_ends=False, mat_idx=0)
        # Overlapping titanium turkey-feather petals
        for i in range(n_petals):
            ang = 2.0 * math.pi * i / n_petals
            p_w = (2.0 * math.pi * radius / n_petals) * 1.08
            p_len = length * (0.82 if (style == "serrated" and i % 2 == 0) else 0.72)
            r_mid = radius * 0.90
            mat = (
                Matrix.Rotation(ang, 4, "Y")
                @ Matrix.Translation(Vector((r_mid, -length * 0.55, 0.0)))
                @ Matrix.Rotation(math.radians(-8.5), 4, "Z")
                @ Matrix.Diagonal((radius * 0.11, p_len, p_w, 1.0))
            )
            res = bmesh.ops.create_cube(bm, size=1.0, matrix=mat)
            vset = set(res["verts"])
            for f in bm.faces:
                if all(v in vset for v in f.verts):
                    f.material_index = 0

        # Inner dark duct + glowing flameholder ring
        bm_add_cylinder(bm, (0.0, -length * 0.05, 0.0), (0.0, -length * 0.78, 0.0), radius * 0.76, radius * 0.70, segments=18, cap_ends=True, mat_idx=1)
        bm_add_cylinder(bm, (0.0, -length * 0.10, 0.0), (0.0, -length * 0.22, 0.0), radius * 0.56, radius * 0.56, segments=16, cap_ends=True, mat_idx=2)

    return finalize_mesh_object(
        name,
        bm,
        [mats.titanium, mats.dark_intake, mats.burner_glow],
        location=(cx, cy_front, cz),
        smooth=True,
    )


# =============================================================================
# 5. RETRACTABLE / FIXED / BOGIE / SKID LANDING GEAR SYSTEM
# =============================================================================

def build_landing_gear_system(
    spec: Dict[str, Any],
    z_belly: float,
    fus_r: float,
    mats: MaterialLibrary,
    nose_y: Optional[float] = None,
    main_y: Optional[float] = None,
    main_track: Optional[float] = None,
) -> Tuple[Any, Optional[Any]]:
    """
    Create separate `Landing_Gear` and `Tires` objects sitting flush at Z = 0.0.
    Supports tricycle, carrier dual-nose + launch bar, 6-wheel bogies, 16-wheel
    4-post heavy widebody, 24-wheel An-124 multi-bogie, sponson bogies,
    taildragger, wheel pants, helicopter skids, and helicopter wheeled gear.
    """
    L = spec["length"]
    span = spec["span"]
    gtype = spec["gear_type"]

    bm_gear = bmesh.new()
    bm_tires = bmesh.new()

    if gtype == "skids":
        skid_len = L * 0.34
        skid_w = max(0.95, fus_r * 1.45)
        skid_r = max(0.042, fus_r * 0.058)
        skid_z = skid_r
        y_center = L * 0.06
        for sx in (-1, 1):
            x = sx * skid_w
            # Horizontal main skid tube resting at Z = 0.0
            bm_add_cylinder(
                bm_gear,
                (x, y_center - skid_len * 0.52, skid_z),
                (x, y_center + skid_len * 0.44, skid_z),
                skid_r, skid_r, segments=12, mat_idx=0,
            )
            # Upturned front toe of skid
            bm_add_cylinder(
                bm_gear,
                (x, y_center + skid_len * 0.44, skid_z),
                (x, y_center + skid_len * 0.58, skid_z + skid_r * 3.8),
                skid_r, skid_r * 0.85, segments=10, mat_idx=0,
            )
            # Two angled cross-tube struts up to belly
            for sy_f in (-0.28, 0.24):
                bm_add_cylinder(
                    bm_gear,
                    (x, y_center + skid_len * sy_f, skid_z),
                    (sx * fus_r * 0.55, y_center + skid_len * sy_f, z_belly + 0.08),
                    skid_r * 0.88, skid_r * 0.88, segments=10, mat_idx=0,
                )
        # Skid wear pads in Tires object so regex always finds consistent pair
        for sx in (-1, 1):
            for sy_f in (-0.30, 0.26):
                bm_add_box(
                    bm_tires,
                    (sx * skid_w, y_center + skid_len * sy_f, skid_r * 0.30),
                    (skid_r * 2.1, skid_len * 0.14, skid_r * 0.60),
                    mat_idx=0,
                )
        obj_gear = finalize_mesh_object("Landing_Gear", bm_gear, [mats.chrome, mats.secondary], smooth=True)
        obj_tires = finalize_mesh_object("Tires", bm_tires, [mats.tire], smooth=True)
        return obj_gear, obj_tires

    # Wheeled aircraft & wheeled helicopters
    if nose_y is None:
        nose_y = L * 0.34
    if main_y is None:
        main_y = -L * 0.04
    if main_track is None:
        main_track = min(span * 0.16, max(1.15, fus_r * 1.95))

    strut_h = max(0.45, z_belly)
    tire_r = max(0.18, min(0.72, strut_h * 0.26 if L > 25 else strut_h * 0.30))
    nose_r = tire_r * 0.78
    strut_r = max(0.035, tire_r * 0.22)

    def add_strut_unit(
        gx: float,
        gy: float,
        z_top: float,
        w_r: float,
        pairs_along_y: int = 1,
        dual_x: bool = True,
        drag_brace_dir: float = -1.0,
        launch_bar: bool = False,
        wheel_pant: bool = False,
    ) -> None:
        # Upper cylinder + chrome oleo piston
        z_mid = w_r + (z_top - w_r) * 0.45
        bm_add_cylinder(bm_gear, (gx, gy, z_mid), (gx, gy, z_top + 0.12), strut_r * 1.25, strut_r * 1.35, segments=12, mat_idx=1)
        bm_add_cylinder(bm_gear, (gx, gy, w_r), (gx, gy, z_mid + 0.05), strut_r * 0.92, strut_r * 0.92, segments=12, mat_idx=0)
        # Drag brace strut
        bm_add_cylinder(
            bm_gear,
            (gx, gy, z_mid),
            (gx, gy + drag_brace_dir * (z_top - w_r) * 0.55, z_top + 0.08),
            strut_r * 0.55, strut_r * 0.55, segments=8, mat_idx=1,
        )
        # Carrier catapult launch bar
        if launch_bar:
            bm_add_cylinder(
                bm_gear,
                (gx, gy, w_r * 1.55),
                (gx, gy + w_r * 2.2, w_r * 0.55),
                strut_r * 0.45, strut_r * 0.38, segments=8, mat_idx=0,
            )
        # Bogie beam if multi-axle
        y_offsets = [0.0]
        if pairs_along_y == 2:
            y_offsets = [-w_r * 1.25, w_r * 1.25]
        elif pairs_along_y == 3:
            y_offsets = [-w_r * 2.25, 0.0, w_r * 2.25]
        if pairs_along_y > 1:
            bm_add_cylinder(
                bm_gear,
                (gx, gy + y_offsets[0], w_r),
                (gx, gy + y_offsets[-1], w_r),
                strut_r * 0.78, strut_r * 0.78, segments=10, mat_idx=1,
            )
        # Wheels/Tires sitting exactly on Z = 0.0 (center at Z = w_r)
        t_width = w_r * 0.46
        x_offsets = (-w_r * 0.58, w_r * 0.58) if dual_x else (0.0,)
        for yo in y_offsets:
            if dual_x:
                bm_add_cylinder(
                    bm_gear,
                    (gx - w_r * 0.65, gy + yo, w_r),
                    (gx + w_r * 0.65, gy + yo, w_r),
                    strut_r * 0.55, strut_r * 0.55, segments=8, mat_idx=0,
                )
            for xo in x_offsets:
                bm_add_tire(bm_tires, (gx + xo, gy + yo, w_r), w_r, t_width, axle_axis="X", segments=18, mat_idx=0)
                if wheel_pant:
                    bm_add_ellipsoid(
                        bm_gear,
                        (gx + xo, gy + yo - w_r * 0.25, w_r * 1.05),
                        (t_width * 0.85, w_r * 2.15, w_r * 0.92),
                        u_segs=14, v_rings=8, mat_idx=1,
                    )

    if gtype == "taildragger":
        # Forward cantilevered main legs + small tailwheel
        for sx in (-1, 1):
            bm_add_cylinder(
                bm_gear,
                (sx * fus_r * 0.55, L * 0.14, z_belly + 0.08),
                (sx * main_track, L * 0.17, tire_r),
                strut_r * 1.1, strut_r * 0.85, segments=10, mat_idx=1,
            )
            bm_add_tire(bm_tires, (sx * main_track, L * 0.17, tire_r), tire_r, tire_r * 0.48, mat_idx=0)
        tw_r = tire_r * 0.42
        bm_add_cylinder(bm_gear, (0.0, -L * 0.42, z_belly + 0.15), (0.0, -L * 0.45, tw_r), strut_r * 0.55, strut_r * 0.50, segments=8, mat_idx=0)
        bm_add_tire(bm_tires, (0.0, -L * 0.45, tw_r), tw_r, tw_r * 0.45, mat_idx=0)

    elif gtype == "helo_tailwheel":
        # UH-60 / AH-64 rugged forward main wheels + aft tailwheel
        for sx in (-1, 1):
            bm_add_cylinder(
                bm_gear,
                (sx * fus_r * 0.72, L * 0.12, z_belly + 0.22),
                (sx * main_track, L * 0.14, tire_r),
                strut_r * 1.25, strut_r * 0.95, segments=10, mat_idx=1,
            )
            bm_add_tire(bm_tires, (sx * main_track, L * 0.14, tire_r), tire_r, tire_r * 0.56, mat_idx=0)
        tw_r = tire_r * 0.52
        bm_add_cylinder(bm_gear, (0.0, -L * 0.38, z_belly + 0.40), (0.0, -L * 0.41, tw_r), strut_r * 0.72, strut_r * 0.60, segments=8, mat_idx=0)
        bm_add_tire(bm_tires, (0.0, -L * 0.41, tw_r), tw_r, tw_r * 0.48, mat_idx=0)

    elif gtype == "an124_24":
        # An-124: twin side-by-side dual-wheel nose struts + 10-wheel (5 bogie pairs) per sponson!
        for sx in (-1, 1):
            add_strut_unit(sx * 0.95, nose_y, z_belly, nose_r, pairs_along_y=1, dual_x=True)
            for k in range(5):
                gy = main_y + (2 - k) * (tire_r * 2.45)
                add_strut_unit(sx * (fus_r * 1.08), gy, z_belly + 0.45, tire_r * 0.88, pairs_along_y=1, dual_x=True)

    elif gtype == "quad_body_16":
        # B747 / A380: dual nose + 2 wing posts + 2 body posts (4-wheel bogies)
        add_strut_unit(0.0, nose_y, z_belly, nose_r, pairs_along_y=1, dual_x=True)
        for sx in (-1, 1):
            add_strut_unit(sx * main_track, main_y, z_belly + 0.35, tire_r, pairs_along_y=2, dual_x=True)
            add_strut_unit(sx * (fus_r * 0.62), main_y - tire_r * 3.1, z_belly, tire_r, pairs_along_y=2, dual_x=True)

    elif gtype == "multi_bogie_6":
        # B777 / A350-1000: dual nose + 6-wheel triple-tandem main bogies
        add_strut_unit(0.0, nose_y, z_belly, nose_r, pairs_along_y=1, dual_x=True)
        for sx in (-1, 1):
            add_strut_unit(sx * main_track, main_y, z_belly + 0.30, tire_r, pairs_along_y=3, dual_x=True)

    elif gtype == "sponson_bogie":
        # C-17 / C-130J / A400M / ATR / Do228: dual nose + sponson-mounted tandem main gear
        add_strut_unit(0.0, nose_y, z_belly, nose_r, pairs_along_y=1, dual_x=(L > 18.0))
        tandem = 3 if L > 40.0 else (2 if L > 28.0 else 1)
        for sx in (-1, 1):
            add_strut_unit(sx * (fus_r * 1.05), main_y, z_belly + 0.25, tire_r, pairs_along_y=tandem, dual_x=(L > 20.0))

    elif gtype == "carrier_tricycle":
        # F/A-18C / F-14B: dual-wheel nose gear with launch bar + rugged single main wheels
        add_strut_unit(0.0, nose_y, z_belly, nose_r, pairs_along_y=1, dual_x=True, launch_bar=True)
        for sx in (-1, 1):
            add_strut_unit(sx * main_track, main_y, z_belly + 0.18, tire_r, pairs_along_y=1, dual_x=False)

    elif gtype in ("fixed_tricycle", "wheel_pants"):
        # GA & utility fixed gear (optional aerodynamic wheel pants)
        pants = (gtype == "wheel_pants")
        add_strut_unit(0.0, nose_y, z_belly, nose_r, pairs_along_y=1, dual_x=False, wheel_pant=pants)
        for sx in (-1, 1):
            bm_add_cylinder(
                bm_gear,
                (sx * fus_r * 0.52, main_y, z_belly + 0.08),
                (sx * main_track, main_y, tire_r),
                strut_r * 1.05, strut_r * 0.85, segments=10, mat_idx=1,
            )
            bm_add_tire(bm_tires, (sx * main_track, main_y, tire_r), tire_r, tire_r * 0.48, mat_idx=0)
            if pants:
                bm_add_ellipsoid(
                    bm_gear,
                    (sx * main_track, main_y - tire_r * 0.25, tire_r * 1.05),
                    (tire_r * 0.42, tire_r * 2.15, tire_r * 0.92),
                    u_segs=14, v_rings=8, mat_idx=1,
                )

    elif gtype == "helo_tricycle":
        # S-92 / AW101 retractable nose & sponson main wheels
        add_strut_unit(0.0, nose_y, z_belly, nose_r, pairs_along_y=1, dual_x=True)
        for sx in (-1, 1):
            add_strut_unit(sx * (fus_r * 1.15), main_y, z_belly + 0.28, tire_r, pairs_along_y=1, dual_x=True)

    else:
        # Standard retractable tricycle (airliners, bizjets, fighters, GA)
        dual_nose = L >= 18.0
        dual_main = L >= 15.0 and spec["preset_class"] != "fighter"
        tandem_main = 2 if L >= 46.0 else 1
        add_strut_unit(0.0, nose_y, z_belly, nose_r, pairs_along_y=1, dual_x=dual_nose)
        for sx in (-1, 1):
            add_strut_unit(sx * main_track, main_y, z_belly + 0.25, tire_r, pairs_along_y=tandem_main, dual_x=dual_main)

    obj_gear = finalize_mesh_object("Landing_Gear", bm_gear, [mats.chrome, mats.secondary], smooth=True)
    obj_tires = finalize_mesh_object("Tires", bm_tires, [mats.tire], smooth=True)
    return obj_gear, obj_tires


# =============================================================================
# 6. CLASS 1 BUILDER — FIGHTERS & JET TRAINERS (20 AIRCRAFT)
# =============================================================================

def build_fighter_trainer(spec: Dict[str, Any], mats: MaterialLibrary) -> None:
    ac_id = spec["id"]
    L = spec["length"]
    span = spec["span"]
    H = spec["height"]
    half_s = span * 0.5
    feats = spec["features"]
    engines = spec["engines"]

    fus_r = spec["fuselage_radius"] or (L * 0.052)
    z_belly = max(0.85, H * 0.26)
    z_fus = z_belly + fus_r * 0.92

    shape = "diamond_chine" if "diamond_chine" in feats else ("pancake" if "pancake" in feats else "ellipse")
    rx_mid = fus_r * (1.55 if shape == "pancake" else (1.35 if shape == "diamond_chine" else 1.08))
    rzt_mid = fus_r * 0.88
    rzb_mid = fus_r * 0.72

    # --- 1. FUSELAGE (mat slots: 0=primary, 1=secondary, 2=accent, 3=belly, 4=radome, 5=dark, 6=chrome) ---
    bm_fus = bmesh.new()
    fus_stations = [
        (L * 0.50, 0.04, 0.04, 0.04, z_fus - 0.14, "ellipse", 4),
        (L * 0.42, rx_mid * 0.34, rzt_mid * 0.36, rzb_mid * 0.34, z_fus - 0.10, "ellipse", 4),
        (L * 0.32, rx_mid * 0.62, rzt_mid * 0.68, rzb_mid * 0.62, z_fus - 0.04, shape, 0),
        (L * 0.18, rx_mid * 0.88, rzt_mid * 0.94, rzb_mid * 0.88, z_fus, shape, 0),
        (L * 0.02, rx_mid * 1.00, rzt_mid * 1.02, rzb_mid * 0.96, z_fus, shape, 0),
        (-L * 0.20, rx_mid * 0.96, rzt_mid * 0.96, rzb_mid * 0.90, z_fus, shape, 0),
        (-L * 0.38, rx_mid * (0.86 if engines == 2 else 0.66), rzt_mid * 0.78, rzb_mid * 0.72, z_fus - 0.02, shape, 0),
        (-L * 0.46, rx_mid * (0.72 if engines == 2 else 0.52), rzt_mid * 0.62, rzb_mid * 0.56, z_fus - 0.04, "ellipse", 1),
    ]
    build_lofted_fuselage(bm_fus, fus_stations, n_ring=28)

    # Pitot nose needle (non-stealth jets)
    if "diamond_chine" not in feats:
        bm_add_cylinder(
            bm_fus,
            (0.0, L * 0.50, z_fus - 0.14),
            (0.0, L * 0.545, z_fus - 0.14),
            0.028, 0.006, segments=8, mat_idx=6,
        )

    # Dorsal avionics spine & conformal fuel tanks (F-16V)
    if "cft_spine" in feats:
        bm_add_box(bm_fus, (0.0, -L * 0.06, z_fus + rzt_mid * 0.95), (rx_mid * 0.46, L * 0.44, rzt_mid * 0.42), mat_idx=1)
        for sx in (-1, 1):
            bm_add_ellipsoid(bm_fus, (sx * rx_mid * 0.82, -L * 0.04, z_fus + rzt_mid * 0.42), (rx_mid * 0.36, L * 0.22, rzt_mid * 0.34), mat_idx=1)

    # Dorsal cooling louvers behind canopy (F/A-18C)
    if "louvers" in feats:
        for k in range(5):
            bm_add_box(bm_fus, (0.0, L * 0.02 - k * 0.26, z_fus + rzt_mid * 0.92), (rx_mid * 0.52, 0.11, 0.08), mat_idx=5)

    # Air intakes by fighter architecture
    if "chin_intake" in feats:
        # F-16 / Typhoon smiling ventral chin intake
        bm_add_box(bm_fus, (0.0, L * 0.10, z_fus - rzb_mid * 1.15), (rx_mid * 1.18, L * 0.36, rzb_mid * 0.72), mat_idx=1)
        bm_add_box(bm_fus, (0.0, L * 0.275, z_fus - rzb_mid * 1.15), (rx_mid * 0.96, 0.14, rzb_mid * 0.54), mat_idx=5)
    elif "caret_intakes" in feats:
        # F-22A angled stealth caret side intakes
        for sx in (-1, 1):
            bm_add_box(bm_fus, (sx * rx_mid * 1.02, L * 0.08, z_fus - 0.06), (rx_mid * 0.48, L * 0.38, rzt_mid * 0.84), rot_deg=(0.0, sx * 14.0, 0.0), mat_idx=0)
            bm_add_box(bm_fus, (sx * rx_mid * 1.04, L * 0.265, z_fus - 0.06), (rx_mid * 0.36, 0.12, rzt_mid * 0.66), rot_deg=(0.0, sx * 14.0, 0.0), mat_idx=5)
    elif "dsi_intakes" in feats:
        # F-35A Diverterless Supersonic Inlet bumps + EOTS sensor prism
        for sx in (-1, 1):
            bm_add_box(bm_fus, (sx * rx_mid * 0.96, L * 0.06, z_fus - 0.05), (rx_mid * 0.42, L * 0.34, rzt_mid * 0.76), mat_idx=0)
            bm_add_ellipsoid(bm_fus, (sx * rx_mid * 0.84, L * 0.22, z_fus - 0.05), (rx_mid * 0.16, 0.38, rzt_mid * 0.48), mat_idx=1)
            bm_add_box(bm_fus, (sx * rx_mid * 1.00, L * 0.225, z_fus - 0.05), (rx_mid * 0.28, 0.10, rzt_mid * 0.58), mat_idx=5)
        bm_add_ellipsoid(bm_fus, (0.0, L * 0.30, z_fus - rzb_mid * 0.96), (0.14, 0.28, 0.14), mat_idx=5)
    elif shape == "pancake":
        # Twin rectangular oblique intakes (F-14 / F-15 / Su-27 / MiG-29)
        intake_x = rx_mid * (0.98 if ac_id in ("f14b", "f15c", "sf15") else 0.78)
        intake_z = z_fus - (rzb_mid * 0.55 if ac_id in ("su27", "mig29") else 0.05)
        for sx in (-1, 1):
            bm_add_box(bm_fus, (sx * intake_x, -L * 0.02, intake_z), (rx_mid * 0.54, L * 0.52, rzt_mid * 0.86), mat_idx=0)
            bm_add_box(bm_fus, (sx * intake_x, L * 0.24, intake_z), (rx_mid * 0.44, 0.14, rzt_mid * 0.68), mat_idx=5)
        # Su-27 central tail boom sting cone
        if ac_id == "su27":
            bm_add_cylinder(bm_fus, (0.0, -L * 0.36, z_fus), (0.0, -L * 0.53, z_fus - 0.04), rx_mid * 0.24, 0.05, segments=14, mat_idx=1)
    else:
        # Side kidney / shock-cone intakes (F/A-18C, F-CK-1, Mirage, Rafale, Gripen, F-5E, F-104G, trainers)
        for sx in (-1, 1):
            bm_add_box(bm_fus, (sx * rx_mid * 0.96, L * 0.02, z_fus - 0.06), (rx_mid * 0.40, L * 0.36, rzt_mid * 0.76), mat_idx=0)
            bm_add_box(bm_fus, (sx * rx_mid * 0.98, L * 0.198, z_fus - 0.06), (rx_mid * 0.30, 0.12, rzt_mid * 0.60), mat_idx=5)
            if "shock_cones" in feats:
                bm_add_cylinder(bm_fus, (sx * rx_mid * 0.88, L * 0.18, z_fus - 0.06), (sx * rx_mid * 0.88, L * 0.27, z_fus - 0.06), rzt_mid * 0.28, 0.02, segments=10, mat_idx=1)

    # Leading-Edge Extensions (LEX) — F/A-18C, F-CK-1, Su-27, MiG-29, F-5E, T-50
    if "lex" in feats:
        for sx in (-1, 1):
            lex_st = [
                (rx_mid * 0.75, L * 0.32, L * 0.28, z_fus + 0.06, 0.05, 0.0),
                (rx_mid * 1.48, L * 0.16, L * 0.12, z_fus + 0.04, 0.04, 0.0),
            ]
            build_airfoil_wing(bm_fus, lex_st, side=sx, naca_camber=0.0, mat_idx=0)

    # Refueling probe (Mirage 2000, Rafale)
    if "refuel_probe" in feats:
        bm_add_cylinder(bm_fus, (rx_mid * 0.42, L * 0.28, z_fus + rzt_mid * 0.42), (rx_mid * 0.56, L * 0.38, z_fus + rzt_mid * 0.54), 0.035, 0.022, segments=8, mat_idx=6)

    # Vertical tail(s) + ventral fins attached to Fuselage
    fin_h = max(1.6, H - z_fus - rzt_mid * 0.55)
    t_type = spec["tail_type"]
    if t_type in ("twin_vertical", "twin_canted"):
        cant = 20.0 if t_type == "twin_canted" else 4.0
        fin_x = rx_mid * (0.95 if shape == "pancake" else 0.76)
        for sx in (-1, 1):
            v_st = [
                (z_fus + rzt_mid * 0.48, L * 0.22, -L * 0.22, sx * fin_x, 0.055, 0.0),
                (z_fus + rzt_mid * 0.48 + fin_h, L * 0.085, -L * 0.36, sx * fin_x, 0.042, 0.0),
            ]
            build_airfoil_wing(bm_fus, v_st, side=sx, vertical=True, cant_deg=cant, mat_idx=1)
    else:
        v_st = [
            (z_fus + rzt_mid * 0.55, L * 0.24, -L * 0.22, 0.0, 0.058, 0.0),
            (z_fus + rzt_mid * 0.55 + fin_h, L * 0.085, -L * 0.38, 0.0, 0.042, 0.0),
        ]
        build_airfoil_wing(bm_fus, v_st, side=1, vertical=True, cant_deg=0.0, mat_idx=1)

    # Horizontal stabilators (except tailless delta fighters)
    if t_type != "tailless":
        h_span = half_s * (0.48 if ac_id != "f104g" else 0.52)
        h_z = (z_fus + rzt_mid * 0.55 + fin_h * 0.94) if t_type == "t_tail" else (z_fus - 0.04)
        for sx in (-1, 1):
            ht_st = [
                (rx_mid * 0.55 if t_type != "t_tail" else 0.05, L * 0.14, -L * 0.30, h_z, 0.05, 0.0),
                (h_span, L * 0.055, -L * 0.41, h_z - (0.14 if t_type != "t_tail" else 0.0), 0.04, 0.0),
            ]
            build_airfoil_wing(bm_fus, ht_st, side=sx, naca_camber=0.0, mat_idx=1)

    # Ventral fins (F-16, F-14, Su-27, F-104G)
    if "ventral_fins" in feats:
        for sx in (-1, 1):
            vf_st = [
                (z_fus - rzb_mid * 0.72, L * 0.14, -L * 0.26, sx * rx_mid * 0.52, 0.04, 0.0),
                (z_fus - rzb_mid * 0.72 - fin_h * 0.26, L * 0.06, -L * 0.34, sx * rx_mid * 0.72, 0.03, 0.0),
            ]
            build_airfoil_wing(bm_fus, vf_st, side=sx, vertical=True, cant_deg=0.0, mat_idx=1)

    # Close-coupled canards (Rafale, Typhoon, Gripen)
    if "canards" in feats:
        for sx in (-1, 1):
            can_st = [
                (rx_mid * 0.72, L * 0.11, L * 0.20, z_fus + rzt_mid * 0.28, 0.05, 0.0),
                (half_s * 0.44, L * 0.045, L * 0.11, z_fus + rzt_mid * 0.34, 0.04, 0.0),
            ]
            build_airfoil_wing(bm_fus, can_st, side=sx, naca_camber=0.0, mat_idx=0)

    finalize_mesh_object(
        "Fuselage",
        bm_fus,
        [mats.primary, mats.secondary, mats.accent, mats.belly, mats.radome, mats.dark_intake, mats.chrome],
        smooth=True,
    )

    # --- 2. CANOPY GLASS (`Canopy_Glass`) ---
    bm_can = bmesh.new()
    can_len = L * (0.28 if "tandem_canopy" in feats else 0.21)
    can_y = L * (0.16 if "tandem_canopy" in feats else 0.20)
    can_z = z_fus + rzt_mid * 0.78
    bm_add_ellipsoid(bm_can, (0.0, can_y, can_z), (rx_mid * 0.48, can_len * 0.55, rzt_mid * 0.62), u_segs=20, v_rings=12, mat_idx=0)
    # Dark cockpit tub & ejection seat headrest inside canopy
    bm_add_box(bm_can, (0.0, can_y - can_len * 0.05, can_z - rzt_mid * 0.15), (rx_mid * 0.42, can_len * 0.62, rzt_mid * 0.32), mat_idx=1)
    finalize_mesh_object("Canopy_Glass", bm_can, [mats.glass, mats.dark_intake], smooth=True)

    # --- 3. WINGS (`Wings`, plus `Wing_Fold_Outer_L`/`R` for fa18c & f14b) ---
    bm_wing = bmesh.new()
    w_z = z_fus + (rzt_mid * 0.35 if spec["wing_pos"] == "high" else (-rzb_mid * 0.28 if spec["wing_pos"] == "low" else 0.05))
    is_delta = spec["wing_pos"] in ("delta", "canard_delta")
    is_fold = "wing_fold" in feats

    if is_fold:
        # F/A-18C & F-14B: fixed inboard wing / sweep glove + separate outer panels pivoted at hinge!
        hinge_x = half_s * (0.62 if ac_id == "fa18c" else 0.34)
        root_chord = L * (0.28 if ac_id == "fa18c" else 0.30)
        hinge_chord = L * (0.17 if ac_id == "fa18c" else 0.18)
        tip_chord = L * (0.085 if ac_id == "fa18c" else 0.075)
        le_root = L * 0.08
        le_hinge = le_root - (hinge_x - rx_mid * 0.80) * (0.36 if ac_id == "fa18c" else 0.50)
        le_tip = le_hinge - (half_s - hinge_x) * (0.32 if ac_id == "fa18c" else 0.42)

        for sx in (-1, 1):
            in_st = [
                (rx_mid * 0.78, root_chord, le_root, w_z, 0.055, 0.0),
                (hinge_x, hinge_chord, le_hinge, w_z - 0.05, 0.048, 0.0),
            ]
            build_airfoil_wing(bm_wing, in_st, side=sx, naca_camber=0.01, mat_idx=0)
            # Wing-fold actuator fairing blister
            bm_add_ellipsoid(bm_wing, (sx * hinge_x, le_hinge - hinge_chord * 0.45, w_z), (0.10, hinge_chord * 0.42, 0.09), mat_idx=1)

            # Separate outer foldable/sweepable wing panel pivoted right at (sx*hinge_x, le_hinge - hinge_chord*0.35, w_z - 0.05)
            bm_out = bmesh.new()
            piv_x = sx * hinge_x
            piv_y = le_hinge - hinge_chord * 0.35
            piv_z = w_z - 0.05
            out_st = [
                (0.0, hinge_chord, hinge_chord * 0.35, 0.0, 0.048, 0.0),
                (half_s - hinge_x, tip_chord, (le_tip - piv_y), -0.06, 0.040, 0.0),
            ]
            build_airfoil_wing(bm_out, out_st, side=sx, naca_camber=0.01, mat_idx=0)
            if "tip_rails" in feats:
                bm_add_box(bm_out, (sx * (half_s - hinge_x + 0.04), (le_tip - piv_y) - tip_chord * 0.45, -0.06), (0.06, tip_chord * 1.45, 0.12), mat_idx=1)
            add_nav_light(bm_out, (sx * (half_s - hinge_x + 0.04), (le_tip - piv_y) - tip_chord * 0.15, -0.06), 0.055, 2 if sx < 0 else 3)
            panel_name = "Wing_Fold_Outer_L" if sx < 0 else "Wing_Fold_Outer_R"
            finalize_mesh_object(
                panel_name,
                bm_out,
                [mats.primary, mats.secondary, mats.nav_red, mats.nav_green],
                location=(piv_x, piv_y, piv_z),
                smooth=True,
            )
    else:
        for sx in (-1, 1):
            if is_delta:
                w_st = [
                    (rx_mid * 0.78, L * 0.46, L * 0.10, w_z, 0.055, 0.0),
                    (half_s * 0.55, L * 0.28, -L * 0.08, w_z - 0.06, 0.046, 0.0),
                    (half_s, L * 0.075, -L * 0.28, w_z - 0.10, 0.038, 0.0),
                ]
            elif ac_id == "f104g":
                # Iconic stubby razor anhedral Starfighter wings
                w_st = [
                    (rx_mid * 0.82, L * 0.19, L * 0.02, w_z, 0.036, 0.0),
                    (half_s, L * 0.095, -L * 0.04, w_z - 0.36, 0.032, 0.0),
                ]
            elif "diamond_chine" in feats:
                # Stealth trapezoidal diamond wing
                w_st = [
                    (rx_mid * 0.85, L * 0.34, L * 0.08, w_z, 0.052, 0.0),
                    (half_s, L * 0.085, -L * 0.18, w_z - 0.08, 0.038, 0.0),
                ]
            else:
                w_st = [
                    (rx_mid * 0.80, L * 0.26, L * 0.07, w_z, 0.058, 0.0),
                    (half_s * 0.58, L * 0.17, -L * 0.04, w_z - 0.04, 0.048, 0.0),
                    (half_s, L * 0.08, -L * 0.14, w_z - 0.08, 0.040, 0.0),
                ]
            build_airfoil_wing(bm_wing, w_st, side=sx, naca_camber=0.01, mat_idx=0)
            tip_s, tip_c, tip_le, tip_z, _, _ = w_st[-1]
            if "tip_rails" in feats:
                bm_add_box(bm_wing, (sx * (tip_s + 0.04), tip_le - tip_c * 0.45, tip_z), (0.06, tip_c * 1.45, 0.12), mat_idx=1)
            add_nav_light(bm_wing, (sx * (tip_s + 0.03), tip_le - tip_c * 0.18, tip_z), 0.055, 2 if sx < 0 else 3)

    finalize_mesh_object("Wings", bm_wing, [mats.primary, mats.secondary, mats.nav_red, mats.nav_green], smooth=True)

    # --- 4. AFTERBURNER NOZZLES (`Nozzle_L` / `Nozzle_R`) ---
    noz_style = "tvc_2d" if "tvc_2d" in feats else ("serrated" if "serrated_nozzle" in feats else "standard")
    noz_len = L * 0.065
    noz_y = -L * 0.445
    if engines == 2:
        noz_sep = rx_mid * (0.72 if ac_id in ("f14b", "su27") else 0.46)
        noz_r = rx_mid * 0.34
        create_turkey_feather_nozzle("Nozzle_L", -noz_sep, noz_y, z_fus - 0.04, noz_r, noz_len, noz_style, mats)
        create_turkey_feather_nozzle("Nozzle_R", +noz_sep, noz_y, z_fus - 0.04, noz_r, noz_len, noz_style, mats)
    else:
        noz_r = rx_mid * 0.48
        create_turkey_feather_nozzle("Nozzle_L", 0.0, noz_y, z_fus - 0.04, noz_r, noz_len, noz_style, mats)

    # --- 5. CARRIER TAILHOOK (`Tailhook` for fa18c & f14b) ---
    if "tailhook" in feats:
        bm_hook = bmesh.new()
        hk_len = L * 0.13
        bm_add_cylinder(bm_hook, (0.0, 0.0, 0.0), (0.0, -hk_len, -0.18), 0.042, 0.034, segments=10, mat_idx=0)
        bm_add_box(bm_hook, (0.0, -hk_len - 0.08, -0.24), (0.14, 0.24, 0.10), mat_idx=1)
        finalize_mesh_object(
            "Tailhook",
            bm_hook,
            [mats.chrome, mats.dark_intake],
            location=(0.0, -L * 0.34, z_fus - rzb_mid * 0.78),
            smooth=True,
        )

    # --- 6. LANDING GEAR (`Landing_Gear` & `Tires`) ---
    build_landing_gear_system(
        spec,
        z_belly=z_belly,
        fus_r=rx_mid,
        mats=mats,
        nose_y=L * 0.27,
        main_y=-L * 0.07,
        main_track=max(1.25, rx_mid * 1.45),
    )


# =============================================================================
# 7. CLASS 2 BUILDER — COMMERCIAL AIRLINERS (27 AIRCRAFT)
# =============================================================================

def build_commercial_airliner(spec: Dict[str, Any], mats: MaterialLibrary) -> None:
    L = spec["length"]
    span = spec["span"]
    H = spec["height"]
    half_s = span * 0.5
    feats = spec["features"]
    engines = spec["engines"]
    is_prop = spec["propulsion"] == "turboprop"

    fus_r = spec["fuselage_radius"] or (L * 0.048)
    z_belly = max(1.15, fus_r * (0.68 if is_prop else 0.85))
    z_fus = z_belly + fus_r

    # --- 1. FUSELAGE (mat slots: 0=primary, 1=secondary, 2=accent, 3=belly, 4=radome, 5=dark, 6=chrome, 7=nav_white) ---
    bm_fus = bmesh.new()
    is_dbl = "double_deck" in feats
    is_hump_long = "hump_long" in feats
    shape_main = "double_deck" if is_dbl else "ellipse"
    rzt_main = fus_r * (1.22 if is_dbl else 1.04)
    rzb_main = fus_r * 0.98

    if is_hump_long:
        # Boeing 747-400 iconic long upper-deck hump
        fus_stations = [
            (L * 0.50, 0.14, 0.14, 0.14, z_fus - fus_r * 0.22, "ellipse", 4),
            (L * 0.45, fus_r * 0.62, fus_r * 0.65, fus_r * 0.58, z_fus - fus_r * 0.14, "ellipse", 4),
            (L * 0.38, fus_r * 0.94, fus_r * 1.38, rzb_main * 0.92, z_fus, "hump", 0),
            (L * 0.22, fus_r * 1.00, fus_r * 1.48, rzb_main, z_fus, "hump", 0),
            (L * 0.08, fus_r * 1.00, fus_r * 1.44, rzb_main, z_fus, "hump", 0),
            (-L * 0.02, fus_r * 1.00, rzt_main, rzb_main, z_fus, "ellipse", 0),
            (-L * 0.28, fus_r * 0.98, rzt_main, rzb_main, z_fus, "ellipse", 0),
            (-L * 0.40, fus_r * 0.66, rzt_main * 0.72, rzb_main * 0.58, z_fus + fus_r * 0.28, "ellipse", 0),
            (-L * 0.50, fus_r * 0.16, rzt_main * 0.18, rzb_main * 0.14, z_fus + fus_r * 0.48, "ellipse", 1),
        ]
    else:
        fus_stations = [
            (L * 0.50, 0.12, 0.12, 0.12, z_fus - fus_r * 0.22, "ellipse", 4),
            (L * 0.46, fus_r * 0.56, fus_r * 0.58, fus_r * 0.52, z_fus - fus_r * 0.12, "ellipse", 4),
            (L * 0.39, fus_r * 0.92, rzt_main * 0.94, rzb_main * 0.90, z_fus, shape_main, 0),
            (L * 0.22, fus_r * 1.00, rzt_main, rzb_main, z_fus, shape_main, 0),
            (-L * 0.24, fus_r * 1.00, rzt_main, rzb_main, z_fus, shape_main, 0),
            (-L * 0.39, fus_r * 0.68, rzt_main * 0.72, rzb_main * 0.56, z_fus + fus_r * 0.26, "ellipse", 0),
            (-L * 0.50, fus_r * 0.14, rzt_main * 0.16, rzb_main * 0.12, z_fus + fus_r * 0.46, "ellipse", 1),
        ]
    build_lofted_fuselage(bm_fus, fus_stations, n_ring=32)

    # Wing-to-body aerodynamic belly fairing blister (low-wing jets) or main gear sponson pods (ATR)
    if is_prop:
        for sx in (-1, 1):
            bm_add_ellipsoid(bm_fus, (sx * fus_r * 0.96, -L * 0.04, z_belly + fus_r * 0.38), (fus_r * 0.36, L * 0.14, fus_r * 0.34), mat_idx=3)
    else:
        bm_add_ellipsoid(bm_fus, (0.0, L * 0.02, z_belly + fus_r * 0.32), (fus_r * 1.10, L * 0.22, fus_r * 0.48), mat_idx=3)

    # Subtle dark passenger cabin window strips along both flanks
    win_rows = [z_fus + fus_r * 0.12, z_fus + fus_r * 0.62] if is_dbl else [z_fus + fus_r * 0.18]
    for wz in win_rows:
        for sx in (-1, 1):
            bm_add_box(bm_fus, (sx * (fus_r * 0.985), L * 0.02, wz), (0.04, L * 0.62, max(0.24, fus_r * 0.14)), mat_idx=5)

    # Vertical tailfin + horizontal stabilizer (conventional or T-tail for ATR)
    fin_base_z = z_fus + rzt_main * 0.65
    fin_h = max(2.8, H - fin_base_z)
    v_st = [
        (fin_base_z, L * 0.18, -L * 0.30, 0.0, 0.095, 0.0),
        (fin_base_z + fin_h, L * 0.068, -L * 0.44, 0.0, 0.075, 0.0),
    ]
    build_airfoil_wing(bm_fus, v_st, side=1, vertical=True, mat_idx=1)

    h_span = half_s * (0.34 if not is_prop else 0.30)
    h_z = (fin_base_z + fin_h * 0.92) if spec["tail_type"] == "t_tail" else (z_fus + fus_r * 0.36)
    h_le = -L * (0.42 if spec["tail_type"] == "t_tail" else 0.36)
    for sx in (-1, 1):
        ht_st = [
            (0.08 if spec["tail_type"] == "t_tail" else fus_r * 0.38, L * 0.11, h_le, h_z, 0.08, 0.0),
            (h_span, L * 0.045, h_le - h_span * 0.42, h_z + (0.0 if spec["tail_type"] == "t_tail" else h_span * 0.12), 0.065, 0.0),
        ]
        build_airfoil_wing(bm_fus, ht_st, side=sx, naca_camber=0.0, mat_idx=1)

    # Tail strobe beacon
    add_nav_light(bm_fus, (0.0, -L * 0.505, z_fus + fus_r * 0.46), max(0.08, fus_r * 0.05), 7)

    # Zorro cockpit mask trim frame (A350 / A330neo / A321neo Starlux)
    if "zorro_mask" in feats:
        bm_add_box(bm_fus, (0.0, L * 0.435, z_fus + fus_r * 0.24), (fus_r * 1.18, L * 0.045, fus_r * 0.32), mat_idx=5)

    finalize_mesh_object(
        "Fuselage",
        bm_fus,
        [mats.primary, mats.secondary, mats.accent, mats.belly, mats.radome, mats.dark_intake, mats.chrome, mats.nav_white],
        smooth=True,
    )

    # --- 2. COCKPIT WINDSHIELD (`Windshield_Glass`) ---
    bm_win = bmesh.new()
    win_y = L * (0.37 if is_hump_long else 0.435)
    win_z = z_fus + (fus_r * 1.05 if is_hump_long else fus_r * 0.24)
    win_w = fus_r * (0.64 if is_hump_long else 0.92)
    bm_add_ellipsoid(bm_win, (0.0, win_y, win_z), (win_w * 0.62, L * 0.032, fus_r * 0.24), u_segs=18, v_rings=8, mat_idx=0)
    finalize_mesh_object("Windshield_Glass", bm_win, [mats.glass], smooth=True)

    # --- 3. WINGS + ENGINES (`Wings` + `Fan_Blades_1..N` or `Propeller_Hub_1..N`) ---
    bm_wing = bmesh.new()
    wing_z = (z_fus + rzt_main * 0.84) if is_prop else (z_belly + fus_r * 0.48)
    dihedral = 0.0 if is_prop else (half_s * 0.095)
    sweep_tan = 0.06 if is_prop else 0.54
    root_c = L * (0.12 if is_prop else 0.19)
    mid_c = root_c * (0.82 if is_prop else 0.56)
    tip_c = root_c * (0.48 if is_prop else 0.22)
    le_root = L * (0.08 if is_prop else 0.14)

    for sx in (-1, 1):
        w_st = [
            (fus_r * 0.72, root_c, le_root, wing_z, 0.135, 2.0),
            (half_s * 0.40, mid_c, le_root - (half_s * 0.40) * sweep_tan, wing_z + dihedral * 0.40, 0.11, 0.5),
            (half_s * 0.94, tip_c, le_root - (half_s * 0.94) * sweep_tan, wing_z + dihedral, 0.09, -1.5),
        ]
        build_airfoil_wing(bm_wing, w_st, side=sx, naca_camber=0.022, mat_idx=0)
        add_wingtip_device(bm_wing, w_st[-1], sx, feats, span, mat_idx=1)

        # Flap track canoe fairings under swept airliner wings
        if not is_prop:
            for frac in (0.32, 0.54, 0.74):
                fx = sx * half_s * frac
                fy = le_root - (half_s * frac) * sweep_tan - root_c * (1.0 - frac * 0.58)
                fz = wing_z + dihedral * frac - 0.18
                bm_add_ellipsoid(bm_wing, (fx, fy, fz), (max(0.10, fus_r * 0.06), root_c * 0.24, max(0.10, fus_r * 0.06)), mat_idx=3)

        tip_s, tip_c_end, tip_le_end, tip_z_end, _, _ = w_st[-1]
        add_nav_light(bm_wing, (sx * (tip_s + 0.05), tip_le_end - tip_c_end * 0.20, tip_z_end), max(0.08, fus_r * 0.045), 7 if sx < 0 else 8)

    # Engine nacelles + animated hubs
    eng_idx = 1
    if is_prop:
        # ATR 72 / ATR 42 wing-mounted turboprops
        nac_x = half_s * 0.29
        nac_r = fus_r * 0.34
        nac_len = L * 0.18
        prop_r = min(1.96, span * 0.074)
        for sx in (-1, 1):
            bm_add_ellipsoid(bm_wing, (sx * nac_x, le_root - nac_len * 0.18, wing_z - nac_r * 0.62), (nac_r, nac_len * 0.62, nac_r * 1.05), mat_idx=0)
            bm_add_box(bm_wing, (sx * nac_x, le_root + nac_len * 0.32, wing_z - nac_r * 1.15), (nac_r * 0.9, nac_len * 0.24, nac_r * 0.5), mat_idx=5)
            create_propeller_hub_object(eng_idx, sx * nac_x, le_root + nac_len * 0.46, wing_z - nac_r * 0.52, prop_r, spec["prop_blades"], mats, scimitar=True)
            eng_idx += 1
    else:
        eng_fracs = (0.34, 0.62) if engines == 4 else (0.34,)
        nac_r = max(0.75, fus_r * (0.44 if engines == 4 else 0.56))
        nac_len = nac_r * 3.15
        for frac in eng_fracs:
            for sx in (-1, 1):
                ex = sx * half_s * frac
                w_le_here = le_root - (half_s * frac) * sweep_tan
                w_z_here = wing_z + dihedral * frac
                ez = max(nac_r * 1.18, w_z_here - nac_r * 1.12)
                ey_front = w_le_here + nac_len * 0.42
                cy_fan = build_turbofan_nacelle(
                    bm_wing,
                    cx=ex,
                    cy_front=ey_front,
                    cz=ez,
                    radius=nac_r,
                    length=nac_len,
                    chevron=("chevron" in feats),
                    pylon_top=(ex, w_le_here - root_c * 0.18, w_z_here),
                    mat_cowl=0,
                    mat_lip=4,
                    mat_dark=5,
                    mat_hot=6,
                    mat_pylon=1,
                )
                create_fan_blades_object(eng_idx, ex, cy_fan, ez, nac_r, mats, blade_count=20)
                eng_idx += 1

    finalize_mesh_object(
        "Wings",
        bm_wing,
        [mats.primary, mats.secondary, mats.accent, mats.belly, mats.chrome, mats.dark_intake, mats.titanium, mats.nav_red, mats.nav_green],
        smooth=True,
    )

    # --- 4. LANDING GEAR (`Landing_Gear` & `Tires`) ---
    build_landing_gear_system(
        spec,
        z_belly=z_belly,
        fus_r=fus_r,
        mats=mats,
        nose_y=L * 0.37,
        main_y=-L * 0.04,
        main_track=min(half_s * 0.34, fus_r * 1.95),
    )


# =============================================================================
# 8. CLASS 3 BUILDER — CARGO FREIGHTERS & MILITARY AIRLIFTERS (13 AIRCRAFT)
# =============================================================================

def build_cargo_freighter(spec: Dict[str, Any], mats: MaterialLibrary) -> None:
    ac_id = spec["id"]
    L = spec["length"]
    span = spec["span"]
    H = spec["height"]
    half_s = span * 0.5
    feats = spec["features"]
    engines = spec["engines"]
    is_high = spec["wing_pos"] == "high"
    is_prop = spec["propulsion"] == "turboprop"

    fus_r = spec["fuselage_radius"] or (L * 0.052)
    z_belly = max(1.10, fus_r * (0.48 if ac_id == "an124" else (0.56 if is_high else 0.84)))
    z_fus = z_belly + fus_r

    # --- 1. FUSELAGE ---
    bm_fus = bmesh.new()
    is_hump_short = "hump_short" in feats
    shape = "box_cargo" if is_high else "ellipse"

    if is_hump_short:
        # Boeing 747-8F short upper-deck freighter hump + nose visor hinge seam
        fus_stations = [
            (L * 0.50, 0.14, 0.14, 0.14, z_fus - fus_r * 0.22, "ellipse", 4),
            (L * 0.45, fus_r * 0.62, fus_r * 0.65, fus_r * 0.58, z_fus - fus_r * 0.14, "ellipse", 4),
            (L * 0.38, fus_r * 0.94, fus_r * 1.40, fus_r * 0.92, z_fus, "hump", 0),
            (L * 0.26, fus_r * 1.00, fus_r * 1.44, fus_r * 0.98, z_fus, "hump", 0),
            (L * 0.18, fus_r * 1.00, fus_r * 1.04, fus_r * 0.98, z_fus, "ellipse", 0),
            (-L * 0.28, fus_r * 0.98, fus_r * 1.04, fus_r * 0.98, z_fus, "ellipse", 0),
            (-L * 0.40, fus_r * 0.66, fus_r * 0.72, fus_r * 0.56, z_fus + fus_r * 0.28, "ellipse", 0),
            (-L * 0.50, fus_r * 0.15, fus_r * 0.18, fus_r * 0.14, z_fus + fus_r * 0.48, "ellipse", 1),
        ]
    elif is_high:
        # An-124 / C-17 / C-130J / A400M flat-floor cargo hull + upswept rear ramp
        fus_stations = [
            (L * 0.50, 0.14, 0.14, 0.14, z_fus - fus_r * 0.26, "ellipse", 4),
            (L * 0.44, fus_r * 0.66, fus_r * 0.70, fus_r * 0.58, z_fus - fus_r * 0.14, "box_cargo", 0),
            (L * 0.34, fus_r * 0.98, fus_r * 1.04, fus_r * 0.94, z_fus, "box_cargo", 0),
            (-L * 0.18, fus_r * 1.00, fus_r * 1.06, fus_r * 0.95, z_fus, "box_cargo", 0),
            (-L * 0.34, fus_r * 0.74, fus_r * 0.92, fus_r * 0.50, z_fus + fus_r * 0.46, "box_cargo", 0),
            (-L * 0.49, fus_r * 0.20, fus_r * 0.30, fus_r * 0.16, z_fus + fus_r * 0.78, "ellipse", 1),
        ]
    else:
        fus_stations = [
            (L * 0.50, 0.12, 0.12, 0.12, z_fus - fus_r * 0.20, "ellipse", 4),
            (L * 0.45, fus_r * 0.58, fus_r * 0.60, fus_r * 0.54, z_fus - fus_r * 0.10, "ellipse", 4),
            (L * 0.38, fus_r * 0.94, fus_r * 1.00, fus_r * 0.92, z_fus, shape, 0),
            (-L * 0.26, fus_r * 1.00, fus_r * 1.04, fus_r * 0.96, z_fus, shape, 0),
            (-L * 0.39, fus_r * 0.68, fus_r * 0.72, fus_r * 0.56, z_fus + fus_r * 0.26, "ellipse", 0),
            (-L * 0.50, fus_r * 0.15, fus_r * 0.18, fus_r * 0.14, z_fus + fus_r * 0.46, "ellipse", 1),
        ]
    build_lofted_fuselage(bm_fus, fus_stations, n_ring=32)

    # Nose cargo visor seam ring (747-8F & An-124)
    if "nose_visor" in feats:
        bm_add_box(bm_fus, (0.0, L * 0.39, z_fus - fus_r * 0.08), (fus_r * 1.92, 0.12, fus_r * 1.72), mat_idx=5)

    # Fuselage main gear sponsons (An-124, C-17, C-130J, A400M)
    if is_high:
        sp_len = L * (0.34 if ac_id == "an124" else 0.24)
        for sx in (-1, 1):
            bm_add_ellipsoid(
                bm_fus,
                (sx * fus_r * 1.02, -L * 0.04, z_belly + fus_r * 0.42),
                (fus_r * 0.36, sp_len * 0.55, fus_r * 0.44),
                mat_idx=3,
            )

    # Vertical tailfin + horizontal stabilizer
    fin_base_z = z_fus + fus_r * (0.86 if is_high else 0.70)
    fin_h = max(3.2, H - fin_base_z)
    v_st = [
        (fin_base_z, L * 0.20, -L * 0.29, 0.0, 0.095, 0.0),
        (fin_base_z + fin_h, L * 0.075, -L * 0.45, 0.0, 0.075, 0.0),
    ]
    build_airfoil_wing(bm_fus, v_st, side=1, vertical=True, mat_idx=1)

    is_ttail = spec["tail_type"] == "t_tail"
    h_span = half_s * (0.36 if is_high else 0.34)
    h_z = (fin_base_z + fin_h * 0.93) if is_ttail else (z_fus + fus_r * 0.45)
    h_le = -L * (0.43 if is_ttail else 0.36)
    for sx in (-1, 1):
        ht_st = [
            (0.10 if is_ttail else fus_r * 0.38, L * 0.12, h_le, h_z, 0.08, 0.0),
            (h_span, L * 0.050, h_le - h_span * 0.36, h_z + (0.0 if is_ttail else h_span * 0.08), 0.065, 0.0),
        ]
        build_airfoil_wing(bm_fus, ht_st, side=sx, naca_camber=0.0, mat_idx=1)

    # Trijet #2 tail-mounted straight-through nacelle (MD-11F / DC-10-30F)
    eng_idx = 1
    if "trijet_tail" in feats:
        nac_r_t = fus_r * 0.52
        nac_len_t = nac_r_t * 3.45
        tz = fin_base_z + nac_r_t * 1.15
        ty_front = -L * 0.29 + nac_len_t * 0.35
        cy_fan = build_turbofan_nacelle(
            bm_fus,
            cx=0.0,
            cy_front=ty_front,
            cz=tz,
            radius=nac_r_t,
            length=nac_len_t,
            chevron=False,
            mat_cowl=1,
            mat_lip=6,
            mat_dark=5,
            mat_hot=7,
        )
        create_fan_blades_object(eng_idx, 0.0, cy_fan, tz, nac_r_t, mats, blade_count=20)
        eng_idx += 1

    finalize_mesh_object(
        "Fuselage",
        bm_fus,
        [mats.primary, mats.secondary, mats.accent, mats.belly, mats.radome, mats.dark_intake, mats.chrome, mats.titanium],
        smooth=True,
    )

    # --- 2. COCKPIT WINDSHIELD (`Windshield_Glass`) ---
    bm_win = bmesh.new()
    win_y = L * (0.37 if is_hump_short else 0.43)
    win_z = z_fus + (fus_r * 1.04 if is_hump_short else fus_r * (0.52 if is_high else 0.26))
    bm_add_ellipsoid(bm_win, (0.0, win_y, win_z), (fus_r * 0.58, L * 0.032, fus_r * 0.24), u_segs=18, v_rings=8, mat_idx=0)
    finalize_mesh_object("Windshield_Glass", bm_win, [mats.glass], smooth=True)

    # --- 3. WINGS + WING ENGINES (`Wings` + `Fan_Blades_i` / `Propeller_Hub_i`) ---
    bm_wing = bmesh.new()
    wing_z = (z_fus + fus_r * 0.92) if is_high else (z_belly + fus_r * 0.48)
    if "anhedral_high" in feats:
        dihedral = -half_s * 0.075  # Iconic An-124 drooping anhedral high wing
    elif is_high:
        dihedral = -half_s * (0.045 if not is_prop else 0.015)
    else:
        dihedral = half_s * 0.090

    sweep_tan = 0.05 if ac_id == "c130j" else (0.28 if ac_id == "a400m" else 0.52)
    root_c = L * (0.16 if is_prop else 0.20)
    mid_c = root_c * (0.80 if is_prop else 0.58)
    tip_c = root_c * (0.48 if is_prop else 0.24)
    le_root = L * 0.14

    for sx in (-1, 1):
        w_st = [
            (fus_r * 0.72, root_c, le_root, wing_z, 0.14, 1.5),
            (half_s * 0.42, mid_c, le_root - (half_s * 0.42) * sweep_tan, wing_z + dihedral * 0.42, 0.115, 0.5),
            (half_s * 0.95, tip_c, le_root - (half_s * 0.95) * sweep_tan, wing_z + dihedral, 0.09, -1.0),
        ]
        build_airfoil_wing(bm_wing, w_st, side=sx, naca_camber=0.022, mat_idx=0)
        add_wingtip_device(bm_wing, w_st[-1], sx, feats, span, mat_idx=1)
        tip_s, tip_c_end, tip_le_end, tip_z_end, _, _ = w_st[-1]
        add_nav_light(bm_wing, (sx * (tip_s + 0.05), tip_le_end - tip_c_end * 0.20, tip_z_end), max(0.08, fus_r * 0.045), 7 if sx < 0 else 8)

    # Wing-mounted engines (2 or 4 jets, or 4 turboprops on C-130J / A400M)
    wing_eng_count = engines - (1 if "trijet_tail" in feats else 0)
    eng_fracs = (0.32, 0.60) if wing_eng_count == 4 else (0.35,)
    if is_prop:
        nac_r = fus_r * 0.26
        nac_len = L * 0.15
        prop_r = span * (0.054 if ac_id == "c130j" else 0.064)
        for frac in eng_fracs:
            for sx in (-1, 1):
                ex = sx * half_s * frac
                w_le_here = le_root - (half_s * frac) * sweep_tan
                w_z_here = wing_z + dihedral * frac
                bm_add_ellipsoid(bm_wing, (ex, w_le_here - nac_len * 0.10, w_z_here - nac_r * 0.45), (nac_r, nac_len * 0.65, nac_r * 1.05), mat_idx=0)
                create_propeller_hub_object(
                    eng_idx, ex, w_le_here + nac_len * 0.52, w_z_here - nac_r * 0.35,
                    prop_r, spec["prop_blades"], mats, scimitar=(ac_id == "a400m"),
                )
                eng_idx += 1
    else:
        nac_r = max(0.80, fus_r * (0.42 if wing_eng_count == 4 else 0.54))
        nac_len = nac_r * 3.15
        for frac in eng_fracs:
            for sx in (-1, 1):
                ex = sx * half_s * frac
                w_le_here = le_root - (half_s * frac) * sweep_tan
                w_z_here = wing_z + dihedral * frac
                ez = max(nac_r * 1.18, w_z_here - nac_r * 1.15)
                ey_front = w_le_here + nac_len * 0.42
                cy_fan = build_turbofan_nacelle(
                    bm_wing,
                    cx=ex,
                    cy_front=ey_front,
                    cz=ez,
                    radius=nac_r,
                    length=nac_len,
                    chevron=("chevron" in feats),
                    pylon_top=(ex, w_le_here - root_c * 0.16, w_z_here),
                    mat_cowl=0,
                    mat_lip=4,
                    mat_dark=5,
                    mat_hot=6,
                    mat_pylon=1,
                )
                create_fan_blades_object(eng_idx, ex, cy_fan, ez, nac_r, mats, blade_count=20)
                eng_idx += 1

    finalize_mesh_object(
        "Wings",
        bm_wing,
        [mats.primary, mats.secondary, mats.accent, mats.belly, mats.chrome, mats.dark_intake, mats.titanium, mats.nav_red, mats.nav_green],
        smooth=True,
    )

    # --- 4. LANDING GEAR ---
    build_landing_gear_system(
        spec,
        z_belly=z_belly,
        fus_r=fus_r,
        mats=mats,
        nose_y=L * 0.37,
        main_y=-L * 0.04,
        main_track=min(half_s * 0.32, fus_r * 1.90),
    )


# =============================================================================
# 9. CLASS 4 BUILDER — REGIONAL TURBOPROPS & BUSINESS JETS (15 AIRCRAFT)
# =============================================================================

def build_regional_bizjet(spec: Dict[str, Any], mats: MaterialLibrary) -> None:
    ac_id = spec["id"]
    L = spec["length"]
    span = spec["span"]
    H = spec["height"]
    half_s = span * 0.5
    feats = spec["features"]
    engines = spec["engines"]
    is_prop = spec["propulsion"] == "turboprop"
    is_high = spec["wing_pos"] == "high"
    is_otwem = "otwem" in feats

    fus_r = spec["fuselage_radius"] or (L * 0.054)
    z_belly = max(0.75, fus_r * (0.95 if not is_prop else 0.78))
    z_fus = z_belly + fus_r

    # --- 1. FUSELAGE ---
    bm_fus = bmesh.new()
    shape = "superellipse" if ac_id in ("twotter", "dornier228", "c208") else "ellipse"
    fus_stations = [
        (L * 0.50, 0.08, 0.08, 0.08, z_fus - fus_r * 0.22, "ellipse", 4),
        (L * 0.43, fus_r * 0.56, fus_r * 0.58, fus_r * 0.52, z_fus - fus_r * 0.10, "ellipse", 4),
        (L * 0.34, fus_r * 0.94, fus_r * 1.00, fus_r * 0.92, z_fus, shape, 0),
        (L * 0.14, fus_r * 1.00, fus_r * 1.04, fus_r * 0.96, z_fus, shape, 0),
        (-L * 0.22, fus_r * 0.98, fus_r * 1.02, fus_r * 0.94, z_fus, shape, 0),
        (-L * 0.38, fus_r * 0.62, fus_r * 0.68, fus_r * 0.52, z_fus + fus_r * 0.24, "ellipse", 0),
        (-L * 0.50, fus_r * 0.14, fus_r * 0.18, fus_r * 0.12, z_fus + fus_r * 0.44, "ellipse", 1),
    ]
    build_lofted_fuselage(bm_fus, fus_stations, n_ring=28)

    # Cessna 208B Grand Caravan ventral belly cargo pod
    if "cargo_pod" in feats:
        bm_add_ellipsoid(bm_fus, (0.0, L * 0.02, z_belly - fus_r * 0.18), (fus_r * 0.68, L * 0.26, fus_r * 0.36), mat_idx=3)

    # Signature large oval Gulfstream cabin windows (G650 / G700) vs standard bizjet window strip
    if "oval_windows" in feats:
        n_win = 8 if ac_id == "g650" else 10
        for sx in (-1, 1):
            for k in range(n_win):
                wy = L * 0.24 - k * (L * 0.44 / n_win)
                bm_add_ellipsoid(bm_fus, (sx * fus_r * 0.99, wy, z_fus + fus_r * 0.16), (0.04, 0.36, 0.24), u_segs=12, v_rings=6, mat_idx=5)
    else:
        for sx in (-1, 1):
            bm_add_box(bm_fus, (sx * fus_r * 0.985, L * 0.04, z_fus + fus_r * 0.16), (0.04, L * 0.46, max(0.18, fus_r * 0.18)), mat_idx=5)

    # Vertical tail + T-tail / cruciform / conventional horizontal stabilizer
    fin_base_z = z_fus + fus_r * 0.65
    fin_h = max(1.8, H - fin_base_z)
    v_st = [
        (fin_base_z, L * 0.20, -L * 0.28, 0.0, 0.09, 0.0),
        (fin_base_z + fin_h, L * 0.075, -L * 0.44, 0.0, 0.07, 0.0),
    ]
    build_airfoil_wing(bm_fus, v_st, side=1, vertical=True, mat_idx=1)

    t_type = spec["tail_type"]
    h_span = half_s * 0.36
    if t_type == "t_tail":
        h_z = fin_base_z + fin_h * 0.92
        h_le = -L * 0.41
    elif t_type == "cruciform":
        h_z = fin_base_z + fin_h * 0.42
        h_le = -L * 0.36
    else:
        h_z = z_fus + fus_r * 0.32
        h_le = -L * 0.36
    for sx in (-1, 1):
        ht_st = [
            (0.08 if t_type != "conventional" else fus_r * 0.35, L * 0.12, h_le, h_z, 0.075, 0.0),
            (h_span, L * 0.048, h_le - h_span * 0.36, h_z, 0.06, 0.0),
        ]
        build_airfoil_wing(bm_fus, ht_st, side=sx, naca_camber=0.0, mat_idx=1)

    # Learjet 75 ventral delta fins
    if "ventral_fins" in feats:
        for sx in (-1, 1):
            vf_st = [
                (z_fus - fus_r * 0.45, L * 0.12, -L * 0.32, sx * fus_r * 0.42, 0.04, 0.0),
                (z_fus - fus_r * 0.92, L * 0.05, -L * 0.40, sx * fus_r * 0.72, 0.03, 0.0),
            ]
            build_airfoil_wing(bm_fus, vf_st, side=sx, vertical=True, mat_idx=1)

    # Rear-fuselage twin turbofans (all bizjets EXCEPT HondaJet OTWEM) + Falcon 7X/8X #3 S-duct!
    eng_idx = 1
    if not is_prop and not is_otwem:
        nac_r = fus_r * 0.44
        nac_len = nac_r * 3.35
        ey_front = -L * 0.16
        ez = z_fus + fus_r * 0.24
        ex_off = fus_r + nac_r * 1.18
        for sx in (-1, 1):
            cy_fan = build_turbofan_nacelle(
                bm_fus,
                cx=sx * ex_off,
                cy_front=ey_front,
                cz=ez,
                radius=nac_r,
                length=nac_len,
                pylon_side=(sx * fus_r * 0.86, ey_front - nac_len * 0.42, ez),
                mat_cowl=0,
                mat_lip=6,
                mat_dark=5,
                mat_hot=7,
                mat_pylon=1,
            )
            create_fan_blades_object(eng_idx, sx * ex_off, cy_fan, ez, nac_r, mats, blade_count=18)
            eng_idx += 1

        if "trijet_sduct" in feats:
            # Dassault Falcon 7X / 8X iconic #3 S-duct intake dorsal scoop & tailcone exhaust
            s_r = nac_r * 0.92
            s_z = fin_base_z + s_r * 0.85
            s_y_front = -L * 0.24
            cy_fan = build_turbofan_nacelle(
                bm_fus,
                cx=0.0,
                cy_front=s_y_front,
                cz=s_z,
                radius=s_r,
                length=nac_len * 0.95,
                mat_cowl=1,
                mat_lip=6,
                mat_dark=5,
                mat_hot=7,
            )
            create_fan_blades_object(eng_idx, 0.0, cy_fan, s_z, s_r, mats, blade_count=18)
            eng_idx += 1

    # Single nose turboprop for Cessna 208B Grand Caravan
    if is_prop and engines == 1:
        prop_r = min(1.38, span * 0.088)
        create_propeller_hub_object(eng_idx, 0.0, L * 0.505, z_fus - fus_r * 0.22, prop_r, spec["prop_blades"], mats)
        eng_idx += 1

    finalize_mesh_object(
        "Fuselage",
        bm_fus,
        [mats.primary, mats.secondary, mats.accent, mats.belly, mats.radome, mats.dark_intake, mats.chrome, mats.titanium],
        smooth=True,
    )

    # --- 2. WINDSHIELD (`Windshield_Glass`) ---
    bm_win = bmesh.new()
    bm_add_ellipsoid(bm_win, (0.0, L * 0.39, z_fus + fus_r * 0.30), (fus_r * 0.68, L * 0.048, fus_r * 0.28), u_segs=18, v_rings=8, mat_idx=0)
    finalize_mesh_object("Windshield_Glass", bm_win, [mats.glass], smooth=True)

    # --- 3. WINGS + OTWEM / WING TURBOPROPS (`Wings`) ---
    bm_wing = bmesh.new()
    wing_z = (z_fus + fus_r * 0.88) if is_high else (z_belly + fus_r * 0.42)
    dihedral = 0.0 if is_high else (half_s * 0.075)
    sweep_tan = 0.04 if is_prop else 0.44
    root_c = L * (0.14 if is_prop else 0.19)
    tip_c = root_c * (0.62 if is_prop else 0.28)
    le_root = L * 0.11

    for sx in (-1, 1):
        w_st = [
            (fus_r * 0.68, root_c, le_root, wing_z, 0.13, 1.5),
            (half_s * 0.48, root_c * 0.72, le_root - (half_s * 0.48) * sweep_tan, wing_z + dihedral * 0.48, 0.11, 0.5),
            (half_s * 0.96, tip_c, le_root - (half_s * 0.96) * sweep_tan, wing_z + dihedral, 0.09, -1.0),
        ]
        build_airfoil_wing(bm_wing, w_st, side=sx, naca_camber=0.022, mat_idx=0)
        add_wingtip_device(bm_wing, w_st[-1], sx, feats, span, mat_idx=1)

        # High-wing lift struts (Twin Otter, Cessna 208B)
        if "strut_braced" in feats:
            bm_add_cylinder(
                bm_wing,
                (sx * fus_r * 0.85, le_root - root_c * 0.42, z_belly + fus_r * 0.25),
                (sx * half_s * 0.46, le_root - root_c * 0.35, wing_z - 0.06),
                0.045, 0.042, segments=8, mat_idx=1,
            )

        tip_s, tip_c_end, tip_le_end, tip_z_end, _, _ = w_st[-1]
        add_nav_light(bm_wing, (sx * (tip_s + 0.04), tip_le_end - tip_c_end * 0.20, tip_z_end), 0.06, 7 if sx < 0 else 8)

    # HondaJet iconic Over-The-Wing Engine Mount (OTWEM) pylons + nacelles!
    if is_otwem:
        nac_r = fus_r * 0.44
        nac_len = nac_r * 3.15
        for sx in (-1, 1):
            ex = sx * (fus_r + nac_r * 1.48)
            w_le_here = le_root - abs(ex) * sweep_tan
            w_z_here = wing_z + dihedral * (abs(ex) / half_s)
            ez = w_z_here + nac_r * 1.65
            ey_front = w_le_here - root_c * 0.12
            # Vertical OTWEM pylon rising from UPPER wing surface into nacelle underside!
            bm_add_box(bm_wing, (ex, ey_front - nac_len * 0.42, (w_z_here + ez - nac_r * 0.72) * 0.5), (nac_r * 0.26, nac_len * 0.76, ez - nac_r * 0.68 - w_z_here), mat_idx=1)
            cy_fan = build_turbofan_nacelle(
                bm_wing,
                cx=ex,
                cy_front=ey_front,
                cz=ez,
                radius=nac_r,
                length=nac_len,
                mat_cowl=0,
                mat_lip=4,
                mat_dark=5,
                mat_hot=6,
            )
            create_fan_blades_object(eng_idx, ex, cy_fan, ez, nac_r, mats, blade_count=18)
            eng_idx += 1

    # Twin wing-mounted regional turboprops (Q400, Twin Otter, Dornier 228, Saab 340)
    if is_prop and engines == 2:
        nac_x = half_s * 0.29
        nac_r = fus_r * 0.34
        nac_len = L * 0.19
        prop_r = min(2.05, span * 0.078)
        for sx in (-1, 1):
            nz = wing_z - nac_r * (0.45 if is_high else -0.15)
            bm_add_ellipsoid(bm_wing, (sx * nac_x, le_root - nac_len * 0.16, nz), (nac_r, nac_len * 0.62, nac_r * 1.05), mat_idx=0)
            create_propeller_hub_object(eng_idx, sx * nac_x, le_root + nac_len * 0.46, nz, prop_r, spec["prop_blades"], mats, scimitar=(ac_id == "q400"))
            eng_idx += 1

    finalize_mesh_object(
        "Wings",
        bm_wing,
        [mats.primary, mats.secondary, mats.accent, mats.belly, mats.chrome, mats.dark_intake, mats.titanium, mats.nav_red, mats.nav_green],
        smooth=True,
    )

    # --- 4. LANDING GEAR ---
    build_landing_gear_system(
        spec,
        z_belly=z_belly,
        fus_r=fus_r,
        mats=mats,
        nose_y=L * 0.36,
        main_y=-L * 0.04,
        main_track=min(half_s * 0.28, max(1.35, fus_r * 1.85)),
    )


# =============================================================================
# 10. CLASS 5 BUILDER — GENERAL AVIATION & TURBOPROP TRAINERS (17 AIRCRAFT)
# =============================================================================

def build_ga_trainer(spec: Dict[str, Any], mats: MaterialLibrary) -> None:
    ac_id = spec["id"]
    L = spec["length"]
    span = spec["span"]
    H = spec["height"]
    half_s = span * 0.5
    feats = spec["features"]
    engines = spec["engines"]
    is_high = spec["wing_pos"] == "high"
    is_mid = spec["wing_pos"] == "mid"
    is_tprop = spec["propulsion"] == "turboprop"

    fus_r = spec["fuselage_radius"] or (L * 0.068)
    z_belly = max(0.55, fus_r * (1.05 if not is_tprop else 1.15))
    z_fus = z_belly + fus_r

    # --- 1. FUSELAGE ---
    bm_fus = bmesh.new()
    shape = "superellipse" if ac_id in ("c172s", "c152", "c182", "c206", "p2006t") else "ellipse"
    fus_stations = [
        (L * 0.49, fus_r * 0.24, fus_r * 0.24, fus_r * 0.22, z_fus - fus_r * 0.08, "ellipse", 4),
        (L * 0.38, fus_r * 0.72, fus_r * 0.68, fus_r * 0.68, z_fus - fus_r * 0.04, shape, 0),
        (L * 0.20, fus_r * 1.00, fus_r * 1.08, fus_r * 0.94, z_fus, shape, 0),
        (L * 0.00, fus_r * 0.96, fus_r * 1.04, fus_r * 0.90, z_fus, shape, 0),
        (-L * 0.20, fus_r * 0.62, fus_r * 0.66, fus_r * 0.54, z_fus + fus_r * 0.14, "ellipse", 0),
        (-L * 0.44, fus_r * 0.22, fus_r * 0.28, fus_r * 0.20, z_fus + fus_r * 0.26, "ellipse", 1),
        (-L * 0.50, fus_r * 0.08, fus_r * 0.12, fus_r * 0.08, z_fus + fus_r * 0.30, "ellipse", 1),
    ]
    build_lofted_fuselage(bm_fus, fus_stations, n_ring=24)

    # Vertical tail + conventional or T-tail horizontal stabilizer
    fin_base_z = z_fus + fus_r * 0.32
    fin_h = max(0.95, H - fin_base_z)
    v_st = [
        (fin_base_z, L * 0.18, -L * 0.30, 0.0, 0.085, 0.0),
        (fin_base_z + fin_h, L * 0.075, -L * 0.44, 0.0, 0.065, 0.0),
    ]
    build_airfoil_wing(bm_fus, v_st, side=1, vertical=True, mat_idx=1)

    is_ttail = spec["tail_type"] == "t_tail"
    h_span = half_s * 0.32
    h_z = (fin_base_z + fin_h * 0.92) if is_ttail else (z_fus + fus_r * 0.26)
    h_le = -L * (0.41 if is_ttail else 0.37)
    for sx in (-1, 1):
        ht_st = [
            (0.05 if is_ttail else fus_r * 0.20, L * 0.11, h_le, h_z, 0.075, 0.0),
            (h_span, L * 0.055, h_le - h_span * 0.16, h_z, 0.06, 0.0),
        ]
        build_airfoil_wing(bm_fus, ht_st, side=sx, naca_camber=0.0, mat_idx=1)

    # Ventral strakes (PC-21, PC-12)
    if "ventral_fins" in feats:
        vf_st = [
            (z_fus - fus_r * 0.20, L * 0.14, -L * 0.30, 0.0, 0.04, 0.0),
            (z_fus - fus_r * 0.62, L * 0.06, -L * 0.38, 0.0, 0.03, 0.0),
        ]
        build_airfoil_wing(bm_fus, vf_st, side=1, vertical=True, mat_idx=1)

    # Cabin side windows for non-bubble GA aircraft
    if "bubble_canopy" not in feats and "tandem_canopy" not in feats:
        for sx in (-1, 1):
            bm_add_box(bm_fus, (sx * fus_r * 0.96, L * 0.09, z_fus + fus_r * 0.36), (0.04, L * 0.26, fus_r * 0.42), mat_idx=5)

    finalize_mesh_object(
        "Fuselage",
        bm_fus,
        [mats.primary, mats.secondary, mats.accent, mats.belly, mats.radome, mats.dark_intake, mats.chrome],
        smooth=True,
    )

    # --- 2. CANOPY OR WINDSHIELD (`Canopy_Glass` or `Windshield_Glass`) ---
    bm_gl = bmesh.new()
    if "bubble_canopy" in feats or "tandem_canopy" in feats:
        c_len = L * (0.30 if "tandem_canopy" in feats else 0.24)
        bm_add_ellipsoid(bm_gl, (0.0, L * 0.12, z_fus + fus_r * 0.72), (fus_r * 0.74, c_len * 0.55, fus_r * 0.68), u_segs=18, v_rings=10, mat_idx=0)
        finalize_mesh_object("Canopy_Glass", bm_gl, [mats.glass], smooth=True)
    else:
        bm_add_ellipsoid(bm_gl, (0.0, L * 0.25, z_fus + fus_r * 0.56), (fus_r * 0.84, L * 0.085, fus_r * 0.46), u_segs=18, v_rings=8, mat_idx=0)
        finalize_mesh_object("Windshield_Glass", bm_gl, [mats.glass], smooth=True)

    # --- 3. WINGS + PROPELLER HUBS (`Wings` + `Propeller_Hub_1..N`) ---
    bm_wing = bmesh.new()
    wing_z = (z_fus + fus_r * 0.92) if is_high else (z_fus if is_mid else (z_belly + fus_r * 0.32))
    dihedral = (half_s * 0.025) if is_high else (0.0 if is_mid else (half_s * 0.075))
    sweep_tan = 0.24 if ac_id == "pc21" else (0.12 if is_tprop else 0.04)
    root_c = L * (0.19 if ac_id == "extra330" else 0.16)
    tip_c = root_c * (0.48 if ac_id in ("pc21", "extra330", "tbm930", "pc12") else 0.74)
    le_root = L * 0.14

    for sx in (-1, 1):
        w_st = [
            (fus_r * 0.68, root_c, le_root, wing_z, 0.125, 1.0),
            (half_s * 0.50, (root_c + tip_c) * 0.52, le_root - (half_s * 0.50) * sweep_tan, wing_z + dihedral * 0.50, 0.115, 0.0),
            (half_s * 0.98, tip_c, le_root - (half_s * 0.98) * sweep_tan, wing_z + dihedral, 0.10, -1.0),
        ]
        build_airfoil_wing(bm_wing, w_st, side=sx, naca_camber=(0.0 if ac_id == "extra330" else 0.024), mat_idx=0)
        add_wingtip_device(bm_wing, w_st[-1], sx, feats, span, mat_idx=1)

        # Classic Cessna strut-braced high wing lift struts
        if "strut_braced" in feats:
            bm_add_cylinder(
                bm_wing,
                (sx * fus_r * 0.82, le_root - root_c * 0.42, z_belly + fus_r * 0.22),
                (sx * half_s * 0.48, le_root - root_c * 0.38, wing_z - 0.05),
                0.032, 0.030, segments=8, mat_idx=1,
            )

        tip_s, tip_c_end, tip_le_end, tip_z_end, _, _ = w_st[-1]
        add_nav_light(bm_wing, (sx * (tip_s + 0.03), tip_le_end - tip_c_end * 0.20, tip_z_end), 0.045, 3 if sx < 0 else 4)

    # Engine nacelles + Propeller_Hub_1..N
    eng_idx = 1
    if engines == 1:
        prop_r = min(1.32, max(0.84, span * 0.095))
        create_propeller_hub_object(
            eng_idx, 0.0, L * 0.50, z_fus - fus_r * 0.08, prop_r, spec["prop_blades"], mats, scimitar=is_tprop
        )
    else:
        nac_x = half_s * 0.28
        nac_r = fus_r * 0.42
        nac_len = L * 0.24
        prop_r = min(1.35, span * 0.085)
        for sx in (-1, 1):
            nz = wing_z - (nac_r * 0.28 if is_high else 0.0)
            bm_add_ellipsoid(bm_wing, (sx * nac_x, le_root - nac_len * 0.10, nz), (nac_r, nac_len * 0.62, nac_r * 0.92), mat_idx=0)
            create_propeller_hub_object(
                eng_idx, sx * nac_x, le_root + nac_len * 0.48, nz, prop_r, spec["prop_blades"], mats, scimitar=is_tprop
            )
            eng_idx += 1

    finalize_mesh_object("Wings", bm_wing, [mats.primary, mats.secondary, mats.accent, mats.nav_red, mats.nav_green], smooth=True)

    # --- 4. LANDING GEAR ---
    build_landing_gear_system(
        spec,
        z_belly=z_belly,
        fus_r=fus_r,
        mats=mats,
        nose_y=L * 0.36,
        main_y=-L * 0.02,
        main_track=min(half_s * 0.26, max(1.10, fus_r * 2.15)),
    )


# =============================================================================
# 11. CLASS 6 BUILDER — HELICOPTERS (8 ROTORCRAFT)
# =============================================================================

def build_helicopter(spec: Dict[str, Any], mats: MaterialLibrary) -> None:
    ac_id = spec["id"]
    L = spec["length"]
    rotor_d = spec["span"]
    H = spec["height"]
    rotor_r = rotor_d * 0.5
    feats = spec["features"]
    engines = spec["engines"]

    fus_r = spec["fuselage_radius"] or (L * 0.068)
    z_belly = max(0.55, fus_r * (0.72 if spec["gear_type"] == "skids" else 0.64))
    z_fus = z_belly + fus_r * 0.92

    # --- 1. FUSELAGE + TAIL BOOM + ENGINE COWLINGS ---
    bm_fus = bmesh.new()
    is_apache = (ac_id == "ah64")
    shape = "apache_armor" if is_apache else "teardrop_helo"

    # Forward fuselage + tapering tail boom (Y = +0.42L nose -> -0.49L tail fin)
    fus_stations = [
        (L * 0.40, fus_r * 0.22, fus_r * 0.22, fus_r * 0.20, z_fus - fus_r * 0.22, "ellipse", 4),
        (L * 0.32, fus_r * 0.72, fus_r * 0.74, fus_r * 0.66, z_fus - fus_r * 0.08, shape, 0),
        (L * 0.18, fus_r * 1.00, fus_r * 1.08, fus_r * 0.92, z_fus, shape, 0),
        (L * 0.00, fus_r * 0.98, fus_r * 1.12, fus_r * 0.90, z_fus + fus_r * 0.05, shape, 0),
        (-L * 0.11, fus_r * 0.62, fus_r * 0.76, fus_r * 0.44, z_fus + fus_r * 0.26, "ellipse", 0),
        (-L * 0.22, fus_r * 0.30, fus_r * 0.36, fus_r * 0.28, z_fus + fus_r * 0.46, "ellipse", 1),
        (-L * 0.44, fus_r * 0.18, fus_r * 0.22, fus_r * 0.18, z_fus + fus_r * 0.56, "ellipse", 1),
        (-L * 0.49, fus_r * 0.10, fus_r * 0.14, fus_r * 0.10, z_fus + fus_r * 0.58, "ellipse", 1),
    ]
    build_lofted_fuselage(bm_fus, fus_stations, n_ring=24)

    # Dorsal transmission & turbine engine housing (1, 2, or 3 engines for AW101 Merlin!)
    dog_z = z_fus + fus_r * 1.24
    bm_add_ellipsoid(bm_fus, (0.0, L * 0.04, dog_z), (fus_r * 0.64, L * 0.16, fus_r * 0.44), mat_idx=1)
    if engines == 3:
        # AW101 Merlin 3-engine dorsal intake scoops & triple exhaust nozzles
        for ex in (-fus_r * 0.56, 0.0, fus_r * 0.56):
            bm_add_cylinder(bm_fus, (ex, -L * 0.06, dog_z + 0.10), (ex, -L * 0.13, dog_z + 0.14), 0.18, 0.15, segments=12, mat_idx=7)
            bm_add_box(bm_fus, (ex, L * 0.14, dog_z + 0.16), (0.28, 0.42, 0.24), mat_idx=5)
    elif engines == 2:
        # Twin outboard turbine nacelles (UH-60, AH-64, S-92, H145)
        for sx in (-1, 1):
            nx = sx * fus_r * (1.02 if is_apache else 0.72)
            bm_add_ellipsoid(bm_fus, (nx, L * 0.01, dog_z - 0.06), (fus_r * 0.36, L * 0.14, fus_r * 0.34), mat_idx=1)
            bm_add_cylinder(bm_fus, (nx, -L * 0.09, dog_z - 0.06), (nx, -L * 0.15, dog_z - 0.04), fus_r * 0.22, fus_r * 0.18, segments=12, mat_idx=7)

    # Wheeled helicopter gear sponsons (S-92, AW101)
    if spec["gear_type"] == "helo_tricycle":
        for sx in (-1, 1):
            bm_add_ellipsoid(bm_fus, (sx * fus_r * 1.08, -L * 0.02, z_belly + fus_r * 0.36), (fus_r * 0.38, L * 0.14, fus_r * 0.34), mat_idx=3)

    # AH-64E Apache nose TADS/PNVS sensor turret + chin 30mm M230 chain gun + avionics cheek bays
    if "chin_gun" in feats:
        # Forward TADS/PNVS optical barrel turret on nose
        bm_add_ellipsoid(bm_fus, (0.0, L * 0.425, z_fus - fus_r * 0.14), (0.32, 0.38, 0.30), mat_idx=5)
        bm_add_cylinder(bm_fus, (-0.12, L * 0.43, z_fus - fus_r * 0.14), (-0.12, L * 0.46, z_fus - fus_r * 0.14), 0.11, 0.11, segments=12, mat_idx=6)
        bm_add_cylinder(bm_fus, (0.12, L * 0.43, z_fus - fus_r * 0.14), (0.12, L * 0.46, z_fus - fus_r * 0.14), 0.09, 0.09, segments=12, mat_idx=6)
        # Chin-mounted 30mm M230 Chain Gun turret + barrel
        bm_add_box(bm_fus, (0.0, L * 0.24, z_belly - 0.12), (0.34, 0.52, 0.28), mat_idx=5)
        bm_add_cylinder(bm_fus, (0.0, L * 0.27, z_belly - 0.14), (0.0, L * 0.40, z_belly - 0.16), 0.045, 0.036, segments=10, mat_idx=7)
        # Side FAB avionics cheek fairings
        for sx in (-1, 1):
            bm_add_box(bm_fus, (sx * fus_r * 1.04, L * 0.14, z_fus - fus_r * 0.24), (0.34, L * 0.24, 0.42), mat_idx=1)

    # Tail pylon / Fenestron duct + horizontal stabilizer
    tb_z = z_fus + fus_r * 0.56
    fin_h = max(1.05, H - tb_z - 0.35)
    tr_y = -L * 0.46
    tr_z = tb_z + fin_h * 0.55

    if "fenestron" in feats:
        # Airbus H145 Fenestron shrouded tail duct + twin horizontal endplate fins
        shroud_r = rotor_r * 0.135
        bm_add_cylinder(bm_fus, (-0.16, tr_y, tr_z), (0.16, tr_y, tr_z), shroud_r * 1.28, shroud_r * 1.28, segments=20, cap_ends=False, mat_idx=1)
        bm_add_box(bm_fus, (0.0, tr_y - shroud_r * 0.25, tr_z + shroud_r * 1.25), (0.14, shroud_r * 1.4, shroud_r * 0.9), mat_idx=1)
        # Horizontal stabilizer with twin endplates
        for sx in (-1, 1):
            ht_st = [
                (0.10, 0.55, -L * 0.35, tb_z + 0.05, 0.09, 0.0),
                (1.18, 0.42, -L * 0.36, tb_z + 0.05, 0.08, 0.0),
            ]
            build_airfoil_wing(bm_fus, ht_st, side=sx, naca_camber=0.0, mat_idx=1)
            bm_add_box(bm_fus, (sx * 1.20, -L * 0.37, tb_z + 0.08), (0.06, 0.48, 0.54), mat_idx=2)
    else:
        # Swept vertical tail pylon + horizontal stabilator
        v_st = [
            (tb_z - 0.12, L * 0.095, -L * 0.41, 0.0, 0.10, 0.0),
            (tb_z + fin_h, L * 0.052, -L * 0.48, 0.0, 0.08, 0.0),
        ]
        build_airfoil_wing(bm_fus, v_st, side=1, vertical=True, mat_idx=1)
        # UH-60 low large stabilator vs AH-64 high T-stabilator vs mid-boom stabilizer
        st_z = (tb_z + fin_h * 0.86) if is_apache else (tb_z - 0.08 if ac_id == "uh60" else tb_z + 0.02)
        st_y = -L * (0.46 if is_apache else (0.44 if ac_id == "uh60" else 0.34))
        st_half = L * (0.12 if ac_id in ("uh60", "ah64", "aw101", "s92") else 0.09)
        for sx in (-1, 1):
            ht_st = [
                (0.08, L * 0.065, st_y, st_z, 0.09, 0.0),
                (st_half, L * 0.048, st_y - 0.08, st_z, 0.075, 0.0),
            ]
            build_airfoil_wing(bm_fus, ht_st, side=sx, naca_camber=0.0, mat_idx=1)

    finalize_mesh_object(
        "Fuselage",
        bm_fus,
        [mats.primary, mats.secondary, mats.accent, mats.belly, mats.radome, mats.dark_intake, mats.chrome, mats.titanium],
        smooth=True,
    )

    # --- 2. CANOPY GLASS (`Canopy_Glass`) ---
    bm_can = bmesh.new()
    if is_apache:
        # Stepped armored flat-pane tandem Apache canopy
        bm_add_box(bm_can, (0.0, L * 0.25, z_fus + fus_r * 0.56), (fus_r * 0.94, L * 0.14, fus_r * 0.72), rot_deg=(18.0, 0.0, 0.0), mat_idx=0)
        bm_add_box(bm_can, (0.0, L * 0.12, z_fus + fus_r * 0.88), (fus_r * 0.90, L * 0.13, fus_r * 0.68), rot_deg=(8.0, 0.0, 0.0), mat_idx=0)
    else:
        bm_add_ellipsoid(bm_can, (0.0, L * 0.24, z_fus + fus_r * 0.34), (fus_r * 0.88, L * 0.125, fus_r * 0.66), u_segs=20, v_rings=10, mat_idx=0)
    finalize_mesh_object("Canopy_Glass", bm_can, [mats.glass], smooth=True)

    # --- 3. AH-64E STUB WINGS + 4 PYLONS + HELLFIRE/ROCKET PODS (`Wings`) ---
    if "apache_weapons" in feats:
        bm_w = bmesh.new()
        sw_half = L * 0.165
        sw_z = z_fus + fus_r * 0.12
        for sx in (-1, 1):
            st = [
                (fus_r * 0.78, 1.35, L * 0.08, sw_z, 0.14, 0.0),
                (sw_half, 0.82, L * 0.05, sw_z - 0.12, 0.11, 0.0),
            ]
            build_airfoil_wing(bm_w, st, side=sx, naca_camber=0.015, mat_idx=0)
            # Two weapon pylons per wing (4 total): inboard Hellfire quad rack + outboard 70mm rocket pod
            for p_idx, frac in enumerate((0.55, 0.86)):
                px = sx * sw_half * frac
                pz = sw_z - 0.06 * frac
                bm_add_box(bm_w, (px, L * 0.03, pz - 0.24), (0.10, 0.85, 0.36), mat_idx=1)
                if p_idx == 0:
                    # Quad AGM-114 Hellfire missile rack
                    for mx in (-0.13, 0.13):
                        for mz in (-0.42, -0.60):
                            bm_add_cylinder(bm_w, (px + mx, L * 0.03 - 0.80, pz + mz), (px + mx, L * 0.03 + 0.82, pz + mz), 0.065, 0.055, segments=10, mat_idx=2)
                else:
                    # M261 19-tube 70mm Hydra rocket pod
                    bm_add_cylinder(bm_w, (px, L * 0.03 - 0.72, pz - 0.48), (px, L * 0.03 + 0.72, pz - 0.48), 0.19, 0.19, segments=14, mat_idx=2)
            # Wingtip Stinger pod & nav light
            add_nav_light(bm_w, (sx * (sw_half + 0.05), L * 0.03, sw_z - 0.12), 0.05, 3 if sx < 0 else 4)
        finalize_mesh_object("Wings", bm_w, [mats.primary, mats.secondary, mats.weapon, mats.nav_red, mats.nav_green], smooth=True)

    # --- 4. MAIN ROTOR HUB (`Main_Rotor_Hub`, pivoted at mast top center!) ---
    mast_y = L * 0.04
    mast_z = max(dog_z + fus_r * 0.82, H - (0.72 if "longbow_radar" in feats else 0.24))
    bm_mr = bmesh.new()

    # Rotor mast shaft + swashplate + rotor head hub (local coords around 0,0,0)
    bm_add_cylinder(bm_mr, (0.0, 0.0, -fus_r * 0.68), (0.0, 0.0, 0.12), max(0.08, fus_r * 0.12), max(0.08, fus_r * 0.12), segments=14, mat_idx=0)
    bm_add_cylinder(bm_mr, (0.0, 0.0, -0.06), (0.0, 0.0, 0.14), max(0.24, fus_r * 0.34), max(0.20, fus_r * 0.30), segments=16, mat_idx=1)

    n_blades = spec["rotor_blades"]
    blade_chord = max(0.24, rotor_r * 0.068)
    blade_thick = blade_chord * 0.12
    for i in range(n_blades):
        ang = 2.0 * math.pi * i / n_blades
        rot_m = Matrix.Rotation(ang, 4, "Z")
        # Blade root grip + airfoil blade extending to rotor_r with slight natural droop
        b_len = rotor_r - 0.25
        mat = (
            rot_m
            @ Matrix.Translation(Vector((0.25 + b_len * 0.5, 0.0, -0.05)))
            @ Matrix.Rotation(math.radians(6.0), 4, "X")
            @ Matrix.Diagonal((b_len, blade_chord, blade_thick, 1.0))
        )
        res = bmesh.ops.create_cube(bm_mr, size=1.0, matrix=mat)
        vset = set(res["verts"])
        for f in bm_mr.faces:
            if all(v in vset for v in f.verts):
                f.material_index = 2
        # High-visibility blade tip band
        mat_tip = (
            rot_m
            @ Matrix.Translation(Vector((rotor_r - 0.22, 0.0, -0.05)))
            @ Matrix.Rotation(math.radians(6.0), 4, "X")
            @ Matrix.Diagonal((0.44, blade_chord * 1.02, blade_thick * 1.06, 1.0))
        )
        res_t = bmesh.ops.create_cube(bm_mr, size=1.0, matrix=mat_tip)
        vset_t = set(res_t["verts"])
        for f in bm_mr.faces:
            if all(v in vset_t for v in f.verts):
                f.material_index = 3

    # AH-64E Longbow AN/APG-78 mast-mounted fire control radar dome atop rotor mast!
    if "longbow_radar" in feats:
        bm_add_cylinder(bm_mr, (0.0, 0.0, 0.12), (0.0, 0.0, 0.44), 0.14, 0.16, segments=12, mat_idx=1)
        bm_add_ellipsoid(bm_mr, (0.0, 0.0, 0.62), (0.64, 0.64, 0.30), u_segs=20, v_rings=10, mat_idx=1)

    finalize_mesh_object(
        "Main_Rotor_Hub",
        bm_mr,
        [mats.chrome, mats.secondary, mats.blade, mats.accent],
        location=(0.0, mast_y, mast_z),
        smooth=True,
    )

    # --- 5. TAIL ROTOR (`Tail_Rotor`, pivoted at tail rotor hub!) ---
    bm_tr = bmesh.new()
    is_fen = "fenestron" in feats
    tr_r = rotor_r * (0.115 if is_fen else 0.19)
    tr_x = 0.0 if is_fen else (0.34 if ac_id in ("uh60", "ah64", "aw101", "s92") else 0.22)
    tr_cant = math.radians(20.0) if "canted_tail_rotor" in feats else 0.0

    # Tail rotor hub
    bm_add_cylinder(bm_tr, (-0.14, 0.0, 0.0), (0.14, 0.0, 0.0), max(0.08, tr_r * 0.14), max(0.08, tr_r * 0.14), segments=12, mat_idx=0)
    if is_fen:
        tr_angles = [2.0 * math.pi * i / 8 for i in range(8)]
    elif spec["tail_type"] == "scissor_helo":
        # AH-64 iconic 60°/120° quiet scissor X-pattern 4-blade tail rotor!
        tr_angles = [math.radians(a) for a in (0.0, 60.0, 180.0, 240.0)]
    elif ac_id in ("uh60", "aw101", "s92"):
        tr_angles = [math.radians(a) for a in (0.0, 90.0, 180.0, 270.0)]
    else:
        tr_angles = [0.0, math.pi]

    tb_c = max(0.11, tr_r * 0.15)
    for ang in tr_angles:
        mat = (
            Matrix.Rotation(ang, 4, "X")
            @ Matrix.Translation(Vector((0.0, 0.0, tr_r * 0.52)))
            @ Matrix.Diagonal((0.025, tb_c, tr_r * 0.92, 1.0))
        )
        res = bmesh.ops.create_cube(bm_tr, size=1.0, matrix=mat)
        vset = set(res["verts"])
        for f in bm_tr.faces:
            if all(v in vset for v in f.verts):
                f.material_index = 1

    finalize_mesh_object(
        "Tail_Rotor",
        bm_tr,
        [mats.chrome, mats.blade],
        location=(tr_x, tr_y, tr_z),
        rotation_euler=(0.0, tr_cant, 0.0),
        smooth=True,
    )

    # --- 6. LANDING GEAR (`Landing_Gear` & `Tires`) ---
    build_landing_gear_system(
        spec,
        z_belly=z_belly,
        fus_r=fus_r,
        mats=mats,
        nose_y=L * 0.28,
        main_y=-L * 0.02,
        main_track=max(1.15, fus_r * 1.48),
    )


# =============================================================================
# 12. DISPATCHER, GROUND ALIGNMENT & GLB EXPORTER
# =============================================================================

CLASS_BUILDERS = {
    "fighter": build_fighter_trainer,
    "airliner": build_commercial_airliner,
    "cargo": build_cargo_freighter,
    "regional_biz": build_regional_bizjet,
    "ga_trainer": build_ga_trainer,
    "helicopter": build_helicopter,
}


def ground_align_scene() -> Tuple[float, float, float]:
    """
    Shift all scene objects vertically so the lowest vertex across the entire
    aircraft sits cleanly at Blender Z = 0.0 (Three.js Y = 0.0).
    Returns world-space (length_y, span_x, height_z) bounding box dimensions.
    """
    bpy.context.view_layer.update()
    min_x = min_y = min_z = float("inf")
    max_x = max_y = max_z = float("-inf")

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        mw = obj.matrix_world
        for corner in obj.bound_box:
            wc = mw @ Vector(corner)
            min_x = min(min_x, wc.x)
            max_x = max(max_x, wc.x)
            min_y = min(min_y, wc.y)
            max_y = max(max_y, wc.y)
            min_z = min(min_z, wc.z)
            max_z = max(max_z, wc.z)

    if math.isfinite(min_z) and abs(min_z) > 1e-4:
        for obj in bpy.context.scene.objects:
            obj.location.z -= min_z
        max_z -= min_z
        min_z = 0.0

    return (max_y - min_y, max_x - min_x, max_z - min_z)


def build_and_export_aircraft(spec: Dict[str, Any], out_dir: Path) -> Path:
    """Build one complete aircraft scene and export it as a binary GLB file."""
    clear_scene()
    mats = MaterialLibrary(spec)
    builder = CLASS_BUILDERS[spec["preset_class"]]
    builder(spec, mats)

    dim_l, dim_w, dim_h = ground_align_scene()
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{spec['id']}.glb"

    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        export_draco_mesh_compression_enable=False,
        export_yup=True,
    )

    obj_names = sorted(o.name for o in bpy.context.scene.objects if o.type == "MESH")
    print(
        f"[OK] {spec['id']:13s} | {spec['preset_class']:12s} | "
        f"L={dim_l:5.2f}m W={dim_w:5.2f}m H={dim_h:5.2f}m | "
        f"objs={len(obj_names)} ({', '.join(obj_names)}) -> {out_path.name}"
    )
    return out_path


def resolve_target_ids(selector: str) -> List[str]:
    """Resolve `SKYBOUND_AIRCRAFT` env var (`HERO`, `ALL`, or comma-separated IDs)."""
    raw = selector.strip()
    if not raw or raw.upper() == "HERO":
        return list(HERO_AIRCRAFT_IDS)
    if raw.upper() == "ALL":
        return list(AIRCRAFT_CATALOG.keys())

    chosen: List[str] = []
    unknown: List[str] = []
    for tok in raw.split(","):
        key = tok.strip().lower()
        if not key:
            continue
        if key in AIRCRAFT_CATALOG:
            if key not in chosen:
                chosen.append(key)
        else:
            unknown.append(key)
    if unknown:
        raise ValueError(f"Unknown SKYBOUND_AIRCRAFT IDs: {', '.join(unknown)}")
    return chosen


def main() -> int:
    if not HAS_BPY:
        print(
            "ERROR: This script must be executed inside Blender:\n"
            "  blender --background --python blender-pipeline/build_all_aircraft_glb.py\n"
            f"Catalog verified: {len(AIRCRAFT_CATALOG)} aircraft across 6 airframe classes.",
            file=sys.stderr,
        )
        return 1

    selector = os.environ.get("SKYBOUND_AIRCRAFT", "HERO")
    targets = resolve_target_ids(selector)

    script_dir = Path(__file__).resolve().parent
    default_out = script_dir.parent / "dist" / "models" / "aircraft"
    out_dir = Path(os.environ.get("SKYBOUND_OUT_DIR", str(default_out))).resolve()

    print("=" * 78)
    print(f"SKYBOUND GLOBAL Blender GLB Pipeline | Blender {bpy.app.version_string}")
    print(f"Selector: SKYBOUND_AIRCRAFT={selector} ({len(targets)} / {len(AIRCRAFT_CATALOG)} models)")
    print(f"Output  : {out_dir}")
    print("=" * 78)

    for ac_id in targets:
        build_and_export_aircraft(AIRCRAFT_CATALOG[ac_id], out_dir)

    print("=" * 78)
    print(f"Completed export of {len(targets)} GLB model(s) into {out_dir}")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
