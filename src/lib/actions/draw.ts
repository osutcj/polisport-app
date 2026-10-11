"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getCurrentSport } from "@/lib/sport";

type ActionResult = { success: true } | { error: string };

function getAdminClient() {
  return createAdminClient();
}

/**
 * Împarte echipele în 4 grupe (A, B, C, D)
 * Suportă 32 de echipe, 36 de echipe sau orice număr divizibil cu 4 (minim 8).
 */
export async function drawGroupsAction(): Promise<ActionResult> {
  const supabase = getAdminClient();
  const sport = await getCurrentSport();

  // 1. Fetch echipe
  const { data: teams, error: fetchErr } = await supabase.from("teams").select("id").eq("sport_type", sport);
  if (fetchErr) return { error: fetchErr.message };

  if (!teams || teams.length < 8) {
    return { error: `Sunt necesare minimum 8 echipe pentru ${sport}. Găsite: ${teams?.length || 0}.` };
  }

  // 2. Amestecăm echipele aleatoriu (Fisher-Yates)
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 3. Asignăm grupele (A, B, C, D)
  // Distribuire echilibrată prin rotație (pentru 32 de echipe: exact 8 pe grupă)
  const groups = ["A", "B", "C", "D"];

  const updates = shuffled.map((team, index) => ({
    id: team.id,
    group_name: groups[index % 4],
  }));

  const updatePromises = updates.map((u) =>
    supabase.from("teams").update({ group_name: u.group_name }).eq("id", u.id)
  );

  const results = await Promise.all(updatePromises);
  const err = results.find((r) => r.error);
  if (err) return { error: err.error!.message };

  revalidatePath("/admin/tragere-la-sorti");
  revalidatePath("/admin/echipe");
  revalidatePath("/admin/clasament");
  revalidatePath("/public");
  return { success: true };
}

/**
 * Generează meciuri pentru echipele din grupe
 * Suportă 32 de echipe (8 pe grupă), 36 de echipe (9 pe grupă) sau alte configurații
 */
export async function drawMatchesAction(): Promise<ActionResult> {
  const supabase = getAdminClient();
  const sport = await getCurrentSport();

  // 1. Resetăm statisticile echipelor pentru sportul curent la regenearea meciurilor
  await supabase
    .from("teams")
    .update({
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_scored: 0,
      goals_conceded: 0,
    })
    .eq("sport_type", sport);

  // 2. Fetch meciurile vechi din faza de grupe pentru a șterge și evenimentele asociate
  const { data: oldMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("stage", "group")
    .eq("sport_type", sport);

  if (oldMatches && oldMatches.length > 0) {
    const oldIds = oldMatches.map((m) => m.id);
    await supabase.from("match_events").delete().in("match_id", oldIds);
  }

  // 3. Ștergem meciurile vechi din faza de grupe
  await supabase.from("matches").delete().eq("stage", "group").eq("sport_type", sport);

  // 4. Fetch echipe cu grupele lor
  const { data: teams, error: fetchErr } = await supabase.from("teams").select("id, group_name").eq("sport_type", sport);
  if (fetchErr) return { error: fetchErr.message };

  if (!teams || teams.some((t) => !t.group_name)) {
    return { error: "Nu toate echipele au o grupă alocată. Faceți mai întâi tragerea grupelor." };
  }

  // Grupăm echipele
  const grouped: Record<string, string[]> = {};
  for (const t of teams) {
    if (!grouped[t.group_name]) grouped[t.group_name] = [];
    grouped[t.group_name].push(t.id);
  }

  const matchesToInsert: {
    home_team_id: string;
    away_team_id: string;
    stage: string;
    status: string;
    round: number;
    match_time: null;
    sport_type: string;
  }[] = [];

  for (const [group, groupTeams] of Object.entries(grouped)) {
    const n = groupTeams.length;
    if (n < 2) {
      return { error: `Grupa ${group} are prea puține echipe (${n}).` };
    }

    const arr = [...groupTeams];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    if (sport === "basketball" || n <= 4) {
      // Fiecare cu fiecare
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          matchesToInsert.push({
            home_team_id: arr[i],
            away_team_id: arr[j],
            stage: "group",
            status: "scheduled",
            round: ((i + j) % (n - 1 || 1)) + 1,
            match_time: null,
            sport_type: sport,
          });
        }
      }
    } else {
      // Fotbal cu n >= 5 (de exemplu 8 echipe per grupă = 32 echipe, sau 9 per grupă = 36 echipe)
      // Fiecare echipă joacă exact 4 meciuri: cu adversarul de la distanța 1 și distanța 2
      for (let i = 0; i < n; i++) {
        matchesToInsert.push({
          home_team_id: arr[i],
          away_team_id: arr[(i + 1) % n],
          stage: "group",
          status: "scheduled",
          round: 1,
          match_time: null,
          sport_type: sport,
        });
      }
      for (let i = 0; i < n; i++) {
        matchesToInsert.push({
          home_team_id: arr[i],
          away_team_id: arr[(i + 2) % n],
          stage: "group",
          status: "scheduled",
          round: 2,
          match_time: null,
          sport_type: sport,
        });
      }
    }
  }

  const { error: insertErr } = await supabase.from("matches").insert(matchesToInsert);
  if (insertErr) return { error: insertErr.message };

  revalidatePath("/admin/tragere-la-sorti");
  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/program");
  revalidatePath("/admin/clasament");
  revalidatePath("/public");
  return { success: true };
}
