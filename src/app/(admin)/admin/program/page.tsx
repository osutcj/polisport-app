import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { getCurrentSport } from "@/lib/sport";
import ProgramManager from "@/components/admin/ProgramManager";

export const metadata: Metadata = { title: "Admin — Program & Rezultate" };
export const dynamic = "force-dynamic";

export default async function AdminProgramPage() {
  const sport = await getCurrentSport();
  const supabase = createPublicClient();

  // Preluăm doar meciurile programate (match_time is not null)
  const { data: matchesData, error: matchesError } = await supabase
    .from("matches")
    .select(`
      id,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      status,
      stage,
      round,
      penalty_winner_id,
      match_time,
      home_team:teams!matches_home_team_id_fkey(id, name, group_name),
      away_team:teams!matches_away_team_id_fkey(id, name, group_name),
      match_events(
        id,
        player_id,
        team_id,
        event_type,
        points_value,
        player:players(name, jersey_number),
        team:teams(name)
      )
    `)
    .eq("sport_type", sport)
    .not("match_time", "is", null) // Doar cele programate
    .order("match_time", { ascending: true }); // Sortare cronologică

  // Preluăm toți jucătorii (pentru dropdown-ul de marcatori)
  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .select("id, name, jersey_number, team_id, team:teams!inner(sport_type)")
    .eq("teams.sport_type", sport)
    .order("jersey_number", { ascending: true });

  const error = matchesError || playersError;

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠️ Eroare la încărcarea datelor: {error.message}
        </div>
      )}
      <ProgramManager
        matches={(matchesData as any) ?? []}
        players={playersData ?? []}
        sport={sport}
      />
    </div>
  );
}
