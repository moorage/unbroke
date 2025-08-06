import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb() {
  if (!db) {
    db = await Database.load("sqlite:app.db");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_date TEXT,
        post_date TEXT,
        description TEXT,
        category TEXT,
        type TEXT,
        amount REAL,
        memo TEXT
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT,
        category TEXT
      )
    `);
  }
  return db;
}
