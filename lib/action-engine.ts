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
      return { handled: true, message: `Navigated to ${section.replace(/-/g, " ")}.` };
    }
  }

  if (isCreateReminderCommand(lower)) {
    return handleCreateReminder(command, ctx);
  }

  if (isSaveMemoryCommand(lower)) {
    return handleSaveMemory(command, ctx);
  }

  return null;
}

const navigateActions: Record<string, string> = {
  "open dashboard": "dashboard",
  "go to dashboard": "dashboard",
  "show dashboard": "dashboard",
  "open settings": "profile",
  "go to settings": "profile",
  "show settings": "profile",
  "open profile": "profile-settings",
  "go to profile": "profile-settings",
  "show profile": "profile-settings",
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
  return Object.keys(navigateActions).some((key) => lower.startsWith(key) || lower === key);
}

function parseNavigateTarget(lower: string): string | null {
  for (const [key, section] of Object.entries(navigateActions)) {
    if (lower.startsWith(key) || lower === key) return section;
  }
  return null;
}

function isCreateReminderCommand(lower: string): boolean {
  return lower.startsWith("create reminder") || lower.startsWith("add reminder") || lower.startsWith("new reminder") || lower.startsWith("remind me");
}

async function handleCreateReminder(command: string, ctx: ActionContext): Promise<ActionResult> {
  const title = command.replace(/^(create|add|new)\s+reminder\s*/i, "").replace(/^remind me\s*/i, "").trim() || "Untitled Reminder";
  try {
    const res = await ctx.authFetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const json = await res.json();
    if (json?.ok) {
      return { handled: true, message: `Reminder created: "${title}".` };
    }
    return { handled: true, message: `Failed to create reminder: ${json?.error || "Unknown error"}.` };
  } catch {
    return { handled: true, message: "Could not create reminder due to a network error." };
  }
}

function isSaveMemoryCommand(lower: string): boolean {
  return lower.startsWith("save memory") || lower.startsWith("remember") || lower.startsWith("add memory") || lower.startsWith("store memory");
}

async function handleSaveMemory(command: string, ctx: ActionContext): Promise<ActionResult> {
  const content = command.replace(/^(save|store|add)\s+memory\s*/i, "").replace(/^remember\s*/i, "").trim();
  if (!content) {
    return { handled: true, message: "What would you like me to remember?" };
  }
  const title = content.length > 80 ? content.slice(0, 80) + "..." : content;
  try {
    const res = await ctx.authFetch("/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: content,
        category: "note",
      }),
    });
    const json = await res.json();
    if (json?.ok) {
      return { handled: true, message: `Memory saved: "${title}".` };
    }
    return { handled: true, message: `Failed to save memory: ${json?.error || "Unknown error"}.` };
  } catch {
    return { handled: true, message: "Could not save memory due to a network error." };
  }
}
