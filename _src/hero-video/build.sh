#!/usr/bin/env bash
# Rebuilds the index.html hero loop, video/hero.mp4 + hero-poster.webp and the phone versions
# hero-sm.mp4 + hero-poster-sm.webp, from three recordings and the factory digital twin video's
# clean (caption-free) passes:
#
#   LATHE  screen recording of the lathe CAM ("Screen Recording 2026-10-01 201643.mp4",
#          2558x1528, 30 fps)
#   PLATE  the EN demo video of the PowerShape + PowerMill plate automation (1920x1080, 30 fps,
#          already at x3, captions burned in along the bottom; the unblurred one, its toolpath
#          names show in the inset)
#   MOLD   the mold-plate-builder demo video (1920x1080, 30 fps, captions along the bottom)
#   REAL   the "reality to twin" video's real-looking flight through the mold shop, no captions
#          (Marketing\2026-10-30 mold shop floor\Work\reality-to-twin\real-0-17s-1080p-v4.mp4)
#   TWIN   the same camera over the digital twin, no captions (same folder, twin-pass.mp4)
#   LINE   the green scan line of the switch, 1920x1080 RGBA, line at x 960 (overlays\line.png)
#
#   bash _src/hero-video/build.sh "<lathe>" "<plate>" "<mold>" "<real>" "<twin>" "<line.png>"
#                                     from the repo root; needs ffmpeg with libx264 and libwebp
#
# The page fades the left half of the frame into the paper from 1141px (the text sits over it),
# so every shot keeps its subject in the right half. Seven shots, in this order:
#   T  REAL 0-15 s + TWIN 15-22 s, x1.6    the whole flight: over the car park, in through the
#                                    entrance, along the machines and up over the shop; from 15 s
#                                    the twin is revealed left to right behind the green scan line
#                                    (frame-matched, the same camera), rising to the overview.
#                                    Cropped under the twin's header bar.
#   D  LATHE 203.9 s   2.7 s         the finished part, 3/4 view, after the cursor has left it
#   A  LATHE  23.0 s   2.4 s         the stock in the chuck: side view, orbit to the front
#   B  LATHE 161.8 s   6.2 s, x3     side B roughing passes, tool moves drawn over them
#   P  PLATE   9.7 s  74.6 s, x14    the "Creating plate toolpaths" dialog from its first frame to
#                                    its last, with the toolpath tree of the Explorer panel laid
#                                    over the 3D preview on the right as an inset, so the
#                                    checklist, the progress bar and the new toolpaths run together
#   M  MOLD    9.0 s  45.0 s, x8     plan + 3D view while the features go in, ending on the turn
#   C  LATHE  74.567 s 5.233 s, x1.5 close-up orbit over the roughing passes
# crossfaded in that order, 0.5 s each. The lathe is split around the plate and mold shots, so no
# project holds the screen for long. T is split: its first 16 frames close the loop and the rest
# opens it, so the last frame runs straight into the first and the loop has no seam. The poster is
# the first frame, so the page shows the same picture before and after the video starts.
#
# No crop takes the captions, the PLATE title bar, the twin's header or a file name. A new
# recording needs new times, and a new crop if the window layout differs.
set -euo pipefail
USAGE="usage: bash _src/hero-video/build.sh <lathe> <plate> <mold> <real> <twin> <line.png>"
LATHE="${1:?$USAGE}"; PLATE="${2:?$USAGE}"; MOLD="${3:?$USAGE}"
REAL="${4:?$USAGE}"; TWIN="${5:?$USAGE}"; LINE="${6:?$USAGE}"
OUT="${OUT:-video}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# The 3D viewport of the 2558x1528 recording, below its view cube and toolbar, at 1280x944.
PREP="crop=1314:969:623:500,scale=1280:944:flags=lanczos,setsar=1"

