import "server-only";

import mysql from "mysql2/promise";

declare global {
  var __sudirjaPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  const host = process.env.MYSQL_HOST ?? "127.0.0.1";
  const port = Number(process.env.MYSQL_PORT ?? "3306");
  const user = process.env.MYSQL_USER ?? "root";
  const password = process.env.MYSQL_PASSWORD ?? "";
  const database = process.env.MYSQL_DATABASE ?? "web_sudirja";

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "Z",
    namedPlaceholders: false,
  });
}

/** Lazy singleton pool — survives HMR via globalThis, never runs at build time. */
export function getPool(): mysql.Pool {
  if (!globalThis.__sudirjaPool) {
    globalThis.__sudirjaPool = createPool();
  }
  return globalThis.__sudirjaPool;
}

export interface QueryResult<T> {
  rows: T;
  fields: mysql.FieldPacket[];
}

/** Run a query with positional placeholders; returns typed rows. */
export async function query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const [rows, fields] = await getPool().query<mysql.RowDataPacket[]>(sql, params);
  return { rows: rows as T, fields };
}

/** Run a DML statement; returns the ResultSetHeader. */
export async function execute(sql: string, params: unknown[] = []): Promise<mysql.ResultSetHeader> {
  const [result] = await getPool().query<mysql.ResultSetHeader>(sql, params);
  return result;
}

/** Run a query on a dedicated connection inside a transaction. */
export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
