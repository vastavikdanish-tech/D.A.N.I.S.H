export type ActionResult = {
  handled: boolean;
  message: string;
};

export type ActionContext = {
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  navigate?: (sectionId: string) => void;
};

export async function executeAction(command: string, ctx: ActionContext): Promise<ActionResult | null> {
  const lower = command.toLowerCase().trim();

  if (isNavigateCommand(lower)) {
    const section = parseNavigateTarget(lower);
    if (section) {
      ctx.navigate?.(section);
      return { handled: true, message: `Opening ${section.replace(/-/g, " ")}.` };
    }
  }

  if (isCreateReminderCommand(lower)) return handleCreateReminder(command, ctx);
  if (isSaveMemoryCommand(lower)) return handleSaveMemory(command, ctx);
  if (hasFactsToExtract(lower)) return handleExtractFacts(command, ctx);
  if (isDeviceCommand(lower)) return handleDeviceCommand(command, ctx);

  return null;
}

const navigateActions: Record<string, string> = {
  "open dashboard": "dashboard", "go to dashboard": "dashboard", "show dashboard": "dashboard",
  "take me to dashboard": "dashboard", "navigate to dashboard": "dashboard",
  "open settings": "profile", "go to settings": "profile", "show settings": "profile",
  "take me to settings": "profile", "navigate to settings": "profile",
  "open profile": "profile-settings", "go to profile": "profile-settings", "show profile": "profile-settings",
  "open assistant": "assistant", "go to assistant": "assistant", "show assistant": "assistant",
  "open reminders": "reminders", "go to reminders": "reminders", "show reminders": "reminders",
  "open calendar": "reminders", "go to calendar": "reminders",
  "open automation": "automation", "go to automation": "automation",
  "open memory": "memory", "go to memory": "memory",
  "open devices": "devices", "go to devices": "devices",
  "open study": "study", "go to study": "study",
  "open career": "career", "go to career": "career",
  "open health": "health", "go to health": "health",
};

function isNavigateCommand(lower: string): boolean {
  return Object.keys(navigateActions).some((key) => lower === key || lower.startsWith(key + " "));
}

function parseNavigateTarget(lower: string): string | null {
  for (const [key, section] of Object.entries(navigateActions)) {
    if (lower === key || lower.startsWith(key + " ")) return section;
  }
  return null;
}

function isCreateReminderCommand(lower: string): boolean {
  return lower.startsWith("create reminder") || lower.startsWith("add reminder") ||
    lower.startsWith("new reminder") || lower.startsWith("remind me") ||
    lower.startsWith("set a reminder") || lower.startsWith("make a reminder");
}

function parseReminderTime(text: string): { title: string; remind_at?: string } {
  const timePatterns: { re: RegExp; parse: (match: RegExpMatchArray) => Date | null }[] = [
    { re: /in\s+(\d+)\s+minutes?\b/i, parse: (m) => { const d = new Date(); d.setMinutes(d.getMinutes() + parseInt(m[1])); return d; } },
    { re: /in\s+(\d+)\s+hours?\b/i, parse: (m) => { const d = new Date(); d.setHours(d.getHours() + parseInt(m[1])); return d; } },
    { re: /in\s+(\d+)\s+days?\b/i, parse: (m) => { const d = new Date(); d.setDate(d.getDate() + parseInt(m[1])); return d; } },
    { re: /tomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i, parse: (m) => {
      const d = new Date(); d.setDate(d.getDate() + 1);
      let h = parseInt(m[1]); const min = m[2] ? parseInt(m[2]) : 0;
      if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12; if (m[3]?.toLowerCase() === "am" && h === 12) h = 0;
      d.setHours(h, min, 0, 0); return d;
    }},
    { re: /tomorrow\b/i, parse: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; }},
    { re: /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i, parse: (m) => {
      const d = new Date(); let h = parseInt(m[1]); const min = m[2] ? parseInt(m[2]) : 0;
      if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12; if (m[3]?.toLowerCase() === "am" && h === 12) h = 0;
      if (h < d.getHours() || (h === d.getHours() && min <= d.getMinutes())) d.setDate(d.getDate() + 1);
      d.setHours(h, min, 0, 0); return d;
    }},
  ];
  for (const { re, parse } of timePatterns) {
    const match = text.match(re);
    if (match) { const date = parse(match); if (date) { return { title: text.replace(re, "").trim(), remind_at: date.toISOString() }; } }
  }
  return { title: text };
}

