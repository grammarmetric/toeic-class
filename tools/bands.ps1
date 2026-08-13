param(
  [Parameter(Mandatory=$true)][string]$Path,
  [int]$X0 = 0,
  [int]$X1 = 0,   # 0 = full width; set both to scan one column only
  [int]$Gap = 14  # blank rows tolerated inside one band
)

# Report horizontal ink bands in a rendered book page, so exercises can be located
# by y-range before any crop rect is written. Prints: band index, y0, y1, height,
# and the x extent of the ink inside that band.

Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Path))
$w = $bmp.Width; $h = $bmp.Height
$rect = New-Object System.Drawing.Rectangle 0,0,$w,$h
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
                      [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bmp.UnlockBits($data)
$bmp.Dispose()

$THRESH = 225          # anything darker than this counts as ink
$MINROW = 3            # rows need this many ink pixels to be "inked"
$GAP    = $Gap           # blank rows this many or fewer do not split a band

$scanLo = if ($X1 -gt 0) { $X0 } else { 0 }
$scanHi = if ($X1 -gt 0) { [Math]::Min($X1, $w - 1) } else { $w - 1 }

$rowInk = New-Object int[] $h
$rowMin = New-Object int[] $h
$rowMax = New-Object int[] $h
for ($y = 0; $y -lt $h; $y++) {
  $base = $y * $stride
  $n = 0; $mn = $w; $mx = -1
  for ($x = $scanLo; $x -le $scanHi; $x++) {
    $i = $base + $x * 3
    if ($bytes[$i] -lt $THRESH -or $bytes[$i+1] -lt $THRESH -or $bytes[$i+2] -lt $THRESH) {
      $n++
      if ($x -lt $mn) { $mn = $x }
      if ($x -gt $mx) { $mx = $x }
    }
  }
  $rowInk[$y] = $n; $rowMin[$y] = $mn; $rowMax[$y] = $mx
}

$bands = @()
$start = -1; $blank = 0
for ($y = 0; $y -lt $h; $y++) {
  if ($rowInk[$y] -ge $MINROW) {
    if ($start -lt 0) { $start = $y }
    $blank = 0
  } elseif ($start -ge 0) {
    $blank++
    if ($blank -gt $GAP) {
      $bands += ,@($start, ($y - $blank))
      $start = -1; $blank = 0
    }
  }
}
if ($start -ge 0) { $bands += ,@($start, ($h - 1)) }

Write-Output ("{0}  ({1}x{2})  {3} bands" -f (Split-Path $Path -Leaf), $w, $h, $bands.Count)
$i = 0
foreach ($b in $bands) {
  $y0 = $b[0]; $y1 = $b[1]
  $mn = $w; $mx = -1
  for ($y = $y0; $y -le $y1; $y++) {
    if ($rowMax[$y] -ge 0) {
      if ($rowMin[$y] -lt $mn) { $mn = $rowMin[$y] }
      if ($rowMax[$y] -gt $mx) { $mx = $rowMax[$y] }
    }
  }
  Write-Output ("  [{0,2}] y {1,5}-{2,5}  h{3,5}   x {4,5}-{5,5}" -f $i, $y0, $y1, ($y1-$y0+1), $mn, $mx)
  $i++
}
