import { Pool, types } from "pg";

types.setTypeParser(types.builtins.DATE, (value) => value);
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));

function normalizeCaCertificate(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(
      /-----BEGIN CERTIFICATE-----\s*([\s\S]*?)\s*-----END CERTIFICATE-----/g,
      (_certificate, body: string) =>
        `-----BEGIN CERTIFICATE-----\n${body.replace(/\s+/g, "")}\n-----END CERTIFICATE-----`,
    );
}

const globalForPostgres = globalThis as typeof globalThis & {
  postgresPool?: Pool;
};

export function getPool(): Pool {
  if (!globalForPostgres.postgresPool) {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL_CA } =
      process.env;
    if (!DB_HOST || !DB_USER || !DB_NAME) {
      throw new Error("Konfigurasi database belum lengkap. Periksa file .env.");
    }

    globalForPostgres.postgresPool = new Pool({
      host: DB_HOST,
      port: Number(DB_PORT || 5432),
      user: DB_USER,
      password: DB_PASSWORD || "",
      database: DB_NAME,
      ssl: DB_SSL_CA ? { ca: normalizeCaCertificate(DB_SSL_CA) } : undefined,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return globalForPostgres.postgresPool;
}
