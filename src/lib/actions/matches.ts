"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { DrawPair } from "@/lib/draw-algorithm";
import { getCurrentSport } from "@/lib/sport";

type ActionResult = { success: true } | { error: string };

export async function saveGeneratedMatches(pairs: DrawPair[]): Promise<ActionResult> {
  const supabaseAdmin = createAdminClient();
  const sport = await getCurrentSport();

  // Verificăm dacă sunt deja meciuri în faza grupelor
  const { count, error: countError } = await supabaseAdmin
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("stage", "group")
    .eq("sport_type", sport);

  if (countError) {
    return { error: `Eroare verificare meciuri existente: ${countError.message}` };
  }

  if (count && count > 0) {
    return { error: "Meciurile pentru faza grupelor au fost deja generate și salvate." };
  }

  // Creăm array-ul de meciuri pentru inserare
  const matchesToInsert = pairs.map(p => ({
    home_team_id: p.home.id,
    away_team_id: p.away.id,
    status: "scheduled",
    stage: "group",
    sport_type: sport
  }));

  // Inserăm în baza de date
  const { error: insertError } = await supabaseAdmin
    .from("matches")
    .insert(matchesToInsert);

  if (insertError) {
    return { error: `Eroare salvare meciuri: ${insertError.message}` };
  }

  // Revalidăm rutele publice și de admin
  revalidatePath("/admin/tragere-la-sorti");
  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/program");
  revalidatePath("/public");
  
  return { success: true };
}
