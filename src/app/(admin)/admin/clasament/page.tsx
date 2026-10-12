import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { getCurrentSport, SPORT_LABELS, SPORT_ICONS } from "@/lib/sport";

export const metadata: Metadata = { title: "Admin — Clasament" };
export const dynamic = "force-dynamic";

export default async function AdminClasamentPage() {
  const sport = await getCurrentSport();
  const supabase = createPublicClient();

  // Preluăm echipele
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("*")
    .eq("sport_type", sport)
    .not("group_name", "is", null);

  let topPlayers: any[] = [];
  
  if (sport === "basketball") {
    const { data: events, error: evErr } = await supabase
      .from("match_events")
      .select("player_id, points_value, player:players(name, jersey_number, team:teams(name))")
      .eq("sport_type", sport)
      .eq("event_type", "goal_scored");
      
    if (evErr) return <div className="p-8 text-red-600">Eroare la baza de date: {evErr.message}</div>;

    const agg: Record<string, any> = {};
    (events || []).forEach((e: any) => {
      if (!agg[e.player_id]) {
        agg[e.player_id] = {
          id: e.player_id,
          name: e.player?.name,
          jersey_number: e.player?.jersey_number,
          team: e.player?.team,
          goals_scored: 0
        };
      }
      agg[e.player_id].goals_scored += (e.points_value || 1);
    });
    topPlayers = Object.values(agg).sort((a, b) => b.goals_scored - a.goals_scored).slice(0, 10);
  } else {
    const { data, error: pErr } = await supabase
      .from("players")
      .select("id, name, jersey_number, goals_scored, team:teams!inner(name, sport_type)")
      .eq("teams.sport_type", sport)
      .gt("goals_scored", 0)
      .order("goals_scored", { ascending: false })
      .limit(10);
    if (pErr) return <div className="p-8 text-red-600">Eroare la baza de date: {pErr.message}</div>;
    topPlayers = data || [];
  }

  const error = teamsError;

  if (error) {
    return <div className="p-8 text-red-600">Eroare la baza de date: {error.message}</div>;
  }

  const teams = teamsData ?? [];
  const groups = ["A", "B", "C", "D"];

  // Funcție de sortare oficială: Puncte > Golaveraj > Goluri Marcate > Nume
  const sortTeams = (a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goals_scored - a.goals_conceded;
    const gdB = b.goals_scored - b.goals_conceded;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goals_scored !== a.goals_scored) return b.goals_scored - a.goals_scored;
    return a.name.localeCompare(b.name);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">🏆 Clasamente Grupe</h1>
        <p className="text-gray-500 text-sm">Situația la zi pentru cele 4 grupe ale turneului.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {groups.map(group => {
          const groupTeams = teams.filter(t => t.group_name === group).sort(sortTeams);
          
          return (
            <div key={group} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-lg">Grupa {group}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Loc</th>
                      <th className="px-4 py-3">Echipă</th>
                      <th className="px-4 py-3 text-center">Pct</th>
                      <th className="px-4 py-3 text-center hidden sm:table-cell">M</th>
                      <th className="px-4 py-3 text-center" title={sport === "basketball" ? "Puncte Marcate - Primite" : "Goluri Marcate - Primite"}>
                        {sport === "basketball" ? "PM-PP" : "GM-GP"}
                      </th>
                      <th className="px-4 py-3 text-center" title={sport === "basketball" ? "Diferență Puncte" : "Golaveraj"}>
                        {sport === "basketball" ? "PD" : "GD"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupTeams.map((team, index) => {
                      const gd = team.goals_scored - team.goals_conceded;
                      const qualifyLimit = sport === "basketball" ? 2 : 4;
                      return (
                        <tr key={team.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index < qualifyLimit ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {team.name}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-blue-700">{team.points}</td>
                          <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">{team.played}</td>
                          <td className="px-4 py-3 text-center text-gray-500">
                            {team.goals_scored}-{team.goals_conceded}
                          </td>
                          <td className="px-4 py-3 text-center font-medium">
                            <span className={gd > 0 ? "text-green-600" : gd < 0 ? "text-red-500" : "text-gray-400"}>
                              {gd > 0 ? `+${gd}` : gd}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {groupTeams.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nu există echipe în această grupă.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-8 border-t border-gray-200">
        <h2 className="text-xl font-black text-gray-900 mb-6">{sport === "basketball" ? "🏀 Top 10 Marcatori" : "⚽ Top 10 Golgheteri"}</h2>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center w-16">Loc</th>
                <th className="px-4 py-3">Jucător</th>
                <th className="px-4 py-3 hidden sm:table-cell">Echipă</th>
                <th className="px-4 py-3 text-center w-24">{sport === "basketball" ? "Puncte" : "Goluri"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topPlayers.map((player: any, index: number) => (
                <tr key={player.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-center font-medium text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">
                      <span className="text-gray-400 text-xs mr-2">#{player.jersey_number}</span>
                      {player.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {player.team?.name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold">
                      {player.goals_scored}
                    </span>
                  </td>
                </tr>
              ))}
              {topPlayers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    {sport === "basketball" ? "Nu s-au înregistrat puncte încă." : "Nu s-a marcat niciun gol încă."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