shot() { # name start duration [speed]
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$LATHE" -an \
    -vf "$PREP,setpts=PTS/${4:-1},fps=30,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 6 "$TMP/$1.mkv"
}
frames() { ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$TMP/$1.mkv"; }
sec() { awk "BEGIN { printf \"%.6f\", $1 / 30 }"; }

shot D 203.9 2.7
shot A 23.0 2.4
shot B 161.8 6.2 3
shot C 74.567 5.233 1.5

# P: the right side of the PowerMill window under the ribbon and above the captions (the AidedCAM
# window with its dialog and 3D preview, the hole drawing on the left), at 1280x944. The inset is
# the Explorer tree from "Toolpaths" down, at 1.1x with a 1px grey frame, over the 3D preview.
ffmpeg -v error -y -ss 9.7 -t 74.6 -i "$PLATE" -an -filter_complex \
  "[0:v]split[a][b];[a]crop=1070:790:850:142,scale=1280:944:flags=lanczos,setsar=1[base];\
[b]crop=300:610:0:290,scale=330:671:flags=lanczos,pad=332:673:1:1:color=0xb4b4b4[tree];\
[base][tree]overlay=932:150,setpts=PTS/14,fps=30,format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 6 "$TMP/P.mkv"
# M: the plan's right half and the 3D view, under their headers and above the captions.
ffmpeg -v error -y -ss 9 -t 45 -i "$MOLD" -an \
  -vf "crop=963:710:557:207,scale=1280:944:flags=lanczos,setsar=1,setpts=PTS/8,fps=30,format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 6 "$TMP/M.mkv"

# T: real 0-17 s and twin 15-22 s, wiped over 2 s from 15 s with the scan line riding the edge;
# then cropped under the twin's 110 px header bar to the right of the frame.
ffmpeg -v error -y -ss 0 -t 17 -i "$REAL" -ss 15 -t 7 -i "$TWIN" -loop 1 -t 22 -i "$LINE" -an -filter_complex \
  "[0:v]fps=30,setpts=PTS-STARTPTS,format=yuv420p[r];[1:v]fps=30,setpts=PTS-STARTPTS,format=yuv420p[t];\
[r][t]xfade=transition=wiperight:duration=2:offset=15[w];[2:v]format=rgba,setpts=PTS-STARTPTS[l];\
[w][l]overlay=x='1920*(t-15)/2-960':y=0:enable='between(t,15,17)':shortest=1,\
crop=1316:970:604:110,scale=1280:944:flags=lanczos,setsar=1,setpts=PTS/1.6,fps=30,format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 6 "$TMP/T.mkv"

X=15   # crossfade length, frames
nT=$(frames T); nD=$(frames D); nA=$(frames A); nB=$(frames B); nC=$(frames C); nP=$(frames P); nM=$(frames M)
lt=$((nT - X - 1))                        # T without its first X+1 frames
o1=$((lt - X)); l1=$((lt + nD - X))
o2=$((l1 - X)); l2=$((l1 + nA - X))
o3=$((l2 - X)); l3=$((l2 + nB - X))
o4=$((l3 - X)); l4=$((l3 + nP - X))
o5=$((l4 - X)); l5=$((l4 + nM - X))
o6=$((l5 - X)); l6=$((l5 + nC - X))
o7=$((l6 - X))
FC="[0:v]split[t1][t2];[t1]trim=end_frame=$((X + 1)),setpts=PTS-STARTPTS[Th];[t2]trim=start_frame=$((X + 1)),setpts=PTS-STARTPTS[Tt];"
FC+="[Tt][1:v]xfade=transition=fade:duration=0.5:offset=$(sec $o1)[x1];"
FC+="[x1][2:v]xfade=transition=fade:duration=0.5:offset=$(sec $o2)[x2];"
FC+="[x2][3:v]xfade=transition=fade:duration=0.5:offset=$(sec $o3)[x3];"
FC+="[x3][4:v]xfade=transition=fade:duration=0.5:offset=$(sec $o4)[x4];"
FC+="[x4][5:v]xfade=transition=fade:duration=0.5:offset=$(sec $o5)[x5];"
FC+="[x5][6:v]xfade=transition=fade:duration=0.5:offset=$(sec $o6)[x6];"
FC+="[x6][Th]xfade=transition=fade:duration=0.5:offset=$(sec $o7),format=yuv420p,"
FC+="setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709[out]"

mkdir -p "$OUT"
# The twin shot (frames 0 to $lt: fast camera over fine grid lines) gets a lower quality zone;
# at the loop's quality it alone would weigh more than all the other shots together.
# No audio, no metadata (the recording's timestamps stay home), moov atom first so it starts at once.
ffmpeg -v error -y -i "$TMP/T.mkv" -i "$TMP/D.mkv" -i "$TMP/A.mkv" -i "$TMP/B.mkv" -i "$TMP/P.mkv" -i "$TMP/M.mkv" -i "$TMP/C.mkv" \
  -filter_complex "$FC" -map "[out]" -an -map_metadata -1 -map_chapters -1 \
  -c:v libx264 -preset veryslow -tune animation -crf 24 -x264-params "zones=0,$lt,crf=30" -profile:v high -level:v 4.0 -pix_fmt yuv420p \
  -movflags +faststart "$OUT/hero.mp4"
# The poster is converted with the video's own BT.709 matrix, so it matches the first frame exactly.
ffmpeg -v error -y -i "$OUT/hero.mp4" -frames:v 1 \
  -vf "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24" "$TMP/poster.png"
ffmpeg -v error -y -i "$TMP/poster.png" -c:v libwebp -quality 78 -compression_level 6 -map_metadata -1 "$OUT/hero-poster.webp"

# The phone versions (index.html loads them up to 768px): the same loop at 720x532, and its first frame.
ffmpeg -v error -y -i "$OUT/hero.mp4" -an -map_metadata -1 -map_chapters -1 -vf "scale=720:-2:flags=lanczos,setsar=1"   -c:v libx264 -preset veryslow -tune animation -crf 25 -x264-params "zones=0,$lt,crf=31" -profile:v high -level:v 3.1 -pix_fmt yuv420p   -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -movflags +faststart "$OUT/hero-sm.mp4"
ffmpeg -v error -y -i "$OUT/hero-sm.mp4" -frames:v 1   -vf "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24" "$TMP/poster-sm.png"
ffmpeg -v error -y -i "$TMP/poster-sm.png" -c:v libwebp -quality 78 -compression_level 6 -map_metadata -1 "$OUT/hero-poster-sm.webp"

echo "frames $((l6 + 1)) ($(sec $((l6 + 1))) s)"
ls -l "$OUT"/hero*
