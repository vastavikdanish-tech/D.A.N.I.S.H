<#
.DESCRIPTION
D.A.N.I.S.H Windows Agent v2.0 — Full device control with permission system.
Connects to the D.A.N.I.S.H server, registers as a device, sends heartbeats,
polls for commands, and executes Windows actions with safe/sensitive tiers.

.SYNOPSIS
.\windows-agent.ps1 -ServerUrl "https://your-server.com" -PairingToken "TOKEN" -DeviceName "My PC"

.PARAMETER ServerUrl
Base URL of the D.A.N.I.S.H server.

.PARAMETER PairingToken
Required for first run. Generate from Dashboard → Remote Control → Add Device.

.PARAMETER DeviceName
Display name for this device.

.PARAMETER DeviceKey
Optional. If provided, skips registration and uses stored key.

.PARAMETER PollInterval
Seconds between command polls. Default: 3
#>

param(
  [Parameter(Mandatory = $true)] [string]$ServerUrl,
  [Parameter(Mandatory = $false)] [string]$PairingToken = "",
  [Parameter(Mandatory = $false)] [string]$DeviceName = $env:COMPUTERNAME,
  [Parameter(Mandatory = $false)] [string]$DeviceKey = "",
  [Parameter(Mandatory = $false)] [int]$PollInterval = 3
)

$ConfigPath = Join-Path $PSScriptRoot ".agent-config.json"
$AgentVersion = "2.0.0"

# ── Permission Tiers ──
$SAFE_COMMANDS = @(
  "open_chrome", "open_vscode", "open_explorer", "open_website", "open_app",
  "close_app", "volume_mute", "volume_set", "volume_up", "volume_down",
  "clipboard_copy", "clipboard_paste", "system_info", "list_apps"
)
$SENSITIVE_COMMANDS = @(
  "shutdown_pc", "restart_pc", "lock_pc", "screenshot", "file_delete",
  "file_move", "file_copy", "mouse_move", "mouse_click", "keyboard_type",
  "brightness_set", "process_kill", "toggle_wifi"
)

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$timestamp] $Message"
}

function Get-AuthToken {
  if (Test-Path $ConfigPath) {
    $config = Get-Content $ConfigPath | ConvertFrom-Json
    return $config
  }
  return $null
}

function Save-Config {
  param($config)
  $config | ConvertTo-Json | Set-Content $ConfigPath
}

function Invoke-Api {
  param([string]$Method, [string]$Endpoint, [object]$Body = $null)
  $url = "$ServerUrl$Endpoint"
  $params = @{ Method = $Method; Uri = $url; ContentType = "application/json"; UseBasicParsing = $true }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }
  try { return Invoke-RestMethod @params }
  catch { Write-Log "API Error: $_"; return $null }
}

function Register-Device {
  param([string]$name, [string]$pairingToken)
  Write-Log "Registering device '$name' with server..."
  $body = @{ name = $name; device_type = "laptop" }
  if ($pairingToken) { $body.pairing_token = $pairingToken }
  $result = Invoke-Api -Method "POST" -Endpoint "/api/devices/register" -Body $body
  if ($result -and $result.ok) {
    Write-Log "Device registered! ID: $($result.data.id)"
    $config = @{ deviceId = $result.data.id; deviceKey = $result.deviceKey; deviceName = $name }
    Save-Config $config
    return $config
  }
  Write-Log "Registration failed."
  return $null
}

function Send-Heartbeat {
  param([string]$deviceId, [string]$deviceKey)
  return (Invoke-Api -Method "POST" -Endpoint "/api/devices/heartbeat" -Body @{ device_id = $deviceId; device_key = $deviceKey }).ok
}

function Get-PendingCommands {
  param([string]$deviceId, [string]$deviceKey)
  $result = Invoke-Api -Method "GET" -Endpoint "/api/devices/commands?device_id=$deviceId&device_key=$deviceKey"
  if ($result -and $result.ok -and $result.data) { return $result.data }
  return @()
}

function Acknowledge-Command {
  param([string]$commandId, [string]$deviceId, [string]$deviceKey, [string]$status, [object]$result = $null)
  $body = @{ command_id = $commandId; device_id = $deviceId; device_key = $deviceKey; status = $status }
  if ($result) { $body.result = $result }
  return Invoke-Api -Method "POST" -Endpoint "/api/devices/commands" -Body $body
}

function Get-VolumeLevel {
  try {
    $sink = Get-CimInstance -Namespace "root/audio" -Class "Win32_SoundDevice" -ErrorAction Stop
    $obj = New-Object -ComObject "WMPlayer.OCX"
    $settings = $obj.settings
    return [math]::Round($settings.volume)
  } catch {
    return $null
  }
}

