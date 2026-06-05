import { NextResponse } from "next/server";
import { assistantRequestSchema, generateAssistantResponse, generateEmbedding } from "@/lib/ai";
import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { getUserFromRequest } from "@/lib/auth";

type MemoryContext = {
  id?: string;
  category: string;
  title: string;
  body: string;
  importance?: number;
};

type MemoryRow = MemoryContext & {
  shared_with?: string[];
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = assistantRequestSchema.parse(json);
    console.log("[ASSISTANT_ROUTE] Received message:", payload.message);
    const supabase = getSupabaseAdminClient();
    const user = await getUserFromRequest(request);
    
    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
    }
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase admin client not configured" }, { status: 500 });
    }

    let memories: MemoryContext[] = [];

    try {
      const { data } = await supabase
        .from("memories")
        .select("id,category,title,body,importance,shared_with")
        .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(15);

      if (data) memories = (data as MemoryRow[]).map((d) => ({ 
        id: d.id, 
        category: d.category, 
        title: d.title, 
        body: d.body,
        importance: d.importance
      }));
      console.log("[ASSISTANT_ROUTE] Initial memories fetched:", memories.length);
    } catch (e) {
      console.warn("Failed to load user memories:", e);
    }

    let response = await generateAssistantResponse(payload.message, payload.mode, memories);
    console.log("[ASSISTANT_ROUTE] First AI response (toolCalls?):", !!response.toolCalls);

    // Handle Tool Calls
    if (response.toolCalls) {
      const toolResults = [];
      for (const call of response.toolCalls) {
        const { name, args } = call.functionCall;
        console.log("[ASSISTANT_ROUTE] Executing tool:", name, "with args:", args);
        
        try {
          if (name === "create_memory") {
            const title = asString(args.title, "Memory");
            const body = asString(args.body);
            const category = asString(args.category, "conversation");
            const embedding = await generateEmbedding(`${title} ${body}`);
            const { data, error } = await supabase.from("memories").insert({
              user_id: user.id,
              title,
              body,
              category,
              importance: asNumber(args.importance, 5),
              tags: asStringArray(args.tags),
              embedding,
              created_at: new Date().toISOString()
            }).select().single();
            toolResults.push({ 
              call, 
              result: error ? { error: error.message } : { status: "success", data } 
            });
          } else if (name === "update_memory") {
            const memoryId = asString(args.id);
            const updatePayload: Record<string, unknown> = {};
            if (typeof args.title === "string") updatePayload.title = args.title;
            if (typeof args.body === "string") updatePayload.body = args.body;
            if (typeof args.importance === "number") updatePayload.importance = args.importance;
            
            if (updatePayload.title || updatePayload.body) {
              const current = memories.find(m => m.id === memoryId);
              const title = asString(updatePayload.title, current?.title || "");
              const body = asString(updatePayload.body, current?.body || "");
              updatePayload.embedding = await generateEmbedding(`${title} ${body}`);
            }

            const { data, error } = await supabase
              .from("memories")
              .update(updatePayload)
              .eq("id", memoryId)
              .eq("user_id", user.id)
              .select().single();
            
            toolResults.push({ 
              call, 
              result: error ? { error: error.message } : { status: "success", data } 
            });
          } else if (name === "add_reminder") {
            const { error } = await supabase.from("reminders").insert({
              user_id: user.id,
              title: asString(args.title, "Reminder"),
              body: asString(args.body) || null,
              remind_at: asString(args.remind_at) || null,
              created_at: new Date().toISOString()
            });
            toolResults.push({ 
              call, 
              result: error ? { error: error.message } : { status: "success", message: `Reminder added: ${asString(args.title, "Reminder")}` } 
            });
          } else if (name === "control_device") {
            const { error } = await supabase.from("device_commands").insert({
              user_id: user.id,
              device_id: asString(args.deviceId),
              command: asString(args.action, "open_app"),
              payload: typeof args.payload === "object" && args.payload !== null ? args.payload : {},
              status: "queued",
              created_at: new Date().toISOString()
            });
            toolResults.push({ 
              call, 
              result: error ? { error: error.message } : { status: "success", message: `Command ${asString(args.action, "open_app")} sent to device` } 
            });
          } else if (name === "list_devices") {
            const { data, error } = await supabase
              .from("devices")
              .select("id, name, device_type, status, last_seen_at")
              .eq("user_id", user.id)
              .order("last_seen_at", { ascending: false });
            toolResults.push({
              call,
              result: error ? { error: error.message } : { status: "success", data: data || [] }
            });
          } else if (name === "get_device_status") {
            const { data, error } = await supabase
              .from("devices")
              .select("id, name, device_type, status, last_seen_at, health")
              .eq("id", asString(args.deviceId))
              .eq("user_id", user.id)
              .single();
            toolResults.push({
              call,
              result: error ? { error: error.message } : { status: "success", data }
            });
          } else if (name === "search_memories") {
            const searchQuery = asString(args.query);
            console.log("[ASSISTANT_ROUTE] Performing semantic search for:", searchQuery);
            const queryEmbedding = await generateEmbedding(searchQuery);
            let searchResult;

            if (queryEmbedding) {
              // Try semantic search if RPC exists
              const { data, error } = await supabase.rpc("match_memories", {
                query_embedding: queryEmbedding,
                match_threshold: 0.5,
                match_count: 5,
                p_user_id: user.id
              });
              if (!error) {
                searchResult = data;
                console.log("[ASSISTANT_ROUTE] Semantic search results:", searchResult?.length);
              } else {
                console.error("[ASSISTANT_ROUTE] Semantic search error:", error.message);
              }
            }

            if (!searchResult) {
              console.log("[ASSISTANT_ROUTE] Falling back to keyword search");
              // Fallback to keyword search
              let query = supabase
                .from("memories")
                .select("id,category,title,body,importance")
                .or(`title.ilike.%${searchQuery}%,body.ilike.%${searchQuery}%`)
                .eq("user_id", user.id)
                .limit(5);
              
              if (typeof args.category === "string") query = query.eq("category", args.category);
              const { data } = await query;
              searchResult = data || [];
              console.log("[ASSISTANT_ROUTE] Keyword search results:", searchResult.length);
            }

            toolResults.push({ 
              call, 
              result: { status: "success", data: searchResult } 
            });
          }
        } catch (e) {
          console.error(`Error executing tool ${name}:`, e);
          toolResults.push({ call, result: { error: "Internal execution error" } });
        }
      }
      
      // Second pass: Get natural language response
      if (toolResults.length > 0) {
        console.log("[ASSISTANT_ROUTE] Re-calling AI with tool results...");
        response = await generateAssistantResponse(payload.message, payload.mode, memories, toolResults);
      }
    }

    const finalContent = response.content || "I processed that, but I could not produce a full response. Please try again.";
    console.log("[ASSISTANT_ROUTE] Final response content:", finalContent.slice(0, 100) + "...");

    // Persist conversation history
    try {
      const [userEmbedding, assistantEmbedding] = await Promise.all([
        generateEmbedding(payload.message),
        generateEmbedding(finalContent)
      ]);
      await supabase.from("memories").insert([
        {
          user_id: user.id,
          category: "conversation",
          title: `User: ${payload.message.slice(0, 100)}`,
          body: payload.message,
          tags: [],
          importance: 10,
          embedding: userEmbedding,
          created_at: new Date().toISOString()
        },
        {
          user_id: user.id,
          category: "conversation",
          title: `Assistant: ${finalContent.slice(0, 100)}`,
          body: finalContent,
          tags: [],
          importance: 10,
          embedding: assistantEmbedding,
          created_at: new Date().toISOString()
        }
      ]);
    } catch (e) {
      console.warn("Failed to persist conversation memory:", e);
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: crypto.randomUUID(),
        role: "assistant",
        createdAt: new Date().toISOString(),
        ...response,
        content: finalContent
      }
    });
  } catch (error) {
    console.error("Assistant route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to process assistant request."
      },
      { status: 400 }
    );
  }
}
