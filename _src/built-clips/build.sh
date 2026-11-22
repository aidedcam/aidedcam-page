#!/usr/bin/env bash
# Rebuilds the #lyseis card loops in index.html, video/built-lathe.mp4, video/built-plate.mp4 and
# video/built-projects.mp4, with their first frames as posters (built-*.webp), from three recordings:
#
#   LATHE  the lathe CAM screen recording ("Screen Recording 2026-10-01 201643.mp4", 2558x1528, 30 fps;
#          the same file the hero loop uses)
#   PLATE  "PowerShape Create CAM File - cut.mp4" (2508x1248, 30 fps) from the marketing project
#          "02-11-2026 routing plan example\Raw\Records to use": a demo mold, dummy data
#   PROJ   the project manager's Timeline (card 04) on its demo database, Months view, scrolled down
#          through the tasks and back (2560x1538, 30 fps): marketing "22-11-2026 website card clips\Raw#          2026-11-22 project manager timeline months demo.mp4", recorded by Work\drive-timeline-months.ps1
#          (gdigrab of the app window, the script clicks the view buttons and scrolls)
#
#   bash _src/built-clips/build.sh "<lathe>" "<plate>" "<proj>"     from the repo root; needs ffmpeg with libx264 and libwebp
#
# All are 960x600 (16:10, the card's .built-shot box), muted, no metadata, moov atom first.
#
# Lathe, the 3D/CAD viewport between the left tree and the right panels, under the ribbon (no title bar):
#   C  80 s   19 s, x5     side A roughing passes (it stops before a view menu opens at 100 s)
#   D  203.9 s 2.7 s       the finished part, 3/4 view
#   A  12 s   9 s, x4      the DXF comes in and the profile is closed (CAD tab; after the file dialog closes)
#   B  26 s   4.2 s, x2    the stock in the chuck, orbit (before the view menu opens at 30.5 s)
# crossfaded in that order, 0.4 s each; the loop starts on the roughing so the poster shows a toolpath.
# Plate: the AidedCAM window with the routing plan and its "create PowerMill project" confirmation
# (0-9 s, x2), then the plate in PowerMill (9-10.5 s, 13-14.6 s, 19-21 s), crossfaded 0.3 s; the gaps are
# PowerMill's empty viewport while it loads. The PowerMill Explorer on the left is outside the crop.
# Projects: the Status / Assignee / Duration columns and the Gantt, under the view buttons (no title
# bar, no ribbon), 3.3-16.4 s at x1.3: the whole schedule in Months, scrolled through and back.
#
# No crop takes a title bar, file path or client name. A new recording needs new times and crops.
set -euo pipefail
USAGE="usage: bash _src/built-clips/build.sh <lathe> <plate> <proj>"
LATHE="${1:?$USAGE}"; PLATE="${2:?$USAGE}"; PROJ="${3:?$USAGE}"
OUT="${OUT:-video}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

LCROP="crop=1300:812:625:470,scale=960:600:flags=lanczos,setsar=1"
shot() { # name start duration speed
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$LATHE" -an \
    -vf "$LCROP,setpts=PTS/$4,fps=30,format=yuv420p" -c:v libx264 -preset veryfast -crf 8 "$TMP/$1.mkv"
}
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/$1.mkv"; }

shot C 80 19 5
shot D 203.9 2.7 1
shot A 12 9 4
shot B 26 4.2 2

X=0.4
o1=$(awk "BEGIN{print $(dur C)-$X}")
o2=$(awk "BEGIN{print $o1+$(dur D)-$X}")
o3=$(awk "BEGIN{print $o2+$(dur A)-$X}")
ENC=(-an -map_metadata -1 -map_chapters -1 -c:v libx264 -preset veryslow -tune animation -crf 27
     -profile:v high -level:v 4.0 -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv
     -movflags +faststart)
mkdir -p "$OUT"
ffmpeg -v error -y -i "$TMP/C.mkv" -i "$TMP/D.mkv" -i "$TMP/A.mkv" -i "$TMP/B.mkv" -filter_complex \
  "[0][1]xfade=transition=fade:duration=$X:offset=$o1[x1];[x1][2]xfade=transition=fade:duration=$X:offset=$o2[x2];\
[x2][3]xfade=transition=fade:duration=$X:offset=$o3,format=yuv420p[out]" -map "[out]" "${ENC[@]}" "$OUT/built-lathe.mp4"

PCROP="crop=1568:980:440:70,scale=960:600:flags=lanczos,setsar=1"
pseg() { # name start duration speed
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$PLATE" -an \
    -vf "$PCROP,setpts=PTS/$4,fps=30,format=yuv420p" -c:v libx264 -preset veryfast -crf 8 "$TMP/$1.mkv"
}
pseg P1 0 9 2       # the plan, the click and the confirmation
pseg P2 9 1.5 1     # the plate opens in PowerMill
pseg P3 13 1.6 1    # the plate, selected
pseg P4 19 2 1      # close-up of the plate
Y=0.3
q1=$(awk "BEGIN{print $(dur P1)-$Y}")
q2=$(awk "BEGIN{print $q1+$(dur P2)-$Y}")
q3=$(awk "BEGIN{print $q2+$(dur P3)-$Y}")
ffmpeg -v error -y -i "$TMP/P1.mkv" -i "$TMP/P2.mkv" -i "$TMP/P3.mkv" -i "$TMP/P4.mkv" -filter_complex \
  "[0][1]xfade=transition=fade:duration=$Y:offset=$q1[y1];[y1][2]xfade=transition=fade:duration=$Y:offset=$q2[y2];\
[y2][3]xfade=transition=fade:duration=$Y:offset=$q3,format=yuv420p[out]" -map "[out]" "${ENC[@]}" "$OUT/built-plate.mp4"

ffmpeg -v error -y -ss 3.3 -t 13.1 -i "$PROJ"   -vf "crop=1550:968:990:410,scale=960:600:flags=lanczos,setsar=1,setpts=PTS/1.3,fps=30,format=yuv420p"   "${ENC[@]}" "$OUT/built-projects.mp4"

# Posters: the first frame, converted with the video's own BT.709 matrix so it matches when playback starts.
for n in built-lathe built-plate built-projects; do
  ffmpeg -v error -y -i "$OUT/$n.mp4" -frames:v 1 \
    -vf "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24" "$TMP/$n.png"
  ffmpeg -v error -y -i "$TMP/$n.png" -c:v libwebp -quality 80 -compression_level 6 -map_metadata -1 "$OUT/$n.webp"
done
ls -l "$OUT"/built-*
