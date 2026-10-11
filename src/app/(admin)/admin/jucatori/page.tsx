import { createPublicClient } from "@/lib/supabase/public";
import { getCurrentSport } from "@/lib/sport";
import PlayersManager from "@/components/admin/PlayersManager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Jucători" };
export const dynamic = "force-dynamic";

export default async function AdminJucatoriPage() {
  const sport = await getCurrentSport();
  const supabase = createPublicClient();

  const [playersRes, teamsRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, jersey_number, role, id_card_url, goals_scored, goals_conceded, team_id, teams!inner(name, sport_type)")
      .eq("teams.sport_type", sport)
      .order("jersey_number", { ascending: true }),
    supabase
      .from("teams")
      .select("id, name")
      .eq("sport_type", sport)
      .order("name"),
  ]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {(playersRes.error || teamsRes.error) && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠️ Eroare la încărcarea datelor: {playersRes.error?.message ?? teamsRes.error?.message}
        </div>
      )}
      <PlayersManager
        players={(playersRes.data as any) ?? []}
        teams={teamsRes.data ?? []}
      />
    </div>
  );
}
