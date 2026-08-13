param(
  [Parameter(Mandatory=$true)][string]$Spec,     # TSV: page  name  x0  y0  x1  y1
  [Parameter(Mandatory=$true)][string]$PageDir,  # holds <Prefix>-<page>.jpg
  [Parameter(Mandatory=$true)][string]$OutDir,
  [Parameter(Mandatory=$true)][string]$Prefix,   # e.g. u03
  [int]$Pad = 10
)

# Crop named rects out of rendered book pages. Each rect is written generously in
# the spec and then tightened to the ink actually inside it, so a rect only has to
# be right to within a dozen pixels. No ImageMagick — System.Drawing only.

Add-Type -AssemblyName System.Drawing
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                 [System.Drawing.Imaging.Encoder]::Quality, 88L)

$THRESH = 232
$cache = @{}

function Get-Page([string]$n) {
  if (-not $cache.ContainsKey($n)) {
    $p = Join-Path $PageDir ("{0}-{1}.jpg" -f $Prefix, $n)
    $cache[$n] = [System.Drawing.Bitmap]::FromFile((Resolve-Path $p))
  }
  return $cache[$n]
}

$rows = Get-Content $Spec | Where-Object { $_.Trim() -ne '' -and -not $_.StartsWith('#') }
$made = 0
foreach ($row in $rows) {
  $f = $row -split "`t+" | Where-Object { $_ -ne '' }
  if ($f.Count -lt 6) { Write-Output "SKIP (bad row): $row"; continue }
  $page = $f[0]; $name = $f[1]
  $x0 = [int]$f[2]; $y0 = [int]$f[3]; $x1 = [int]$f[4]; $y1 = [int]$f[5]

  $bmp = Get-Page $page
  $x0 = [Math]::Max(0, $x0); $y0 = [Math]::Max(0, $y0)
  $x1 = [Math]::Min($bmp.Width - 1, $x1); $y1 = [Math]::Min($bmp.Height - 1, $y1)
  $rw = $x1 - $x0 + 1; $rh = $y1 - $y0 + 1

  $rect = New-Object System.Drawing.Rectangle $x0, $y0, $rw, $rh
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $stride = $data.Stride
  $bytes = New-Object byte[] ($stride * $rh)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)

  $mnx = $rw; $mxx = -1; $mny = $rh; $mxy = -1
  for ($y = 0; $y -lt $rh; $y++) {
    $base = $y * $stride
    for ($x = 0; $x -lt $rw; $x++) {
      $i = $base + $x * 3
      if ($bytes[$i] -lt $THRESH -or $bytes[$i+1] -lt $THRESH -or $bytes[$i+2] -lt $THRESH) {
        if ($x -lt $mnx) { $mnx = $x }
        if ($x -gt $mxx) { $mxx = $x }
        if ($y -lt $mny) { $mny = $y }
        if ($y -gt $mxy) { $mxy = $y }
      }
    }
  }
  if ($mxx -lt 0) { Write-Output ("EMPTY {0}" -f $name); continue }

  # Pad outwards but never past the rect that was asked for: the book prints two
  # columns a few pixels apart, and a padded edge silently drags the neighbouring
  # column's question number into the crop.
  $lx = [Math]::Max(0, $mnx - $Pad);   $rx = [Math]::Min($rw - 1, $mxx + $Pad)
  $ty = [Math]::Max(0, $mny - $Pad);   $by = [Math]::Min($rh - 1, $mxy + $Pad)
  $cx = $x0 + $lx; $cy = $y0 + $ty
  $cw = $rx - $lx + 1; $ch = $by - $ty + 1

  $src = New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch
  $out = New-Object System.Drawing.Bitmap $cw, $ch
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0,0,$cw,$ch), $src,
               [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $dest = Join-Path $OutDir ($name + '.jpg')
  $out.Save($dest, $jpeg, $ep)
  $out.Dispose()
  Write-Output ("{0,-16} p{1}  {2}x{3}" -f $name, $page, $cw, $ch)
  $made++
}
foreach ($k in $cache.Keys) { $cache[$k].Dispose() }
Write-Output ("--- {0} crops written to {1}" -f $made, $OutDir)
