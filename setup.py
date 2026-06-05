"""
D.A.N.I.S.H Dependency Checker
Automatically detects and installs missing dependencies for all services.

Usage: python setup.py
"""

import importlib
import os
import subprocess
import sys
from pathlib import Path

REQUIRED = {
    "voice-service": [
        "fastapi",
        "uvicorn",
        "edge_tts",
    ],
    "system-controller": [
        "fastapi",
        "uvicorn",
        "pydantic",
    ],
    "optional": [
        "pyautogui",
        "psutil",
        "PIL",
    ],
}

NPM_REQUIRED = [
    "next",
    "react",
    "typescript",
]

GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
RESET = "\033[0m"


def check_python(package: str) -> bool:
    try:
        importlib.import_module(package)
        return True
    except ImportError:
        return False


def install_python(package: str) -> bool:
    pkg_name = package.replace("_", "-")
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", pkg_name],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return True
    except subprocess.CalledProcessError:
        return False


def check_npm() -> bool:
    try:
        subprocess.check_call(["npm", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def check_npm_deps() -> list[str]:
    missing = []
    if not (Path("node_modules").is_dir()):
        return NPM_REQUIRED  # if node_modules missing, all are "missing"
    for pkg in NPM_REQUIRED:
        if not (Path("node_modules") / pkg).is_dir():
            missing.append(pkg)
    return missing


def check_voice_service() -> bool:
    try:
        import edge_tts
        return True
    except ImportError:
        return False


def check_system_controller() -> bool:
    try:
        import fastapi
        import uvicorn
        return True
    except ImportError:
        return False


def main():
    print(f"{CYAN}╔══════════════════════════════════════╗{RESET}")
    print(f"{CYAN}║  D.A.N.I.S.H Dependency Checker     ║{RESET}")
    print(f"{CYAN}╚══════════════════════════════════════╝{RESET}")
    print()

    all_ok = True

    # ── Python Dependencies ──
    print(f"{YELLOW}[Python Packages]{RESET}")
    for service, packages in REQUIRED.items():
        for pkg in packages:
            ok = check_python(pkg)
            label = pkg.replace("_", "-")
            if ok:
                print(f"  {GREEN}✓{RESET} {label} ({service})")
            else:
                print(f"  {YELLOW}✗{RESET} {label} ({service}) — run: pip install {label}")
                all_ok = False

    # ── Edge TTS check ──
    print()
    print(f"{YELLOW}[Voice Service]{RESET}")
    if check_voice_service():
        print(f"  {GREEN}✓ edge-tts available{RESET}")
    else:
        print(f"  {YELLOW}✗ edge-tts not found — voice TTS won't work{RESET}")
        print(f"  Run: pip install edge-tts")
        all_ok = False

    # ── System Controller check ──
    sys_ctrl_path = Path("system-controller/main.py")
    if sys_ctrl_path.exists():
        print(f"  {GREEN}✓ system-controller/main.py exists{RESET}")
    else:
        print(f"  {YELLOW}✗ system-controller/main.py missing{RESET}")

    # ── Node.js ──
    print()
    print(f"{YELLOW}[Node.js / Frontend]{RESET}")
    if check_npm():
        print(f"  {GREEN}✓ npm available{RESET}")
        missing = check_npm_deps()
        if missing:
            print(f"  {YELLOW}✗ Missing npm deps: {', '.join(missing)}{RESET}")
            print(f"  Run: npm install")
            all_ok = False
        else:
            print(f"  {GREEN}✓ All npm deps installed{RESET}")
    else:
        print(f"  {RED}✗ npm not found{RESET}")
        all_ok = False

    # ── Agent Scripts ──
    print()
    print(f"{YELLOW}[Agent Scripts]{RESET}")
    agent_path = Path("agents/windows-agent.ps1")
    if agent_path.exists():
        print(f"  {GREEN}✓ windows-agent.ps1 exists{RESET}")
    else:
        print(f"  {YELLOW}✗ windows-agent.ps1 missing{RESET}")

    # ── Summary ──
    print()
    print(f"{CYAN}══════════════════════════════════════{RESET}")
    if all_ok:
        print(f"{GREEN}  All dependencies satisfied!{RESET}")
    else:
        print(f"{YELLOW}  Some dependencies missing — see above.{RESET}")
    print(f"{CYAN}══════════════════════════════════════{RESET}")
    print()
    print("To start services:")
    print(f"  {CYAN}1.{RESET} Voice TTS:   python voice-service/main.py")
    print(f"  {CYAN}2.{RESET} System Ctrl: python system-controller/main.py")
    print(f"  {CYAN}3.{RESET} Dashboard:   npm run dev")
    print(f"  {CYAN}4.{RESET} Agent:       .\\agents\\windows-agent.ps1 -ServerUrl 'http://localhost:3000' -PairingToken '<token>'")
    print()

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
