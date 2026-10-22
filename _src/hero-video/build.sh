#!/usr/bin/env bash
# Rebuilds the index.html hero loop, video/hero.mp4 + hero-poster.webp and the phone versions
# hero-sm.mp4 + hero-poster-sm.webp, from three recordings:
#
#   LATHE  screen recording of the lathe CAM ("Screen Recording 2026-10-01 201643.mp4",
#          2558x1528, 30 fps)
#   PLATE  the EN demo video of the PowerShape + PowerMill plate automation (1920x1080, 30 fps,
#          already at x3, captions burned in along the bottom)
#   MOLD   the mold-plate-builder demo video (1920x1080, 30 fps, captions along the bottom)
#
#   bash _src/hero-video/build.sh "<lathe.mp4>" "<plate.mp4>" "<mold.mp4>"
#                                     from the repo root; needs ffmpeg with libx264 and libwebp
#
# The page fades the left half of the frame into the paper from 1141px (the text sits over it),
# so every shot keeps its subject in the right half. Six shots, in this order:
#   D  LATHE 203.9 s   2.7 s         the finished part, 3/4 view, after the cursor has left it
#   A  LATHE  23.0 s   2.4 s         the stock in the chuck: side view, orbit to the front
#   B  LATHE 161.8 s   6.2 s, x3     side B roughing passes, tool moves drawn over them
#   P  PLATE   9.7 s  74.6 s, x14    the "Creating plate toolpaths" dialog from its first frame to
#                                    its last, with the toolpath tree of the Explorer panel laid
#                                    over the 3D preview on the right as an inset, so the
#                                    checklist, the progress bar and the new toolpaths run together
#   M  MOLD    9.0 s  45.0 s, x8     plan + 3D view while the features go in, ending on the turn
#   C  LATHE  74.567 s 5.233 s, x1.5 close-up orbit over the roughing passes
# crossfaded in that order, 0.5 s each. The lathe is split around the other two, so no project
# holds the screen for long and the loop opens and closes on the lathe part. D is split: its first 16 frames close the loop and the rest
# opens it, so the last frame runs straight into the first and the loop has no seam. The poster is
# the first frame, so the page shows the same picture before and after the video starts.
#
# No crop takes the captions, the PLATE title bar or a file name. A new recording needs new times,
# and a new crop if the window layout differs.
set -euo pipefail
LATHE="${1:?usage: bash _src/hero-video/build.sh <lathe.mp4> <plate.mp4> <mold.mp4>}"
PLATE="${2:?usage: bash _src/hero-video/build.sh <lathe.mp4> <plate.mp4> <mold.mp4>}"
MOLD="${3:?usage: bash _src/hero-video/build.sh <lathe.mp4> <plate.mp4> <mold.mp4>}"
OUT="video"
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

X=15   # crossfade length, frames
nD=$(frames D); nA=$(frames A); nB=$(frames B); nC=$(frames C); nP=$(frames P); nM=$(frames M)
lt=$((nD - X - 1))                        # D without its first X+1 frames
o1=$((lt - X)); l1=$((lt + nA - X))
o2=$((l1 - X)); l2=$((l1 + nB - X))
o3=$((l2 - X)); l3=$((l2 + nP - X))
o4=$((l3 - X)); l4=$((l3 + nM - X))
o5=$((l4 - X)); l5=$((l4 + nC - X))
o6=$((l5 - X))
FC="[0:v]split[d1][d2];[d1]trim=end_frame=$((X + 1)),setpts=PTS-STARTPTS[Dh];[d2]trim=start_frame=$((X + 1)),setpts=PTS-STARTPTS[Dt];"
FC+="[Dt][1:v]xfade=transition=fade:duration=0.5:offset=$(sec $o1)[x1];"
FC+="[x1][2:v]xfade=transition=fade:duration=0.5:offset=$(sec $o2)[x2];"
FC+="[x2][3:v]xfade=transition=fade:duration=0.5:offset=$(sec $o3)[x3];"
FC+="[x3][4:v]xfade=transition=fade:duration=0.5:offset=$(sec $o4)[x4];"
FC+="[x4][5:v]xfade=transition=fade:duration=0.5:offset=$(sec $o5)[x5];"
FC+="[x5][Dh]xfade=transition=fade:duration=0.5:offset=$(sec $o6),format=yuv420p,"
FC+="setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709[out]"

mkdir -p "$OUT"
# No audio, no metadata (the recording's timestamps stay home), moov atom first so it starts at once.
ffmpeg -v error -y -i "$TMP/D.mkv" -i "$TMP/A.mkv" -i "$TMP/B.mkv" -i "$TMP/P.mkv" -i "$TMP/M.mkv" -i "$TMP/C.mkv" \
  -filter_complex "$FC" -map "[out]" -an -map_metadata -1 -map_chapters -1 \
  -c:v libx264 -preset veryslow -tune animation -crf 24 -profile:v high -level:v 4.0 -pix_fmt yuv420p \
  -movflags +faststart "$OUT/hero.mp4"
# The poster is converted with the video's own BT.709 matrix, so it matches the first frame exactly.
ffmpeg -v error -y -i "$OUT/hero.mp4" -frames:v 1 \
  -vf "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24" "$TMP/poster.png"
ffmpeg -v error -y -i "$TMP/poster.png" -c:v libwebp -quality 78 -compression_level 6 -map_metadata -1 "$OUT/hero-poster.webp"

# The phone versions (index.html loads them up to 768px): the same loop at 720x532, and its first frame.
ffmpeg -v error -y -i "$OUT/hero.mp4" -an -map_metadata -1 -map_chapters -1 -vf "scale=720:-2:flags=lanczos,setsar=1"   -c:v libx264 -preset veryslow -tune animation -crf 25 -profile:v high -level:v 3.1 -pix_fmt yuv420p   -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -movflags +faststart "$OUT/hero-sm.mp4"
ffmpeg -v error -y -i "$OUT/hero-sm.mp4" -frames:v 1   -vf "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24" "$TMP/poster-sm.png"
ffmpeg -v error -y -i "$TMP/poster-sm.png" -c:v libwebp -quality 78 -compression_level 6 -map_metadata -1 "$OUT/hero-poster-sm.webp"

echo "frames $((l5 + 1)) ($(sec $((l5 + 1))) s)"
ls -l "$OUT"/hero*
