"""World Clock Widget Launcher - Always on top, resizable window"""
import webview
import os
import ctypes
import threading
import time

html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'index.html')

# Win32 constants for always-on-top
HWND_TOPMOST = -1
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001
SWP_SHOWWINDOW = 0x0040

def set_always_on_top():
    """Find the window by title and set it always on top using Win32 API."""
    user32 = ctypes.windll.user32
    time.sleep(2)
    for _ in range(20):
        hwnd = user32.FindWindowW(None, 'World Clock')
        if hwnd:
            user32.SetWindowPos(
                hwnd, HWND_TOPMOST, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW
            )
            break
        time.sleep(0.5)

threading.Thread(target=set_always_on_top, daemon=True).start()

# pywebview 2.x API
webview.create_window(
    'World Clock',
    url=html_path,
    width=900,
    height=580,
    resizable=True,
    background_color='#0B0F1A',
)