async function handleCreateReminder(command: string, ctx: ActionContext): Promise<ActionResult> {
  const cleaned = command.replace(/^(create|add|new|set|make)\s+a?\s*reminder\s*/i, "").replace(/^remind me\s*/i, "").trim();
  if (!cleaned) return { handled: true, message: "What would you like me to remind you about?" };
  const { title, remind_at } = parseReminderTime(cleaned);
  try {
    const res = await ctx.authFetch("/api/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title || cleaned, remind_at }) });
    const json = await res.json();
    if (json?.ok) return { handled: true, message: remind_at ? `Reminder set for ${title}.` : `Reminder created for ${title}.` };
    return { handled: true, message: `Could not create reminder: ${json?.error || "Something went wrong."}` };
  } catch { return { handled: true, message: "Could not create reminder." }; }
}

function isSaveMemoryCommand(lower: string): boolean {
  return ["remember", "save memory", "add memory", "store memory", "remember that", "i want to remember", "note down"].some((t) => lower.startsWith(t));
}

async function handleSaveMemory(command: string, ctx: ActionContext): Promise<ActionResult> {
  const content = command.replace(/^(save|store|add)\s+memory\s*/i, "").replace(/^(remember|note down)\s*(that\s*)?/i, "").replace(/^i want to remember\s*/i, "").trim();
  if (!content) return { handled: true, message: "What would you like me to remember?" };
  try {
    const res = await ctx.authFetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: content.length > 80 ? content.slice(0, 80) + "..." : content, body: content, category: "note" }) });
    const json = await res.json();
    if (json?.ok) return { handled: true, message: "I will remember that." };
    return { handled: true, message: `Could not save memory: ${json?.error || "Something went wrong."}` };
  } catch { return { handled: true, message: "Could not save memory." }; }
}

// ── Device Commands (client-side triggers) ──

type DeviceAction = { command: string; label: string; sensitive?: boolean; payload?: Record<string, string> };

const deviceActions: Record<string, DeviceAction> = {
  // Browsers / Apps
  "open chrome": { command: "open_chrome", label: "Chrome" },
  "launch chrome": { command: "open_chrome", label: "Chrome" },
  "start chrome": { command: "open_chrome", label: "Chrome" },
  "open vs code": { command: "open_vscode", label: "VS Code" },
  "launch vs code": { command: "open_vscode", label: "VS Code" },
  "start vs code": { command: "open_vscode", label: "VS Code" },
  "open vscode": { command: "open_vscode", label: "VS Code" },
  "open code": { command: "open_vscode", label: "VS Code" },
  "open explorer": { command: "open_explorer", label: "File Explorer" },
  "open file explorer": { command: "open_explorer", label: "File Explorer" },
  "open this pc": { command: "open_explorer", label: "File Explorer" },
  "close chrome": { command: "close_app", label: "Chrome", payload: { app: "chrome" } },
  "close vs code": { command: "close_app", label: "VS Code", payload: { app: "code" } },
  "close vscode": { command: "close_app", label: "VS Code", payload: { app: "code" } },
  "close explorer": { command: "close_app", label: "Explorer", payload: { app: "explorer" } },
  "open spotify": { command: "open_app", label: "Spotify", payload: { app: "spotify" } },
  "open discord": { command: "open_app", label: "Discord", payload: { app: "discord" } },
  "open terminal": { command: "open_app", label: "Terminal", payload: { app: "wt" } },
  "open cmd": { command: "open_app", label: "Command Prompt", payload: { app: "cmd" } },
  "open notepad": { command: "open_app", label: "Notepad", payload: { app: "notepad" } },
  "open calculator": { command: "open_app", label: "Calculator", payload: { app: "calc" } },
  // System
  "lock pc": { command: "lock_pc", label: "PC lock", sensitive: true },
  "lock computer": { command: "lock_pc", label: "PC lock", sensitive: true },
  "shutdown pc": { command: "shutdown_pc", label: "PC shutdown", sensitive: true },
  "shutdown computer": { command: "shutdown_pc", label: "PC shutdown", sensitive: true },
  "restart pc": { command: "restart_pc", label: "PC restart", sensitive: true },
  "restart computer": { command: "restart_pc", label: "PC restart", sensitive: true },
  "system info": { command: "system_info", label: "System Info" },
  "pc info": { command: "system_info", label: "System Info" },
  "what are my specs": { command: "system_info", label: "System Info" },
  // Volume
  "mute": { command: "volume_mute", label: "Mute" },
  "mute volume": { command: "volume_mute", label: "Mute" },
  "unmute": { command: "volume_mute", label: "Unmute" },
  "unmute volume": { command: "volume_mute", label: "Unmute" },
  "volume up": { command: "volume_up", label: "Volume Up" },
  "increase volume": { command: "volume_up", label: "Volume Up" },
  "turn it up": { command: "volume_up", label: "Volume Up" },
  "volume down": { command: "volume_down", label: "Volume Down" },
  "decrease volume": { command: "volume_down", label: "Volume Down" },
  "turn it down": { command: "volume_down", label: "Volume Down" },
  // Screenshot
  "take a screenshot": { command: "screenshot", label: "Screenshot", sensitive: true },
  "screenshot": { command: "screenshot", label: "Screenshot", sensitive: true },
  "capture screen": { command: "screenshot", label: "Screenshot", sensitive: true },
  // Clipboard
  "copy to clipboard": { command: "clipboard_copy", label: "Clipboard Copy" },
  "paste from clipboard": { command: "clipboard_paste", label: "Clipboard Paste" },
  // Brightness
  "brightness up": { command: "brightness_set", label: "Brightness", payload: { level: "80" } },
  "brightness down": { command: "brightness_set", label: "Brightness", payload: { level: "30" } },
  // Processes
  "list apps": { command: "list_apps", label: "List Apps" },
  "list processes": { command: "list_apps", label: "List Processes" },
  "what apps are running": { command: "list_apps", label: "Running Apps" },
  // Website
  "open youtube": { command: "open_website", label: "YouTube", payload: { url: "https://youtube.com" } },
  "open gmail": { command: "open_website", label: "Gmail", payload: { url: "https://mail.google.com" } },
  "open github": { command: "open_website", label: "GitHub", payload: { url: "https://github.com" } },
  "open google": { command: "open_website", label: "Google", payload: { url: "https://google.com" } },
  "open reddit": { command: "open_website", label: "Reddit", payload: { url: "https://reddit.com" } },
};

