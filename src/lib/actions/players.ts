"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type ActionResult = { success: true } | { error: string };
type PlayerRole = "player" | "goalkeeper";

// ─── CREATE ────────────────────────────────────────────────────────────────
export async function createPlayerAction(formData: FormData): Promise<ActionResult> {
  const supabaseAdmin = createAdminClient();

  const team_id      = formData.get("team_id") as string;
  const name         = (formData.get("name") as string)?.trim();
  const jersey_number = parseInt(formData.get("jersey_number") as string, 10);
  const role         = formData.get("role") as PlayerRole;
  const id_card_url  = (formData.get("id_card_url") as string)?.trim() || null;

  if (!team_id)           return { error: "Selectează o echipă." };
  if (!name)              return { error: "Numele jucătorului este obligatoriu." };
  if (isNaN(jersey_number) || jersey_number < 1 || jersey_number > 99)
                          return { error: "Numărul de tricou trebuie să fie între 1 și 99." };
  if (!["player", "goalkeeper"].includes(role))
                          return { error: "Rolul jucătorului este invalid." };

  const { error } = await supabaseAdmin.from("players").insert({
    team_id,
    name,
    jersey_number,
    role,
    id_card_url,
  });

  if (error) {
    if (error.code === "23505")
      return { error: `Numărul de tricou #${jersey_number} este deja folosit în această echipă.` };
    return { error: error.message };
  }

  revalidatePath("/admin/echipe");
  revalidatePath("/admin/jucatori");
  revalidatePath("/admin/program");
  revalidatePath("/public");
  return { success: true };
}

// ─── UPDATE ────────────────────────────────────────────────────────────────
export async function updatePlayerAction(formData: FormData): Promise<ActionResult> {
  const supabaseAdmin = createAdminClient();

  const id           = formData.get("id") as string;
  const team_id      = formData.get("team_id") as string;
  const name         = (formData.get("name") as string)?.trim();
  const jersey_number = parseInt(formData.get("jersey_number") as string, 10);
  const role         = formData.get("role") as PlayerRole;
  const id_card_url  = (formData.get("id_card_url") as string)?.trim() || null;

  if (!id)    return { error: "ID jucător lipsă." };
  if (!name)  return { error: "Numele jucătorului este obligatoriu." };
  if (isNaN(jersey_number) || jersey_number < 1 || jersey_number > 99)
              return { error: "Numărul de tricou trebuie să fie între 1 și 99." };

  const updateData: Record<string, unknown> = {
    team_id, name, jersey_number, role,
  };
  // Actualizează id_card_url DOAR dacă a fost furnizat unul nou
  if (id_card_url !== null) updateData.id_card_url = id_card_url;

  const { error } = await supabaseAdmin
    .from("players")
    .update(updateData)
    .eq("id", id);

  if (error) {
    if (error.code === "23505")
      return { error: `Numărul de tricou #${jersey_number} este deja folosit în această echipă.` };
    return { error: error.message };
  }

  revalidatePath("/admin/echipe");
  revalidatePath("/admin/jucatori");
  revalidatePath("/admin/program");
  revalidatePath("/public");
  return { success: true };
}

// ─── DELETE ────────────────────────────────────────────────────────────────
export async function deletePlayerAction(id: string): Promise<ActionResult> {
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from("players")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/echipe");
  revalidatePath("/admin/jucatori");
  revalidatePath("/admin/program");
  revalidatePath("/public");
  return { success: true };
}
