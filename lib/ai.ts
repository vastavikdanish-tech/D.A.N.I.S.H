import { z } from "zod";

export const assistantRequestSchema = z.object({
  message: z.string().min(1).max(8000),
  mode: z.enum(["assistant", "study", "career", "content", "automation"]).default("assistant")
});

export type AssistantMode = z.infer<typeof assistantRequestSchema>["mode"];

type GeminiFunctionCall = {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
};

export type AssistantToolResult = {
  call: GeminiFunctionCall;
  result: unknown;
};

type AssistantResponse =
  | { provider: "gemini"; content: string; toolCalls?: never }
  | { provider: "gemini"; toolCalls: GeminiFunctionCall[]; content?: never };

const systemPrompts: Record<AssistantMode, string> = {
  assistant: "You are D.A.N.I.S.H, a warm, emotionally aware conversational AI operating system. Speak naturally, vary short and detailed answers based on the moment, and remember useful facts about the user. Use tools proactively for durable facts, preferences, goals, and ongoing context. Check existing memories before duplicating. Assign importance (1-10) to every memory. Keep most replies concise unless the user needs depth.",
  study: "You are Study OS inside D.A.N.I.S.H. Teach clearly and automatically save key study progress or facts learned about the user.",
  career: "You are Career OS inside D.A.N.I.S.H. Help with jobs and automatically remember the user's skills and career goals.",
  content: "You are Content Factory inside D.A.N.I.S.H. Produce assets and remember the user's content style and brand voice.",
  automation: "You are Automation Engine inside D.A.N.I.S.H. Convert goals into workflows and remember user routine preferences."
};