function isDeviceCommand(lower: string): boolean {
  return Object.keys(deviceActions).some((key) => lower === key || lower.startsWith(key + " "));
}

function parseDeviceCommand(lower: string): { action: DeviceAction; rest: string } | null {
  for (const [key, action] of Object.entries(deviceActions)) {
    if (lower === key) return { action, rest: "" };
    if (lower.startsWith(key + " ")) return { action, rest: lower.slice(key.length).trim() };
  }
  return null;
}

async function handleDeviceCommand(command: string, ctx: ActionContext): Promise<ActionResult> {
  const lower = command.toLowerCase().trim();
  const parsed = parseDeviceCommand(lower);
  if (!parsed) return { handled: true, message: `Could not parse: ${command}` };

  const { action, rest } = parsed;
  const payload: Record<string, string> = { ...action.payload };

  // Handle dynamic URL/path
  if (rest) {
    if (action.command === "open_chrome") payload.url = rest;
    else if (action.command === "open_app") payload.app = rest;
    else if (action.command === "open_website") {
      payload.url = rest.startsWith("http") ? rest : `https://${rest}`;
    }
    else if (action.command === "open_explorer") payload.path = rest;
    else if (action.command === "close_app") payload.app = rest;
    else if (action.command === "clipboard_copy") payload.text = rest;
    else if (action.command === "keyboard_type") payload.text = rest;
    else if (action.command === "brightness_set") payload.level = rest;
    else if (action.command === "volume_set") payload.level = rest;
  }

  try {
    const res = await ctx.authFetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_type: "laptop", action: action.command, payload }),
    });
    const json = await res.json();
    if (json?.ok) {
      const warning = action.sensitive ? " (sensitive command)" : "";
      return { handled: true, message: `${action.label} command sent.${warning}` };
    }
    return { handled: true, message: `Could not send command: ${json?.error || "Unknown error"}` };
  } catch {
    return { handled: true, message: "Could not send command due to network error." };
  }
}

const factPatterns = [
  /i (?:like|love|enjoy|prefer|hate|dislike) /i,
  /my (?:name|favorite|age|job|work|email|phone|address|birthday|goal|hobby) /i,
  /i (?:am|work|study|live|have|want|need|wish|hope) /i,
  /i (?:don't|do not|can't|cannot) /i,
  /remember (?:that )?(?:i|my|we) /i,
];

function hasFactsToExtract(lower: string): boolean {
  if (isCreateReminderCommand(lower) || isNavigateCommand(lower) || isDeviceCommand(lower)) return false;
  return factPatterns.some((p) => p.test(lower));
}

async function handleExtractFacts(command: string, ctx: ActionContext): Promise<ActionResult> {
  const lower = command.toLowerCase().trim();
  const clearPrefix = lower.replace(/^(remember that |remember |save that |save )/i, "");
  const { extractFacts } = await import("@/lib/memory-utils");
  const facts = extractFacts(clearPrefix);
  if (facts.length === 0) return { handled: true, message: "Noted." };
  let saved = 0;
  for (const fact of facts) {
    try {
      const res = await ctx.authFetch("/api/memories/facts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fact) });
      if ((await res.json())?.ok) saved++;
    } catch { /* skip */ }
  }
  if (saved > 0) return { handled: true, message: `I'll remember that${saved > 1 ? ` (${saved} things)` : ""}.` };
  return { handled: false, message: command };
}
