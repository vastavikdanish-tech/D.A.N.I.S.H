#!/usr/bin/env node
// Quick test script for Gemini API integration
// Usage: node test-gemini.mjs

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Load .env.local
  const envPath = path.join(__dirname, ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  const envVars = {};
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...rest] = trimmed.split("=");
      envVars[key.trim()] = rest.join("=").trim();
    }
  });

  const apiUrl = envVars.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";
  const apiKey = envVars.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY not found in .env.local");
    return;
  }

  const message = "hello";
  const systemPrompt = "You are D.A.N.I.S.H, a practical AI operating system assistant. Plan, execute, remember, and keep answers concise.";
  const promptText = `${systemPrompt}\n\n${message}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: promptText
          }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 200,
      temperature: 0.7
    }
  };

  const url = new URL(apiUrl);
  url.searchParams.set("key", apiKey);

  console.log("Testing Gemini API...");
  console.log(`Endpoint: ${apiUrl}`);
  console.log(`Full URL: ${url.toString().replace(apiKey, "***")}`);
  console.log(`Message: "${message}"`);
  console.log("---");

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const responseText = await res.text();
  if (!res.ok) {
    console.error(`❌ API Error (${res.status}):`, responseText);
    return;
  }

  const json = JSON.parse(responseText);
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("❌ Unexpected response format:", JSON.stringify(json));
    return;
  }

  console.log("✅ Gemini API Response:");
  console.log(text);
  console.log("---");
  console.log("✓ Gemini integration successful!");
}

main().catch((error) => {
  console.error("Unhandled error in Gemini test:", error);
});
