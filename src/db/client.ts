import path from "node:path";
import fs from "node:fs/promises";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { userConfigDir } from "../config/paths";

let _instance: DuckDBInstance | null = null;
let _conn: DuckDBConnection | null = null;
let _ready: Promise<DuckDBConnection> | null = null;

function dbPath(): string {
  return path.join(userConfigDir(), "switchbay.db");
}

async function init(): Promise<DuckDBConnection> {
  const dir = userConfigDir();
  await fs.mkdir(dir, { recursive: true });
  _instance = await DuckDBInstance.create(dbPath());
  _conn = await _instance.connect();
  await applySchema(_conn);
  return _conn;
}

export function getDb(): Promise<DuckDBConnection> {
  if (!_ready) _ready = init();
  return _ready;
}

async function applySchema(conn: DuckDBConnection): Promise<void> {
  await conn.run(`
    CREATE TABLE IF NOT EXISTS engine_health (
      id          VARCHAR PRIMARY KEY,
      name        VARCHAR NOT NULL,
      status      VARCHAR NOT NULL,
      version     VARCHAR,
      message     VARCHAR,
      checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS models (
      id          VARCHAR PRIMARY KEY,
      provider    VARCHAR NOT NULL,
      lane        VARCHAR NOT NULL,
      name        VARCHAR NOT NULL,
      label       VARCHAR,
      param_count BIGINT,
      last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS router_log (
      id           VARCHAR PRIMARY KEY,
      session_id   VARCHAR,
      surface      VARCHAR,
      provider     VARCHAR,
      model        VARCHAR,
      lane         VARCHAR,
      intent       VARCHAR,
      reason       VARCHAR,
      mode         VARCHAR,
      input_tokens  INTEGER,
      output_tokens INTEGER,
      latency_ms   INTEGER,
      logged_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS benchmark_results (
      id          VARCHAR PRIMARY KEY,
      run_id      VARCHAR NOT NULL,
      provider    VARCHAR,
      model       VARCHAR,
      test_name   VARCHAR NOT NULL,
      passed      BOOLEAN NOT NULL,
      score       DOUBLE,
      latency_ms  INTEGER,
      raw_text    VARCHAR,
      ran_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id           VARCHAR PRIMARY KEY,
      workspace    VARCHAR,
      lane         VARCHAR,
      model        VARCHAR,
      provider     VARCHAR,
      message_count INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
