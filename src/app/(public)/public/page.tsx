import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import TournamentBracket from "@/components/admin/TournamentBracket";
import type { SportType } from "@/lib/sport";
import { SPORT_LABELS, SPORT_ICONS } from "@/lib/sport";

export const metadata: Metadata = { title: "Portal Public — Polisport" };
export const dynamic = "force-dynamic";

export default async function PublicPage({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const params = await searchParams;
  const sport: SportType = params.sport === "basketball" ? "basketball" : "football";
  const supabase = createPublicClient();

  // 1. Echipe și clasament grupe
  const { data: teamsData } = await supabase.from("teams").select("*").not("group_name", "is", null).eq("sport_type", sport);
  const teams = teamsData ?? [];
  
  const sortTeams = (a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goals_scored - a.goals_conceded;
    const gdB = b.goals_scored - b.goals_conceded;
    if (gdB !== gdA) return gdB - gdA;
    if (b.goals_scored !== a.goals_scored) return b.goals_scored - a.goals_scored;
    return a.name.localeCompare(b.name);
  };

  // 2. Meciuri pentru bracket și program
  const { data: matches } = await supabase
    .from("matches")
    .select(`
      id, home_team_id, away_team_id, home_score, away_score, status, stage, match_time, penalty_winner_id, forfeit_loser_id, bracket_position,
      home_team:teams!matches_home_team_id_fkey(name, group_name),
      away_team:teams!matches_away_team_id_fkey(name, group_name),
      match_events(team_id, event_type)
    `)
    .eq("sport_type", sport)
    .order("match_time", { ascending: true });

  const allMatches = matches ?? [];
  const scheduledMatches = allMatches.filter(m => m.match_time !== null);
  const knockoutMatches = allMatches.filter(m => ["ro16", "quarter", "semi", "final", "third_place"].includes(m.stage));

  // 3. Top Marcatori
  let players: any[] = [];
  if (sport === "basketball") {
    const { data: events } = await supabase
      .from("match_events")
      .select("player_id, points_value, player:players(name, jersey_number, team:teams(name))")
      .eq("sport_type", sport)
      .eq("event_type", "goal_scored");
    
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
    players = Object.values(agg).sort((a, b) => b.goals_scored - a.goals_scored).slice(0, 10);
  } else {
    const { data } = await supabase
      .from("players")
      .select("id, name, jersey_number, goals_scored, team:teams!inner(name, sport_type)")
      .eq("teams.sport_type", sport)
      .gt("goals_scored", 0)
      .order("goals_scored", { ascending: false })
      .limit(10);
    players = data || [];
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-12 px-6 shadow-lg mb-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-2">{SPORT_ICONS[sport]} Polisport Tournament - {SPORT_LABELS[sport]}</h1>
            <p className="text-blue-200 text-lg">Portal public de rezultate și clasamente</p>
          </div>
          <div className="flex items-center gap-2 bg-blue-950/60 p-1.5 rounded-2xl border border-blue-800/60 w-fit">
            <Link
              href="/public?sport=football"
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                sport === "football"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-blue-200 hover:text-white hover:bg-blue-800/40"
              }`}
            >
              ⚽ Fotbal
            </Link>
            <Link
              href="/public?sport=basketball"
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                sport === "basketball"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-blue-200 hover:text-white hover:bg-blue-800/40"
              }`}
            >
              🏀 Baschet
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 space-y-20">
        
        {/* SECȚIUNEA 1: Grupe */}
        <section>
          <h2 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
            <span className="text-3xl">📊</span> Clasament Grupe
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {["A", "B", "C", "D"].map(group => {
              const groupTeams = teams.filter(t => t.group_name === group).sort(sortTeams);
              return (
                <div key={group} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 px-5 py-3 border-b border-gray-200">
                    <h3 className="font-black text-gray-800 text-lg">Grupa {group}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3 text-center">Loc</th>
                          <th className="px-4 py-3">Echipă</th>
                          <th className="px-4 py-3 text-center">Pct</th>
                          <th className="px-4 py-3 text-center">GM-GP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {groupTeams.map((team, idx) => (
                          <tr key={team.id} className={idx < 4 ? "bg-green-50/30" : ""}>
                            <td className="px-4 py-3 text-center font-bold text-gray-500">{idx + 1}</td>
                            <td className="px-4 py-3 font-bold text-gray-900">{team.name}</td>
                            <td className="px-4 py-3 text-center font-black text-blue-700">{team.points}</td>
                            <td className="px-4 py-3 text-center text-gray-500">{team.goals_scored}-{team.goals_conceded}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECȚIUNEA 2: Bracket */}
        <section>
          <h2 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
            <span className="text-3xl">🔥</span> Faze Eliminatorii
          </h2>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
            {knockoutMatches.length > 0 ? (
              <TournamentBracket matches={knockoutMatches as any} sport={sport} />
            ) : (
              <p className="text-center text-gray-500 py-10">Fazele eliminatorii nu au fost încă generate.</p>
            )}
          </div>
        </section>

        {/* SECȚIUNEA 3: Program */}
        <section>
          <h2 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
            <span className="text-3xl">📅</span> Program Meciuri
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {scheduledMatches.map(m => {
                const homeYellows = (m as any).match_events?.filter((e: any) => e.team_id === m.home_team_id && e.event_type === "yellow_card").length || 0;
                const homeReds = (m as any).match_events?.filter((e: any) => e.team_id === m.home_team_id && e.event_type === "red_card").length || 0;
                const awayYellows = (m as any).match_events?.filter((e: any) => e.team_id === m.away_team_id && e.event_type === "yellow_card").length || 0;
                const awayReds = (m as any).match_events?.filter((e: any) => e.team_id === m.away_team_id && e.event_type === "red_card").length || 0;
                
                const homeScoreLive = (m as any).match_events?.filter((e: any) => e.team_id === m.home_team_id && (!e.event_type || e.event_type === "goal_scored" || e.event_type === "goal")).reduce((sum: number, e: any) => sum + (e.points_value !== undefined ? e.points_value : 1), 0) || 0;
                const awayScoreLive = (m as any).match_events?.filter((e: any) => e.team_id === m.away_team_id && (!e.event_type || e.event_type === "goal_scored" || e.event_type === "goal")).reduce((sum: number, e: any) => sum + (e.points_value !== undefined ? e.points_value : 1), 0) || 0;
                const homeScore = m.status === "finished" ? m.home_score : homeScoreLive;
                const awayScore = m.status === "finished" ? m.away_score : awayScoreLive;

                  const groupName = (m.home_team as any)?.group_name || (m.away_team as any)?.group_name;
                  const groupColor = groupName === "A" ? "bg-blue-50 text-blue-700 border-blue-200"
                    : groupName === "B" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : groupName === "C" ? "bg-purple-50 text-purple-700 border-purple-200"
                    : groupName === "D" ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-gray-100 text-gray-700 border-gray-200";

                  return (
                  <li key={m.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                      {m.stage === "group" ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black border w-fit ${groupColor}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                          Grupa {groupName || "?"}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                          {({ ro16: "Optimi", quarter: "Sferturi", semi: "Semifinale", final: "Finala", third_place: "Finala Mică" } as Record<string, string>)[m.stage] || "Eliminatoriu"}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-500" suppressHydrationWarning>
                        {new Date(m.match_time!).toLocaleString("ro-RO", { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })}
                      </span>
                    </div>

                  <div className="flex items-center gap-4 sm:gap-6 bg-gray-50/50 sm:bg-transparent p-3 sm:p-0 rounded-xl">
                    <div className={`flex items-center justify-end gap-2 font-bold w-32 sm:w-40 text-right ${homeScore !== null && homeScore > (awayScore || 0) ? 'text-gray-900' : 'text-gray-600'}`}>
                      {(m.home_team as any)?.name}
                      {sport === "football" && (homeYellows > 0 || homeReds > 0) && (
                        <span className="flex items-center gap-1 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                          {homeYellows > 0 && <span className="text-yellow-600">🟨 {homeYellows}</span>}
                          {homeReds > 0 && <span className="text-red-600">🟥 {homeReds}</span>}
                        </span>
                      )}
                    </div>
                    
                        <div className="flex items-center justify-center min-w-[80px] relative">
                          {m.status === "finished" ? (
                            <div className="flex flex-col items-center">
                              <span className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg font-black text-lg shadow-inner">
                                {homeScore} - {awayScore}
                              </span>
                              {m.penalty_winner_id && (
                                <span className="text-[10px] uppercase font-bold text-amber-600 mt-1">
                                  {m.penalty_winner_id === m.home_team_id ? "Gazda" : "Oaspete"} (Pen)
                                </span>
                              )}
                              {(m as any).forfeit_loser_id && (
                                <span className="text-[9px] uppercase font-bold text-red-600 mt-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                  Masă verde
                                </span>
                              )}
                            </div>
                          ) : m.status === "in_progress" ? (
                        <div className="flex flex-col items-center">
                          <span className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg font-black text-lg shadow-inner">
                            {homeScore} - {awayScore}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 font-black text-sm">VS</span>
                      )}
                    </div>

                    <div className={`flex items-center justify-start gap-2 font-bold w-32 sm:w-40 text-left ${awayScore !== null && awayScore > (homeScore || 0) ? 'text-gray-900' : 'text-gray-600'}`}>
                      {sport === "football" && (awayYellows > 0 || awayReds > 0) && (
                        <span className="flex items-center gap-1 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
                          {awayYellows > 0 && <span className="text-yellow-600">🟨 {awayYellows}</span>}
                          {awayReds > 0 && <span className="text-red-600">🟥 {awayReds}</span>}
                        </span>
                      )}
                      {(m.away_team as any)?.name}
                    </div>
                  </div>
                </li>
              )})}
              {scheduledMatches.length === 0 && (
                <li className="p-10 text-center text-gray-500">Niciun meci programat momentan.</li>
              )}
            </ul>
          </div>
        </section>

        {/* SECȚIUNEA 4: Marcatori */}
        <section>
          <h2 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
            <span className="text-3xl">{sport === "basketball" ? "🏀" : "⚽"}</span> 
            {sport === "basketball" ? "Top 10 Marcatori" : "Top 10 Golgheteri"}
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Jucător</th>
                  <th className="px-6 py-4 hidden sm:table-cell">Echipă</th>
                  <th className="px-6 py-4 text-center">{sport === "basketball" ? "Puncte" : "Goluri"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(players ?? []).map(p => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <span className="text-gray-400 font-medium text-xs mr-2">#{p.jersey_number}</span>
                      {p.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600 hidden sm:table-cell">{(p.team as any)?.name}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-blue-50 text-blue-700 font-bold">
                        {p.goals_scored}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        
      </main>
    </div>
  );
}
