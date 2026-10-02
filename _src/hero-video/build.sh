#!/usr/bin/env bash
# Rebuilds the index.html hero loop, video/hero.mp4 and video/hero-poster.webp, from the screen
# recording of the lathe CAM ("Screen Recording 2026-10-01 201643.mp4", 2558x1528, 30 fps).
#
#   bash _src/hero-video/build.sh "<recording.mp4>"        from the repo root; needs ffmpeg with
#                                                          libx264 and libwebp
#
# Four shots of the 3D viewport only (no ribbon, panels or title bar, so no file or program names):
#   D  203.9 s   2.7 s       the finished part, 3/4 view, after the cursor has left it
#   A   23.0 s   2.4 s       the stock in the chuck: side view, orbit to the front
#   B  161.8 s   6.2 s, x2   side B roughing passes, tool moves drawn over them
#   C   74.567 s 5.233 s     close-up orbit over the roughing passes
# crossfaded in that order, 0.5 s each. D is split: its first 16 frames close the loop and the rest
# opens it, so the last frame runs straight into the first and the loop has no seam. The poster is
# the first frame, so the page shows the same picture before and after the video starts.
#
# A new recording needs new times, and a new crop if the window layout differs.
set -euo pipefail
SRC="${1:?usage: bash _src/hero-video/build.sh <recording.mp4>}"
OUT="video"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# The 3D viewport of the 2558x1528 recording, below its view cube and toolbar, at 1280x944.
PREP="crop=1314:969:623:500,scale=1280:944:flags=lanczos,setsar=1"

shot() { # name start duration [speed]
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$SRC" -an \
    -vf "$PREP,setpts=PTS/${4:-1},fps=30,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 6 "$TMP/$1.mkv"
}
frames() { ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$TMP/$1.mkv"; }
sec() { awk "BEGIN { printf \"%.6f\", $1 / 30 }"; }

shot D 203.9 2.7
shot A 23.0 2.4
shot B 161.8 6.2 2
shot C 74.567 5.233

X=15   # crossfade length, frames
nD=$(frames D); nA=$(frames A); nB=$(frames B); nC=$(frames C)
lt=$((nD - X - 1))                        # D without its first X+1 frames
o1=$((lt - X)); l1=$((lt + nA - X))
o2=$((l1 - X)); l2=$((l1 + nB - X))
o3=$((l2 - X)); l3=$((l2 + nC - X))
o4=$((l3 - X))
FC="[0:v]split[d1][d2];[d1]trim=end_frame=$((X + 1)),setpts=PTS-STARTPTS[Dh];[d2]trim=start_frame=$((X + 1)),setpts=PTS-STARTPTS[Dt];"
FC+="[Dt][1:v]xfade=transition=fade:duration=0.5:offset=$(sec $o1)[x1];"
FC+="[x1][2:v]xfade=transition=fade:duration=0.5:offset=$(sec $o2)[x2];"
FC+="[x2][3:v]xfade=transition=fade:duration=0.5:offset=$(sec $o3)[x3];"
FC+="[x3][Dh]xfade=transition=fade:duration=0.5:offset=$(sec $o4),format=yuv420p,"
FC+="setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709[out]"

mkdir -p "$OUT"
# No audio, no metadata (the recording's timestamps stay home), moov atom first so it starts at once.
ffmpeg -v error -y -i "$TMP/D.mkv" -i "$TMP/A.mkv" -i "$TMP/B.mkv" -i "$TMP/C.mkv" \
  -filter_complex "$FC" -map "[out]" -an -map_metadata -1 -map_chapters -1 \
  -c:v libx264 -preset veryslow -tune animation -crf 24 -profile:v high -level:v 4.0 -pix_fmt yuv420p \
  -movflags +faststart "$OUT/hero.mp4"
# The poster is converted with the video's own BT.709 matrix, so it matches the first frame exactly.
ffmpeg -v error -y -i "$OUT/hero.mp4" -frames:v 1 \
  -vf "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24" "$TMP/poster.png"
ffmpeg -v error -y -i "$TMP/poster.png" -c:v libwebp -quality 78 -compression_level 6 -map_metadata -1 "$OUT/hero-poster.webp"

echo "frames $((l3 + 1)) ($(sec $((l3 + 1))) s)"
ls -l "$OUT/hero.mp4" "$OUT/hero-poster.webp"
