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

type GeminiPart = {
  text?: string;
  functionCall?: GeminiFunctionCall["functionCall"];
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
  safetyRatings?: unknown;
};

type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: unknown;
  };
  modelVersion?: string;
  usageMetadata?: unknown;
};

export type AssistantToolResult = {
  call: GeminiFunctionCall;
  result: unknown;
};

type AssistantResponse =
  | { provider: "gemini"; content: string; toolCalls?: never }
  | { provider: "gemini"; toolCalls: GeminiFunctionCall[]; content?: never };

type AssistantLanguage = "hindi" | "hinglish" | "english";

const systemPrompts: Record<AssistantMode, string> = {
  assistant: "You are D.A.N.I.S.H, a warm, emotionally aware conversational AI operating system. IMPORTANT: Everything you write will be spoken aloud to the user via text-to-speech. You are a VOICE assistant, not a text-only AI. Speak naturally, use conversational language, avoid markdown, bullet points, code blocks, or any formatting — write in plain spoken sentences. Vary short and detailed answers based on the moment, and remember useful facts about the user. Use tools proactively for durable facts, preferences, goals, and ongoing context. Check existing memories before duplicating. Assign importance (1-10) to every memory. Keep most replies concise unless the user needs depth.",
  study: "You are Study OS inside D.A.N.I.S.H. Teach clearly and automatically save key study progress or facts learned about the user.",
  career: "You are Career OS inside D.A.N.I.S.H. Help with jobs and automatically remember the user's skills and career goals.",
  content: "You are Content Factory inside D.A.N.I.S.H. Produce assets and remember the user's content style and brand voice.",
  automation: "You are Automation Engine inside D.A.N.I.S.H. Convert goals into workflows and remember user routine preferences."
};

function detectAssistantLanguage(text: string): AssistantLanguage {
  const normalized = text.toLowerCase();
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasDevanagari) return "hindi";

  const hinglishWords = normalized.match(/\b(kya|kaise|kaisa|kaisi|kyu|kyun|nahi|nahin|haan|han|hai|hain|ho|hu|hun|mera|meri|mere|mujhe|tum|aap|apna|batao|bata|karna|karo|chahiye|acha|achha|theek|thik|yaar|bhai|kal|aaj|abhi|wala|wali|matlab)\b/g) ?? [];
  if (hinglishWords.length >= 2) return "hinglish";

  return "english";
}

function getLanguageInstruction(language: AssistantLanguage) {
  if (language === "english") {
    return `
LANGUAGE RULES:

You are D.A.N.I.S.H.

Always reply in fluent English.

Only use Hindi or Hinglish when the user writes in Hindi or Hinglish.

Do not force Devanagari script replies.
`;
  }

  if (language === "hinglish") {
    return `
LANGUAGE RULES:

You are D.A.N.I.S.H.

The owner speaks Hinglish (Hindi + English mix).

Reply in natural Hinglish using Roman script.

Mix Hindi and English naturally like a bilingual speaker.

Do not force Devanagari script unless the user uses it.
`;
  }

  return `
LANGUAGE RULES:

You are D.A.N.I.S.H.

The owner prefers Hindi.

Always reply in natural Hindi written in Devanagari script.

Examples:

User: kya haal hai
Assistant: क्या हाल है?

User: tum kaun ho
Assistant: मैं D.A.N.I.S.H हूँ।

Only use English when:
- the user explicitly asks for English
- code is being shown
- technical terms require English

Do not describe yourself as a Hinglish assistant.
Do not force Roman-script replies.
`;
}

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
  const primaryModel = envModel || "gemini-2.5-flash";
  const availableModels = Array.from(new Set([
    primaryModel,
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ].filter(Boolean)));

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

  const detectedInputLanguage = detectAssistantLanguage(message);
  console.log("[AI_LIB] Detected input language:", detectedInputLanguage);

  const promptText = `${systemPrompts[mode]}\n\n${getLanguageInstruction(detectedInputLanguage)}\n\n${memoryContext}${toolContext}User message: ${message}`;
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

    console.log("[AI_LIB] Raw Gemini response:", responseText);

    let json: GeminiGenerateContentResponse;
    try {
      json = JSON.parse(responseText);
    } catch {
      console.error("[AI_LIB] Gemini returned invalid JSON:", responseText);
      return { provider: "gemini", content: "Gemini returned an empty response." };
    }

    console.log("[AI_LIB] Complete Gemini response:", JSON.stringify(json, null, 2));
    console.log("[AI_LIB] Gemini response shape:", JSON.stringify({
      modelVersion: json.modelVersion ?? null,
      promptBlockReason: json.promptFeedback?.blockReason ?? null,
      candidateCount: json.candidates?.length ?? 0,
      candidates: json.candidates?.map((candidate, index) => ({
        index,
        finishReason: candidate.finishReason ?? null,
        hasContent: Boolean(candidate.content),
        partCount: candidate.content?.parts?.length ?? 0,
        partTypes: candidate.content?.parts?.map((part) => ({
          hasText: typeof part.text === "string",
          textLength: part.text?.length ?? 0,
          hasFunctionCall: Boolean(part.functionCall),
          functionName: part.functionCall?.name ?? null
        })) ?? [],
        hasSafetyRatings: Boolean(candidate.safetyRatings)
      })) ?? []
    }, null, 2));

    if (json.promptFeedback?.blockReason) {
      console.warn("[AI_LIB] Gemini prompt was blocked:", json.promptFeedback.blockReason);
      return { provider: "gemini", content: "Gemini returned an empty response." };
    }

    const candidates = json.candidates ?? [];
    if (!candidates.length) {
      console.warn("[AI_LIB] Gemini returned no candidates.");
      return { provider: "gemini", content: "Gemini returned an empty response." };
    }

    const allParts = candidates.flatMap((candidate) => candidate.content?.parts ?? []);
    const toolCalls = allParts
      .filter((part): part is { functionCall: GeminiFunctionCall["functionCall"] } => Boolean(part.functionCall))
      .map((part) => ({ functionCall: part.functionCall }));

    if (toolCalls.length && !toolResults?.length) {
      console.log("[AI_LIB] Gemini returned functionCall(s):", toolCalls.map((call) => call.functionCall.name).join(", "));
      return {
        provider: "gemini",
        toolCalls
      };
    }

    const text = allParts
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");

    if (text) {
      console.log("[AI_LIB] Gemini response language:", detectAssistantLanguage(text));
      return { provider: "gemini", content: text };
    }

    const safetyFinish = candidates.some((candidate) => candidate.finishReason === "SAFETY" || candidate.finishReason === "BLOCKLIST");
    if (safetyFinish) {
      console.warn("[AI_LIB] Gemini response was safety-filtered.");
    } else if (toolCalls.length) {
      console.warn("[AI_LIB] Gemini returned functionCall(s) when a text answer was expected.");
    } else {
      console.warn("[AI_LIB] Gemini returned candidates without text parts.");
    }

    return { provider: "gemini", content: "Gemini returned an empty response." };
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
