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

  if (isCreateReminderCommand(lower)) {
    return handleCreateReminder(command, ctx);
  }

  if (isSaveMemoryCommand(lower)) {
    return handleSaveMemory(command, ctx);
  }

  if (hasFactsToExtract(lower)) {
    return handleExtractFacts(command, ctx);
  }

  if (isWindowsCommand(lower)) {
    return handleWindowsCommand(command, ctx);
  }

  return null;
}

const navigateActions: Record<string, string> = {
  "open dashboard": "dashboard",
  "go to dashboard": "dashboard",
  "show dashboard": "dashboard",
  "take me to dashboard": "dashboard",
  "navigate to dashboard": "dashboard",
  "open settings": "profile",
  "go to settings": "profile",
  "show settings": "profile",
  "take me to settings": "profile",
  "navigate to settings": "profile",
  "open profile": "profile-settings",
  "go to profile": "profile-settings",
  "show profile": "profile-settings",
  "take me to profile": "profile-settings",
  "open assistant": "assistant",
  "go to assistant": "assistant",
  "show assistant": "assistant",
  "open reminders": "reminders",
  "go to reminders": "reminders",
  "show reminders": "reminders",
  "open calendar": "reminders",
  "go to calendar": "reminders",
  "open automation": "automation",
  "go to automation": "automation",
  "open system": "system",
  "go to system": "system",
  "open files": "quick-access",
  "go to files": "quick-access",
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
  return lower.startsWith("create reminder") ||
    lower.startsWith("add reminder") ||
    lower.startsWith("new reminder") ||
    lower.startsWith("remind me") ||
    lower.startsWith("set a reminder") ||
    lower.startsWith("make a reminder");
}

function parseReminderTime(text: string): { title: string; remind_at?: string } {
  const timePatterns: { re: RegExp; parse: (match: RegExpMatchArray) => Date | null }[] = [
    {
      re: /in\s+(\d+)\s+minutes?\b/i,
      parse: (m) => { const d = new Date(); d.setMinutes(d.getMinutes() + parseInt(m[1])); return d; },
    },
    {
      re: /in\s+(\d+)\s+hours?\b/i,
      parse: (m) => { const d = new Date(); d.setHours(d.getHours() + parseInt(m[1])); return d; },
    },
    {
      re: /in\s+(\d+)\s+days?\b/i,
      parse: (m) => { const d = new Date(); d.setDate(d.getDate() + parseInt(m[1])); return d; },
    },
    {
      re: /tomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      parse: (m) => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        let h = parseInt(m[1]);
        const min = m[2] ? parseInt(m[2]) : 0;
        if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12;
        if (m[3]?.toLowerCase() === "am" && h === 12) h = 0;
        d.setHours(h, min, 0, 0);
        return d;
      },
    },
    {
      re: /tomorrow\b/i,
      parse: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; },
    },
    {
      re: /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      parse: (m) => {
        const d = new Date();
        let h = parseInt(m[1]);
        const min = m[2] ? parseInt(m[2]) : 0;
        if (m[3]?.toLowerCase() === "pm" && h < 12) h += 12;
        if (m[3]?.toLowerCase() === "am" && h === 12) h = 0;
        if (h < d.getHours() || (h === d.getHours() && min <= d.getMinutes())) {
          d.setDate(d.getDate() + 1);
        }
        d.setHours(h, min, 0, 0);
        return d;
      },
    },
  ];

  for (const { re, parse } of timePatterns) {
    const match = text.match(re);
    if (match) {
      const date = parse(match);
      if (date) {
        const title = text.replace(re, "").trim();
        return { title, remind_at: date.toISOString() };
      }
    }
  }

  return { title: text };
}

async function handleCreateReminder(command: string, ctx: ActionContext): Promise<ActionResult> {
  const cleaned = command.replace(/^(create|add|new|set|make)\s+a?\s*reminder\s*/i, "").replace(/^remind me\s*/i, "").trim();
  if (!cleaned) {
    return { handled: true, message: "What would you like me to remind you about?" };
  }

  const { title, remind_at } = parseReminderTime(cleaned);
  const finalTitle = title || cleaned || "Untitled Reminder";

  try {
    const res = await ctx.authFetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: finalTitle, remind_at }),
    });
    const json = await res.json();
    if (json?.ok) {
      if (remind_at) {
        return { handled: true, message: `Reminder set for ${finalTitle}.` };
      }
      return { handled: true, message: `Reminder created for ${finalTitle}.` };
    }
    return { handled: true, message: `Could not create reminder: ${json?.error || "Something went wrong."}` };
  } catch {
    return { handled: true, message: "Could not create reminder. Please try again." };
  }
}

