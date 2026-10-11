"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { revertTeamStats } from "@/lib/actions/matchActions";

type ActionResult = { success: true } | { error: string };

function getAdminClient() {
  return createAdminClient();
}

export async function scheduleMatchAction(formData: FormData): Promise<ActionResult> {
  const supabase = getAdminClient();
  const id = formData.get("id") as string;
  const datetime = formData.get("datetime") as string; // ex: 2026-10-15T18:30

  if (!id || !datetime) {
    return { error: "ID meci sau dată lipsă." };
  }

  const { error } = await supabase
    .from("matches")
    .update({ 
      match_time: new Date(datetime).toISOString() 
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/program");
  revalidatePath("/public");
  
  return { success: true };
}

export async function deleteMatchAction(id: string): Promise<ActionResult> {
  const supabase = getAdminClient();
  if (!id) return { error: "ID meci lipsă." };

  const { data: match } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id, status, home_score, away_score, stage")
    .eq("id", id)
    .single();

  if (match && match.stage === "group" && match.status === "finished" && match.home_score !== null && match.away_score !== null) {
    const revertErr = await revertTeamStats(
      supabase,
      match.home_team_id,
      match.away_team_id,
      match.home_score as number,
      match.away_score as number
    );
    if (revertErr) return { error: revertErr };
  }

  // First delete match events if any (though usually cascading is on, good practice)
  await supabase.from("match_events").delete().eq("match_id", id);
  
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/program");
  revalidatePath("/admin/clasament");
  revalidatePath("/admin/faze-eliminatorii");
  revalidatePath("/public");

  return { success: true };
}
