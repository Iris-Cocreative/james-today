# World Clock Widget Launcher
# Opens in Edge app mode (chromeless) and sets always-on-top

$htmlPath = Join-Path $PSScriptRoot "index.html"
$fileUrl = "file:///" + ($htmlPath -replace '\\','/') -replace ' ','%20'

# Try Chrome first, fall back to Edge
$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
$chromeX86 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
$chromeLocal = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"

$browser = $null
if (Test-Path $chrome) { $browser = $chrome }
elseif (Test-Path $chromeX86) { $browser = $chromeX86 }
elseif (Test-Path $chromeLocal) { $browser = $chromeLocal }
elseif (Test-Path $edge) { $browser = $edge }
else {
    Write-Host "No supported browser found. Opening in default browser..."
    Start-Process $htmlPath
    exit
}

Write-Host "Launching World Clock with $browser..."
Write-Host "URL: $fileUrl"

# Launch in app mode (no browser chrome)
$proc = Start-Process -FilePath $browser -ArgumentList "--app=$fileUrl", "--window-size=950,550" -PassThru

# Wait for window to appear, then set always-on-top
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_SHOWWINDOW = 0x0040;
}
"@

Start-Sleep -Seconds 2

for ($i = 0; $i -lt 10; $i++) {
    $proc.Refresh()
    if ($proc.MainWindowHandle -ne [IntPtr]::Zero) {
        [Win32]::SetWindowPos($proc.MainWindowHandle, [Win32]::HWND_TOPMOST, 0, 0, 0, 0, [Win32]::SWP_NOMOVE -bor [Win32]::SWP_NOSIZE -bor [Win32]::SWP_SHOWWINDOW) | Out-Null
        Write-Host "Window set to always-on-top."
        break
    }
    Start-Sleep -Milliseconds 500
}
