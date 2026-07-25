import { getDb } from "./client";
import { randomUUID } from "node:crypto";

export type BenchmarkResultRow = {
  run_id: string;
  provider?: string | null;
  model?: string | null;
  test_name: string;
  passed: boolean;
  score?: number | null;
  latency_ms?: number | null;
  raw_text?: string | null;
};

export async function insertBenchmarkResult(row: BenchmarkResultRow): Promise<void> {
  const conn = await getDb();
  await conn.run(
    `INSERT INTO benchmark_results
       (id, run_id, provider, model, test_name, passed, score, latency_ms, raw_text, ran_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now())`,
    [
      randomUUID(),
      row.run_id,
      row.provider ?? null,
      row.model ?? null,
      row.test_name,
      row.passed,
      row.score ?? null,
      row.latency_ms ?? null,
      row.raw_text ?? null,
    ],
  );
}

export async function getBenchmarkRuns(limit = 10): Promise<{ run_id: string; ran_at: string; pass_rate: number }[]> {
  const conn = await getDb();
  const result = await conn.runAndReadAll(
    `SELECT run_id,
            min(ran_at)::VARCHAR AS ran_at,
            round(avg(passed::INTEGER) * 100, 1) AS pass_rate
     FROM benchmark_results
     GROUP BY run_id
     ORDER BY ran_at DESC
     LIMIT ?`,
    [limit],
  );
  return result.getRowObjects() as { run_id: string; ran_at: string; pass_rate: number }[];
}
