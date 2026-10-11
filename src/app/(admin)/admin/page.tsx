import { createPublicClient } from "@/lib/supabase/public";
import { getCurrentSport, SPORT_LABELS, SPORT_ICONS } from "@/lib/sport";
import type { Metadata } from "next";
import Link from "next/link";
import ResetTournamentButton from "@/components/admin/ResetTournamentButton";

export const metadata: Metadata = { title: "Dashboard Admin" };

async function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-xl mb-4 shadow-sm`}>
        {icon}
      </div>
      <div className="text-3xl font-black text-gray-900 mb-1">{value}</div>
      <div className="font-semibold text-gray-700 text-sm">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function AdminDashboard() {
  const sport = await getCurrentSport();
  const supabase = createPublicClient();

  // Fetch statistici în paralel
  const [teamsRes, playersRes, matchesRes] = await Promise.all([
    supabase.from("teams").select("id", { count: "exact", head: true }).eq("sport_type", sport),
    supabase.from("players").select("id, team:teams!inner(sport_type)", { count: "exact", head: true }).eq("teams.sport_type", sport),
    supabase.from("matches").select("id, status", { count: "exact" }).eq("sport_type", sport),
  ]);

  const totalTeams   = teamsRes.count   ?? 0;
  const totalPlayers = playersRes.count ?? 0;

  const matches        = matchesRes.data ?? [];
  const finishedCount  = matches.filter(m => m.status === "finished").length;
  const scheduledCount = matches.filter(m => m.status === "scheduled").length;

  // Ultimele echipe adăugate
  const { data: recentTeams } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .eq("sport_type", sport)
    .order("created_at", { ascending: false })
    .limit(5);

  // Ultimii jucători adăugați
  const { data: recentPlayers } = await supabase
    .from("players")
    .select("id, name, jersey_number, role, teams!inner(name, sport_type)")
    .eq("teams.sport_type", sport)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Dashboard &mdash; {SPORT_ICONS[sport]} {SPORT_LABELS[sport]}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Bine ai venit! Gestionează turneul PoliSport din acest panou.
          </p>
        </div>
        <ResetTournamentButton />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Echipe înregistrate" value={totalTeams}   icon="🛡️" color="bg-green-100" sub="în turneu" />
        <StatCard label="Jucători"            value={totalPlayers} icon="👤" color="bg-blue-100"  sub="total înregistrați" />
        <StatCard label="Meciuri finalizate"  value={finishedCount} icon="✅" color="bg-emerald-100" sub={`din ${matches.length} total`} />
      </div>

      {/* Progress bar turneu */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">Progres Turneu</h2>
          <span className="text-sm text-gray-500">
            {finishedCount}/{matches.length} meciuri finalizate
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-700"
            style={{ width: matches.length > 0 ? `${(finishedCount / matches.length) * 100}%` : "0%" }}
          />
        </div>
        <div className="flex gap-6 mt-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-gray-600">{finishedCount} finalizate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-gray-600">{scheduledCount} programate</span>
          </div>
        </div>
      </div>

      {/* Recent tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Echipe recente */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">🛡️ Echipe recente</h2>
            <Link href="/admin/echipe" className="text-green-600 hover:text-green-700 text-sm font-semibold">
              Vezi toate →
            </Link>
          </div>
          {recentTeams && recentTeams.length > 0 ? (
            <ul className="divide-y divide-gray-50">
              {recentTeams.map(t => (
                <li key={t.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-black text-xs shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <span className="font-medium text-gray-800 text-sm">{t.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Nicio echipă adăugată încă
            </div>
          )}
        </div>

        {/* Jucători recenți */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">👤 Jucători recenți</h2>
            <Link href="/admin/jucatori" className="text-green-600 hover:text-green-700 text-sm font-semibold">
              Vezi toți →
            </Link>
          </div>
          {recentPlayers && recentPlayers.length > 0 ? (
            <ul className="divide-y divide-gray-50">
              {recentPlayers.map((p: any) => (
                <li key={p.id} className="flex items-center gap-3 px-6 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0
                    ${p.role === "goalkeeper" ? "bg-blue-500" : "bg-green-600"}`}>
                    #{p.jersey_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 text-sm truncate">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.teams?.name ?? "—"}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                    ${p.role === "goalkeeper" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                    {p.role === "goalkeeper" ? "Portar" : "Jucător"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Niciun jucător adăugat încă
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
