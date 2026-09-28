# Publishes the browser engine and copies it to js/dwg/engine/ (spec §3). Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File _src/dwg-engine/publish.ps1
# Only the JavaScript modules and the gzip copies are kept: the worker unpacks each .wasm itself.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$out = Join-Path $env:TEMP 'aidedcam-dwg-publish'
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
dotnet publish (Join-Path $PSScriptRoot 'Host/Host.csproj') -c Release -o $out -v q
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed' }
$fw = Join-Path $out 'wwwroot/_framework'
$dest = Join-Path $root 'js/dwg/engine'
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
New-Item -ItemType Directory -Force $dest | Out-Null
Get-ChildItem $fw -File |
    Where-Object { ($_.Name -like '*.js') -or ($_.Name -like '*.gz' -and $_.Name -notlike '*.js.gz') } |
    Copy-Item -Destination $dest
$gz = Get-ChildItem $dest -File -Filter '*.gz'
$bytes = ($gz | Measure-Object Length -Sum).Sum
# The worker shows download progress against these totals.
'{{"files":{0},"bytes":{1}}}' -f $gz.Count, $bytes | Set-Content -Encoding ascii (Join-Path $dest 'manifest.json')
$all = Get-ChildItem $dest -File
'{0} files, {1:N1} MB in js/dwg/engine' -f $all.Count, (($all | Measure-Object Length -Sum).Sum / 1MB)
