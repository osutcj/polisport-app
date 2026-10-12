import Database from "better-sqlite3";
import { createClient as createLibsqlClient, type Client as LibsqlClient } from "@libsql/client";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export interface AnyDb {
   
  prepare(sql: string): {
     
    run(...params: any[]): Promise<{ changes: number; lastInsertRowid?: any }> | { changes: number; lastInsertRowid?: any };
     
    get(...params: any[]): Promise<any> | any;
     
    all(...params: any[]): Promise<any[]> | any[];
  };
  exec(sql: string): Promise<void> | void;
  pragma?(sql: string): void;
}

 
let dbInstance: any = null;

 
export function getDb(): any {
  if (dbInstance) return dbInstance;

  // Turso / LibSQL cloud support (pentru serverless / Vercel multi-instanță persistentă)
  const tursoUrl =
    process.env.TURSO_DATABASE_URL ||
    (process.env.DATABASE_URL?.startsWith("libsql://") || process.env.DATABASE_URL?.startsWith("https://")
      ? process.env.DATABASE_URL
      : null);

  if (tursoUrl) {
    const client: LibsqlClient = createLibsqlClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const libsqlDb: AnyDb = {
      prepare(sql: string) {
        return {
          async run(...params: any[]) {
            const res = await client.execute({ sql, args: params });
            return { changes: res.rowsAffected, lastInsertRowid: res.lastInsertRowid };
          },
          async get(...params: any[]) {
            const res = await client.execute({ sql, args: params });
            return res.rows[0] ? { ...res.rows[0] } : undefined;
          },
          async all(...params: any[]) {
            const res = await client.execute({ sql, args: params });
            return res.rows.map((r) => ({ ...r }));
          },
        };
      },
      async exec(sql: string) {
        await client.executeMultiple(sql);
      },
      pragma() {
        // Libsql cloud handles pragmas internally
      },
    };

    dbInstance = libsqlDb;
    return dbInstance;
  }

  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  let dbPath: string;

  if (process.env.DATABASE_PATH) {
    dbPath = process.env.DATABASE_PATH;
  } else if (isServerless) {
    // Pe Vercel / serverless, filesystem-ul este read-only cu excepția /tmp
    const tmpDbPath = path.join("/tmp", "polisport.db");
    const bundledDbPath = path.join(process.cwd(), "data", "polisport.db");

    if (fs.existsSync(bundledDbPath)) {
      if (!fs.existsSync(tmpDbPath) || fs.statSync(tmpDbPath).size === 0) {
        try {
          fs.copyFileSync(bundledDbPath, tmpDbPath);
          try {
            fs.chmodSync(tmpDbPath, 0o666);
          } catch {
            // ignore
          }
        } catch (err) {
          console.error("Nu s-a putut copia baza de date bundled în /tmp:", err);
        }
      }
    }
    try {
      if (fs.existsSync(tmpDbPath)) {
        fs.chmodSync(tmpDbPath, 0o666);
      }
    } catch {
      // ignore
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
  db.pragma("busy_timeout = 5000");
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
      name TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      played INTEGER NOT NULL DEFAULT 0,
      won INTEGER NOT NULL DEFAULT 0,
      drawn INTEGER NOT NULL DEFAULT 0,
      lost INTEGER NOT NULL DEFAULT 0,
      goals_scored INTEGER NOT NULL DEFAULT 0,
      goals_conceded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      group_name TEXT,
      sport_type TEXT NOT NULL DEFAULT 'football',
      CONSTRAINT unique_name_per_sport UNIQUE (name, sport_type)
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
      yellow_cards INTEGER NOT NULL DEFAULT 0,
      red_cards INTEGER NOT NULL DEFAULT 0,
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

    DROP VIEW IF EXISTS public_players;
    CREATE VIEW public_players AS
    SELECT id, team_id, name, jersey_number, role, goals_scored, goals_conceded, yellow_cards, red_cards, created_at
    FROM players;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    DROP TRIGGER IF EXISTS trg_update_standings;
    CREATE TRIGGER trg_update_standings
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
        points = points + (
          CASE 
            WHEN NEW.home_score > NEW.away_score THEN 3 
            WHEN NEW.home_score = NEW.away_score THEN 1 
            ELSE 0 
          END
        )
      WHERE id = NEW.home_team_id;

      UPDATE teams SET
        played = played + 1,
        goals_scored = goals_scored + NEW.away_score,
        goals_conceded = goals_conceded + NEW.home_score,
        won = won + (CASE WHEN NEW.away_score > NEW.home_score THEN 1 ELSE 0 END),
        drawn = drawn + (CASE WHEN NEW.away_score = NEW.home_score THEN 1 ELSE 0 END),
        lost = lost + (CASE WHEN NEW.away_score < NEW.home_score THEN 1 ELSE 0 END),
        points = points + (
          CASE 
            WHEN NEW.away_score > NEW.home_score THEN 3 
            WHEN NEW.away_score = NEW.home_score THEN 1 
            ELSE 0 
          END
        )
      WHERE id = NEW.away_team_id;
    END;

    DROP TRIGGER IF EXISTS trg_update_player_stats;
    CREATE TRIGGER trg_update_player_stats
    AFTER INSERT ON match_events
    FOR EACH ROW
    BEGIN
      UPDATE players SET
        goals_scored = goals_scored + (CASE WHEN NEW.event_type = 'goal_scored' THEN MAX(1, COALESCE(NEW.points_value, 1)) ELSE 0 END),
        yellow_cards = yellow_cards + (CASE WHEN NEW.event_type = 'yellow_card' THEN 1 ELSE 0 END),
        red_cards = red_cards + (CASE WHEN NEW.event_type = 'red_card' THEN 1 ELSE 0 END)
      WHERE id = NEW.player_id;

      UPDATE players SET goals_conceded = goals_conceded + 1
      WHERE id = NEW.player_id AND NEW.event_type = 'goal_conceded';
    END;

    DROP TRIGGER IF EXISTS trg_revert_player_stats;
    CREATE TRIGGER trg_revert_player_stats
    AFTER DELETE ON match_events
    FOR EACH ROW
    BEGIN
      UPDATE players SET
        goals_scored = MAX(0, goals_scored - (CASE WHEN OLD.event_type = 'goal_scored' THEN MAX(1, COALESCE(OLD.points_value, 1)) ELSE 0 END)),
        yellow_cards = MAX(0, yellow_cards - (CASE WHEN OLD.event_type = 'yellow_card' THEN 1 ELSE 0 END)),
        red_cards = MAX(0, red_cards - (CASE WHEN OLD.event_type = 'red_card' THEN 1 ELSE 0 END))
      WHERE id = OLD.player_id;

      UPDATE players SET goals_conceded = MAX(0, goals_conceded - 1)
      WHERE id = OLD.player_id AND OLD.event_type = 'goal_conceded';
    END;
  `);

  // Migrări automate pentru coloane adăugate pe tabele existente
  try {
    const cols = (db.prepare("PRAGMA table_info(players)").all() as { name: string }[]).map(c => c.name);
    if (!cols.includes("yellow_cards")) {
      db.exec("ALTER TABLE players ADD COLUMN yellow_cards INTEGER NOT NULL DEFAULT 0;");
    }
    if (!cols.includes("red_cards")) {
      db.exec("ALTER TABLE players ADD COLUMN red_cards INTEGER NOT NULL DEFAULT 0;");
    }
  } catch (err) {
    console.error("Eroare la migrare schema players:", err);
  }

  // Migrări automate pentru teams: UNIQUE(name, sport_type)
  try {
    const teamsMaster = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='teams'").get() as { sql: string } | undefined)?.sql || "";
    if (teamsMaster.includes("name TEXT NOT NULL UNIQUE")) {
      db.pragma("foreign_keys = OFF");
      db.transaction(() => {
        db.exec(`
          DROP TRIGGER IF EXISTS trg_update_standings;
          CREATE TABLE teams_migrated (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            points INTEGER NOT NULL DEFAULT 0,
            played INTEGER NOT NULL DEFAULT 0,
            won INTEGER NOT NULL DEFAULT 0,
            drawn INTEGER NOT NULL DEFAULT 0,
            lost INTEGER NOT NULL DEFAULT 0,
            goals_scored INTEGER NOT NULL DEFAULT 0,
            goals_conceded INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            group_name TEXT,
            sport_type TEXT NOT NULL DEFAULT 'football',
            CONSTRAINT unique_name_per_sport UNIQUE (name, sport_type)
          );
          INSERT INTO teams_migrated SELECT * FROM teams;
          DROP TABLE teams;
          ALTER TABLE teams_migrated RENAME TO teams;
        `);
      })();
      db.pragma("foreign_keys = ON");
    }
  } catch (err) {
    console.error("Eroare la migrare schema teams:", err);
  }

  // Auto-seed baschet dacă lipsesc echipele (ex: instanță serverless /tmp nouă)
  try {
    const basketballTeamCount = (db.prepare("SELECT count(*) as cnt FROM teams WHERE sport_type = 'basketball'").get() as { cnt: number })?.cnt ?? 0;
    if (basketballTeamCount < 16) {
      const BASKETBALL_ROSTER_TEMPLATES = [
        { name: "Andrei Pop", jersey: 4 },
        { name: "Mihai Radu", jersey: 7 },
        { name: "Alex Stan", jersey: 9 },
        { name: "Cristian Dima", jersey: 10 },
        { name: "Vlad Marin", jersey: 23 },
        { name: "George Ionescu", jersey: 30 },
      ];
      const existingBTeams = db.prepare("SELECT id, name FROM teams WHERE sport_type = 'basketball'").all() as { id: string; name: string }[];
      for (let i = 1; i <= 16; i++) {
        const expectedName = `baschet ${i}`;
        let team = existingBTeams.find(t => t.name.toLowerCase() === expectedName.toLowerCase());
        if (!team) {
          const teamId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO teams (id, name, points, played, won, drawn, lost, goals_scored, goals_conceded, sport_type)
            VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, 'basketball')
          `).run(teamId, expectedName);
          team = { id: teamId, name: expectedName };
        }
        const pCnt = (db.prepare("SELECT count(*) as c FROM players WHERE team_id = ?").get(team.id) as { c: number })?.c ?? 0;
        if (pCnt === 0) {
          for (const p of BASKETBALL_ROSTER_TEMPLATES) {
            db.prepare(`
              INSERT INTO players (id, team_id, name, jersey_number, role, goals_scored, goals_conceded)
              VALUES (?, ?, ?, ?, 'player', 0, 0)
            `).run(crypto.randomUUID(), team.id, `${p.name} (${team.name})`, p.jersey);
          }
        }
      }
    }
  } catch (err) {
    console.error("Eroare la auto-seed baschet:", err);
  }

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
