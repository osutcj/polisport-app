import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { getCurrentSport, SPORT_LABELS, SPORT_ICONS } from "@/lib/sport";
import SchedulerManager from "@/components/admin/SchedulerManager";

export const metadata: Metadata = { title: "Admin — Programare Meciuri" };
export const dynamic = "force-dynamic";

export default async function AdminMeciuriPage() {
  const sport = await getCurrentSport();
  const supabase = createPublicClient();

  // Preluăm doar meciurile neprogramate (match_time e null)
  const { data: matchesData, error: matchesError } = await supabase
    .from("matches")
    .select(`
      id,
      home_team_id,
      away_team_id,
      stage,
      status,
      round,
      match_time,
      home_team:teams!matches_home_team_id_fkey(id, name, group_name),
      away_team:teams!matches_away_team_id_fkey(id, name, group_name)
    `)
    .eq("sport_type", sport)
    .is("match_time", null)
    .order("stage", { ascending: true })
    .order("round", { ascending: true })
    .order("id", { ascending: true });

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900">📅 Programare Meciuri</h1>
        <p className="text-gray-500 text-sm mt-1">
          Setează data și ora pentru meciurile neprogramate.
        </p>
      </div>

      {matchesError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠️ Eroare la încărcarea datelor: {matchesError.message}
        </div>
      )}

      <SchedulerManager matches={(matchesData as any) ?? []} />
    </div>
  );
}
