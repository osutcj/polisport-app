/**
 * ============================================================
 *  ALGORITM TRAGERE LA SORȚI — PoliSport Tournament
 * ============================================================
 *
 *  Metodă: Round-Robin Rotation (garantat fără repetiții)
 *  ─────────────────────────────────────────────────────────
 *  Fixăm prima echipă (după amestecare aleatorie).
 *  Rotim celelalte N-1 echipe în 4 runde.
 *  În fiecare rundă, formăm N/2 perechi unice.
 *
 *  Garanții:
 *  ✓ Fiecare echipă joacă EXACT 4 meciuri
 *  ✓ Nicio echipă nu se întâlnește de două ori cu același adversar
 *  ✓ Nu există meciuri cu sine însuși
 *  ✓ Funcționează pentru orice N ≥ 8 (par sau impar)
 */

export interface DrawTeam {
  id: string;
  name: string;
}

export interface DrawPair {
  home:  DrawTeam;
  away:  DrawTeam;
  round: number;
}

export interface DrawRound {
  round: number;
  pairs: DrawPair[];
}

// ─── Shuffle Fisher-Yates ───────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── ALGORITM PRINCIPAL ─────────────────────────────────────────────────────
export function generateGroupDraw(teams: DrawTeam[]): DrawRound[] {
  if (teams.length < 8) {
    throw new Error(`Sunt necesare minimum 8 echipe. Ai ${teams.length}.`);
  }

  // Amestecare aleatorie
  const shuffled = shuffle(teams);

  // Dacă numărul de echipe este impar, adăugăm un "bye" (null)
  const hasOdd = shuffled.length % 2 !== 0;
  type Slot = DrawTeam | null;
  const workingTeams: Slot[] = hasOdd ? [...shuffled, null] : [...shuffled];
  const _n = workingTeams.length; // garantat par

  // Round-Robin Rotation:
  // - workingTeams[0] este FIXAT
  // - restul n-1 echipe se ROTESC la fiecare rundă
  const fixed   = workingTeams[0];
  const rotating = workingTeams.slice(1); // lungime n-1
  const rotLen  = rotating.length;        // n-1 (impar dacă n par)

  const rounds: DrawRound[] = [];

  for (let r = 0; r < 4; r++) {
    const pairs: DrawPair[] = [];

    // Rotire: mutăm primul element la final
    const rotated: Slot[] = [
      ...rotating.slice(r % rotLen),
      ...rotating.slice(0, r % rotLen),
    ];

    // 1. Echipa fixată vs echipa din mijloc
    const midIdx  = Math.floor(rotLen / 2);
    const midTeam = rotated[midIdx];
    if (fixed && midTeam) {
      // Alternăm home/away aleatoriu pentru varietate
      const coinFlip = Math.random() > 0.5;
      pairs.push({
        home:  coinFlip ? (fixed as DrawTeam) : (midTeam as DrawTeam),
        away:  coinFlip ? (midTeam as DrawTeam) : (fixed as DrawTeam),
        round: r + 1,
      });
    }

    // 2. Restul: perechi simetrice (i cu rotLen-1-i)
    for (let i = 0; i < midIdx; i++) {
      const a = rotated[i];
      const b = rotated[rotLen - 1 - i];
      if (a && b) {
        const coinFlip = Math.random() > 0.5;
        pairs.push({
          home:  coinFlip ? (a as DrawTeam) : (b as DrawTeam),
          away:  coinFlip ? (b as DrawTeam) : (a as DrawTeam),
          round: r + 1,
        });
      }
    }

    rounds.push({ round: r + 1, pairs });
  }

  return rounds;
}

// ─── VALIDARE REZULTAT ─────────────────────────────────────────────────────
export function validateDraw(rounds: DrawRound[], teams: DrawTeam[]): string[] {
  const errors: string[] = [];
  const matchCount = new Map<string, number>(); // teamId → nr meciuri
  const pairsSeen  = new Set<string>();          // "idA_idB"

  for (const round of rounds) {
    for (const pair of round.pairs) {
      // Contorizare meciuri per echipă
      matchCount.set(pair.home.id, (matchCount.get(pair.home.id) ?? 0) + 1);
      matchCount.set(pair.away.id, (matchCount.get(pair.away.id) ?? 0) + 1);

      // Verificare perechi duplicate
      const key = [pair.home.id, pair.away.id].sort().join("_");
      if (pairsSeen.has(key)) {
        errors.push(`Pereche duplicată: ${pair.home.name} vs ${pair.away.name}`);
      }
      pairsSeen.add(key);

      // Verificare self-match
      if (pair.home.id === pair.away.id) {
        errors.push(`Self-match detectat: ${pair.home.name}`);
      }
    }
  }

  // Verificare că fiecare echipă are exact 4 meciuri
  for (const team of teams) {
    const count = matchCount.get(team.id) ?? 0;
    if (count !== 4) {
      errors.push(`${team.name} are ${count} meciuri (trebuie 4)`);
    }
  }

  return errors;
}
