import { getDb } from "./client";

export type ModelRow = {
  id: string;
  provider: string;
  lane: string;
  name: string;
  label?: string | null;
  param_count?: number | null;
  last_seen?: string;
};

export async function upsertModel(row: ModelRow): Promise<void> {
  const conn = await getDb();
  await conn.run(
    `INSERT OR REPLACE INTO models (id, provider, lane, name, label, param_count, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, now())`,
    [row.id, row.provider, row.lane, row.name, row.label ?? null, row.param_count ?? null],
  );
}

export async function upsertModels(rows: ModelRow[]): Promise<void> {
  for (const row of rows) await upsertModel(row);
}

export async function getModelsByLane(lane: string): Promise<ModelRow[]> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(
    `SELECT id, provider, lane, name, label, param_count, last_seen::VARCHAR AS last_seen
     FROM models WHERE lane = ? ORDER BY name`,
    [lane],
  );
  return result.getRowObjects() as ModelRow[];
}

export async function getModelsByProvider(provider: string): Promise<ModelRow[]> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(
    `SELECT id, provider, lane, name, label, param_count, last_seen::VARCHAR AS last_seen
     FROM models WHERE provider = ? ORDER BY name`,
    [provider],
  );
  return result.getRowObjects() as ModelRow[];
}

export async function getAllModels(): Promise<ModelRow[]> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(
    `SELECT id, provider, lane, name, label, param_count, last_seen::VARCHAR AS last_seen
     FROM models ORDER BY provider, name`,
  );
  return result.getRowObjects() as ModelRow[];
}