export async function generateEmbedding(text: string) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error("Missing GEMINI_API_KEY for embeddings");
    return null;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: {
          parts: [{ text }]
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Gemini Embedding API error (${res.status}):`, errText);
      return null;
    }

    const json = await res.json();
    const values = json?.embedding?.values;
    
    if (!values || !Array.isArray(values)) {
      console.error("Gemini Embedding API returned invalid format:", json);
      return null;
    }

    console.log("[AI_LIB] Generated embedding dimensions:", values.length);
    return values;
  } catch (e) {
    console.error("Embedding generation failed:", e);
    return null;
  }
}

export async function generateAssistantResponse(
  message: string,
  mode: AssistantMode,
  memories: Array<{ category: string; title: string; body: string }> = [],
  toolResults?: AssistantToolResult[]
): Promise<AssistantResponse> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiUrl = process.env.GEMINI_API_URL;
  const envModel = process.env.GEMINI_MODEL;
  const primaryModel = envModel || "gemini-2.0-flash";
  const availableModels = [
    primaryModel,
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
  ].filter(Boolean);

  if (!geminiKey) {
    throw new Error("Gemini configuration missing: GEMINI_API_KEY is required.");
  }
  const key = geminiKey;

  const memoryContext = memories.length
    ? `Memories:\n${memories
        .map((memory) => `- [${memory.category}] ${memory.title}: ${memory.body}`)
        .join("\n")}\n\n`
    : "";

  const toolContext = toolResults?.length
    ? `Tool results:\n${toolResults
        .map((toolResult) => `- ${toolResult.call.functionCall.name}: ${JSON.stringify(toolResult.result)}`)
        .join("\n")}\n\nNow answer the user naturally. Do not mention internal tool mechanics unless it helps the user.\n\n`
    : "";

  const promptText = `${systemPrompts[mode]}\n\n${memoryContext}${toolContext}User message: ${message}`;
  console.log("[AI_LIB] Final promptText length:", promptText.length);
  // console.log("[AI_LIB] promptText:", promptText); // Optional: can be very long
  
  const contents = [
    {
      role: "user",
      parts: [{ text: promptText }]
    }
  ];

  console.log("[AI_LIB] Contents array:", JSON.stringify(contents, null, 2));

  const tools = [
    {
      function_declarations: [
        {
          name: "create_memory",
          description: "Create a new memory in the system. Use this proactively to save facts about the user.",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Short title of the memory." },
              body: { type: "STRING", description: "Detailed content of the memory." },
              category: { 
                type: "STRING", 
                enum: ["personal", "study", "relationship", "goal", "conversation", "note", "career", "preference", "project"],
                description: "Category of the memory." 
              },
              importance: { type: "INTEGER", description: "Score 1-10 of how important this memory is.", minimum: 1, maximum: 10 },
              tags: { type: "ARRAY", items: { type: "STRING" }, description: "Tags for the memory." }
            },
            required: ["title", "body", "category", "importance"]
          }
        },
        {
          name: "update_memory",
          description: "Update an existing memory. Use this when the user's information changes or to add detail.",
          parameters: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING", description: "The UUID of the memory to update." },
              title: { type: "STRING", description: "New title." },
              body: { type: "STRING", description: "New body content." },
              importance: { type: "INTEGER", description: "Updated importance score 1-10." }
            },
            required: ["id"]
          }
        },
        {
          name: "add_reminder",
          description: "Add a reminder to the system.",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "What to be reminded about." },
              body: { type: "STRING", description: "Optional details." },
              remind_at: { type: "STRING", description: "ISO 8601 timestamp for the reminder." }
            },
            required: ["title", "remind_at"]
          }
        },
        {
          name: "control_device",
          description: "Send a command to a connected device.",
          parameters: {
            type: "OBJECT",
            properties: {
              deviceId: { type: "STRING", description: "The UUID of the device." },
              action: { type: "STRING", description: "The action to perform (e.g., open_app, shutdown, lock)." },
              payload: { type: "OBJECT", description: "Optional parameters for the action." }
            },
            required: ["deviceId", "action"]
          }
        },
        {
          name: "search_memories",
          description: "Search for existing memories. Use this to find facts about the user, even if wording is different.",
          parameters: {
            type: "OBJECT",
            properties: {
              query: { type: "STRING", description: "The search term or phrase." },
              category: { 
                type: "STRING", 
                enum: ["personal", "study", "relationship", "goal", "conversation", "note", "career", "preference", "project"],
                description: "Optional category to filter by." 
              }
            },
            required: ["query"]
          }
        }
      ]
    }
  ];

  const body = {
    contents,
    ...(toolResults?.length ? {} : { tools }),
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: toolResults ? 0.7 : 0.25
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };

  function buildUrlForModel(model: string) {
    if (geminiUrl) {
      return geminiUrl.replace(/models\/[^:]+(:generateContent)?$/, `models/${model}:generateContent`);
    }
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  }

  async function callGemini(url: string): Promise<AssistantResponse> {
    const urlWithKey = new URL(url);
    urlWithKey.searchParams.set("key", key);

    const res = await fetch(urlWithKey.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const responseText = await res.text();
    if (!res.ok) {
      throw new Error(`Gemini API returned ${res.status}: ${responseText}`);
    }

    const json: {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string; functionCall?: GeminiFunctionCall["functionCall"] }>;
        };
      }>;
    } = JSON.parse(responseText);
    console.log("[AI_LIB] Gemini candidate content parts length:", json?.candidates?.[0]?.content?.parts?.length);
    const candidate = json?.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part?.functionCall && !toolResults?.length) {
      console.log("[AI_LIB] Gemini returned functionCall:", part.functionCall.name);
      return {
        provider: "gemini",
        toolCalls: candidate?.content?.parts
          ?.filter((p): p is { functionCall: GeminiFunctionCall["functionCall"] } => Boolean(p.functionCall))
          .map((p) => ({ functionCall: p.functionCall })) ?? []
      };
    }

    const text = part?.text;
    if (!text) {
      console.error("[AI_LIB] Gemini error response:", responseText);
      throw new Error(`Gemini did not return expected content. Raw response: ${responseText}`);
    }

    return { provider: "gemini", content: text };
  }

  let lastError: Error | null = null;

  for (const model of availableModels) {
    const url = buildUrlForModel(model);
    try {
      return await callGemini(url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const message = lastError.message.toLowerCase();
      console.warn(`Gemini model ${model} failed:`, lastError.message);
      if (!message.includes("429") && !message.includes("404") && !message.includes("quota")) {
        break;
      }
      console.warn(`Trying fallback Gemini model.`);
    }
  }

  throw lastError ?? new Error("Gemini request failed for all available models.");
}
