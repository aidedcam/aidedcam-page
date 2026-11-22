#!/usr/bin/env bash
# Rebuilds the images (and the one clip) of the story pages built by _src/case-pages/build.py.
# All from demo recordings; no crop takes a title bar, file path or client name.
#
#   LATHE  the lathe CAM screen recording ("Screen Recording 2026-10-01 201643.mp4", 2558x1528)
#          -> img/lathe-cam/step-1..6.webp: the app below its title bar at 13, 19, 27, 95, 158, 205 s
#   ROUTE  marketing "02-11-2026 routing plan example\Raw\Records to use": "PowerShape Build Routing
#          Plan - cut.mp4" (2326x1200), "... Create CAM File - cut.mp4" (2508x1248), "... Create
#          Workplanes - cut.mp4" (2150x1218); demo mould, dummy data
#   HERO   video/hero.mp4 itself (already public): its plate-toolpaths shot, 18.6-23.5 s, is the mould
#          page's step 6 clip
#
#   PROJ   marketing "22-11-2026 website card clips\Raw": window and screen grabs of the project manager on
#          its dummy database (Projects and Timeline tabs, project 22's Edit form on Estimate and on
#          Workload); the Months scroll for step 6 is video/built-projects.mp4 (_src/built-clips/build.sh).
#          The Projects list shows one real company's name ("BGS ..."), so its name cell is blurred.
#
#   bash _src/case-pages/media.sh "<lathe>" "<route dir>" "<proj dir>"     from the repo root; needs ffmpeg with libwebp
set -euo pipefail
U="usage: media.sh <lathe> <route dir> <proj dir>"
LATHE="${1:?$U}"; ROUTE="${2:?$U}"; PROJ="${3:?$U}"
webp() { ffmpeg -v error -y -ss "$2" -i "$1" -frames:v 1 -vf "$3,scale=2400:-2:flags=lanczos,format=rgb24" -c:v libwebp -quality 80 -compression_level 6 -map_metadata -1 "$4"; }

mkdir -p img/lathe-cam img/mold-cam img/projects-app
i=1; for t in 13 19 27 95 158 205; do webp "$LATHE" $t "crop=2558:1458:0:68" "img/lathe-cam/step-$i.webp"; i=$((i+1)); done

B="$ROUTE/PowerShape Build Routing Plan - cut.mp4"; C="$ROUTE/PowerShape Create CAM File - cut.mp4"; W="$ROUTE/PowerShape Create Workplanes - cut.mp4"
webp "$B" 12   "crop=2105:1200:110:0"  img/mold-cam/step-1.webp   # the command window listing the components as they are read
webp "$B" 15.5 "crop=2105:1200:110:0"  img/mold-cam/step-2.webp   # "Select routing plan components": available / selected
webp "$C" 1    "crop=2098:1196:410:26" img/mold-cam/step-3.webp   # the routing plan, priorities and status
webp "$W" 11.5 "crop=2136:1218:7:0"    img/mold-cam/step-4.webp   # machining side and workplanes
webp "$C" 6.3  "crop=2098:1196:410:26" img/mold-cam/step-5.webp   # "Create PowerMill project for component ..."

# step 6: the plate toolpaths running, cut from the hero loop and cropped to the window's 16:9-ish box
ffmpeg -v error -y -ss 18.6 -t 4.9 -i video/hero.mp4 -an -map_metadata -1 \
  -vf "crop=1280:730:0:107,setpts=PTS*1.6,fps=30,format=yuv420p" -c:v libx264 -preset veryslow -crf 23 \
  -movflags +faststart video/case-mold-toolpaths.mp4
ffmpeg -v error -y -i video/case-mold-toolpaths.mp4 -frames:v 1 -c:v libwebp -quality 80 -map_metadata -1 img/mold-cam/step-6.webp
# project manager (card 04): dummy data
P="$PROJ/2026-11-22 project manager"
ffmpeg -v error -y -i "$P projects tab.png" -frames:v 1 -filter_complex   "[0]format=rgb24,crop=2560:1460:0:70,split[a][b];[b]crop=530:44:230:1236,boxblur=luma_radius=10:luma_power=4:chroma_radius=5:chroma_power=4[bl];[a][bl]overlay=230:1236,scale=2400:-2:flags=lanczos,format=rgb24"   -c:v libwebp -quality 80 -compression_level 6 -map_metadata -1 img/projects-app/step-1.webp   # the "BGS ..." name cell blurred
webp "$P edit project estimate.png" 0 "crop=1800:1153:229:229" img/projects-app/step-2.webp   # the form only: no list behind it
webp "$P edit project workload.png" 0 "crop=1800:1106:305:353" img/projects-app/step-4.webp
webp "$P timeline tab.png" 0 "crop=2560:1460:0:70" img/projects-app/step-5.webp
ls -l img/lathe-cam img/mold-cam img/projects-app video/case-mold-toolpaths.mp4
