"""
D.A.N.I.S.H System Controller v1.0
Local HTTP service for advanced system control operations.
Runs alongside the voice-service to provide OS-level capabilities:
screenshot OCR, file search, advanced volume/brightness, etc.

Usage: python system-controller/main.py
Port: 8766 (default)
"""

import json
import os
import platform
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
except ImportError:
    print("Missing dependencies. Install with:")
    print("pip install fastapi uvicorn pydantic")
    sys.exit(1)

app = FastAPI(title="D.A.N.I.S.H System Controller")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM = platform.system()
IS_WINDOWS = SYSTEM == "Windows"


class ExecRequest(BaseModel):
    action: str
    payload: dict = {}


class ExecResponse(BaseModel):
    success: bool
    output: str
    data: Optional[dict] = None


def _run(cmd: list[str], timeout: int = 30) -> tuple[str, str, int]:
    """Run a shell command and return (stdout, stderr, returncode)."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip(), r.stderr.strip(), r.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", -1
    except FileNotFoundError:
        return "", "Command not found", -1


@app.get("/health")
def health():
    return {"status": "ok", "system": SYSTEM}


@app.post("/exec", response_model=ExecResponse)
def execute(req: ExecRequest):
    action = req.action
    payload = req.payload

    handlers = {
        # ── File System ──
        "list_directory": lambda: _list_dir(payload.get("path", ".")),
        "search_files": lambda: _search_files(payload.get("query", ""), payload.get("root", str(Path.home()))),
        "read_file": lambda: _read_file(payload.get("path", "")),
        "write_file": lambda: _write_file(payload.get("path", ""), payload.get("content", "")),
        "file_info": lambda: _file_info(payload.get("path", "")),

        # ── System Info ──
        "disk_usage": lambda: _disk_usage(),
        "battery_status": lambda: _battery_status(),
        "network_info": lambda: _network_info(),
        "running_services": lambda: _running_services(),

        # ── Media ──
        "screenshot_base64": lambda: _screenshot_base64(),

        # ── Window Management ──
        "list_windows": lambda: _list_windows(),
        "focus_window": lambda: _focus_window(payload.get("title", "")),
        "get_active_window": lambda: _get_active_window(),

        # ── Automation ──
        "type_text": lambda: _type_text(payload.get("text", "")),
        "press_key": lambda: _press_key(payload.get("key", "")),
        "key_combo": lambda: _key_combo(payload.get("keys", [])),
    }

    handler = handlers.get(action)
    if not handler:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    try:
        result = handler()
        return ExecResponse(success=True, output=result.get("output", ""), data=result.get("data"))
    except Exception as e:
        return ExecResponse(success=False, output=str(e))


# ── File System Handlers ──

def _list_dir(path: str):
    try:
        p = Path(path).expanduser().resolve()
        if not p.is_dir():
            return {"output": f"Not a directory: {path}", "data": None}
        items = []
        for entry in sorted(p.iterdir()):
            items.append({"name": entry.name, "is_dir": entry.is_dir(), "size": entry.stat().st_size if entry.is_file() else 0})
        return {"output": f"Listed {len(items)} items", "data": items}
    except Exception as e:
        return {"output": f"Error: {e}"}


def _search_files(query: str, root: str):
    try:
        root_p = Path(root).expanduser().resolve()
        results = []
        for p in root_p.rglob(f"*{query}*"):
            if p.is_file() and len(results) < 50:
                results.append(str(p.relative_to(root_p)))
        return {"output": f"Found {len(results)} files", "data": results}
    except Exception as e:
        return {"output": f"Error: {e}"}


def _read_file(path: str):
    try:
        p = Path(path).expanduser().resolve()
        if not p.is_file():
            return {"output": f"File not found: {path}"}
        if p.stat().st_size > 1_000_000:
            return {"output": "File too large (>1MB)"}
        content = p.read_text(encoding="utf-8", errors="replace")
        return {"output": f"Read {len(content)} chars", "data": {"content": content[:10000], "path": str(p)}}
    except Exception as e:
        return {"output": f"Error: {e}"}


def _write_file(path: str, content: str):
    try:
        p = Path(path).expanduser().resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return {"output": f"Written {len(content)} bytes to {p}"}
    except Exception as e:
        return {"output": f"Error: {e}"}


def _file_info(path: str):
    try:
        p = Path(path).expanduser().resolve()
        if not p.exists():
            return {"output": f"Not found: {path}"}
        s = p.stat()
        return {"output": str(p), "data": {
            "name": p.name, "size": s.st_size, "is_dir": p.is_dir(),
            "modified": time.ctime(s.st_mtime), "created": time.ctime(s.st_ctime)
        }}
    except Exception as e:
        return {"output": f"Error: {e}"}


# ── System Info ──

def _disk_usage():
    if IS_WINDOWS:
        out, _, _ = _run(["wmic", "logicaldisk", "get", "size,freespace,caption"])
    else:
        out, _, _ = _run(["df", "-h"])
    return {"output": out}


def _battery_status():
    if IS_WINDOWS:
        out, _, _ = _run(["powercfg", "/batteryreport", "/output", str(Path(tempfile.gettempdir()) / "battery.html")])
        out2, _, _ = _run(["WMIC", "Path", "Win32_Battery", "Get", "EstimatedChargeRemaining"])
        return {"output": out2}
    try:
        import psutil
        batt = psutil.sensors_battery()
        if batt:
            return {"output": f"{batt.percent}% {'plugged in' if batt.power_plugged else 'on battery'}"}
        return {"output": "No battery found"}
    except ImportError:
        return {"output": "psutil not available"}


def _network_info():
    if IS_WINDOWS:
        out, _, _ = _run(["ipconfig"])
    else:
        out, _, _ = _run(["ifconfig"])
    return {"output": out[:2000]}


def _running_services():
    if IS_WINDOWS:
        out, _, _ = _run(["sc", "query", "state=", "all"])
        return {"output": out[:2000]}
    out, _, _ = _run(["systemctl", "list-units", "--type=service", "--state=running"])
    return {"output": out}


# ── Media ──

def _screenshot_base64():
    try:
        import pyautogui
        import base64
        from io import BytesIO
        img = pyautogui.screenshot()
        buf = BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        return {"output": f"Screenshot {len(b64)} bytes", "data": {"base64": b64, "format": "png"}}
    except ImportError:
        return {"output": "pyautogui not available. pip install pyautogui"}


# ── Window Management ──

def _list_windows():
    if not IS_WINDOWS:
        return {"output": "Only supported on Windows"}
    out, _, _ = _run(["powershell", "-Command",
        "Add-Type @' using System; using System.Runtime.InteropServices; public class WinAPI { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); } '@; $h=@{}; Get-Process | Where-Object MainWindowTitle | Select-Object -First 20 MainWindowTitle, Id | ForEach-Object { $h[$_.Id]=$_.MainWindowTitle }; $h | ConvertTo-Json"])
    return {"output": out}


def _focus_window(title: str):
    if not IS_WINDOWS:
        return {"output": "Only supported on Windows"}
    out, _, _ = _run(["powershell", "-Command",
        f"(Get-Process | Where-Object {{ $_.MainWindowTitle -like '*{title}*' }}).MainWindowHandle | ForEach-Object {{ (New-Object -ComObject WScript.Shell).AppActivate($_) }}"])
    return {"output": f"Focused window: {title}"}


def _get_active_window():
    if IS_WINDOWS:
        out, _, _ = _run(["powershell", "-Command",
            "Add-Type @' using System; using System.Runtime.InteropServices; public class ActWin { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); } '@; $sb=New-Object System.Text.StringBuilder 256; [ActWin]::GetWindowText([ActWin]::GetForegroundWindow(), $sb, 256); $sb.ToString()"])
        return {"output": f"Active window: {out}"}
    return {"output": "Unsupported on this OS"}


# ── Automation ──

def _type_text(text: str):
    try:
        import pyautogui
        pyautogui.write(text, interval=0.02)
        return {"output": f"Typed {len(text)} characters"}
    except ImportError:
        return {"output": "pyautogui not available"}


def _press_key(key: str):
    try:
        import pyautogui
        pyautogui.press(key)
        return {"output": f"Pressed: {key}"}
    except ImportError:
        return {"output": "pyautogui not available"}


def _key_combo(keys: list[str]):
    try:
        import pyautogui
        pyautogui.hotkey(*keys)
        return {"output": f"Combo: {'+'.join(keys)}"}
    except ImportError:
        return {"output": "pyautogui not available"}


if __name__ == "__main__":
    port = int(os.environ.get("SYSTEM_CONTROLLER_PORT", "8766"))
    print(f"D.A.N.I.S.H System Controller starting on port {port}...")
    print(f"System: {SYSTEM}")
    print(f"Python: {sys.version}")
    print()
    uvicorn.run(app, host="0.0.0.0", port=port)
