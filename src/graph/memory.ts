import { withGraph } from "./client";
import { extractEntitiesFromConversation, type ExtractedEntity } from "./entities";

export type GraphSessionInput = {
  id: string;
  workspace: string | null;
  lane: string | null;
  model: string | null;
  provider: string | null;
  messages: { role: string; content: string | unknown }[];
};

export type GraphFact = {
  key: string;
  value: string;
  source: string;
};

export type GraphRecallResult = {
  facts: { key: string; value: string; source: string; sessionId: string }[];
  entities: { name: string; kind: string; mentionCount: number }[];
};

/** Persist a session and its extracted entities to the graph. Fire-and-forget safe. */
export async function saveSessionGraph(input: GraphSessionInput): Promise<void> {
  await withGraph(async (session) => {
    // Upsert the Session node
    await session.run(
      `MERGE (s:Session {id: $id})
       SET s.lane = $lane, s.model = $model, s.provider = $provider, s.updated_at = datetime()`,
      { id: input.id, lane: input.lane, model: input.model, provider: input.provider },
    );

    // Upsert the Workspace and link
    if (input.workspace) {
      await session.run(
        `MERGE (w:Workspace {path: $path})
         WITH w
         MATCH (s:Session {id: $id})
         MERGE (s)-[:IN_WORKSPACE]->(w)`,
        { path: input.workspace, id: input.id },
      );
    }

    // Extract entities from the conversation and link
    const entities = extractEntitiesFromConversation(input.messages);
    for (const entity of entities.slice(0, 60)) {
      await session.run(
        `MERGE (e:Entity {name: $name, kind: $kind})
         WITH e
         MATCH (s:Session {id: $id})
         MERGE (s)-[:MENTIONED]->(e)`,
        { name: entity.name, kind: entity.kind, id: input.id },
      );
    }
  });
}

/** Store an explicit fact attached to a session. */
export async function saveGraphFact(
  sessionId: string,
  fact: GraphFact,
): Promise<void> {
  await withGraph(async (session) => {
    await session.run(
      `MERGE (f:Fact {session_id: $sessionId, key: $key})
       SET f.value = $value, f.source = $source, f.updated_at = datetime()
       WITH f
       MATCH (s:Session {id: $sessionId})
       MERGE (s)-[:STORED]->(f)`,
      { sessionId, key: fact.key, value: fact.value, source: fact.source },
    );
  });
}

/**
 * Recall context relevant to the current session:
 * - Facts stored in past sessions in the same workspace
 * - Frequently mentioned entities in this workspace
 */
export async function recallContext(
  workspace: string,
  currentSessionId?: string,
): Promise<GraphRecallResult> {
  const empty: GraphRecallResult = { facts: [], entities: [] };

  const result = await withGraph(async (session) => {
    const [factsResult, entitiesResult] = await Promise.all([
      session.run(
        `MATCH (s:Session)-[:IN_WORKSPACE]->(w:Workspace {path: $workspace})
         MATCH (s)-[:STORED]->(f:Fact)
         WHERE s.id <> $currentId
         RETURN f.key AS key, f.value AS value, f.source AS source, s.id AS sessionId
         ORDER BY f.updated_at DESC
         LIMIT 30`,
        { workspace, currentId: currentSessionId ?? "" },
      ),
      session.run(
        `MATCH (s:Session)-[:IN_WORKSPACE]->(w:Workspace {path: $workspace})
         MATCH (s)-[:MENTIONED]->(e:Entity)
         RETURN e.name AS name, e.kind AS kind, count(s) AS mentionCount
         ORDER BY mentionCount DESC
         LIMIT 25`,
        { workspace },
      ),
    ]);

    return {
      facts: factsResult.records.map((r) => ({
        key: r.get("key") as string,
        value: r.get("value") as string,
        source: r.get("source") as string,
        sessionId: r.get("sessionId") as string,
      })),
      entities: entitiesResult.records.map((r) => ({
        name: r.get("name") as string,
        kind: r.get("kind") as string,
        mentionCount: r.get("mentionCount") as number,
      })),
    };
  });

  return result ?? empty;
}

/** Format recall context as a prompt block. Returns empty string if nothing useful. */
export async function buildGraphMemoryPromptBlock(
  workspace: string,
  currentSessionId?: string,
): Promise<string> {
  const { facts, entities } = await recallContext(workspace, currentSessionId);
  const parts: string[] = [];

  if (facts.length > 0) {
    parts.push(
      "Remembered facts (from past sessions in this workspace):\n" +
        facts.map((f) => `- ${f.key}: ${f.value}`).join("\n"),
    );
  }

  if (entities.length > 0) {
    const top = entities.slice(0, 12);
    parts.push(
      "Frequently referenced in this workspace:\n" +
        top.map((e) => `- ${e.name} (${e.kind}, ×${e.mentionCount})`).join("\n"),
    );
  }

  if (parts.length === 0) return "";
  return `\n\nGRAPH MEMORY (cross-session, workspace-scoped):\n${parts.join("\n\n")}`;
}
