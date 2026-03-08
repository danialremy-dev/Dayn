import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let migrated = false;

/**
 * Initialize the database asynchronously. Call this at app startup so we can
 * catch errors instead of crashing. After initDb() resolves, getDb() is safe to use.
 */
export async function initDb(): Promise<void> {
  if (db && migrated) return;
  const database = await SQLite.openDatabaseAsync('lifestyle.db');
  migrateIfNeeded(database);
  db = database;
  migrated = true;
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

function migrateIfNeeded(database: SQLite.SQLiteDatabase) {
  database.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const rows = database.getAllSync<{ user_version: number }>('PRAGMA user_version');
  const userVersion = rows[0]?.user_version ?? 0;

  if (userVersion >= 1) return;

  database.execSync(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      location TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      schedule_mask INTEGER NOT NULL DEFAULT 127,
      target_per_day INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      habit_id TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(habit_id, day),
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      day TEXT NOT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sports_goals (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      target_number REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS strava_activities (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT,
      type TEXT,
      sport_type TEXT,
      start_date TEXT,
      distance REAL,
      moving_time INTEGER,
      elapsed_time INTEGER,
      total_elevation_gain REAL,
      average_speed REAL,
      kudos_count INTEGER,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finance_goals (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      target_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      principal REAL NOT NULL,
      current_balance REAL NOT NULL,
      apr REAL,
      minimum_payment REAL,
      due_day INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id TEXT PRIMARY KEY NOT NULL,
      debt_id TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_on TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );
  `);

  database.execSync('PRAGMA user_version = 1;');
}

