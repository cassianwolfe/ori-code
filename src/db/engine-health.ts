import { getDb } from "./client";

export type EngineHealthRow = {
  id: string;
  name: string;
  status: "healthy" | "degraded" | "offline" | "unknown";
  version?: string | null;
  message?: string | null;
  checked_at?: string;
};

export async function upsertEngineHealth(row: EngineHealthRow): Promise<void> {
  const conn = await getDb();
  await conn.run(
    `INSERT OR REPLACE INTO engine_health (id, name, status, version, message, checked_at)
     VALUES (?, ?, ?, ?, ?, now())`,
    [row.id, row.name, row.status, row.version ?? null, row.message ?? null],
  );
}

export async function getEngineHealth(id: string): Promise<EngineHealthRow | null> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(
    `SELECT id, name, status, version, message, checked_at::VARCHAR AS checked_at
     FROM engine_health WHERE id = ? LIMIT 1`,
    [id],
  );
  const rows = result.getRowObjects();
  return rows.length > 0 ? (rows[0] as EngineHealthRow) : null;
}

export async function getAllEngineHealth(): Promise<EngineHealthRow[]> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(
    `SELECT id, name, status, version, message, checked_at::VARCHAR AS checked_at
     FROM engine_health ORDER BY name`,
  );
  return result.getRowObjects() as EngineHealthRow[];
}
