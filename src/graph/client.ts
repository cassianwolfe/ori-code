import neo4j, { type Driver, type Session } from "neo4j-driver";

let _driver: Driver | null = null;
let _available: boolean | null = null;

function neo4jConfig() {
  return {
    uri: Bun.env.NEO4J_URI?.trim() ?? "bolt://localhost:7687",
    user: Bun.env.NEO4J_USER?.trim() ?? "neo4j",
    password: Bun.env.NEO4J_PASSWORD?.trim() ?? "neo4j",
  };
}

function getDriver(): Driver {
  if (!_driver) {
    const { uri, user, password } = neo4jConfig();
    _driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      disableLosslessIntegers: true,
      connectionTimeout: 3000,
      maxConnectionPoolSize: 10,
    });
  }
  return _driver;
}

export async function isGraphAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    await getDriver().verifyConnectivity();
    _available = true;
    await applyConstraints();
  } catch {
    _available = false;
  }
  return _available;
}

/** Run a callback with a Neo4j session; returns null if Neo4j is unavailable. */
export async function withGraph<T>(
  fn: (session: Session) => Promise<T>,
): Promise<T | null> {
  if (!(await isGraphAvailable())) return null;
  const session = getDriver().session();
  try {
    return await fn(session);
  } catch {
    return null;
  } finally {
    await session.close();
  }
}

async function applyConstraints(): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      `CREATE CONSTRAINT session_id IF NOT EXISTS FOR (s:Session) REQUIRE s.id IS UNIQUE`,
    );
    await session.run(
      `CREATE CONSTRAINT workspace_path IF NOT EXISTS FOR (w:Workspace) REQUIRE w.path IS UNIQUE`,
    );
    await session.run(
      `CREATE CONSTRAINT entity_key IF NOT EXISTS FOR (e:Entity) REQUIRE (e.name, e.kind) IS UNIQUE`,
    );
    await session.run(
      `CREATE CONSTRAINT fact_key IF NOT EXISTS FOR (f:Fact) REQUIRE (f.session_id, f.key) IS UNIQUE`,
    );
  } finally {
    await session.close();
  }
}

export async function closeGraph(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
    _available = null;
  }
}