function isSaveMemoryCommand(lower: string): boolean {
  const triggers = [
    "remember", "save memory", "add memory", "store memory",
    "remember that", "i want to remember", "note down",
  ];
  return triggers.some((t) => lower.startsWith(t));
}

async function handleSaveMemory(command: string, ctx: ActionContext): Promise<ActionResult> {
  const content = command
    .replace(/^(save|store|add)\s+memory\s*/i, "")
    .replace(/^(remember|note down)\s*(that\s*)?/i, "")
    .replace(/^i want to remember\s*/i, "")
    .trim();

  if (!content) {
    return { handled: true, message: "What would you like me to remember?" };
  }

  const title = content.length > 80 ? content.slice(0, 80) + "..." : content;
  try {
    const res = await ctx.authFetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body: content, category: "note" }),
    });
    const json = await res.json();
    if (json?.ok) {
      return { handled: true, message: "I will remember that." };
    }
    return { handled: true, message: `Could not save memory: ${json?.error || "Something went wrong."}` };
  } catch {
    return { handled: true, message: "Could not save memory. Please try again." };
  }
}

const windowsCommands: Record<string, { command: string; label: string }> = {
  "open chrome": { command: "open_chrome", label: "Chrome" },
  "launch chrome": { command: "open_chrome", label: "Chrome" },
  "start chrome": { command: "open_chrome", label: "Chrome" },
  "open vs code": { command: "open_vscode", label: "VS Code" },
  "launch vs code": { command: "open_vscode", label: "VS Code" },
  "start vs code": { command: "open_vscode", label: "VS Code" },
  "open vscode": { command: "open_vscode", label: "VS Code" },
  "open explorer": { command: "open_explorer", label: "File Explorer" },
  "open file explorer": { command: "open_explorer", label: "File Explorer" },
  "lock pc": { command: "lock_pc", label: "PC lock" },
  "lock computer": { command: "lock_pc", label: "PC lock" },
  "shutdown pc": { command: "shutdown_pc", label: "PC shutdown" },
  "shutdown computer": { command: "shutdown_pc", label: "PC shutdown" },
  "restart pc": { command: "restart_pc", label: "PC restart" },
  "restart computer": { command: "restart_pc", label: "PC restart" },
};

function isWindowsCommand(lower: string): boolean {
  return Object.keys(windowsCommands).some((key) => lower === key || lower.startsWith(key + " "));
}

function parseWindowsCommand(lower: string): { command: string; label: string; payload?: Record<string, string> } | null {
  for (const [key, cmd] of Object.entries(windowsCommands)) {
    if (lower === key) return cmd;
    if (lower.startsWith(key + " ")) {
      const rest = lower.slice(key.length).trim();
      if (cmd.command === "open_chrome" && rest) {
        return { ...cmd, payload: { url: rest } };
      }
      if (cmd.command === "open_explorer" && rest) {
        return { ...cmd, payload: { path: rest } };
      }
      return cmd;
    }
  }
  return null;
}

async function handleWindowsCommand(command: string, ctx: ActionContext): Promise<ActionResult> {
  const lower = command.toLowerCase().trim();
  const parsed = parseWindowsCommand(lower);
  if (!parsed) {
    return { handled: true, message: `Could not parse command: ${command}` };
  }

  const payload: Record<string, string> = {};
  if (parsed.payload?.url) payload.url = parsed.payload.url;
  if (parsed.payload?.path) payload.path = parsed.payload.path;

  try {
    const res = await ctx.authFetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_type: "laptop",
        action: parsed.command,
        payload,
      }),
    });
    const json = await res.json();
    if (json?.ok) {
      return { handled: true, message: `Command sent: ${parsed.label}.` };
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
  if (isCreateReminderCommand(lower) || isNavigateCommand(lower) || isWindowsCommand(lower)) return false;
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
      const res = await ctx.authFetch("/api/memories/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fact),
      });
      const json = await res.json();
      if (json?.ok) saved++;
    } catch { /* skip */ }
  }

  if (saved > 0) {
    return { handled: true, message: `I'll remember that${saved > 1 ? ` (${saved} things)` : ""}.` };
  }
  return { handled: false, message: command };
}
