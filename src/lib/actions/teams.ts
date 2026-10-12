"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getCurrentSport } from "@/lib/sport";

type ActionResult = { success: true } | { error: string };

function getAdminClient() {
  return createAdminClient();
}

// ─── CREATE ────────────────────────────────────────────────────────────────
export async function createTeamAction(formData: FormData): Promise<ActionResult> {
  const supabaseAdmin = getAdminClient();

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Numele echipei este obligatoriu." };

  const sportParam = (formData.get("sport_type") as string)?.trim();
  const currentSport = await getCurrentSport();
  const sport = (sportParam === "basketball" || sportParam === "football") ? sportParam : currentSport;

  const { error } = await supabaseAdmin
    .from("teams")
    .insert({
      name,
      sport_type: sport,
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_scored: 0,
      goals_conceded: 0,
    });

  if (error) {
    if (error.code === "23505") return { error: "O echipă cu acest nume există deja." };
    return { error: error.message };
  }

  revalidatePath("/admin/echipe");
  revalidatePath("/admin/clasament");
  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/faza-eliminatorie");
  revalidatePath("/clasament");
  revalidatePath("/echipe");
  revalidatePath("/meciuri");
  revalidatePath("/public");
  revalidatePath("/");
  return { success: true };
}

// ─── UPDATE ────────────────────────────────────────────────────────────────
export async function updateTeamAction(formData: FormData): Promise<ActionResult> {
  const supabaseAdmin = getAdminClient();

  const id   = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();

  if (!id)   return { error: "ID echipă lipsă." };
  if (!name) return { error: "Numele echipei este obligatoriu." };

  const { error } = await supabaseAdmin
    .from("teams")
    .update({ name })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "O echipă cu acest nume există deja." };
    return { error: error.message };
  }

  revalidatePath("/admin/echipe");
  revalidatePath("/admin/clasament");
  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/faza-eliminatorie");
  revalidatePath("/clasament");
  revalidatePath("/echipe");
  revalidatePath("/meciuri");
  revalidatePath("/public");
  revalidatePath("/");
  return { success: true };
}

// ─── DELETE ────────────────────────────────────────────────────────────────
export async function deleteTeamAction(id: string): Promise<ActionResult> {
  const supabaseAdmin = getAdminClient();

  const { error } = await supabaseAdmin
    .from("teams")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/echipe");
  revalidatePath("/admin/clasament");
  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/faza-eliminatorie");
  revalidatePath("/clasament");
  revalidatePath("/echipe");
  revalidatePath("/meciuri");
  revalidatePath("/public");
  revalidatePath("/");
  return { success: true };
}
