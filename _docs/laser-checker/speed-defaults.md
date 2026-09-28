# Default cutting speeds and pierce times

Researched 2026-09-27 for the laser DXF check (spec §8). `js/laser/pricing.js` holds exactly these rows; change both together.

## How to read this

These are typical values for a **3 kW fiber laser** cutting job-shop-grade sheet metal, gathered from public cutting-speed charts and machine-builder guides (no single laser brand's chart is reproduced here — only the numbers actually used, with their source). The gas shown is the one a job shop would normally run at that thickness: nitrogen or air on thin material for speed and edge quality, switching to oxygen on mild/galvanised steel above about 2 mm for cost (oxygen is far cheaper than nitrogen, even though nitrogen would cut a bit faster). Where two or more sources disagreed, the slower, more conservative figure was kept — a safer basis for a time/cost estimate than the fastest number a marketing chart shows. The tool labels these rows "typical values: set your machine's" and any numbers a shop enters for its own machine override these defaults in the browser.

Every thickness required by the tool (0.5, 1, 2, 3, 5, 8, 10, 15, 20 mm) has a row even where a 3 kW laser cannot realistically cut that material at that thickness (e.g. copper/brass above ~6-8 mm, stainless/aluminium above ~10-12 mm). Those rows are clearly marked **UNVERIFIED (extrapolated)** — they exist only so the tool always has a number to show, not because the cut is production-viable.

## Steel (mild/carbon)

Gas: N2/air up to 2 mm, oxygen from 3 mm up (job-shop practice; N2 could cut faster at 3 mm but is rarely used there for cost).

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 30000 | 0.1 | UNVERIFIED — interpolated above the 1 mm figure; no source publishes 0.5 mm mild steel, thin-gauge speed is capped by machine axis speed rather than laser power |
| 1 | 28000 | 0.15 | Sourced — artizono.com (N2/air, 28-35 m/min) and istarmachining.com (air, 25-30 m/min) agree closely; laserspechub.com shows 35 m/min (marketing-optimistic, not used) |
| 2 | 16000 | 0.25 | Sourced — artizono.com (N2/air, 16-20 m/min) and laserspechub.com (~20 m/min) agree; conservative low end taken |
| 3 | 4500 | 0.4 | Sourced, sources disagree — artizono.com gives O2 at 3.8-4.2 m/min; istarmachining.com and laserspechub.com give air/O2 at 7-10 m/min. Took the slower O2 figure as the safer, cost-typical shop choice |
| 5 | 3000 | 0.7 | Sourced — artizono.com O2 2.7-3.0 m/min, within adhmt.com's 4-8 mm O2 range (1.2-5 m/min) |
| 8 | 1900 | 1.3 | Sourced — artizono.com O2 1.8-2.2 m/min, consistent with istarmachining.com and adhmt.com ranges |
| 10 | 1300 | 2.0 | Sourced — artizono.com O2 1.0-1.3 m/min, istarmachining.com 1.0-1.5 m/min, adhmt.com range midpoint |
| 15 | 750 | 3.5 | Sourced — laserspechub.com 0.8 m/min, adhmt.com 10-16 mm range midpoint ~0.85 m/min, istarmachining.com interpolated ~0.6-0.7 m/min |
| 20 | 450 | 5.5 | Sourced — laserspechub.com 0.4 m/min, adhmt.com ~0.3 m/min, istarmachining.com 0.5-0.6 m/min; conservative middle taken |

Pierce times: no source gave a thickness-matched pierce-time table for a 3 kW machine specifically. All pierce times above are **UNVERIFIED typical-practice estimates**, based on general guidance found (paramountmachinery.ca, arcuscnc.com, laserspechub.com "thick plate cutting" guide): roughly 0.3-0.8 s for 1-3 mm, 1.0-2.5 s for 6-20 mm, with multi-second pulsed piercing on the thickest plate.

## Stainless steel (N2)

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 34000 | 0.1 | UNVERIFIED — interpolated above the 1 mm figure, no direct 0.5 mm source |
| 1 | 27000 | 0.15 | Sourced — istarmachining.com N2 20-25 m/min, artizono.com N2 31-38.5 m/min; conservative middle taken |
| 2 | 13000 | 0.3 | Sourced — artizono.com N2 10-16.5 m/min, midpoint ~13.25 m/min |
| 3 | 6500 | 0.5 | Sourced — artizono.com N2 7-10 m/min, istarmachining.com N2 5-7 m/min; conservative middle-low taken |
| 5 | 2200 | 0.9 | Sourced, sources disagree — artizono.com N2 1.8-2.45 m/min vs adhmt.com's wider 4-6 mm range (2-7 m/min); took the lower, more specific figure |
| 8 | 1000 | 1.6 | Sourced — artizono.com N2 1.2-2.0 m/min, istarmachining.com 0.8-1.0 m/min, adhmt.com 8-10 mm range midpoint; converge near 1000 |
| 10 | 700 | 2.3 | Sourced — artizono.com N2 0.7-1.0 m/min, istarmachining.com 0.6-0.7 m/min; conservative middle |
| 15 | 250 | 4.5 | UNVERIFIED (extrapolated) — multiple sources put practical 3 kW stainless capability at ~10-12 mm max; 15 mm figure extrapolated downward from the 10 mm value |
| 20 | 120 | 7.0 | UNVERIFIED (extrapolated) — well beyond realistic 3 kW stainless cutting; figure exists only to fill the tool's row |

## Aluminium (N2)

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 35000 | 0.1 | UNVERIFIED — interpolated above the 1 mm figure, no direct 0.5 mm source |
| 1 | 20000 | 0.15 | Sourced, sources disagree — istarmachining.com N2 18-22 m/min, artizono.com N2 25-40 m/min, gyclaser.com only 8-12 m/min. Took istarmachining.com's middle figure as the conservative choice |
| 2 | 10000 | 0.3 | Sourced — artizono.com N2 10-20 m/min and gyclaser.com 4-6 m/min bracket this; adhmt.com's 1-3 mm range (5-30 m/min) is consistent |
| 3 | 5000 | 0.5 | Sourced — istarmachining.com N2 4-6 m/min, artizono.com 5-6.6 m/min; gyclaser.com lower at 2-3.5 m/min not used (outlier) |
| 5 | 2000 | 0.9 | Sourced — artizono.com N2 2-2.65 m/min |
| 8 | 800 | 1.6 | Sourced — istarmachining.com N2 0.7-0.9 m/min |
| 10 | 450 | 2.3 | Sourced — artizono.com N2 0.3-0.45 m/min, istarmachining.com 0.5-0.6 m/min; conservative middle |
| 15 | 180 | 4.5 | UNVERIFIED (extrapolated) — sources put practical 3 kW aluminium capability at roughly 10-12 mm max due to reflectivity/conductivity; extrapolated downward |
| 20 | 90 | 7.0 | UNVERIFIED (extrapolated) — well beyond realistic 3 kW aluminium cutting |

## Galvanised steel (estimated from mild steel)

No 3 kW manufacturer chart for galvanised steel was found in this search — every row below is **UNVERIFIED**, estimated as the mild-steel figures above reduced by roughly 10-15% (same gas pattern: N2/air thin, O2 from 3 mm), reflecting the extra energy/slower feed job shops typically use to burn off the zinc coating cleanly and avoid zinc-oxide fuming.

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 27000 | 0.15 | UNVERIFIED — estimated at ~90% of the mild-steel N2/air value |
| 1 | 25000 | 0.2 | UNVERIFIED — estimated at ~90% of the mild-steel N2/air value |
| 2 | 13500 | 0.3 | UNVERIFIED — estimated at ~85% of the mild-steel N2/air value |
| 3 | 3800 | 0.5 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 5 | 2550 | 0.9 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 8 | 1600 | 1.6 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 10 | 1100 | 2.3 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 15 | 640 | 4.0 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |
| 20 | 380 | 6.5 | UNVERIFIED — estimated at ~85% of the mild-steel O2 value |

## Copper (N2)

Public 3 kW charts for copper are scarce; most manufacturer charts show copper cutting starting at 4-6 kW because copper's high reflectivity/conductivity is hard on a 3 kW source. One data point found: a fiber laser (power not clearly stated, ~3-6 kW class) cutting 6 mm copper at about 1.3 m/min (1300 mm/min) — used only as a rough sanity check, not a direct source for any single row below.

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 16000 | 0.2 | UNVERIFIED (extrapolated) — no source for thin copper at 3 kW specifically |
| 1 | 10000 | 0.3 | UNVERIFIED (extrapolated) — general copper speed-range claims (0.1-65 m/min across 1-80 mm and many powers) too broad to anchor a single figure |
| 2 | 3500 | 0.5 | UNVERIFIED (extrapolated) |
| 3 | 2200 | 0.8 | UNVERIFIED, loosely supported — consistent with general copper speed-range claims for this thickness band |
| 5 | 1000 | 1.4 | UNVERIFIED, loosely supported by the ~1.3 m/min at 6 mm data point noted above |
| 8 | 250 | 3.0 | UNVERIFIED (extrapolated) — beyond the ~5-6 mm practical limit most sources give for copper at 3 kW; row exists only to fill the tool's grid |
| 10 | 150 | 4.5 | UNVERIFIED (extrapolated) — beyond practical 3 kW copper capability |
| 15 | 70 | 7.0 | UNVERIFIED (extrapolated) — beyond practical 3 kW copper capability |
| 20 | 40 | 9.0 | UNVERIFIED (extrapolated) — beyond practical 3 kW copper capability |

## Brass (N2)

| Thickness (mm) | Cutting speed (mm/min) | Pierce time (s) | Source / status |
|---|---|---|---|
| 0.5 | 29000 | 0.2 | UNVERIFIED (extrapolated) — above the sourced 1 mm figure, no direct 0.5 mm source |
| 1 | 25000 | 0.3 | Sourced — artizono.com N2 20-31 m/min, midpoint ~25.5 m/min |
| 2 | 10000 | 0.5 | Sourced — artizono.com N2 7-13.2 m/min, midpoint ~10.1 m/min |
| 3 | 6000 | 0.8 | Sourced — artizono.com N2 5-7.2 m/min, midpoint ~6.1 m/min |
| 5 | 1300 | 1.4 | Sourced — artizono.com N2 1-1.65 m/min, midpoint ~1.3 m/min |
| 8 | 400 | 2.8 | Sourced — artizono.com N2 0.3-0.45 m/min, midpoint ~0.375 m/min |
| 10 | 220 | 4.2 | UNVERIFIED (extrapolated) — artizono.com's table stops at 8 mm; most sources put practical 3 kW brass capability at ~6-8 mm max |
| 15 | 100 | 6.5 | UNVERIFIED (extrapolated) — beyond practical 3 kW brass capability |
| 20 | 60 | 9.0 | UNVERIFIED (extrapolated) — beyond practical 3 kW brass capability |

## Marking speed

**10000 mm/min** for all materials — **UNVERIFIED, typical-practice estimate**. No manufacturer publishes a "marking speed" figure for the low-power mark pass on a cutting-head machine specifically. Dedicated fiber marking/engraving machines (small galvo-scanner heads, much lower power) run far faster — commonly 500-2000 mm/s, with high-speed setups at 3000-10000+ mm/s (sources: stylecnc.com, heatsign.com) — but that figure describes a galvo mirror scanning a small field, not a gantry-mounted cutting head moving its whole beam-delivery carriage, which is limited by machine axis dynamics rather than laser/optics speed. A few-thousand-to-low-tens-of-thousands mm/min mark-pass speed is consistent with typical CAM/nesting-software defaults for cutting machines, so the tool uses 10000 mm/min.

## DWG format written by current AutoCAD

**AutoCAD 2025, 2026 and 2027 all still write the "AutoCAD 2018" DWG format (internal version code AC1032) — no new DWG format has been introduced since AutoCAD 2018.** The laser check reads DWG from R14 up to this format, so files saved by current AutoCAD releases open. Status: UNVERIFIED against a first-party page — Autodesk's own format pages could not be fetched (see below); spot-check them before launch.

Sources:
- en.wikipedia.org/wiki/.dwg — version table lists AC1032 as the DWG format code covering AutoCAD 2018 through the current release, with no newer internal DWG version code listed.
- Search results referencing autodesk.com/blogs/autocad/autocad-2027/, architosh.com's April-2026 AutoCAD 2027 coverage, and cadpilot.com's AutoCAD 2027 release article: consistently state there is no DWG file-format change in the 2027 release, and that the format remains the AutoCAD 2018 (AC1032) format. (The Autodesk support pages autodesk.com/.../Compatibility-with-previous-AutoCAD-dwg-releases.html and .../AutoCAD-drawing-file-format.html, Autodesk's own canonical pages on this topic, returned HTTP 403 to automated fetch in this session and could not be quoted directly — their titles/summaries were visible in search results and are consistent with the above, but should be spot-checked manually if a fully first-party citation is needed.)

## Sources

1. artizono.com/fiber-laser-cutting-thickness-speed-chart/ — 3 kW cutting-speed table used for mild steel (N2/air thin, O2 thick), stainless steel (N2), aluminium (N2) and brass (N2) rows across most thicknesses.
2. istarmachining.com/fiber-laser-cutting-speed-thickness-chart-guide/ — 3000 W table used as a cross-check for mild steel, stainless steel and aluminium.
3. adhmt.com/how-to-set-3000w-laser-cutting-parameters-for-speed-gas-and-thickness/ — "3000W Baseline Reference Ranges" used as a cross-check/range for mild steel, stainless steel and aluminium.
4. laserspechub.com/guides/cutting-speed-chart — used as a cross-check (and upper-bound/marketing comparison) for mild steel at 1-20 mm.
5. gyclaser.com/2024/03/07/fiber-laser-cutting-speed-chart/ — used as a lower-bound cross-check for aluminium; general 3000W nitrogen/air speed range statement (28-35 m/min) and general copper/brass thickness-limit commentary.
6. General web-search summaries (queries: "copper laser cutting speed mm/min fiber laser…", "fiber laser cutting speed chart copper brass 3000W…") aggregating krrass.com, stylecnc.com and similar manufacturer-blog claims — used only as loose, UNVERIFIED sanity checks for copper/brass, not as a primary source for any single row.
7. paramountmachinery.ca (via search: "How Fiber Laser Power Affects Piercing Time") and arcuscnc.com ("Optimizing Laser Piercing Parameters for Thick Plate Cutting") and laserspechub.com/guides/thick-plate-cutting — general pierce-time-by-thickness guidance (0.3-0.8 s thin, 1.0-2.5 s mid/thick, multi-second pulsed piercing on very thick plate), used for all materials' pierce-time column, all marked UNVERIFIED as no thickness-matched pierce table for a 3 kW machine specifically was found.
8. stylecnc.com/blog/laser-engraving-speed-and-power-settings-chart.html and heatsign.com ("How fast do modern laser engravers operate today") — general fiber marking/engraving speed ranges, used only as background for the marking-speed note (background only: these describe a different machine class).
9. en.wikipedia.org/wiki/.dwg — DWG format version table, used for the DWG-format answer.
10. Search results citing autodesk.com/blogs/autocad/autocad-2027/, architosh.com and cadpilot.com AutoCAD 2027 coverage — used to confirm no DWG format change in AutoCAD 2027.
