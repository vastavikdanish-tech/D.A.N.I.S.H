export type FactEntry = {
  id?: string;
  body: string;
  category: "fact" | "preference";
  tags?: string[];
  importance?: number;
};

const factPatterns = [
  { regex: /i (?:like|love|enjoy|prefer) (.+)/i, tag: "like" },
  { regex: /i don.t (?:like|love|enjoy|prefer) (.+)/i, tag: "dislike" },
  { regex: /my name is (.+)/i, tag: "name" },
  { regex: /i am (\d+) years? old/i, tag: "age" },
  { regex: /i work (?:at|for) (.+)/i, tag: "work" },
  { regex: /i (?:study|major) in (.+)/i, tag: "study" },
  { regex: /my favorite (.+)/i, tag: "favorite" },
  { regex: /i live (?:in|at) (.+)/i, tag: "location" },
  { regex: /i have a (.+)/i, tag: "possession" },
  { regex: /i (?:want|need|wish) (.+)/i, tag: "desire" },
  { regex: /i am (?:a|an) (.+)/i, tag: "identity" },
];

export function extractFacts(text: string): FactEntry[] {
  const facts: FactEntry[] = [];
  const seen = new Set<string>();

  for (const pattern of factPatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const body = match[0].trim();
      if (!seen.has(body.toLowerCase())) {
        seen.add(body.toLowerCase());
        facts.push({
          body,
          category: "preference" as const,
          tags: [pattern.tag],
          importance: 5,
        });
      }
    }
  }

  return facts;
}

export function extractCommandFacts(command: string): FactEntry[] {
  const lower = command.toLowerCase().trim();

  const clearPatterns = [
    /^remember (?:that )?(?:i |my |we |you )?(.+)/i,
    /^save (?:that )?(?:i |my |we |you )?(.+)/i,
    /^note (?:that )?(?:i |my |we |you )?(.+)/i,
  ];

  for (const pat of clearPatterns) {
    const m = lower.match(pat);
    if (m) {
      const body = m[1].trim();
      if (body.length > 3) {
        const facts = extractFacts(body);
        if (facts.length > 0) return facts;
        return [{ body, category: "fact", tags: ["spoken"], importance: 4 }];
      }
    }
  }

  return extractFacts(lower);
}
