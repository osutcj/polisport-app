"use client";

import { useState, useTransition } from "react";
import { saveAllKnockoutMatchesAction } from "@/lib/actions/knockoutActions";

function getWinner(match: any): { id: string; name: string } | null {
  if (!match || match.status !== "finished") return null;
  const homeGoals = match.home_score ?? 0;
  const awayGoals = match.away_score ?? 0;
  if (homeGoals > awayGoals || match.penalty_winner_id === match.home_team_id) {
    return { id: match.home_team_id, name: match.home_team.name };
  }
  return { id: match.away_team_id, name: match.away_team.name };
}

function getLoser(match: any): { id: string; name: string } | null {
  if (!match || match.status !== "finished") return null;
  const homeGoals = match.home_score ?? 0;
  const awayGoals = match.away_score ?? 0;
  if (homeGoals > awayGoals || match.penalty_winner_id === match.home_team_id) {
    return { id: match.away_team_id, name: match.away_team.name };
  }
  return { id: match.home_team_id, name: match.home_team.name };
}

interface MatchSlot {
  home_team_id: string;
  away_team_id: string;
}

function MatchCard({
  label,
  slot,
  onHome,
  onAway,
  options,
  existingMatch,
}: {
  label: string;
  slot: MatchSlot;
  onHome: (v: string) => void;
  onAway: (v: string) => void;
  options: { id: string; name: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingMatch?: any;
}) {
  if (existingMatch) {
    const isForfeit = !!existingMatch.forfeit_loser_id;
    const homeWin =
      existingMatch.status === "finished" &&
      ((isForfeit && existingMatch.forfeit_loser_id === existingMatch.away_team_id) ||
        (!isForfeit && ((existingMatch.home_score ?? 0) > (existingMatch.away_score ?? 0) ||
          existingMatch.penalty_winner_id === existingMatch.home_team_id)));
    const awayWin =
      existingMatch.status === "finished" &&
      ((isForfeit && existingMatch.forfeit_loser_id === existingMatch.home_team_id) ||
        (!isForfeit && ((existingMatch.away_score ?? 0) > (existingMatch.home_score ?? 0) ||
          existingMatch.penalty_winner_id === existingMatch.away_team_id)));

    return (
      <div className="w-56 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="text-[10px] text-center font-bold text-gray-400 uppercase tracking-wider bg-gray-50 py-1 border-b border-gray-100">
          {label}
        </div>
        <div className={`flex justify-between items-center px-3 py-2 border-b border-gray-50 ${homeWin ? "bg-green-50" : ""}`}>
          <span className={`text-xs font-bold truncate ${homeWin ? "text-green-800" : "text-gray-700"}`}>
            {existingMatch.home_team?.name || "?"}
          </span>
          <span className="font-black text-sm text-gray-800 flex items-center gap-1">
            {existingMatch.home_score !== null ? existingMatch.home_score : "-"}
            {isForfeit && existingMatch.forfeit_loser_id === existingMatch.away_team_id && (
              <span className="text-[9px] text-red-500 font-bold">(mv)</span>
            )}
          </span>
        </div>
        <div className={`flex justify-between items-center px-3 py-2 ${awayWin ? "bg-green-50" : ""}`}>
          <span className={`text-xs font-bold truncate ${awayWin ? "text-green-800" : "text-gray-700"}`}>
            {existingMatch.away_team?.name || "?"}
          </span>
          <span className="font-black text-sm text-gray-800 flex items-center gap-1">
            {existingMatch.away_score !== null ? existingMatch.away_score : "-"}
            {isForfeit && existingMatch.forfeit_loser_id === existingMatch.home_team_id && (
              <span className="text-[9px] text-red-500 font-bold">(mv)</span>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 bg-white border border-blue-200 rounded-xl shadow-sm overflow-hidden">
      <div className="text-[10px] text-center font-bold text-blue-500 uppercase tracking-wider bg-blue-50 py-1 border-b border-blue-100">
        {label}
      </div>
      <div className="p-2 border-b border-gray-50">
        <select
          className="w-full text-xs p-1.5 rounded border border-gray-200 focus:ring-2 focus:ring-blue-400"
          value={slot.home_team_id}
          onChange={(e) => onHome(e.target.value)}
          disabled={options.length === 0}
        >
          <option value="">Echipa 1...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
      <div className="p-2">
        <select
          className="w-full text-xs p-1.5 rounded border border-gray-200 focus:ring-2 focus:ring-blue-400"
          value={slot.away_team_id}
          onChange={(e) => onAway(e.target.value)}
          disabled={options.length === 0}
        >
          <option value="">Echipa 2...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Render a stage column
function StageColumn({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-4">{title}</h3>
      <div className="flex flex-col justify-around gap-4 flex-1">
        {children}
      </div>
    </div>
  );
}

export default function KnockoutManager({ topTeams, allTeams, existingMatches, sport }: any) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // State for each stage
  const [ro16, setRo16] = useState<MatchSlot[]>(
    Array(8).fill(null).map(() => ({ home_team_id: "", away_team_id: "" }))
  );
  const [quarters, setQuarters] = useState<MatchSlot[]>(
    Array(4).fill(null).map(() => ({ home_team_id: "", away_team_id: "" }))
  );
  const [semis, setSemis] = useState<MatchSlot[]>(
    Array(2).fill(null).map(() => ({ home_team_id: "", away_team_id: "" }))
  );
  const [finalMatch, setFinalMatch] = useState<MatchSlot>({ home_team_id: "", away_team_id: "" });
  const [thirdPlace, setThirdPlace] = useState<MatchSlot>({ home_team_id: "", away_team_id: "" });

  const hasExisting = existingMatches && existingMatches.length > 0;

  // Get existing matches by stage
  const existingRo16 = existingMatches?.filter((m: any) => m.stage === "ro16") ?? [];
  const existingQuarters = existingMatches?.filter((m: any) => m.stage === "quarter") ?? [];
  const existingSemis = existingMatches?.filter((m: any) => m.stage === "semi") ?? [];
  const existingFinal = existingMatches?.filter((m: any) => m.stage === "final") ?? [];
  const existingThirdPlace = existingMatches?.filter((m: any) => m.stage === "third_place") ?? [];

  // Derive available teams for each stage from finished matches
  const quarterOptions = sport === "basketball" 
    ? topTeams 
    : existingRo16.map((m: any) => getWinner(m)).filter(Boolean);
  const semiOptions = existingQuarters
    .map((m: any) => getWinner(m))
    .filter(Boolean);
  const finalOptions = existingSemis
    .map((m: any) => getWinner(m))
    .filter(Boolean);
  const thirdPlaceOptions = existingSemis
    .map((m: any) => getLoser(m))
    .filter(Boolean);

  function handleSave() {
    setError(null);
    setSuccess(false);

    const allMatches: { stage: string; home_team_id: string; away_team_id: string; bracket_position: string }[] = [];

    ro16.forEach((m, i) => allMatches.push({ stage: "ro16", bracket_position: `ro16_${i}`, ...m }));
    quarters.forEach((m, i) => allMatches.push({ stage: "quarter", bracket_position: `quarter_${i}`, ...m }));
    semis.forEach((m, i) => allMatches.push({ stage: "semi", bracket_position: `semi_${i}`, ...m }));
    allMatches.push({ stage: "final", bracket_position: "final_0", ...finalMatch });
    allMatches.push({ stage: "third_place", bracket_position: "third_place_0", ...thirdPlace });

    const validMatches = allMatches.filter(m => m.home_team_id !== "" && m.away_team_id !== "");

    if (validMatches.length === 0) {
      setError("Nu ai selectat niciun meci nou valid pentru salvare.");
      return;
    }

    startTransition(async () => {
      const res = await saveAllKnockoutMatchesAction(validMatches);
      if ("error" in res) {
        setError(res.error);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  function updateSlot(
    arr: MatchSlot[],
    setArr: React.Dispatch<React.SetStateAction<MatchSlot[]>>,
    index: number,
    field: "home_team_id" | "away_team_id",
    value: string
  ) {
    const copy = [...arr];
    copy[index] = { ...copy[index], [field]: value };
    setArr(copy);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium text-sm">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 font-medium text-sm">
          ✅ Arborele a fost salvat! Meciurile sunt acum disponibile la Programare.
        </div>
      )}

      <div className="flex justify-between items-center gap-4">
        {hasExisting ? (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm font-bold flex-1">
            ℹ️ Poți adăuga meciuri suplimentare și poți salva arborele din nou.
          </div>
        ) : (
          <div className="flex-1"></div>
        )}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 shadow-lg whitespace-nowrap"
        >
          {isPending ? "⏳ Se salvează..." : "💾 Salvează Arbore"}
        </button>
      </div>

      {/* BRACKET VIZUAL */}
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 overflow-x-auto">
        <div className="min-w-[1200px] flex items-stretch gap-2 justify-between">

          {/* Col 1: Optimi Stânga (M1-M4) - Ascuns la baschet */}
          {sport !== "basketball" && (
            <StageColumn title="Optimi">
              {[0, 1, 2, 3].map(i => (
                <MatchCard
                  key={`ro16-${i}`}
                  label={`Optimi ${i + 1}`}
                  slot={ro16[i]}
                  onHome={(v) => updateSlot(ro16, setRo16, i, "home_team_id", v)}
                  onAway={(v) => updateSlot(ro16, setRo16, i, "away_team_id", v)}
                  options={topTeams}
                  existingMatch={existingRo16.find((m: any) => m.bracket_position === `ro16_${i}`)}
                />
              ))}
            </StageColumn>
          )}

          {/* Col 2: Sferturi Stânga (Q1-Q2) */}
          <StageColumn title="Sferturi" className={sport === "basketball" ? "" : "py-10"}>
            {[0, 1].map(i => (
              <MatchCard
                key={`quarter-${i}`}
                label={`Sfert ${i + 1}`}
                slot={quarters[i]}
                onHome={(v) => updateSlot(quarters, setQuarters, i, "home_team_id", v)}
                onAway={(v) => updateSlot(quarters, setQuarters, i, "away_team_id", v)}
                options={sport === "basketball" ? topTeams : (hasExisting ? quarterOptions : allTeams)}
                existingMatch={existingQuarters.find((m: any) => m.bracket_position === `quarter_${i}`)}
              />
            ))}
          </StageColumn>

          {/* Col 3: Semifinală Stânga */}
          <StageColumn title="Semifinale" className={sport === "basketball" ? "py-14" : "py-24"}>
            <MatchCard
              label="Semifinala 1"
              slot={semis[0]}
              onHome={(v) => updateSlot(semis, setSemis, 0, "home_team_id", v)}
              onAway={(v) => updateSlot(semis, setSemis, 0, "away_team_id", v)}
              options={hasExisting ? semiOptions : allTeams}
              existingMatch={existingSemis.find((m: any) => m.bracket_position === `semi_0`)}
            />
          </StageColumn>

          {/* CENTRU: Finala Mare + Finala Mică */}
          <div className="flex flex-col items-center justify-center gap-8 px-4">
            <div className="text-center">
              <span className="text-3xl">🏆</span>
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mt-2 mb-4">Finala Mare</h3>
              <MatchCard
                label="Finala"
                slot={finalMatch}
                onHome={(v) => setFinalMatch(prev => ({ ...prev, home_team_id: v }))}
                onAway={(v) => setFinalMatch(prev => ({ ...prev, away_team_id: v }))}
                options={hasExisting ? finalOptions : allTeams}
                existingMatch={existingFinal.find((m: any) => m.bracket_position === `final_0`)}
              />
            </div>
            <div className="text-center">
              <span className="text-2xl">🥉</span>
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mt-2 mb-4">Finala Mică</h3>
              <MatchCard
                label="Locul 3"
                slot={thirdPlace}
                onHome={(v) => setThirdPlace(prev => ({ ...prev, home_team_id: v }))}
                onAway={(v) => setThirdPlace(prev => ({ ...prev, away_team_id: v }))}
                options={hasExisting ? thirdPlaceOptions : allTeams}
                existingMatch={existingThirdPlace.find((m: any) => m.bracket_position === `third_place_0`)}
              />
            </div>
          </div>

          {/* Col 5: Semifinală Dreapta */}
          <StageColumn title="Semifinale" className={sport === "basketball" ? "py-14" : "py-24"}>
            <MatchCard
              label="Semifinala 2"
              slot={semis[1]}
              onHome={(v) => updateSlot(semis, setSemis, 1, "home_team_id", v)}
              onAway={(v) => updateSlot(semis, setSemis, 1, "away_team_id", v)}
              options={hasExisting ? semiOptions : allTeams}
              existingMatch={existingSemis.find((m: any) => m.bracket_position === `semi_1`)}
            />
          </StageColumn>

          {/* Col 6: Sferturi Dreapta (Q3-Q4) */}
          <StageColumn title="Sferturi" className={sport === "basketball" ? "" : "py-10"}>
            {[2, 3].map(i => (
              <MatchCard
                key={`quarter-${i}`}
                label={`Sfert ${i + 1}`}
                slot={quarters[i]}
                onHome={(v) => updateSlot(quarters, setQuarters, i, "home_team_id", v)}
                onAway={(v) => updateSlot(quarters, setQuarters, i, "away_team_id", v)}
                options={sport === "basketball" ? topTeams : (hasExisting ? quarterOptions : allTeams)}
                existingMatch={existingQuarters.find((m: any) => m.bracket_position === `quarter_${i}`)}
              />
            ))}
          </StageColumn>

          {/* Col 7: Optimi Dreapta (M5-M8) - Ascuns la baschet */}
          {sport !== "basketball" && (
            <StageColumn title="Optimi">
              {[4, 5, 6, 7].map(i => (
                <MatchCard
                  key={`ro16-${i}`}
                  label={`Optimi ${i + 1}`}
                  slot={ro16[i]}
                  onHome={(v) => updateSlot(ro16, setRo16, i, "home_team_id", v)}
                  onAway={(v) => updateSlot(ro16, setRo16, i, "away_team_id", v)}
                  options={topTeams}
                  existingMatch={existingRo16.find((m: any) => m.bracket_position === `ro16_${i}`)}
                />
              ))}
            </StageColumn>
          )}

        </div>
      </div>
    </div>
  );
}
