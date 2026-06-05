# D.A.N.I.S.H Full Device Control Architecture

## Overview

D.A.N.I.S.H now has a complete **full-device control system** that allows the AI assistant to control the user's Windows laptop through natural language commands — either by typing or by speaking.

The system is organized into four layers:

```
User Voice/Text → Gemini AI → System Controller / PowerShell Agent → Windows OS
```

---

## What Was Added

### 1. Enhanced PowerShell Agent (`agents/windows-agent.ps1`)

**Version 2.0** — Major rewrite with 25+ commands organized into permission tiers:

| Category | Commands |
|----------|---------|
| **App Management** | `open_chrome`, `open_vscode`, `open_explorer`, `open_website`, `open_app`, `close_app` |
| **System** | `lock_pc`, `shutdown_pc`, `restart_pc`, `system_info` |
| **Volume** | `volume_mute`, `volume_set`, `volume_up`, `volume_down` |
| **Brightness** | `brightness_set` (via WMI + powercfg fallback) |
| **Clipboard** | `clipboard_copy`, `clipboard_paste` |
| **Screenshot** | `screenshot` (captures to PNG) |
| **File Ops** | `file_delete`, `file_move`, `file_copy` |
| **Process** | `list_apps`, `process_kill` |
| **Mouse** | `mouse_move`, `mouse_click` |
| **Keyboard** | `keyboard_type` |
| **Network** | `toggle_wifi` |

**Permission System**: Commands are categorized as `$SAFE_COMMANDS` (auto-execute) and `$SENSITIVE_COMMANDS` (logged as sensitive). The agent logs the tier before executing.

### 2. Python System Controller (`system-controller/main.py`)

A local HTTP service (port **8766**) for advanced OS operations that require Python libraries:

| Endpoint | Action | Description |
|----------|--------|-------------|
| `GET /health` | — | Health check |
| `POST /exec` | `list_directory` | List files in a directory |
| | `search_files` | Search files by name |
| | `read_file` | Read file contents (up to 10K chars) |
| | `write_file` | Write content to a file |
| | `file_info` | Get file metadata |
| | `disk_usage` | Disk space usage |
| | `battery_status` | Battery percentage |
| | `network_info` | Network config |
| | `screenshot_base64` | Screenshot as base64 (requires `pyautogui`) |
| | `list_windows` | List open windows |
| | `focus_window` | Focus a window by title |
| | `get_active_window` | Get foreground window title |
| | `type_text` | Type text via pyautogui |
| | `press_key` | Press a key |
| | `key_combo` | Keyboard shortcut |

### 3. Enhanced Action Engine (`lib/action-engine.ts`)

The client-side action router now handles **50+ natural language triggers** mapped to device commands. New categories:

- **Browser/App launch**: `open youtube`, `open gmail`, `open spotify`, `open discord`, `open terminal`, `close chrome`, etc.
- **System control**: `system info`, `pc info`, `what are my specs`
- **Volume**: `mute`, `unmute`, `volume up`, `volume down`, `turn it up`, `turn it down`
- **Screenshot**: `take a screenshot`, `capture screen`
- **Clipboard**: `copy to clipboard`, `paste from clipboard`
- **Brightness**: `brightness up`, `brightness down`
- **Processes**: `list apps`, `list processes`, `what apps are running`
- **Dynamic URL/App**: `open chrome <url>`, `open <anything>`

### 4. AI Tool Declarations (`lib/ai.ts`)

Two new function declarations added to Gemini's toolset:

| Tool | Purpose |
|------|---------|
| `list_devices` | List all registered devices and their status |
| `get_device_status` | Get detailed status of a specific device |
| `control_device` | (Enhanced) Send any action to a device with descriptive enum |

The `control_device` action parameter now has a comprehensive enum documenting all 25+ supported actions.

### 5. API Route Handlers (`app/api/assistant/route.ts`)

The assistant route now handles `list_devices` and `get_device_status` tool calls server-side, querying the Supabase `devices` table.

### 6. Dependency Checker (`setup.py`)

Auto-detects missing Python and Node.js dependencies. Run:
```
python setup.py
```

---

## What Files Were Modified

| File | Change |
|------|--------|
| `agents/windows-agent.ps1` | **Rewritten** — v2.0 with 25+ commands, permission tiers, volume/brightness APIs |
| `lib/action-engine.ts` | **Rewritten** — 50+ triggers, dynamic URL parsing, sensitive flag |
| `lib/ai.ts` | **Modified** — Added `list_devices`, `get_device_status` tools; enhanced `control_device` description |
| `app/api/assistant/route.ts` | **Modified** — Added handlers for `list_devices` and `get_device_status` |
| `system-controller/main.py` | **New** — Python FastAPI service for advanced OS operations |
| `setup.py` | **New** — Dependency auto-detection script |
| `voice-service/main.py` | (Unchanged, already running) |

---

## How to Use Every New Capability

