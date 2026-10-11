"use client";

import { useState, useTransition, useMemo } from "react";
import { scheduleMatchAction, deleteMatchAction } from "@/lib/actions/matches_schedule";

interface Team {
  id: string;
  name: string;
  group_name: string | null;
}

interface Match {
  id: string;
  stage: string;
  status: string;
  round?: number | null;
  match_time: string | null;
  home_team: Team;
  away_team: Team;
}

type GroupFilter = "all" | "A" | "B" | "C" | "D" | "knockout";

const GROUP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  B: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  C: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  D: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

const STAGE_LABELS: Record<string, string> = {
  ro16: "Optimi",
  quarter: "Sferturi",
  semi: "Semifinale",
  final: "Finala",
  third_place: "Finala Mică",
};

export default function SchedulerManager({ matches }: { matches: Match[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<GroupFilter>("all");

  const getMatchGroup = (m: Match): string | null => {
    if (m.stage !== "group") return null;
    return m.home_team.group_name || m.away_team.group_name || null;
  };

  const groupCounts = useMemo(() => {
    const counts = { all: matches.length, A: 0, B: 0, C: 0, D: 0, knockout: 0 };
    for (const m of matches) {
      const g = getMatchGroup(m);
      if (g === "A" || g === "B" || g === "C" || g === "D") {
        counts[g]++;
      } else {
        counts.knockout++;
      }
    }
    return counts;
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (activeFilter === "all") return matches;
    if (activeFilter === "knockout") return matches.filter(m => m.stage !== "group");
    return matches.filter(m => getMatchGroup(m) === activeFilter);
  }, [matches, activeFilter]);

  function handleSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await scheduleMatchAction(fd);
      if ("error" in res) {
        setError(res.error);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Ești sigur că vrei să ștergi acest meci? Această acțiune va goli poziția meciului în arborele eliminatoriu.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteMatchAction(id);
      if ("error" in res) {
        setError(res.error);
      }
    });
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
        <div className="text-4xl mb-3">📅</div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Toate meciurile au fost programate</h3>
        <p className="text-sm">Nu există niciun meci care să necesite programare momentan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
          ⚠️ {error}
        </div>
      )}

      {/* Filtre pe Grupe */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-100 rounded-2xl">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
            activeFilter === "all"
              ? "bg-white shadow text-gray-900"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Toate
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700">
            {groupCounts.all}
          </span>
        </button>

        {(["A", "B", "C", "D"] as const).map(group => (
          <button
            key={group}
            onClick={() => setActiveFilter(group)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeFilter === group
                ? "bg-white shadow text-blue-700"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Grupa {group}
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs font-black ${
                activeFilter === group ? "bg-blue-100 text-blue-800" : "bg-gray-200 text-gray-700"
              }`}
            >
              {groupCounts[group]}
            </span>
          </button>
        ))}

        <button
          onClick={() => setActiveFilter("knockout")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
            activeFilter === "knockout"
              ? "bg-white shadow text-rose-700"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Faze Eliminatorii
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700">
            {groupCounts.knockout}
          </span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 border-b border-gray-200">
              <th className="py-3.5 px-4 text-left font-bold text-xs uppercase">Echipe</th>
              <th className="py-3.5 px-4 text-center font-bold text-xs uppercase w-36">Grupă / Fază</th>
              <th className="py-3.5 px-4 text-right font-bold text-xs uppercase">Data & Ora Meciului</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredMatches.map(match => {
              const group = getMatchGroup(match);
              const groupStyle = group && GROUP_STYLES[group]
                ? GROUP_STYLES[group]
                : { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };

              return (
                <tr key={match.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">{match.home_team.name}</span>
                      <span className="text-xs font-black text-gray-400 px-2 py-0.5 rounded bg-gray-100">VS</span>
                      <span className="font-semibold text-gray-900">{match.away_team.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shadow-xs ${groupStyle.bg} ${groupStyle.text} ${groupStyle.border}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current opacity-80" />
                        {match.stage === "group"
                          ? `Grupa ${group || "?"}`
                          : STAGE_LABELS[match.stage] || "Eliminatoriu"}
                      </span>
                      {match.stage === "group" && match.round && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                          Runda {match.round}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <form onSubmit={handleSchedule} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={match.id} />
                        <input
                          type="datetime-local"
                          name="datetime"
                          required
                          className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button
                          type="submit"
                          disabled={isPending}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                        >
                          {isPending ? "..." : "Programează"}
                        </button>
                      </form>
                      <button
                        onClick={() => handleDelete(match.id)}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-1 border border-red-100"
                        title="Șterge meci"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredMatches.length === 0 && (
              <tr>
                <td colSpan={3} className="py-12 text-center text-gray-400">
                  Niciun meci de programat pentru filtrul selectat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
