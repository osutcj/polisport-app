"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getCurrentSport } from "@/lib/sport";

type ActionResult = { success: true } | { error: string };

function getAdminClient() {
  return createAdminClient();
}

export async function saveAllKnockoutMatchesAction(
  matchesData: { stage: string; home_team_id: string; away_team_id: string; bracket_position: string }[]
): Promise<ActionResult> {
  const supabase = getAdminClient();
  const sport = await getCurrentSport();

  if (!matchesData || matchesData.length === 0) {
    return { error: "Nu există meciuri valide de salvat." };
  }

  // Filtrăm meciurile incomplete pentru siguranță (deși sunt deja filtrate pe client)
  const validMatches = matchesData.filter(m => m.home_team_id && m.away_team_id);

  if (validMatches.length === 0) {
    return { error: "Toate meciurile trimise sunt incomplete." };
  }

  const positions = validMatches.map((m) => m.bracket_position);
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id, bracket_position, status")
    .eq("sport_type", sport)
    .in("bracket_position", positions);

  const existingMap = new Map((existingMatches || []).map((m) => [m.bracket_position, m]));

  const toInsert: {
    home_team_id: string;
    away_team_id: string;
    stage: string;
    bracket_position: string;
    status: string;
    match_time: null;
    sport_type: string;
  }[] = [];

  for (const m of validMatches) {
    const existing = existingMap.get(m.bracket_position);
    if (existing) {
      if (existing.status !== "finished") {
        const { error: updErr } = await supabase
          .from("matches")
          .update({
            home_team_id: m.home_team_id,
            away_team_id: m.away_team_id,
            stage: m.stage,
          })
          .eq("id", existing.id);
        if (updErr) return { error: updErr.message };
      }
    } else {
      toInsert.push({
        home_team_id: m.home_team_id,
        away_team_id: m.away_team_id,
        stage: m.stage,
        bracket_position: m.bracket_position,
        status: "scheduled",
        match_time: null,
        sport_type: sport,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("matches").insert(toInsert);
    if (insErr) return { error: insErr.message };
  }

  revalidatePath("/admin/faze-eliminatorii");
  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/program");
  revalidatePath("/public");

  return { success: true };
}
