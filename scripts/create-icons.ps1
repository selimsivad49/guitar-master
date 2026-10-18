Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path -Parent $PSScriptRoot
foreach ($taskSize in @(180, 192, 512)) {
    $taskBitmap = [System.Drawing.Bitmap]::new($taskSize, $taskSize)
    $taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
    $taskGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $taskGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#a84b31'))
    $taskGraphics.ScaleTransform($taskSize / 128.0, $taskSize / 128.0)
    $taskCream = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#f8edda'))
    $taskRust = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#a84b31'))
    $taskPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $taskPath.AddBezier(42, 29, 53, 20, 75, 20, 86, 29)
    $taskPath.AddBezier(86, 29, 84, 62, 78, 91, 64, 108)
    $taskPath.AddBezier(64, 108, 50, 91, 44, 62, 42, 29)
    $taskPath.CloseFigure()
    $taskGraphics.FillPath($taskCream, $taskPath)
    $taskGraphics.FillEllipse($taskRust, 52, 50, 24, 24)
    $taskPen = [System.Drawing.Pen]::new($taskRust.Color, 2)
    $taskGraphics.DrawLine($taskPen, 59, 25, 59, 92)
    $taskGraphics.DrawLine($taskPen, 64, 24, 64, 97)
    $taskGraphics.DrawLine($taskPen, 69, 25, 69, 92)
    $taskPen.Width = 4
    $taskGraphics.DrawLine($taskPen, 53, 84, 75, 84)
    $taskFilename = if ($taskSize -eq 180) { 'apple-touch-icon.png' } else { "icon-$taskSize.png" }
    $taskBitmap.Save((Join-Path $taskRoot "public/$taskFilename"), [System.Drawing.Imaging.ImageFormat]::Png)
    $taskPen.Dispose(); $taskPath.Dispose(); $taskCream.Dispose(); $taskRust.Dispose(); $taskGraphics.Dispose(); $taskBitmap.Dispose()
}
