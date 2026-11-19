"""
SKYBOUND GLOBAL — One-Click Blender Batch GLB Exporter
======================================================
Runs all three procedural Blender Python (bpy) modeling generators:
  1. build_all_airports_glb.py   (62 Taiwan & Global Airports -> dist/models/airports/<ICAO>.glb)
  2. build_all_landmarks_glb.py  (50 Iconic World Landmarks   -> dist/models/landmarks/<id>.glb)
  3. build_all_aircraft_glb.py   (100 Fleet Aircraft & Helis  -> dist/models/aircraft/<id>.glb)

Usage (Headless CLI — Fastest, Recommended):
  blender --background --python run_all_blender_exports.py

Optional Environment Filters:
  SKYBOUND_AIRPORTS="RCTP,RCSS,WSSS,KJFK,KLAX,KSFO,RJTT,VHHH,EGLL,OMDB"
  SKYBOUND_LANDMARKS="taipei_101,golden_gate,tokyo_skytree,dubai_burj,paris_eiffel"
  SKYBOUND_AIRCRAFT="HERO"   # or "ALL" for all 100 aircraft, or "fa18c,f16v,b773"

Usage (Blender GUI):
  Open Blender -> Scripting workspace -> Open run_all_blender_exports.py -> Click Run Script.
"""

import json
import os
import runpy
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_MODELS_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "dist", "models"))


def run_generator(filename):
    path = os.path.join(SCRIPT_DIR, filename)
    if not os.path.isfile(path):
        print(f"[SKIP] Generator not found: {path}")
        return False
    print(f"\n{'=' * 72}\n[SKYBOUND] Running {filename} ...\n{'=' * 72}")
    t0 = time.time()
    runpy.run_path(path, run_name="__main__")
    print(f"[DONE] {filename} finished in {time.time() - t0:.1f}s")
    return True


def write_manifest():
    manifest = {"airports": [], "landmarks": [], "aircraft": []}
    for key in manifest:
        folder = os.path.join(DIST_MODELS_DIR, key)
        if os.path.isdir(folder):
            manifest[key] = sorted(
                os.path.splitext(f)[0]
                for f in os.listdir(folder)
                if f.lower().endswith(".glb")
            )
    manifest_path = os.path.join(DIST_MODELS_DIR, "glb-manifest.json")
    os.makedirs(DIST_MODELS_DIR, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
    print(f"\n[SKYBOUND] Wrote GLB manifest -> {manifest_path}")
    print(
        f"  Airports: {len(manifest['airports'])}, "
        f"Landmarks: {len(manifest['landmarks'])}, "
        f"Aircraft: {len(manifest['aircraft'])}"
    )


def main():
    try:
        import bpy  # noqa: F401
    except ImportError:
        print("ERROR: This script must be run inside Blender (bpy module required).")
        print("Example: blender --background --python run_all_blender_exports.py")
        sys.exit(1)

    t_start = time.time()
    targets = os.environ.get("SKYBOUND_TARGETS", "airports,landmarks,aircraft").lower()
    if "airports" in targets:
        run_generator("build_all_airports_glb.py")
    if "landmarks" in targets:
        run_generator("build_all_landmarks_glb.py")
    if "aircraft" in targets:
        run_generator("build_all_aircraft_glb.py")

    write_manifest()
    print(f"\n[SKYBOUND] All exports complete in {time.time() - t_start:.1f}s!")


if __name__ == "__main__":
    main()
