import { createPublicClient } from "@/lib/supabase/public";
import { getCurrentSport } from "@/lib/sport";
import DrawManager from "@/components/admin/DrawManager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Tragere la Sorți" };
export const dynamic = "force-dynamic";

export default async function AdminDrawPage() {
  const sport = await getCurrentSport();
  const supabase = createPublicClient();

  // 1. Preluăm echipele
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, group_name")
    .eq("sport_type", sport)
    .order("name");

  // 2. Verificăm dacă există meciuri în grupă
  const { count: matchesCount } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("sport_type", sport)
    .eq("stage", "group");

  const teams = teamsData ?? [];
  const hasGroups = teams.some(t => t.group_name !== null);
  const hasMatches = (matchesCount ?? 0) > 0;
  
  const canDrawGroups = teams.length >= 8;

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900">🎲 Tragere la Sorți</h1>
        <p className="text-gray-500 text-sm mt-1">
          Împarte echipele în grupe și generează meciurile pentru faza grupelor (suportă 32 de echipe sau orice număr ≥ 8).
        </p>
      </div>

      {teamsError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
          ⚠️ Eroare la încărcare: {teamsError.message}
        </div>
      )}

      {!canDrawGroups && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-amber-800 text-sm font-semibold flex items-center gap-2">
            <span>⚠️</span> E nevoie de minimum 8 echipe pentru a forma cele 4 grupe (A, B, C, D). Ai momentan {teams.length} echipe.
          </p>
        </div>
      )}

      <DrawManager 
        teams={teams}
        hasGroups={hasGroups}
        hasMatches={hasMatches}
        canDrawGroups={canDrawGroups}
        sport={sport}
      />
    </div>
  );
}
