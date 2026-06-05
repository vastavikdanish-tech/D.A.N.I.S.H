<#
.DESCRIPTION
D.A.N.I.S.H Windows Agent — Connects to the D.A.N.I.S.H server,
registers as a device, sends heartbeats, polls for commands,
and executes Windows actions.

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
Seconds between command polls. Default: 5
#>

param(
  [Parameter(Mandatory = $true)] [string]$ServerUrl,
  [Parameter(Mandatory = $false)] [string]$PairingToken = "",
  [Parameter(Mandatory = $false)] [string]$DeviceName = $env:COMPUTERNAME,
  [Parameter(Mandatory = $false)] [string]$DeviceKey = "",
  [Parameter(Mandatory = $false)] [int]$PollInterval = 5
)

$ConfigPath = Join-Path $PSScriptRoot ".agent-config.json"
$AgentVersion = "1.0.0"

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
  param(
    [string]$Method,
    [string]$Endpoint,
    [object]$Body = $null
  )

  $url = "$ServerUrl$Endpoint"
  $params = @{
    Method = $Method
    Uri = $url
    ContentType = "application/json"
    UseBasicParsing = $true
  }

  if ($Body) {
    $params.Body = ($Body | ConvertTo-Json)
  }

  try {
    $response = Invoke-RestMethod @params
    return $response
  } catch {
    Write-Log "API Error: $_"
    return $null
  }
}

function Register-Device {
  param([string]$name, [string]$pairingToken)

  Write-Log "Registering device '$name' with server..."

  $body = @{
    name = $name
    device_type = "laptop"
  }
  if ($pairingToken) {
    $body.pairing_token = $pairingToken
    Write-Log "Using pairing token for authentication."
  }

  $result = Invoke-Api -Method "POST" -Endpoint "/api/devices/register" -Body $body

  if ($result -and $result.ok) {
    Write-Log "Device registered! ID: $($result.data.id)"
    Write-Log "Pairing code: $($result.pairingCode)"
    Write-Log "Waiting for admin approval..."

    $config = @{
      deviceId = $result.data.id
      deviceKey = $result.deviceKey
      deviceName = $name
    }
    Save-Config $config
    return $config
  }

  Write-Log "Registration failed."
  return $null
}

function Send-Heartbeat {
  param([string]$deviceId, [string]$deviceKey)

  $result = Invoke-Api -Method "POST" -Endpoint "/api/devices/heartbeat" -Body @{
    device_id = $deviceId
    device_key = $deviceKey
  }

  return ($result -and $result.ok)
}

function Get-PendingCommands {
  param([string]$deviceId, [string]$deviceKey)

  $result = Invoke-Api -Method "GET" -Endpoint "/api/devices/commands?device_id=$deviceId&device_key=$deviceKey"
  if ($result -and $result.ok -and $result.data) {
    return $result.data
  }
  return @()
}

function Acknowledge-Command {
  param([string]$commandId, [string]$deviceId, [string]$deviceKey, [string]$status, [object]$result = $null)

  $body = @{
    command_id = $commandId
    device_id = $deviceId
    device_key = $deviceKey
    status = $status
  }
  if ($result) { $body.result = $result }

  return Invoke-Api -Method "POST" -Endpoint "/api/devices/commands" -Body $body
}

function Execute-WindowsAction {
  param([string]$command, [object]$payload)

  Write-Log "Executing: $command"

  switch -Wildcard ($command) {
    "open_chrome" {
      Start-Process "chrome"
      return @{ success = $true; output = "Chrome opened" }
    }
    "open_vscode" {
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
        try {
          Start-Process $payload.app -ErrorAction Stop
          return @{ success = $true; output = "App started: $($payload.app)" }
        } catch {
          return @{ success = $false; output = "Failed to start $($payload.app): $_" }
        }
      }
      return @{ success = $false; output = "No app specified" }
    }
    "lock_pc" {
      rundll32.exe user32.dll,LockWorkStation
      return @{ success = $true; output = "PC locked" }
    }
    "shutdown_pc" {
      if ($payload -and $payload.force -eq $true) {
        Stop-Computer -Force
      } else {
        Stop-Computer
      }
      return @{ success = $true; output = "Shutting down..." }
    }
    "restart_pc" {
      Restart-Computer
      return @{ success = $true; output = "Restarting..." }
    }
    "volume_mute" {
      $obj = New-Object -ComObject WScript.Shell
      $obj.SendKeys([char]173)
      return @{ success = $true; output = "Volume toggled mute" }
    }
    "volume_set" {
      if ($payload -and $payload.level -ge 0 -and $payload.level -le 100) {
        for ($i = 0; $i -lt 50; $i++) {
          $obj = New-Object -ComObject WScript.Shell
          $obj.SendKeys([char]174)
        }
        for ($i = 0; $i -lt [math]::Floor($payload.level / 2); $i++) {
          $obj = New-Object -ComObject WScript.Shell
          $obj.SendKeys([char]175)
        }
        return @{ success = $true; output = "Volume set to $($payload.level)%" }
      }
      return @{ success = $false; output = "Invalid volume level" }
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
  if ($DeviceKey) {
    Write-Log "DeviceKey provided but no config found. Run without -DeviceKey to register."
    exit 1
  }
  if (-not $PairingToken) {
    Write-Log "ERROR: -PairingToken is required for first-time registration."
    Write-Log "Generate a token from Dashboard → Remote Control → Add Device."
    Write-Log "Then run: .\windows-agent.ps1 -ServerUrl '$ServerUrl' -PairingToken '<token>' -DeviceName '$DeviceName'"
    exit 1
  }
  $config = Register-Device -name $DeviceName -pairingToken $PairingToken
  if (-not $config) {
    Write-Log "Registration failed. Exiting."
    exit 1
  }
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
    Write-Log "Command received: $($cmd.command) (ID: $($cmd.id))"
    $result = Execute-WindowsAction -command $cmd.command -payload $cmd.payload
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
