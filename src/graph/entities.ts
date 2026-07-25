export type ExtractedEntity = {
  name: string;
  kind: "file" | "function" | "concept" | "workspace";
};

const FILE_PATTERN = /\b[\w./\\-]+\.(ts|tsx|js|jsx|py|md|json|yaml|yml|sh|toml)\b/g;
const FUNCTION_PATTERN = /\b([a-z][a-zA-Z0-9]{2,}(?:[A-Z][a-zA-Z0-9]+)+)\b/g;
const PASCAL_PATTERN = /\b([A-Z][a-zA-Z0-9]{2,}(?:[A-Z][a-zA-Z0-9]*)*)\b/g;

export function extractEntities(text: string): ExtractedEntity[] {
  const seen = new Set<string>();
  const results: ExtractedEntity[] = [];

  function add(name: string, kind: ExtractedEntity["kind"]) {
    const key = `${kind}:${name}`;
    if (!seen.has(key) && name.length <= 120) {
      seen.add(key);
      results.push({ name, kind });
    }
  }

  for (const match of text.matchAll(FILE_PATTERN)) {
    add(match[0], "file");
  }
  for (const match of text.matchAll(FUNCTION_PATTERN)) {
    add(match[1], "function");
  }
  for (const match of text.matchAll(PASCAL_PATTERN)) {
    // Skip all-caps acronyms and very short tokens
    if (match[1].length > 2 && !/^[A-Z]+$/.test(match[1])) {
      add(match[1], "concept");
    }
  }

  return results;
}

export function extractEntitiesFromConversation(
  messages: { role: string; content: string | unknown }[],
): ExtractedEntity[] {
  const text = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n");
  return extractEntities(text);
}
