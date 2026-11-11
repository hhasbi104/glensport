import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

function loadLocalEnv() {
  try {
    const contents = readFileSync(".env.local", "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=]+)=(.*)$/);
      if (match && process.env[match[1].trim()] === undefined) {
        process.env[match[1].trim()] = match[2].trim();
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

loadLocalEnv();

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  !password ||
  password.length < 12 ||
  password === "ubah-password-admin-ini"
) {
  throw new Error(
    "Set ADMIN_EMAIL dan ADMIN_PASSWORD (minimal 12 karakter) di .env.local sebelum menjalankan npm run seed:admin.",
  );
}

const salt = randomBytes(16).toString("hex");
const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
const sslCa = process.env.DB_SSL_CA;
const connection = new pg.Client({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sport_court_booking",
  ssl: sslCa ? { ca: sslCa.replace(/\\n/g, "\n") } : undefined,
});

try {
  await connection.connect();
  await connection.query(
    `INSERT INTO users (name, email, phone, password_hash, role)
     VALUES ('Admin Courtly', $1, '0000000000', $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       role = 'admin'`,
    [email, passwordHash],
  );
  console.log(`Akun admin siap digunakan: ${email}`);
} finally {
  await connection.end();
}
