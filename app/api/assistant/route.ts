import { NextResponse } from "next/server";
import { assistantRequestSchema, generateAssistantResponse, generateEmbedding } from "@/lib/ai";
import { createClient } from "@/lib/supabase.server";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = assistantRequestSchema.parse(json);
    console.log("[ASSISTANT_ROUTE] Received message:", payload.message);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
    }

    let memories: Array<{ id?: string; category: string; title: string; body: string; importance?: number }> = [];

    try {
      const { data } = await supabase
        .from("memories")
        .select("id,category,title,body,importance,shared_with")
        .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(15);

      if (data) memories = data.map((d: any) => ({ 
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
            const embedding = await generateEmbedding(`${args.title} ${args.body}`);
            const { data, error } = await supabase.from("memories").insert({
              user_id: user.id,
              ...args,
              embedding,
              created_at: new Date().toISOString()
            }).select().single();
            toolResults.push({ 
              call, 
              result: error ? { error: error.message } : { status: "success", data } 
            });
          } else if (name === "update_memory") {
            const updatePayload: any = { ...args };
            delete updatePayload.id;
            
            if (updatePayload.title || updatePayload.body) {
              const current = memories.find(m => m.id === args.id);
              const title = updatePayload.title || current?.title || "";
              const body = updatePayload.body || current?.body || "";
              updatePayload.embedding = await generateEmbedding(`${title} ${body}`);
            }

            const { data, error } = await supabase
              .from("memories")
              .update(updatePayload)
              .eq("id", args.id)
              .eq("user_id", user.id)
              .select().single();
            
            toolResults.push({ 
              call, 
              result: error ? { error: error.message } : { status: "success", data } 
            });
          } else if (name === "add_reminder") {
            const { error } = await supabase.from("reminders").insert({
              user_id: user.id,
              ...args,
              created_at: new Date().toISOString()
            });
            toolResults.push({ 
              call, 
              result: error ? { error: error.message } : { status: "success", message: `Reminder added: ${args.title}` } 
            });
          } else if (name === "control_device") {
            const { error } = await supabase.from("device_commands").insert({
              user_id: user.id,
              device_id: args.deviceId,
              command: args.action,
              payload: args.payload ?? {},
              status: "queued",
              created_at: new Date().toISOString()
            });
            toolResults.push({ 
              call, 
              result: error ? { error: error.message } : { status: "success", message: `Command ${args.action} sent to device` } 
            });
          } else if (name === "search_memories") {
            console.log("[ASSISTANT_ROUTE] Performing semantic search for:", args.query);
            const queryEmbedding = await generateEmbedding(args.query);
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
                .or(`title.ilike.%${args.query}%,body.ilike.%${args.query}%`)
                .eq("user_id", user.id)
                .limit(5);
              
              if (args.category) query = query.eq("category", args.category);
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

    console.log("[ASSISTANT_ROUTE] Final response content:", response.content?.slice(0, 100) + "...");

    // Persist conversation history
    try {
      await supabase.from("memories").insert([
        {
          user_id: user.id,
          category: "conversation",
          title: `User: ${payload.message.slice(0, 100)}`,
          body: payload.message,
          tags: [],
          importance: 10,
          created_at: new Date().toISOString()
        },
        {
          user_id: user.id,
          category: "conversation",
          title: `Assistant: ${response.content.slice(0, 100)}`,
          body: response.content,
          tags: [],
          importance: 10,
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
        ...response
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
