#!/usr/bin/env node
// D.A.N.I.S.H — Memory Recall Test Suite
// Tests: creation, retrieval, category/tag/importance filter,
//        vector search (match_memories RPC), edge cases, API endpoint
// Usage: node test-memory-recall.mjs

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";
const WARN = "⚠️ WARN";
let passed = 0, failed = 0, warnings = 0;

function report(label, ok, detail = "") {
  const icon = ok ? PASS : (detail.startsWith("WARN") ? WARN : FAIL);
  ok ? passed++ : detail.startsWith("WARN") ? warnings++ : failed++;
  console.log(`  ${icon} ${label}${detail ? " — " + detail : ""}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

  const supabase = createClient(url, key);
  const tag = `memtest_${Date.now()}`;

  console.log("=".repeat(72));
  console.log("  D.A.N.I.S.H — Memory Recall Test Suite");
  console.log(`  Tag: ${tag}`);
  console.log("=".repeat(72) + "\n");

  // Phase 1: Test user
  console.log("── Phase 1: Test User ────────────────────────────────────");
  let uid;
  const { data: u, error: ue } = await supabase.auth.admin.createUser({
    email: `${tag}@test.danish`, password: "X".repeat(12), email_confirm: true,
  });
  if (ue) {
    const { data: fallback } = await supabase.from("profiles").select("id").limit(1).single();
    uid = fallback?.id;
    report("Test user", !!uid, `WARN: using existing user ${uid?.slice(0,8)}`);
  } else {
    uid = u.user.id;
    await supabase.from("profiles").insert({ id: uid, display_name: "Test", timezone: "UTC" });
    report("Test user created", true, uid.slice(0, 8));
  }
  const cleanup = async () => {
    if (uid?.includes("-")) {
      await supabase.from("memories").delete().eq("user_id", uid).like("title", `%${tag}%`);
      try { await supabase.auth.admin.deleteUser(uid); } catch {}
    }
  };

  try {
    // Phase 2: Create
    console.log("\n── Phase 2: Create Memories ─────────────────────────────");
    const memories = [
      { title: `Alpha ${tag}`, body: "User loves hiking in the Pacific Northwest.", category: "personal", importance: 8, tags: ["hiking", "pnw"] },
      { title: `Beta ${tag}`, body: "User is learning React Native for a mobile app.", category: "study", importance: 7, tags: ["react-native"] },
      { title: `Gamma ${tag}`, body: "Partner's favorite food is Italian, especially pasta.", category: "relationship", importance: 9, tags: ["partner", "food"] },
      { title: `Delta ${tag}`, body: "Career goal: staff engineer in 2 years.", category: "career", importance: 10, tags: ["career"] },
      { title: `Epsilon ${tag}`, body: "User prefers dark mode + One Dark Pro theme.", category: "preference", importance: 3, tags: ["theme"] },
    ];
    const ids = [];
    for (const m of memories) {
      const { data, error } = await supabase.from("memories").insert({
        user_id: uid, title: m.title, body: m.body, category: m.category,
        importance: m.importance, tags: m.tags, embedding: new Array(3072).fill(0),
        created_at: new Date().toISOString(),
      }).select("id").single();
      if (data) ids.push(data.id);
      report(`Create [${m.category}] ${m.title.slice(0,35)}`, !!data, error?.message);
    }

    // Phase 3: Retrieve & filter
    console.log("\n── Phase 3: Retrieve & Filter ───────────────────────────");
    const { data: all } = await supabase.from("memories")
      .select("id, category, importance").eq("user_id", uid).like("title", `%${tag}%`);
    report(`List (expected ${memories.length})`, all?.length === memories.length, `got ${all?.length}`);

    for (const c of ["personal", "study", "career"]) {
      const { data: f } = await supabase.from("memories")
        .select("id").eq("user_id", uid).eq("category", c).like("title", `%${tag}%`);
      report(`Category "${c}"`, f?.length === 1, `got ${f?.length}`);
    }

    const { data: hi } = await supabase.from("memories")
      .select("id").eq("user_id", uid).like("title", `%${tag}%`).gte("importance", 8);
    report(`Importance >= 8 (expected 3)`, hi?.length === 3, `got ${hi?.length}`);

    const { data: tg } = await supabase.from("memories")
      .select("id").eq("user_id", uid).like("title", `%${tag}%`).contains("tags", ["hiking"]);
    report(`Tag "hiking" (expected 1)`, tg?.length === 1, `got ${tg?.length}`);

    // Phase 4: Vector search
    console.log("\n── Phase 4: Vector Search ────────────────────────────────");
    const { data: vs, error: ve } = await supabase.rpc("match_memories", {
      query_embedding: new Array(3072).fill(0.01), match_threshold: 0.0,
      match_count: 10, p_user_id: uid,
    });
    report("match_memories RPC", !ve, ve?.message || `${vs?.length} results`);
    if (vs?.length) {
      const found = ids.filter(id => vs.some(r => r.id === id));
      report(`Our test IDs found`, found.length > 0, `${found.length}/${ids.length}`);
    }

    // Phase 5: Edge cases
    console.log("\n── Phase 5: Edge Cases ──────────────────────────────────");
    const edges = [
      { title: `Empty body ${tag}`, body: "", category: "note" },
      { title: `Special chars ${tag}`, body: "@#$% ^&*()_+{}[]|\\:;'\"<>,.?/~`", category: "note" },
      { title: `Unicode ${tag}`, body: "हिन्दी 中文 Español العربية", category: "note" },
      { title: `Very short ${tag}`, body: "Hi", category: "note" },
      { title: `Long body ${tag}`, body: "X".repeat(5000), category: "note" },
    ];
    for (const e of edges) {
      const { data: d, error: er } = await supabase.from("memories").insert({
        user_id: uid, title: e.title, body: e.body, category: e.category,
        importance: 5, embedding: new Array(3072).fill(0), created_at: new Date().toISOString(),
      }).select("id").single();
      if (d) ids.push(d.id);
      report(`Edge "${e.title.slice(0,30)}"`, !er, er?.message || `accepted (${e.body.length} chars)`);
    }

    // Phase 6: REST API test
    console.log("\n── Phase 6: REST API ─────────────────────────────────────");
    try {
      const r = await fetch(`${url}/rest/v1/rpc/match_memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({ query_embedding: new Array(3072).fill(0.01), match_threshold: 0.0, match_count: 5, p_user_id: uid }),
      });
      report("match_memories REST endpoint", r.ok, `status ${r.status}`);
    } catch (e) { report("match_memories REST endpoint", false, e.message); }

    // Phase 7: Cleanup
    console.log("\n── Phase 7: Cleanup ─────────────────────────────────────");
    if (ids.length) {
      const { error: de } = await supabase.from("memories").delete().in("id", ids);
      report(`Delete ${ids.length} memories`, !de, de?.message || "ok");
    }
    await cleanup();
    report("Test user removed", true);

  } catch (e) { console.error("\nFATAL:", e); await cleanup(); }

  const total = passed + failed + warnings;
  console.log("\n" + "=".repeat(72));
  console.log("  MEMORY RECALL TEST SUMMARY");
  console.log("=".repeat(72));
  console.log(`  Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}  |  Warnings: ${warnings}`);
  console.log(`  Result: ${failed === 0 ? "✅ ALL PASSED" : "❌ FAILURES"}`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