function Set-VolumeLevel {
  param([int]$Level)
  try {
    $obj = New-Object -ComObject "WMPlayer.OCX"
    $obj.settings.volume = [math]::Max(0, [math]::Min(100, $Level))
    return $true
  } catch {
    for ($i = 0; $i -lt 50; $i++) {
      $shell = New-Object -ComObject WScript.Shell; $shell.SendKeys([char]174)
    }
    for ($i = 0; $i -lt [math]::Floor($Level / 2); $i++) {
      $shell = New-Object -ComObject WScript.Shell; $shell.SendKeys([char]175)
    }
    return $true
  }
}

function Get-Brightness {
  try {
    $monitor = Get-CimInstance -Namespace "root/wmi" -Class "WmiMonitorBrightness" -ErrorAction Stop
    return $monitor.CurrentBrightness
  } catch { return $null }
}

function Set-Brightness {
  param([int]$Level)
  try {
    $monitor = Get-CimInstance -Namespace "root/wmi" -Class "WmiMonitorBrightnessMethods" -ErrorAction Stop
    $monitor.WmiSetBrightness(1, [math]::Max(0, [math]::Min(100, $Level)))
    return $true
  } catch {
    # Fallback: use power profile
    $percent = [math]::Max(0, [math]::Min(100, $Level))
    $guid = if ($percent -le 50) { "a1841308-3541-4fab-bc81-f71556f20b4a" } else { "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" }
    powercfg /setacvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOBRIGHTNESS $percent 2>$null
    powercfg /setdcvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOBRIGHTNESS $percent 2>$null
    powercfg /setactive SCHEME_CURRENT 2>$null
    return $true
  }
}

function Take-Screenshot {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen
  $bounds = $screen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
  $graphics.Dispose()
  $tempPath = Join-Path $env:TEMP "danish_screenshot.png"
  $bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  return $tempPath
}

