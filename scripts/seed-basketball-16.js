const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "../data/polisport.db");
const db = new Database(dbPath);

console.log("🏀 Checking basketball teams in:", dbPath);

const existingTeams = db.prepare("SELECT * FROM teams WHERE sport_type = 'basketball' ORDER BY name").all();
console.log(`Found ${existingTeams.length} basketball teams.`);

const teamInsertStmt = db.prepare(`
  INSERT INTO teams (id, name, points, played, won, drawn, lost, goals_scored, goals_conceded, sport_type)
  VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, 'basketball')
`);

const playerInsertStmt = db.prepare(`
  INSERT INTO players (id, team_id, name, jersey_number, role, goals_scored, goals_conceded)
  VALUES (?, ?, ?, ?, 'player', 0, 0)
`);

const BASKETBALL_ROSTER_TEMPLATES = [
  { name: "Andrei Pop", jersey: 4 },
  { name: "Mihai Radu", jersey: 7 },
  { name: "Alex Stan", jersey: 9 },
  { name: "Cristian Dima", jersey: 10 },
  { name: "Vlad Marin", jersey: 23 },
  { name: "George Ionescu", jersey: 30 },
];

db.transaction(() => {
  // Ensure teams baschet 1 through baschet 16 exist
  for (let i = 1; i <= 16; i++) {
    const expectedName = `baschet ${i}`;
    let team = existingTeams.find(t => t.name.toLowerCase() === expectedName.toLowerCase());
    
    if (!team) {
      const teamId = crypto.randomUUID();
      teamInsertStmt.run(teamId, expectedName);
      console.log(`➕ Created team: ${expectedName} (${teamId})`);
      team = { id: teamId, name: expectedName };
    }

    // Check player count for this team
    const playerCount = db.prepare("SELECT count(*) as c FROM players WHERE team_id = ?").get(team.id).c;
    if (playerCount === 0) {
      console.log(`👥 Seeding squad for ${team.name}...`);
      for (const p of BASKETBALL_ROSTER_TEMPLATES) {
        const playerId = crypto.randomUUID();
        const pName = `${p.name} (${team.name})`;
        playerInsertStmt.run(playerId, team.id, pName, p.jersey);
      }
    }
  }
})();

const updatedTeams = db.prepare("SELECT count(*) as c FROM teams WHERE sport_type = 'basketball'").get().c;
const updatedPlayers = db.prepare("SELECT count(*) as c FROM players p JOIN teams t ON p.team_id = t.id WHERE t.sport_type = 'basketball'").get().c;

console.log(`✅ Basketball teams now in DB: ${updatedTeams} (expected: 16)`);
console.log(`✅ Basketball players now in DB: ${updatedPlayers}`);

db.close();
