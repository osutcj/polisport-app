import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  let dbPath: string;

  if (process.env.DATABASE_PATH) {
    dbPath = process.env.DATABASE_PATH;
  } else if (isServerless) {
    // Pe Vercel / serverless, filesystem-ul este read-only cu excepția /tmp
    const tmpDbPath = path.join("/tmp", "polisport.db");
    const bundledDbPath = path.join(process.cwd(), "data", "polisport.db");

    if (!fs.existsSync(tmpDbPath) && fs.existsSync(bundledDbPath)) {
      try {
        fs.copyFileSync(bundledDbPath, tmpDbPath);
      } catch (err) {
        console.error("Nu s-a putut copia baza de date bundled în /tmp:", err);
      }
    }
    dbPath = tmpDbPath;
  } else {
    const dbDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    dbPath = path.join(dbDir, "polisport.db");
  }

  const db = new Database(dbPath);

  try {
    db.pragma("journal_mode = WAL");
  } catch {
    db.pragma("journal_mode = DELETE");
  }
  db.pragma("foreign_keys = ON");

  // Ensure schema is created
  initSchema(db);

  dbInstance = db;
  return dbInstance;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      points INTEGER NOT NULL DEFAULT 0,
      played INTEGER NOT NULL DEFAULT 0,
      won INTEGER NOT NULL DEFAULT 0,
      drawn INTEGER NOT NULL DEFAULT 0,
      lost INTEGER NOT NULL DEFAULT 0,
      goals_scored INTEGER NOT NULL DEFAULT 0,
      goals_conceded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      group_name TEXT,
      sport_type TEXT NOT NULL DEFAULT 'football'
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      jersey_number INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'goalkeeper')),
      id_card_url TEXT,
      goals_scored INTEGER NOT NULL DEFAULT 0,
      goals_conceded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT unique_jersey_per_team UNIQUE (team_id, jersey_number)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      home_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      away_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      match_time TEXT,
      home_score INTEGER,
      away_score INTEGER,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'finished')),
      stage TEXT NOT NULL DEFAULT 'group' CHECK (stage IN ('group', 'playoff', 'ro16', 'quarter', 'semi', 'final', 'third_place')),
      round INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      penalty_winner_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      match_date TEXT,
      bracket_position TEXT,
      sport_type TEXT NOT NULL DEFAULT 'football',
      forfeit_loser_id TEXT REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS match_events (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN ('goal_scored', 'goal_conceded', 'yellow_card', 'red_card')),
      minute INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      sport_type TEXT NOT NULL DEFAULT 'football',
      points_value INTEGER NOT NULL DEFAULT 1
    );

    CREATE VIEW IF NOT EXISTS public_players AS
    SELECT id, team_id, name, jersey_number, role, goals_scored, goals_conceded, created_at
    FROM players;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS trg_update_standings
    AFTER UPDATE OF status ON matches
    FOR EACH ROW
    WHEN NEW.status = 'finished' AND OLD.status != 'finished'
         AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL
         AND NEW.stage = 'group'
    BEGIN
      UPDATE teams SET
        played = played + 1,
        goals_scored = goals_scored + NEW.home_score,
        goals_conceded = goals_conceded + NEW.away_score,
        won = won + (CASE WHEN NEW.home_score > NEW.away_score THEN 1 ELSE 0 END),
        drawn = drawn + (CASE WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END),
        lost = lost + (CASE WHEN NEW.home_score < NEW.away_score THEN 1 ELSE 0 END),
        points = points + (CASE WHEN NEW.home_score > NEW.away_score THEN 3 WHEN NEW.home_score = NEW.away_score THEN 1 ELSE 0 END)
      WHERE id = NEW.home_team_id;

      UPDATE teams SET
        played = played + 1,
        goals_scored = goals_scored + NEW.away_score,
        goals_conceded = goals_conceded + NEW.home_score,
        won = won + (CASE WHEN NEW.away_score > NEW.home_score THEN 1 ELSE 0 END),
        drawn = drawn + (CASE WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END),
        lost = lost + (CASE WHEN NEW.away_score < NEW.home_score THEN 1 ELSE 0 END),
        points = points + (CASE WHEN NEW.away_score > NEW.home_score THEN 3 WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END)
      WHERE id = NEW.away_team_id;
    END;

    DROP TRIGGER IF EXISTS trg_update_player_stats;
    CREATE TRIGGER trg_update_player_stats
    AFTER INSERT ON match_events
    FOR EACH ROW
    BEGIN
      UPDATE players SET goals_scored = goals_scored + COALESCE(NEW.points_value, 1)
      WHERE id = NEW.player_id AND NEW.event_type = 'goal_scored';

      UPDATE players SET goals_conceded = goals_conceded + 1
      WHERE id = NEW.player_id AND NEW.event_type = 'goal_conceded';
    END;

    DROP TRIGGER IF EXISTS trg_revert_player_stats;
    CREATE TRIGGER trg_revert_player_stats
    AFTER DELETE ON match_events
    FOR EACH ROW
    BEGIN
      UPDATE players SET goals_scored = MAX(0, goals_scored - COALESCE(OLD.points_value, 1))
      WHERE id = OLD.player_id AND OLD.event_type = 'goal_scored';

      UPDATE players SET goals_conceded = MAX(0, goals_conceded - 1)
      WHERE id = OLD.player_id AND OLD.event_type = 'goal_conceded';
    END;
  `);

  // Ensure default admin user
  const adminEmail = process.env.ADMIN_EMAIL || "andrei.armean17@gmail.com";
  const adminPass = process.env.ADMIN_PASSWORD || "admin123";
  const userCount = (db.prepare("SELECT count(*) as cnt FROM users WHERE email = ?").get(adminEmail) as { cnt: number }).cnt;
  if (userCount === 0) {
    db.prepare(`
      INSERT OR REPLACE INTO users (id, email, password_hash, role)
      VALUES (?, ?, ?, 'admin')
    `).run(crypto.randomUUID(), adminEmail, adminPass);
  }
}