### Starting All Services

```powershell
# Terminal 1: Voice TTS
python voice-service/main.py

# Terminal 2: System Controller (optional, for advanced ops)
python system-controller/main.py

# Terminal 3: Dashboard
npm run dev

# Terminal 4: Windows Agent (after registration)
.\agents\windows-agent.ps1 -ServerUrl "http://localhost:3000" -PairingToken "<token>"
```

### Voice-Controlled Device Commands

**App Management:**
- "Open Chrome" — launches Chrome
- "Open Chrome and go to youtube.com" — launches Chrome with URL
- "Open VS Code" — launches VS Code
- "Open the D.A.N.I.S.H project in VS Code" — launches VS Code in that folder (via agent)
- "Close Chrome" — closes Chrome
- "Open Spotify" / "Open Discord" / "Open Terminal"
- "Open calculator" / "Open Notepad"

**System Control:**
- "Lock my PC" / "Lock computer"
- "Shutdown PC" / "Restart computer"
- "System info" / "What are my specs"

**Volume:**
- "Mute" / "Unmute"
- "Volume up" / "Turn it up" / "Increase volume"
- "Volume down" / "Turn it down" / "Decrease volume"

**Screenshot:**
- "Take a screenshot" / "Screenshot" / "Capture screen"

**Clipboard:**
- "Copy 'hello world' to clipboard"
- "Paste from clipboard"

**Brightness:**
- "Brightness up" / "Brightness down"

**Processes:**
- "List apps" / "What apps are running"

**Websites:**
- "Open YouTube" / "Open Gmail" / "Open GitHub" / "Open Google"
- "Open reddit.com"

### Phone-to-PC Workflow

1. Speak to your phone (via browser mic)
2. Voice Engine transcribes speech to text
3. Text is sent to Gemini AI via `/api/assistant`
4. AI decides which tool to call (`list_devices` → `control_device`)
5. Command is inserted into `device_commands` table
6. PowerShell agent polls and executes the command
7. Result is acknowledged back to the server
8. Gemini gives a natural language response ("Done, Chrome is now open")
9. Response is spoken back via edge-tts

### Permission System

- **Safe commands** (volume, clipboard, app launch, system info) execute automatically
- **Sensitive commands** (shutdown, restart, screenshot, file delete) are logged with a `[SENSITIVE]` tag in the agent console
- Future enhancement: Add a confirmation prompt in the UI for sensitive commands

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Next.js)                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ HomeScreen│  │ Action Engine│  │ VoiceEngine          │  │
│  │ Launcher  │  │ (client-side)│  │ (STT + TTS + barge)  │  │
│  └────┬─────┘  └──────┬───────┘  └──────────┬───────────┘  │
│       │               │                     │              │
│       └───────┬───────┴─────────┬───────────┘              │
│               │                 │                          │
│         POST /api/assistant    Mic input                   │
└───────────────┼─────────────────┼──────────────────────────┘
                │                 │
                ▼                 ▼
┌────────────────────────────┐  ┌───────────────────────┐
│   Next.js API Routes       │  │ edge-tts (Python)      │
│                            │  │ Port 8765              │
│  /api/assistant → Gemini AI│  └───────────────────────┘
│    ├─ list_devices         │
│    ├─ get_device_status    │
│    ├─ control_device ──────┼──┐
│    ├─ create_memory        │  │
│    └─ search_memories      │  │
└────────────────────────────┘  │
                                │
┌────────────────────────────┐  │
│  Supabase (PostgreSQL)     │  │
│  ┌──────────────────┐      │  │
│  │ device_commands  │◄─────┘  │
│  │   status: queued │         │
│  └────────┬─────────┘         │
│           │                   │
│  ┌────────▼─────────┐         │
│  │ devices          │         │
│  │   status, health │         │
│  └──────────────────┘         │
└────────────────────────────┘  │
                                │
┌────────────────────────────┐  │
│  Windows (PowerShell Agent)│  │
│                            │  │
│  Poll GET /api/devices/    │  │
│       commands?device_id=  │  │
│                            │  │
│  Execute-WindowsAction     │  │
│    ├─ open_chrome          │  │
│    ├─ screenshot           │  │
│    ├─ volume_set           │  │
│    └─ ... 25+ commands     │  │
│                            │  │
│  POST /api/devices/        │  │
│       commands (ack)       │  │
└────────────────────────────┘  │
                                │
┌────────────────────────────┐  │
│  System Controller (Python)│  │
│  Port 8766                 │  │
│  ├─ screenshot_base64      │  │
│  ├─ search_files           │  │
│  ├─ read/write files       │  │
│  ├─ window management      │  │
│  └─ keyboard/mouse API     │  │
└────────────────────────────┘  │
                                │
                                ▼
                     ┌─────────────────────┐
                     │  Windows OS          │
                     │  (actual execution)  │
                     └─────────────────────┘
```