function Execute-WindowsAction {
  param([string]$command, [object]$payload)

  Write-Log "Executing: $command"

  # ── Permission check ──
  if ($SENSITIVE_COMMANDS -contains $command) {
    Write-Log "[SENSITIVE] $command requires approval"
  }

  switch -Wildcard ($command) {
    # ── App Management ──
    "open_chrome" {
      if ($payload -and $payload.url) {
        Start-Process "chrome" -ArgumentList "--new-window `"$($payload.url)`""
        return @{ success = $true; output = "Chrome opened with URL: $($payload.url)" }
      }
      Start-Process "chrome"
      return @{ success = $true; output = "Chrome opened" }
    }
    "open_vscode" {
      if ($payload -and $payload.path) {
        Start-Process "code" -ArgumentList "`"$($payload.path)`""
        return @{ success = $true; output = "VS Code opened: $($payload.path)" }
      }
      Start-Process "code"
      return @{ success = $true; output = "VS Code opened" }
    }
    "open_explorer" {
      $path = if ($payload -and $payload.path) { $payload.path } else { $env:USERPROFILE }
      Start-Process "explorer" -ArgumentList "`"$path`""
      return @{ success = $true; output = "Explorer opened: $path" }
    }
    "open_website" {
      if ($payload -and $payload.url) {
        Start-Process $payload.url
        return @{ success = $true; output = "Website opened: $($payload.url)" }
      }
      return @{ success = $false; output = "No URL provided" }
    }
    "open_app" {
      if ($payload -and $payload.app) {
        try { Start-Process $payload.app -ErrorAction Stop; return @{ success = $true; output = "App started: $($payload.app)" } }
        catch { return @{ success = $false; output = "Failed: $($payload.app): $_" } }
      }
      return @{ success = $false; output = "No app specified" }
    }
    "close_app" {
      if ($payload -and $payload.app) {
        try { Stop-Process -Name $payload.app -Force -ErrorAction Stop; return @{ success = $true; output = "Closed: $($payload.app)" } }
        catch { return @{ success = $false; output = "Failed to close $($payload.app): $_" } }
      }
      return @{ success = $false; output = "No app specified" }
    }

    # ── System ──
    "lock_pc" {
      rundll32.exe user32.dll,LockWorkStation
      return @{ success = $true; output = "PC locked" }
    }
    "shutdown_pc" {
      if ($payload -and $payload.force -eq $true) { Stop-Computer -Force }
      else { Stop-Computer }
      return @{ success = $true; output = "Shutting down..." }
    }
    "restart_pc" {
      Restart-Computer
      return @{ success = $true; output = "Restarting..." }
    }
    "system_info" {
      $os = Get-CimInstance Win32_OperatingSystem
      $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
      $ram = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
      $free = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
      $disk = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, @{N="FreeGB";E={[math]::Round($_.FreeSpace/1GB,1)}}, @{N="TotalGB";E={[math]::Round($_.Size/1GB,1)}}
      return @{ success = $true; output = @{
        os = $os.Caption; version = $os.Version; cpu = $cpu.Name; ram_total_gb = $ram; ram_free_gb = $free
        disks = $disk | ForEach-Object { "$($_.DeviceID) $($_.FreeGB)/$($_.TotalGB)GB free" }
        uptime_days = [math]::Round((Get-Date) - $os.LastBootUpTime | Select-Object -ExpandProperty TotalDays)
      }}
    }

    # ── Volume ──
    "volume_mute" {
      $shell = New-Object -ComObject WScript.Shell; $shell.SendKeys([char]173)
      return @{ success = $true; output = "Volume toggled mute" }
    }
    "volume_set" {
      if ($payload -and $payload.level -ge 0 -and $payload.level -le 100) {
        Set-VolumeLevel -Level $payload.level
        return @{ success = $true; output = "Volume set to $($payload.level)%" }
      }
      return @{ success = $false; output = "Invalid volume level" }
    }
    "volume_up" {
      $current = Get-VolumeLevel
      $new = [math]::Min(100, ($current ?? 50) + 10)
      Set-VolumeLevel -Level $new
      return @{ success = $true; output = "Volume increased to ${new}%" }
    }
    "volume_down" {
      $current = Get-VolumeLevel
      $new = [math]::Max(0, ($current ?? 50) - 10)
      Set-VolumeLevel -Level $new
      return @{ success = $true; output = "Volume decreased to ${new}%" }
    }

    # ── Brightness ──
    "brightness_set" {
      if ($payload -and $payload.level -ge 0 -and $payload.level -le 100) {
        Set-Brightness -Level $payload.level
        return @{ success = $true; output = "Brightness set to $($payload.level)%" }
      }
      return @{ success = $false; output = "Invalid brightness level" }
    }

    # ── Clipboard ──
    "clipboard_copy" {
      if ($payload -and $payload.text) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Clipboard]::SetText($payload.text)
        return @{ success = $true; output = "Copied to clipboard" }
      }
      return @{ success = $false; output = "No text to copy" }
    }
    "clipboard_paste" {
      Add-Type -AssemblyName System.Windows.Forms
      $text = [System.Windows.Forms.Clipboard]::GetText()
      if ($text) {
        $shell = New-Object -ComObject WScript.Shell
        $shell.SendKeys($text)
        return @{ success = $true; output = "Pasted $($text.Length) characters" }
      }
      return @{ success = $false; output = "Clipboard is empty" }
    }

    # ── Screenshot ──
    "screenshot" {
      try {
        $path = Take-Screenshot
        if (Test-Path $path) {
          return @{ success = $true; output = "Screenshot saved: $path"; filePath = $path }
        }
        return @{ success = $false; output = "Screenshot failed" }
      } catch {
        return @{ success = $false; output = "Screenshot error: $_" }
      }
    }

    # ── File Operations ──
    "file_delete" {
      if ($payload -and $payload.path) {
        try { Remove-Item -Path $payload.path -Force -Recurse -ErrorAction Stop; return @{ success = $true; output = "Deleted: $($payload.path)" } }
        catch { return @{ success = $false; output = "Delete failed: $_" } }
      }
      return @{ success = $false; output = "No path specified" }
    }
    "file_move" {
      if ($payload -and $payload.source -and $payload.destination) {
        try { Move-Item -Path $payload.source -Destination $payload.destination -Force -ErrorAction Stop; return @{ success = $true; output = "Moved to: $($payload.destination)" } }
        catch { return @{ success = $false; output = "Move failed: $_" } }
      }
      return @{ success = $false; output = "Source/destination required" }
    }
    "file_copy" {
      if ($payload -and $payload.source -and $payload.destination) {
        try { Copy-Item -Path $payload.source -Destination $payload.destination -Force -Recurse -ErrorAction Stop; return @{ success = $true; output = "Copied to: $($payload.destination)" } }
        catch { return @{ success = $false; output = "Copy failed: $_" } }
      }
      return @{ success = $false; output = "Source/destination required" }
    }

    # ── Process ──
    "list_apps" {
      $processes = Get-Process | Where-Object { $_.MainWindowTitle -or -not $_.HasExited } | Sort-Object CPU -Descending | Select-Object -First 20 Name, Id, @{N="CPU";E={[math]::Round($_.CPU,1)}}, @{N="MB";E={[math]::Round($_.WorkingSet64/1MB,1)}}
      return @{ success = $true; output = ($processes | Format-Table Name, Id, CPU, MB -AutoSize | Out-String) }
    }
    "process_kill" {
      if ($payload -and $payload.name) {
        try { Stop-Process -Name $payload.name -Force -ErrorAction Stop; return @{ success = $true; output = "Terminated: $($payload.name)" } }
        catch { return @{ success = $false; output = "Failed: $($payload.name): $_" } }
      }
      return @{ success = $false; output = "No process name" }
    }

    # ── Mouse ──
    "mouse_move" {
      if ($payload -and $payload.x -ne $null -and $payload.y -ne $null) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point $payload.x, $payload.y
        return @{ success = $true; output = "Mouse moved to ($($payload.x), $($payload.y))" }
      }
      return @{ success = $false; output = "x/y coordinates required" }
    }
    "mouse_click" {
      Add-Type -AssemblyName System.Windows.Forms
      $btn = if ($payload -and $payload.button -eq "right") { [System.Windows.Forms.MouseButtons]::Right } else { [System.Windows.Forms.MouseButtons]::Left }
      [System.Windows.Forms.Cursor]::Click($btn)
      return @{ success = $true; output = "Mouse clicked $($payload.button ?? 'left')" }
    }

    # ── Keyboard ──
    "keyboard_type" {
      if ($payload -and $payload.text) {
        $shell = New-Object -ComObject WScript.Shell
        $shell.SendKeys($payload.text)
        return @{ success = $true; output = "Typed: $($payload.text)" }
      }
      return @{ success = $false; output = "No text to type" }
    }

    # ── Network ──
    "toggle_wifi" {
      try {
        $adapter = Get-CimInstance -ClassName Win32_NetworkAdapter | Where-Object { $_.Name -match "Wi-Fi|Wireless|WLAN" } | Select-Object -First 1
        if ($adapter) {
          if ($adapter.NetEnabled) { Disable-NetAdapter -Name $adapter.Name -Confirm:$false } else { Enable-NetAdapter -Name $adapter.Name -Confirm:$false }
          return @{ success = $true; output = "Wi-Fi toggled" }
        }
        return @{ success = $false; output = "No Wi-Fi adapter found" }
      } catch { return @{ success = $false; output = "Wi-Fi toggle failed: $_" } }
    }

    default {
      Write-Log "Unknown command: $command"
      return @{ success = $false; output = "Unknown command: $command" }
    }
  }
}

# ── Main Loop ──
Write-Log "D.A.N.I.S.H Windows Agent v$AgentVersion"
Write-Log "Server: $ServerUrl"
Write-Log ""

$config = Get-AuthToken

if (-not $config) {
  if ($DeviceKey) { Write-Log "DeviceKey provided but no config found."; exit 1 }
  if (-not $PairingToken) {
    Write-Log "ERROR: -PairingToken is required for first registration."
    Write-Log "Run: .\windows-agent.ps1 -ServerUrl '$ServerUrl' -PairingToken '<token>' -DeviceName '$DeviceName'"
    exit 1
  }
  $config = Register-Device -name $DeviceName -pairingToken $PairingToken
  if (-not $config) { Write-Log "Registration failed."; exit 1 }
}

$deviceId = $config.deviceId
$deviceKey = $config.deviceKey

Write-Log "Connected as: $($config.deviceName) ($deviceId)"
Write-Log "Polling every ${PollInterval}s for commands..."
Write-Log ""

$heartbeatCounter = 0

while ($true) {
  $heartbeatCounter++
  $commands = Get-PendingCommands -deviceId $deviceId -deviceKey $deviceKey

  foreach ($cmd in $commands) {
    $cmdName = $cmd.command
    $isSensitive = $SENSITIVE_COMMANDS -contains $cmdName

    if ($isSensitive) {
      Write-Log "[SENSITIVE] $cmdName — executing (ID: $($cmd.id))"
    } else {
      Write-Log "Command received: $cmdName (ID: $($cmd.id))"
    }

    $result = Execute-WindowsAction -command $cmdName -payload $cmd.payload
    $status = if ($result.success) { "executed" } else { "failed" }
    Acknowledge-Command -commandId $cmd.id -deviceId $deviceId -deviceKey $deviceKey -status $status -result $result
    Write-Log "  Result: $status — $($result.output)"
  }

  if ($heartbeatCounter -ge (60 / $PollInterval)) {
    Send-Heartbeat -deviceId $deviceId -deviceKey $deviceKey | Out-Null
    $heartbeatCounter = 0
  }

  Start-Sleep -Seconds $PollInterval
}
