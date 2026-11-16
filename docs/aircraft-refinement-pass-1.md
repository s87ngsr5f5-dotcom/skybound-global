# Aircraft refinement pass 1

Reference: aircraft-model-reference.md (user-supplied; unverified factual details and branding are not treated as licensed assets).

Implemented visual configurations for 54 subtypes (see JSON for the exact set): propeller blade counts, wing taper and strut selection, GA T-tails and winglets, Caravan belly pod, fighter tandem canopy and F-104 tip tanks, business-jet cruciform tails, airliner fences / split winglets / raked tips, selective engine chevrons, A340 centre gear, 777/A350 bogie axle counts and 787 wing rise.

Existing dedicated aircraft builders remain in use. Flight mass, thrust, input and save structures are unchanged. The wing / fin face winding fix already present in the working tree was checked: left and right upper-wing normals point outward.

Validation: 100 aircraft instantiated in browser with finite vertices and bounded dimensions; all 100 rendered in hangar; aircraft cache bounded to four; mobile hangar mission entry passed. Existing fixed-wing, helicopter and livery checks passed. Test environment: Windows desktop Edge/Chromium, 1100x720 and emulated 844x390; no physical iPhone verification.

This is the first geometry differentiation pass. It does not claim all 100 have completed high-detail acceptance. Shared cockpits, detailed mechanisms, per-subtype close-up review, external references and LOD/triangle-budget work remain. The reference's 1,500–4,500 triangle target is not yet met by the existing high-detail builders. See aircraft-refinement-status.json for all aircraft and pending review items.

Release gate: full legacy workflow is not green. Baseline HEAD also fails heavy-cargo, taipei-city, v60-features, v62-aero-roads and v70-real-world-cities checks. No production release is claimed. Geometry/clipping verification passes for 100/100 aircraft plus KC-135 after retaining A340-600 engine clearance.
