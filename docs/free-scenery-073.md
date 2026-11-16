# Free scenery 0.73

New normal entry: Main menu → 地景與勳章 → 吉隆坡 / 雅加達城市試作區. Free flight airport selection also offers WMKK and WIII.

23,444 closed OSM way footprints. 510 buildings have height tags; 1,397 use floor counts × 3.2 m; 21,537 use explicitly recorded default heights. No claim of complete national buildings, photographic facades, multipolygon holes or exact landmark reconstruction. No Google Maps content or paid API requests.

Terrain: three Mapzen Terrain Tiles HGT cells resampled to 121×121, negative and void values clamped to zero. Credits, source links, coverage and limitations are in dist/WORLD-PILOTS.txt and per-building methods in dist/world-city/pilot-provenance.json.

Build sources: tools/fetch-city-pilots.py → tools/build-city-pilots.py; tools/build-pilot-terrain.py for sampled heights / airport source rows. Files use the existing scene projection for compatibility. Geographic scale and runway true bearings at new latitudes still require a regional coordinate-system correction before claiming high-fidelity flight geometry.

Aircraft: adjusted shared airframe paint roughness, clearcoat and metallic response. Dedicated model builders retained. Full fleet high-detail refinement remains incomplete.

Tests: all 52 existing workflow checks passed before final packaging; new verify-city-pilots.cjs checks footprint counts and finite geometry, height provenance, sampled DEM and both airport surfaces. Normal menu browser testing loaded 4 Kuala Lumpur city tiles and 2 Jakarta tiles without page exceptions. Tests used Windows Edge desktop, not a physical iPhone. Prototype visual quality still requires work (facade accuracy, trees / roads exclusion and distant ground boundaries).
