import { getDb } from "./client";

export type SessionRow = {
  id: string;
  workspace?: string | null;
  lane?: string | null;
  model?: string | null;
  provider?: string | null;
  message_count?: number;
};

export async function upsertSession(row: SessionRow): Promise<void> {
  const conn = await getDb();
  await conn.run(
    `INSERT INTO sessions (id, workspace, lane, model, provider, message_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, now(), now())
     ON CONFLICT (id) DO UPDATE SET
       lane = excluded.lane,
       model = excluded.model,
       provider = excluded.provider,
       message_count = excluded.message_count,
       updated_at = now()`,
    [
      row.id,
      row.workspace ?? null,
      row.lane ?? null,
      row.model ?? null,
      row.provider ?? null,
      row.message_count ?? 0,
    ],
  );
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(
    `SELECT id, workspace, lane, model, provider, message_count FROM sessions WHERE id = ? LIMIT 1`,
    [id],
  );
  const rows = result.getRowObjects();
  return rows.length > 0 ? (rows[0] as SessionRow) : null;
}

export async function getRecentSessions(limit = 20): Promise<SessionRow[]> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(
    `SELECT id, workspace, lane, model, provider, message_count,
            updated_at::VARCHAR AS updated_at
     FROM sessions ORDER BY updated_at DESC LIMIT ?`,
    [limit],
  );
  return result.getRowObjects() as SessionRow[];
}
