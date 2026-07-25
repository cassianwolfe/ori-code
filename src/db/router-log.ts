import { getDb } from "./client";
import { randomUUID } from "node:crypto";

export type RouterLogRow = {
  session_id?: string | null;
  surface?: string | null;
  provider?: string | null;
  model?: string | null;
  lane?: string | null;
  intent?: string | null;
  reason?: string | null;
  mode?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  latency_ms?: number | null;
};

export async function logRouterDecision(row: RouterLogRow): Promise<void> {
  const conn = await getDb();
  await conn.run(
    `INSERT INTO router_log
       (id, session_id, surface, provider, model, lane, intent, reason, mode,
        input_tokens, output_tokens, latency_ms, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())`,
    [
      randomUUID(),
      row.session_id ?? null,
      row.surface ?? null,
      row.provider ?? null,
      row.model ?? null,
      row.lane ?? null,
      row.intent ?? null,
      row.reason ?? null,
      row.mode ?? null,
      row.input_tokens ?? null,
      row.output_tokens ?? null,
      row.latency_ms ?? null,
    ],
  );
}

export async function getRouterLog(limit = 100): Promise<RouterLogRow[]> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(
    `SELECT id, session_id, surface, provider, model, lane, intent, reason, mode,
            input_tokens, output_tokens, latency_ms, logged_at::VARCHAR AS logged_at
     FROM router_log ORDER BY logged_at DESC LIMIT ?`,
    [limit],
  );
  return result.getRowObjects() as RouterLogRow[];
}
