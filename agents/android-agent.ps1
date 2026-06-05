<#
.DESCRIPTION
D.A.N.I.S.H Android Agent — Connects to the D.A.N.I.S.H server via ADB.
Requires ADB (Android Debug Bridge) installed and device connected.

.SYNOPSIS
.\android-agent.ps1 -ServerUrl "https://your-server.com" -DeviceName "My Phone"

.PARAMETER ServerUrl
Base URL of the D.A.N.I.S.H server.

.PARAMETER DeviceName
Display name for this device.

.PARAMETER PollInterval
Seconds between command polls. Default: 5
#>

param(
  [Parameter(Mandatory = $true)] [string]$ServerUrl,
  [Parameter(Mandatory = $false)] [string]$DeviceName = "Android Phone",
  [Parameter(Mandatory = $false)] [int]$PollInterval = 5
)

$ConfigPath = Join-Path $PSScriptRoot ".android-agent-config.json"
$AgentVersion = "1.0.0"

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$timestamp] $Message"
}

function Get-Config {
  if (Test-Path $ConfigPath) {
    return Get-Content $ConfigPath | ConvertFrom-Json
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
  if ($Body) { $params.Body = ($Body | ConvertTo-Json) }
  try { return Invoke-RestMethod @params } catch { return $null }
}

function Register-Device {
  param([string]$name)
  $result = Invoke-Api -Method "POST" -Endpoint "/api/devices/register" -Body @{ name = $name; device_type = "phone" }
  if ($result -and $result.ok) {
    Write-Log "Device registered! ID: $($result.data.id) — Pairing code: $($result.pairingCode)"
    Write-Log "Approve this device in the D.A.N.I.S.H dashboard."
    $config = @{ deviceId = $result.data.id; deviceKey = $result.deviceKey; deviceName = $name }
    Save-Config $config
    return $config
  }
  return $null
}

function Send-Heartbeat {
  param([string]$deviceId, [string]$deviceKey)
  $result = Invoke-Api -Method "POST" -Endpoint "/api/devices/heartbeat" -Body @{ device_id = $deviceId; device_key = $deviceKey }
  return ($result -and $result.ok)
}

function Get-PendingCommands {
  param([string]$deviceId, [string]$deviceKey)
  $result = Invoke-Api -Method "GET" -Endpoint "/api/devices/commands?device_id=$deviceId&device_key=$deviceKey"
  if ($result -and $result.ok -and $result.data) { return $result.data }
  return @()
}

function Acknowledge-Command {
  param([string]$commandId, [string]$deviceId, [string]$deviceKey, [string]$status, [object]$result)
  $body = @{ command_id = $commandId; device_id = $deviceId; device_key = $deviceKey; status = $status }
  if ($result) { $body.result = $result }
  return Invoke-Api -Method "POST" -Endpoint "/api/devices/commands" -Body $body
}

function Execute-AndroidAction {
  param([string]$command, [object]$payload)
  Write-Log "Executing: $command"
  switch -Wildcard ($command) {
    "open_app" {
      if ($payload -and $payload.package) {
        adb shell monkey -p $payload.package -c android.intent.category.LAUNCHER 1
        return @{ success = $true; output = "App opened: $($payload.package)" }
      }
      return @{ success = $false; output = "No package specified" }
    }
    "open_website" {
      if ($payload -and $payload.url) {
        adb shell am start -a android.intent.action.VIEW -d $payload.url
        return @{ success = $true; output = "URL opened: $($payload.url)" }
      }
      return @{ success = $false; output = "No URL provided" }
    }
    "send_sms" {
      if ($payload -and $payload.phone -and $payload.message) {
        adb shell am start -a android.intent.action.SENDTO -d "sms:$($payload.phone)" --es sms_body "$($payload.message)" --ez exit_on_sent true
        return @{ success = $true; output = "SMS draft sent to $($payload.phone)" }
      }
      return @{ success = $false; output = "Phone and message required" }
    }
    "take_screenshot" {
      $path = "/sdcard/screenshot_$(Get-Date -Format 'yyyyMMdd_HHmmss').png"
      adb shell screencap -p $path
      return @{ success = $true; output = "Screenshot saved to $path" }
    }
    "lock_device" {
      adb shell input keyevent 26
      return @{ success = $true; output = "Device locked" }
    }
    "set_volume" {
      if ($payload -and $payload.level -ge 0 -and $payload.level -le 15) {
        adb shell media volume --set $payload.level --stream 3
        return @{ success = $true; output = "Media volume set to $($payload.level)" }
      }
      return @{ success = $false; output = "Volume level must be 0-15" }
    }
    default {
      return @{ success = $false; output = "Unknown command: $command" }
    }
  }
}

# ── Main Loop ──
Write-Log "D.A.N.I.S.H Android Agent v$AgentVersion"
Write-Log "Server: $ServerUrl"
Write-Log ""

$config = Get-Config
if (-not $config) {
  $config = Register-Device -name $DeviceName
  if (-not $config) { Write-Log "Registration failed."; exit 1 }
}

Write-Log "Connected as: $($config.deviceName) ($($config.deviceId))"
Write-Log "Polling every ${PollInterval}s..."

$heartbeatCounter = 0
while ($true) {
  $heartbeatCounter++
  $commands = Get-PendingCommands -deviceId $config.deviceId -deviceKey $config.deviceKey
  foreach ($cmd in $commands) {
    Write-Log "Command: $($cmd.command)"
    $result = Execute-AndroidAction -command $cmd.command -payload $cmd.payload
    $status = if ($result.success) { "executed" } else { "failed" }
    Acknowledge-Command -commandId $cmd.id -deviceId $config.deviceId -deviceKey $config.deviceKey -status $status -result $result
    Write-Log "  $status — $($result.output)"
  }
  if ($heartbeatCounter -ge (60 / $PollInterval)) {
    Send-Heartbeat -deviceId $config.deviceId -deviceKey $config.deviceKey | Out-Null
    $heartbeatCounter = 0
  }
  Start-Sleep -Seconds $PollInterval
}
