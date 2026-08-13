param(
  [Parameter(Mandatory=$true)][string]$Dir,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$Cols = 4,
  [int]$Cell = 470,
  [int]$Rows = 0,        # 0 = all in one sheet; else split into pages of Cols*Rows
  [string]$Only = ''     # optional comma list of names to include
)

# Tile every crop in a directory into one labelled contact sheet, so a whole
# unit's artwork can be eyeballed in a single look instead of 40 separate reads.

Add-Type -AssemblyName System.Drawing
$files = Get-ChildItem -Path $Dir -Filter *.jpg | Sort-Object Name
if ($Only -ne '') {
  $want = $Only -split ','
  $files = $files | Where-Object { $want -contains $_.BaseName }
}
if ($files.Count -eq 0) { Write-Output "no crops in $Dir"; exit }

$LabelH = 26
$Pad = 10
$perSheet = if ($Rows -gt 0) { $Cols * $Rows } else { $files.Count }
$sheets = [Math]::Ceiling($files.Count / $perSheet)

$font = New-Object System.Drawing.Font('Consolas', 13, [System.Drawing.FontStyle]::Bold)
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 86L)

for ($s = 0; $s -lt $sheets; $s++) {
  $chunk = $files | Select-Object -Skip ($s * $perSheet) -First $perSheet
  $n = $chunk.Count
  $nrows = [Math]::Ceiling($n / $Cols)

  # measure: each cell keeps aspect, capped to $Cell wide and 1.4*$Cell tall
  $maxH = New-Object 'int[]' $nrows
  $imgs = @()
  $i = 0
  foreach ($f in $chunk) {
    $b = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $sc = [Math]::Min(1.0, $Cell / [double]$b.Width)
    $sc = [Math]::Min($sc, ($Cell * 1.5) / [double]$b.Height)
    $tw = [int]($b.Width * $sc); $th = [int]($b.Height * $sc)
    $imgs += [pscustomobject]@{ Bmp = $b; W = $tw; H = $th; Name = $f.BaseName }
    $r = [Math]::Floor($i / $Cols)
    if ($th -gt $maxH[$r]) { $maxH[$r] = $th }
    $i++
  }

  $sheetW = $Cols * ($Cell + $Pad * 2)
  $sheetH = 0
  foreach ($m in $maxH) { $sheetH += $m + $LabelH + $Pad * 2 }

  $sheetBmp = New-Object System.Drawing.Bitmap $sheetW, $sheetH
  $g = [System.Drawing.Graphics]::FromImage($sheetBmp)
  $g.Clear([System.Drawing.Color]::FromArgb(238, 241, 246))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  $y = 0; $i = 0
  for ($r = 0; $r -lt $nrows; $r++) {
    for ($c = 0; $c -lt $Cols; $c++) {
      if ($i -ge $n) { break }
      $im = $imgs[$i]
      $x = $c * ($Cell + $Pad * 2) + $Pad
      $g.FillRectangle([System.Drawing.Brushes]::White, $x, ($y + $LabelH), $im.W, $im.H)
      $g.DrawImage($im.Bmp, $x, ($y + $LabelH), $im.W, $im.H)
      $g.DrawRectangle([System.Drawing.Pens]::LightGray, $x, ($y + $LabelH), $im.W, $im.H)
      $g.DrawString($im.Name, $font, [System.Drawing.Brushes]::DarkRed, $x, ($y + 4))
      $i++
    }
    $y += $maxH[$r] + $LabelH + $Pad * 2
  }
  $g.Dispose()

  $dest = if ($sheets -eq 1) { $Out } else { [IO.Path]::ChangeExtension($Out, $null) + ($s + 1) + '.jpg' }
  $sheetBmp.Save($dest, $jpeg, $ep)
  $sheetBmp.Dispose()
  foreach ($im in $imgs) { $im.Bmp.Dispose() }
  Write-Output ("sheet -> {0}  ({1} crops)" -f $dest, $n)
}
