import { createPublicClient } from "@/lib/supabase/public";
import { getCurrentSport } from "@/lib/sport";
import TeamsManager from "@/components/admin/TeamsManager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Echipe & Jucători" };
export const dynamic = "force-dynamic";

export default async function AdminEchipePage() {
  const sport = await getCurrentSport();
  const supabase = createPublicClient();

  const [teamsRes, playersRes, eventsRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, points, played, goals_scored, goals_conceded")
      .eq("sport_type", sport)
      .order("points", { ascending: false }),
    supabase
      .from("players")
      .select("id, name, jersey_number, role, id_card_url, goals_scored, goals_conceded, team_id, team:teams!inner(sport_type)")
      .eq("teams.sport_type", sport)
      .order("jersey_number", { ascending: true }),
    supabase
      .from("match_events")
      .select("player_id, event_type")
      .eq("sport_type", sport)
  ]);

  const teams = teamsRes.data ? [...teamsRes.data] : [];
  teams.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    const gdA = a.goals_scored - a.goals_conceded;
    const gdB = b.goals_scored - b.goals_conceded;
    if (gdA !== gdB) return gdB - gdA;
    if (a.goals_scored !== b.goals_scored) return b.goals_scored - a.goals_scored;
    return a.name.localeCompare(b.name);
  });

  const allPlayers = (playersRes.data as any) ?? [];
  const events = eventsRes.data ?? [];

  // Calculează cartonașele per jucător
  const cardsMap = new Map<string, { yellow: number; red: number }>();
  events.forEach(ev => {
    if (!ev.player_id) return;
    if (!cardsMap.has(ev.player_id)) cardsMap.set(ev.player_id, { yellow: 0, red: 0 });
    const c = cardsMap.get(ev.player_id)!;
    if (ev.event_type === "yellow_card") c.yellow++;
    if (ev.event_type === "red_card") c.red++;
  });

  const playersWithCards = allPlayers.map((p: any) => ({
    ...p,
    yellow_cards: cardsMap.get(p.id)?.yellow || 0,
    red_cards: cardsMap.get(p.id)?.red || 0,
  }));

  const error = teamsRes.error || playersRes.error || eventsRes.error;

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠️ Eroare la încărcarea datelor: {error.message}
        </div>
      )}
      <TeamsManager
        teams={teams}
        players={playersWithCards}
        sport={sport}
      />
    </div>
  );
}
