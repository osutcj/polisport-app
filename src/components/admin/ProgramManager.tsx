"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import {
  addGoalAction,
  removeGoalAction,
  finalizeMatchAction,
  reopenMatchAction,
  rescheduleMatchAction,
} from "@/lib/actions/matchActions";

// ─── Tipuri ──────────────────────────────────────────────────────────────────
interface Player {
  id: string;
  name: string;
  jersey_number: number;
  team_id: string;
}

interface GoalEvent {
  id: string;
  player_id: string;
  team_id: string;
  points_value?: number;
  event_type?: string;
  player: { name: string; jersey_number: number };
  team: { name: string };
}

interface Match {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  stage: string;
  round?: number | null;
  match_time?: string | null;
  penalty_winner_id?: string | null;
  home_team: { id: string; name: string; group_name?: string | null };
  away_team: { id: string; name: string; group_name?: string | null };
  match_events: GoalEvent[];
}

function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "evt-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 9);
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">✕</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Badge status ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "finished")
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">✓ Finalizat</span>;
  if (status === "in_progress")
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 animate-pulse">⚡ În desfășurare</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">⏳ Programat</span>;
}

// ─── Match Item Row ──────────────────────────────────────────────────────────
function MatchItemRow({
  match,
  sport,
  openModal,
  handleReschedule,
  isPending,
}: {
  match: Match;
  sport: "football" | "basketball";
  openModal: (match: Match) => void;
  handleReschedule: (matchId: string) => void;
  isPending: boolean;
}) {
  const homeGoals = match.match_events.filter(e => e.team_id === match.home_team_id && (!e.event_type || e.event_type === "goal_scored" || e.event_type === "goal"));
  const awayGoals = match.match_events.filter(e => e.team_id === match.away_team_id && (!e.event_type || e.event_type === "goal_scored" || e.event_type === "goal"));

  const computedHomeScore = sport === "football" ? homeGoals.length : homeGoals.reduce((sum, e) => sum + (e.points_value !== undefined ? e.points_value : 1), 0);
  const computedAwayScore = sport === "football" ? awayGoals.length : awayGoals.reduce((sum, e) => sum + (e.points_value !== undefined ? e.points_value : 1), 0);

  const homeScore = match.status === "finished" ? (match.home_score ?? computedHomeScore) : computedHomeScore;
  const awayScore = match.status === "finished" ? (match.away_score ?? computedAwayScore) : computedAwayScore;

  const homeYellows = match.match_events.filter(e => e.team_id === match.home_team_id && e.event_type === "yellow_card").length;
  const homeReds = match.match_events.filter(e => e.team_id === match.home_team_id && e.event_type === "red_card").length;
  const awayYellows = match.match_events.filter(e => e.team_id === match.away_team_id && e.event_type === "yellow_card").length;
  const awayReds = match.match_events.filter(e => e.team_id === match.away_team_id && e.event_type === "red_card").length;

  const matchHour = match.match_time ? new Date(match.match_time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' }) : 'N/A';

  const stageLabels: Record<string, string> = { group: "Grupe", ro16: "Optimi", quarter: "Sferturi", semi: "Semifinale", final: "Finala", third_place: "Finala Mică" };
  const groupName = match.home_team.group_name || match.away_team?.group_name;
  const groupColor = groupName === "A" ? "bg-blue-50 text-blue-700 border-blue-200"
    : groupName === "B" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : groupName === "C" ? "bg-purple-50 text-purple-700 border-purple-200"
    : groupName === "D" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <li className="p-4 hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Ora & Etapa */}
      <div className="flex flex-col min-w-[120px]">
        <span className="text-lg font-black text-gray-900" suppressHydrationWarning>{matchHour}</span>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {match.stage === "group" ? (
            <>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border shadow-2xs ${groupColor}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                Grupa {groupName || "?"}
              </span>
              {match.round && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                  Runda {match.round}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs font-bold text-rose-600 uppercase">
              {stageLabels[match.stage] || match.stage}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center gap-4">
        <div className={`flex-1 flex items-center justify-end gap-2 text-right font-semibold ${match.status === "finished" && homeScore > awayScore ? "text-green-700 font-bold" : "text-gray-800"}`}>
          {match.home_team.name}
          {sport === "football" && (homeYellows > 0 || homeReds > 0) && (
            <span className="flex items-center gap-1 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
              {homeYellows > 0 && <span className="text-yellow-600">🟨 {homeYellows}</span>}
              {homeReds > 0 && <span className="text-red-600">🟥 {homeReds}</span>}
            </span>
          )}
        </div>
        <div className="flex items-center justify-center min-w-[100px] relative">
          {match.status === "finished" ? (
            <div className="flex flex-col items-center">
              <span className="font-black text-lg bg-gray-900 text-white px-3 py-1 rounded-lg">
                {homeScore} - {awayScore}
              </span>
              {match.penalty_winner_id && (
                <span className="text-[10px] uppercase font-bold text-amber-600 mt-1">
                  {match.penalty_winner_id === match.home_team_id ? "Gazda" : "Oaspete"} (Pen)
                </span>
              )}
              {(match as any).forfeit_loser_id && (
                <span className="text-[9px] uppercase font-bold text-red-600 mt-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                  Masă verde
                </span>
              )}
            </div>
          ) : match.status === "in_progress" ? (
            <div className="flex flex-col items-center">
              <span className="font-black text-lg bg-gray-800 text-white px-3 py-1 rounded-lg">
                {homeScore} - {awayScore}
              </span>
            </div>
          ) : (
            <span className="text-gray-300 font-black">VS</span>
          )}
        </div>
        <div className={`flex-1 flex items-center justify-start gap-2 text-left font-semibold ${match.status === "finished" && awayScore > homeScore ? "text-green-700 font-bold" : "text-gray-800"}`}>
          {sport === "football" && (awayYellows > 0 || awayReds > 0) && (
            <span className="flex items-center gap-1 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">
              {awayYellows > 0 && <span className="text-yellow-600">🟨 {awayYellows}</span>}
              {awayReds > 0 && <span className="text-red-600">🟥 {awayReds}</span>}
            </span>
          )}
          {match.away_team.name}
        </div>
      </div>

      {/* Status & Actiuni */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-4 min-w-[150px]">
        <div className="hidden sm:block">
          <StatusBadge status={match.status} />
        </div>
        {match.status !== "finished" && (
          <button
            onClick={() => handleReschedule(match.id)}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
          >
            🔄 Reprogramează
          </button>
        )}
        <button
          onClick={() => openModal(match)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            match.status === "finished"
              ? "border-blue-200 text-blue-600 hover:bg-blue-50"
              : "border-green-200 text-green-700 hover:bg-green-50"
          }`}
        >
          {match.status === "finished" ? "✎ Editează" : (sport === "basketball" ? "🏀 Introduce scorul" : "⚽ Introduce goluri")}
        </button>
      </div>
    </li>
  );
}

export default function ProgramManager({
  matches,
  players,
  sport,
}: {
  matches: Match[];
  players: Player[];
  sport: "football" | "basketball";
}) {
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [localMatch, setLocalMatch]  = useState<Match | null>(null); // copie locală actualizată după acțiuni
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "scheduled" | "finished">("all");
  const [stageFilter, setStageFilter] = useState<"all" | "group" | "playoff" | "ro16" | "quarter" | "semi" | "final" | "third_place">("all");
  const [groupFilter, setGroupFilter] = useState<"all" | "A" | "B" | "C" | "D">("all");
  const [penaltyWinnerId, setPenaltyWinnerId] = useState<string | null>(null);
  const [forfeitLoserId, setForfeitLoserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"rounds" | "calendar">("rounds");
  const addFormRef = useRef<HTMLFormElement>(null);

  // Jucătorii celor două echipe din meciul deschis
  const matchPlayers = useCallback((match: Match) => ({
    home: players.filter(p => p.team_id === match.home_team_id),
    away: players.filter(p => p.team_id === match.away_team_id),
  }), [players]);

  const filtered = matches.filter(m => {
    if (filter === "scheduled" && m.status !== "scheduled" && m.status !== "in_progress") return false;
    if (filter === "finished" && m.status !== "finished") return false;
    if (stageFilter !== "all" && m.stage !== stageFilter) return false;
    if (stageFilter === "group" && groupFilter !== "all") {
      const g = m.home_team.group_name || m.away_team?.group_name;
      if (g !== groupFilter) return false;
    }
    return true;
  });

  function openModal(match: Match) {
    setModalMatch(match);
    setLocalMatch({ ...match });
    setPenaltyWinnerId(match.penalty_winner_id || null);
    setForfeitLoserId((match as any).forfeit_loser_id || null);
    setError(null);
  }
  function close() {
    setModalMatch(null);
    setLocalMatch(null);
    setError(null);
  }

  // ─── Adaugă gol ──────────────────────────────────────────────────────────
  function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(addFormRef.current!);
    fd.append("match_id", localMatch!.id);

    const nativeEvent = (e as any).nativeEvent;
    const submitter = nativeEvent?.submitter;
    
    // Extrage tipul de eveniment sau punctele de pe butonul apăsat
    if (submitter) {
      if (submitter.name === "points_value") {
        fd.set("points_value", submitter.value);
        fd.set("event_type", "goal_scored");
      }
      if (submitter.name === "event_type") {
        fd.set("event_type", submitter.value);
        fd.set("points_value", submitter.value === "goal_scored" ? "1" : "0");
      }
    }

    const playerId = fd.get("player_id") as string;
    const selectedPlayer = players.find(p => p.id === playerId);
    if (!selectedPlayer) return;

    startTransition(async () => {
      const result = await addGoalAction(fd);
      if ("error" in result) { setError(result.error); return; }
      
      const pval = fd.get("points_value") ? parseInt(fd.get("points_value") as string) : (fd.get("event_type") === "goal_scored" ? 1 : 0);
      const eventId = ("eventId" in result && result.eventId) ? result.eventId : safeUUID();

      // Actualizăm local pentru a vedea evenimentul imediat fără refresh
      const newEvent: GoalEvent = {
        id: eventId,
        player_id: selectedPlayer.id,
        team_id: selectedPlayer.team_id,
        event_type: fd.get("event_type") as string || "goal_scored",
        points_value: pval,
        player: { name: selectedPlayer.name, jersey_number: selectedPlayer.jersey_number },
        team: { name: localMatch!.home_team_id === selectedPlayer.team_id ? localMatch!.home_team.name : localMatch!.away_team.name },
      };
      setLocalMatch(prev => prev ? { ...prev, match_events: [...prev.match_events, newEvent] } : prev);
      addFormRef.current?.reset();
      setError(null);
    });
  }

  // ─── Șterge gol ──────────────────────────────────────────────────────────
  function handleRemoveGoal(eventId: string) {
    startTransition(async () => {
      const result = await removeGoalAction(eventId);
      if ("error" in result) { setError(result.error); return; }
      setLocalMatch(prev => prev ? {
        ...prev,
        match_events: prev.match_events.filter(e => e.id !== eventId),
      } : prev);
    });
  }

  // ─── Finalizează meciul ───────────────────────────────────────────────────
  function handleFinalize() {
    const homeGoals = localMatch!.match_events.filter(e => e.team_id === localMatch!.home_team_id && (!e.event_type || e.event_type === "goal_scored" || e.event_type === "goal"));
    const awayGoals = localMatch!.match_events.filter(e => e.team_id === localMatch!.away_team_id && (!e.event_type || e.event_type === "goal_scored" || e.event_type === "goal"));
    const homeScore = sport === "football" ? homeGoals.length : homeGoals.reduce((sum, e) => sum + (e.points_value !== undefined ? e.points_value : 1), 0);
    const awayScore = sport === "football" ? awayGoals.length : awayGoals.reduce((sum, e) => sum + (e.points_value !== undefined ? e.points_value : 1), 0);

    if (localMatch!.stage !== "group" && !forfeitLoserId) {
      if (homeScore === awayScore && !penaltyWinnerId) {
        setError(sport === "basketball" ? "Te rugăm să selectezi echipa care avansează după prelungiri/departajare." : "Te rugăm să selectezi echipa câștigătoare la departajare.");
        return;
      }
    }

    startTransition(async () => {
      const result = await finalizeMatchAction(localMatch!.id, penaltyWinnerId || undefined, forfeitLoserId || undefined);
      if ("error" in result) { setError(result.error); return; }
      close();
    });
  }

  // ─── Redeschide meciul ────────────────────────────────────────────────────
  function handleReopen() {
    startTransition(async () => {
      const result = await reopenMatchAction(localMatch!.id);
      if ("error" in result) { setError(result.error); return; }
      close();
    });
  }

  // ─── Reprogramează meciul (resetează tot) ─────────────────────────────────
  function handleReschedule(matchId: string) {
    if (!confirm("Ești sigur că vrei să reprogramezi acest meci? Toate evenimentele curente (goluri/cartonașe) vor fi șterse, iar meciul se va întoarce în panoul de programare.")) return;
    startTransition(async () => {
      const result = await rescheduleMatchAction(matchId);
      if ("error" in result) { alert(result.error); return; }
    });
  }

  const completedCount = matches.filter(m => m.status === "finished").length;
  const scheduledCount = matches.filter(m => m.status === "scheduled" || m.status === "in_progress").length;

  // Grupăm meciurile după dată (pentru modul calendar)
  const groupedMatches: Record<string, Match[]> = {};
  filtered.forEach(match => {
    let dateKey = "Fără Dată";
    if (match.match_time) {
      const d = new Date(match.match_time);
      dateKey = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' });
      dateKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);
    }
    if (!groupedMatches[dateKey]) groupedMatches[dateKey] = [];
    groupedMatches[dateKey].push(match);
  });

  // Grupăm meciurile pe Etape (Runde) și pe Grupe
  const groupStageMatches = filtered.filter(m => m.stage === "group");
  const knockoutStageMatches = filtered.filter(m => m.stage !== "group");

  const roundsMap = new Map<number, Record<string, Match[]>>();
  groupStageMatches.forEach(m => {
    const r = m.round || 1;
    if (!roundsMap.has(r)) roundsMap.set(r, {});
    const byGroup = roundsMap.get(r)!;
    const g = m.home_team.group_name || m.away_team?.group_name || "Altele";
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(m);
  });

  const sortedRoundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);

  const knockoutByStage: Record<string, Match[]> = {};
  knockoutStageMatches.forEach(m => {
    if (!knockoutByStage[m.stage]) knockoutByStage[m.stage] = [];
    knockoutByStage[m.stage].push(m);
  });

  const stageLabels: Record<string, string> = {
    group: "Grupe",
    ro16: "Optimi de finală",
    quarter: "Sferturi de finală",
    semi: "Semifinale",
    final: "Finala Mare",
    third_place: "Finala Mică",
  };

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{sport === "basketball" ? "🏀" : "⚽"} Meciuri</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {completedCount} finalizate · {scheduledCount} programate · {matches.length} total
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
          {stageFilter === "group" && (
            <div className="flex gap-1.5 p-1 bg-blue-50/80 rounded-xl text-xs font-bold border border-blue-200/60 overflow-x-auto">
              {(["all", "A", "B", "C", "D"] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGroupFilter(g)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    groupFilter === g
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-blue-900 hover:bg-blue-100"
                  }`}
                >
                  {g === "all" ? "Toate Grupele" : `Grupa ${g}`}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl text-sm font-semibold overflow-x-auto max-w-full">
            {(["all", "group", "ro16", "quarter", "semi", "final", "third_place"] as const).map(s => {
              if (sport === "basketball" && s === "ro16") return null;
              const labels: Record<string, string> = { all: "Toate Etapele", group: "Grupe", ro16: "Optimi", quarter: "Sferturi", semi: "Semifinale", final: "Finala", third_place: "Finala Mică" };
              return (
                <button
                  key={s}
                  onClick={() => setStageFilter(s)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${stageFilter === s ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl text-sm font-semibold">
            {(["all", "scheduled", "finished"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg transition-all ${filter === f ? "bg-white shadow text-green-700 font-bold" : "text-gray-500 hover:text-gray-700"}`}
              >
                {f === "all" ? "Toate" : f === "scheduled" ? "Programate" : "Finalizate"}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 p-1 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs sm:text-sm font-bold">
            <button
              onClick={() => setViewMode("rounds")}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                viewMode === "rounds" ? "bg-green-600 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
              }`}
            >
              🏆 Etape & Grupe
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                viewMode === "calendar" ? "bg-green-600 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
              }`}
            >
              📅 Calendar
            </button>
          </div>
        </div>
      </div>

      {/* ── Conținut Meciuri ── */}
      <div className="space-y-8">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-gray-400 font-medium">Niciun meci programat conform filtrelor selectate.</p>
          </div>
        ) : viewMode === "rounds" ? (
          /* Mod de afișare: ETAPE (RUNDE) ȘI GRUPE */
          <>
            {/* Grupe: Etape în ordine */}
            {sortedRoundNumbers.map(roundNum => {
              const groupsInRound = roundsMap.get(roundNum)!;
              const sortedGroupKeys = Object.keys(groupsInRound).sort();
              const roundMatchesCount = Object.values(groupsInRound).flat().length;

              return (
                <div key={roundNum} className="space-y-4">
                  {/* Banner Runda */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-6 py-4 rounded-2xl shadow-sm border border-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center font-black text-white text-base shadow-sm">
                        {roundNum}
                      </span>
                      <div>
                        <h2 className="text-lg sm:text-xl font-black tracking-tight">
                          Runda {roundNum}
                        </h2>
                        <p className="text-xs text-gray-300">
                          {sport === "basketball"
                            ? `Etapa ${roundNum} · Toate echipele au meciul ${roundNum}`
                            : `Etapa ${roundNum} · Toate echipele au programat meciul ${roundNum}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs bg-white/10 px-3 py-1.5 rounded-full font-bold text-gray-200">
                      {roundMatchesCount} {roundMatchesCount === 1 ? "meci" : "meciuri"}
                    </span>
                  </div>

                  {/* Subgrupe din runda respectivă */}
                  <div className="grid grid-cols-1 gap-4">
                    {sortedGroupKeys.map(grpKey => (
                      <div key={grpKey} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                          <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              grpKey === 'A' ? 'bg-blue-500' :
                              grpKey === 'B' ? 'bg-emerald-500' :
                              grpKey === 'C' ? 'bg-purple-500' :
                              grpKey === 'D' ? 'bg-amber-500' : 'bg-gray-400'
                            }`} />
                            Grupa {grpKey}
                            <span className="text-xs text-gray-400 font-normal">· Runda {roundNum}</span>
                          </span>
                          <span className="text-xs text-gray-400 font-semibold">
                            {groupsInRound[grpKey].length} {groupsInRound[grpKey].length === 1 ? "meci" : "meciuri"}
                          </span>
                        </div>
                        <ul className="divide-y divide-gray-50">
                          {groupsInRound[grpKey].map(m => (
                            <MatchItemRow
                              key={m.id}
                              match={m}
                              sport={sport}
                              openModal={openModal}
                              handleReschedule={handleReschedule}
                              isPending={isPending}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Faze eliminatorii (dacă sunt prezente) */}
            {Object.keys(knockoutByStage).length > 0 && (
              <div className="space-y-6 pt-4 border-t border-gray-200">
                <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <span>🔥</span> Faze Eliminatorii
                </h2>
                {Object.entries(knockoutByStage).map(([stg, stgMatches]) => (
                  <div key={stg} className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-rose-50 to-red-50 px-5 py-3 border-b border-rose-100 flex items-center justify-between">
                      <span className="font-bold text-rose-900 text-sm">
                        {stageLabels[stg] || stg}
                      </span>
                      <span className="text-xs text-rose-600 font-semibold">{stgMatches.length} meciuri</span>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {stgMatches.map(m => (
                        <MatchItemRow
                          key={m.id}
                          match={m}
                          sport={sport}
                          openModal={openModal}
                          handleReschedule={handleReschedule}
                          isPending={isPending}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Mod de afișare: CALENDAR ZILE */
          Object.entries(groupedMatches).map(([dateLabel, dayMatches]) => (
            <div key={dateLabel} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-200">
                <h3 className="font-bold text-gray-800 text-lg" suppressHydrationWarning>📅 {dateLabel}</h3>
              </div>
              <ul className="divide-y divide-gray-50">
                {dayMatches.map((match) => (
                  <MatchItemRow
                    key={match.id}
                    match={match}
                    sport={sport}
                    openModal={openModal}
                    handleReschedule={handleReschedule}
                    isPending={isPending}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* ── MODAL: Introducere goluri ── */}
      {modalMatch && localMatch && (() => {
        const { home: homePlayers, away: awayPlayers } = matchPlayers(modalMatch);
        const homeEvents = localMatch.match_events.filter(e => e.team_id === localMatch.home_team_id);
        const awayEvents = localMatch.match_events.filter(e => e.team_id === localMatch.away_team_id);
        const homeGoals = homeEvents.filter(e => !e.event_type || e.event_type === "goal_scored" || e.event_type === "goal");
        const awayGoals = awayEvents.filter(e => !e.event_type || e.event_type === "goal_scored" || e.event_type === "goal");
        
        const computedHomeScore = sport === "football" ? homeGoals.length : homeGoals.reduce((sum, e) => sum + (e.points_value !== undefined ? e.points_value : 1), 0);
        const computedAwayScore = sport === "football" ? awayGoals.length : awayGoals.reduce((sum, e) => sum + (e.points_value !== undefined ? e.points_value : 1), 0);
        
        const homeScore = localMatch.status === "finished" ? (localMatch.home_score ?? computedHomeScore) : computedHomeScore;
        const awayScore = localMatch.status === "finished" ? (localMatch.away_score ?? computedAwayScore) : computedAwayScore;
        
        const allPlayers = [...homePlayers, ...awayPlayers];

        return (
          <Modal
            title={`${modalMatch.home_team.name} vs ${modalMatch.away_team.name}${modalMatch.stage === 'group' ? ` (Grupa ${modalMatch.home_team.group_name || modalMatch.away_team?.group_name || '?'})` : ''}`}
            onClose={close}
          >
            {/* Scor curent */}
            <div className="flex items-center justify-center gap-6 mb-6 p-4 bg-green-50 rounded-2xl border border-green-100">
              <div className="text-center">
                <div className="font-bold text-green-900 text-sm truncate max-w-[100px]">{localMatch.home_team.name}</div>
                <div className="text-4xl font-black text-green-700 tabular-nums">{homeScore}</div>
              </div>
              <div className="text-2xl font-black text-green-400">–</div>
              <div className="text-center">
                <div className="font-bold text-green-900 text-sm truncate max-w-[100px]">{localMatch.away_team.name}</div>
                <div className="text-4xl font-black text-green-700 tabular-nums">{awayScore}</div>
              </div>
            </div>

            {/* Formular adăugare gol */}
            {localMatch.status !== "finished" && (
              <form ref={addFormRef} onSubmit={handleAddGoal} className="mb-5">
                <p className="text-sm font-semibold text-gray-700 mb-2">Adaugă Eveniment</p>
                <div className="flex gap-2">
                  <select
                    name="player_id"
                    required
                    className="flex-1 px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 text-sm"
                    onChange={e => {
                      const player = players.find(p => p.id === e.target.value);
                      const teamInput = addFormRef.current?.querySelector<HTMLInputElement>('input[name="team_id"]');
                      if (teamInput && player) teamInput.value = player.team_id;
                    }}
                  >
                    <option value="">— Selectează marcatorul —</option>
                    <optgroup label={`🟢 ${modalMatch.home_team.name} (Gazdă)`}>
                      {homePlayers.map(p => (
                        <option key={p.id} value={p.id}>
                          #{p.jersey_number} {p.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={`🔵 ${modalMatch.away_team.name} (Oaspete)`}>
                      {awayPlayers.map(p => (
                        <option key={p.id} value={p.id}>
                          #{p.jersey_number} {p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <input type="hidden" name="team_id" />
                  
                  {sport === "basketball" ? (
                    <>
                      <button
                        type="submit"
                        name="points_value"
                        value="1"
                        disabled={isPending || allPlayers.length === 0}
                        className="px-3 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {isPending ? "..." : "+1 Pct"}
                      </button>
                      <button
                        type="submit"
                        name="points_value"
                        value="2"
                        disabled={isPending || allPlayers.length === 0}
                        className="px-3 py-2.5 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {isPending ? "..." : "+2 Pct"}
                      </button>
                      <button
                        type="submit"
                        name="points_value"
                        value="3"
                        disabled={isPending || allPlayers.length === 0}
                        className="px-3 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {isPending ? "..." : "+3 Pct"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="submit"
                        name="event_type"
                        value="goal_scored"
                        disabled={isPending || allPlayers.length === 0}
                        className="px-4 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {isPending ? "..." : "+ Gol"}
                      </button>
                      <button
                        type="submit"
                        name="event_type"
                        value="yellow_card"
                        disabled={isPending || allPlayers.length === 0}
                        className="px-3 py-2.5 rounded-xl bg-yellow-400 text-yellow-900 font-bold text-sm hover:bg-yellow-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                        title="Cartonaș Galben"
                      >
                        {isPending ? "..." : "🟨"}
                      </button>
                      <button
                        type="submit"
                        name="event_type"
                        value="red_card"
                        disabled={isPending || allPlayers.length === 0}
                        className="px-3 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                        title="Cartonaș Roșu"
                      >
                        {isPending ? "..." : "🟥"}
                      </button>
                    </>
                  )}
                </div>
                {allPlayers.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">⚠️ Adaugă jucători la aceste echipe înainte de a introduce evenimente.</p>
                )}
              </form>
            )}

            {/* Lista goluri */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* Goluri gazdă */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{localMatch.home_team.name}</p>
                {homeEvents.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Niciun eveniment</p>
                ) : (
                  <ul className="space-y-1">
                    {homeEvents.map(e => (
                      <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium text-green-800">
                          {sport === "basketball" ? `🏀 +${e.points_value || 1}` : (e.event_type === "yellow_card" ? "🟨" : e.event_type === "red_card" ? "🟥" : "⚽")} #{e.player.jersey_number} {e.player.name}
                        </span>
                        {localMatch.status !== "finished" && (
                          <button
                            onClick={() => handleRemoveGoal(e.id)}
                            disabled={isPending}
                            className="w-5 h-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-bold"
                          >✕</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Goluri oaspete */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{localMatch.away_team.name}</p>
                {awayEvents.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Niciun eveniment</p>
                ) : (
                  <ul className="space-y-1">
                    {awayEvents.map(e => (
                      <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                        <span className="text-sm font-medium text-blue-800">
                          {sport === "basketball" ? `🏀 +${e.points_value || 1}` : (e.event_type === "yellow_card" ? "🟨" : e.event_type === "red_card" ? "🟥" : "⚽")} #{e.player.jersey_number} {e.player.name}
                        </span>
                        {localMatch.status !== "finished" && (
                          <button
                            onClick={() => handleRemoveGoal(e.id)}
                            disabled={isPending}
                            className="w-5 h-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-bold"
                          >✕</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Selectare departajare dacă scor egal și meci eliminatoriu */}
            {localMatch.stage !== "group" && homeScore === awayScore && (
              <div className="mb-5 p-4 rounded-xl border border-amber-200 bg-amber-50">
                <p className="text-sm font-bold text-amber-900 mb-3">
                  {sport === "basketball" ? "Departajare / Prelungiri — Selectează echipa care avansează" : "Departajare la penalty-uri — Selectează echipa care avansează"}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className={`flex-1 flex items-center justify-between p-3 rounded-xl cursor-pointer border-2 transition-all ${
                    penaltyWinnerId === localMatch.home_team_id 
                      ? "bg-green-100 border-green-500 text-green-900" 
                      : "bg-white border-transparent text-gray-700 hover:bg-gray-50"
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="penalty_winner"
                        value={localMatch.home_team_id}
                        checked={penaltyWinnerId === localMatch.home_team_id}
                        onChange={() => setPenaltyWinnerId(localMatch.home_team_id)}
                        disabled={localMatch.status === "finished"}
                        className="w-4 h-4 text-green-600 focus:ring-green-500"
                      />
                      <span className="font-bold text-sm truncate">{localMatch.home_team.name}</span>
                    </div>
                    {penaltyWinnerId === localMatch.home_team_id && (
                      <span className="text-[10px] uppercase tracking-wider font-black text-green-600 bg-white px-2 py-1 rounded-md shadow-sm">
                        ✓ Avansează
                      </span>
                    )}
                  </label>

                  <label className={`flex-1 flex items-center justify-between p-3 rounded-xl cursor-pointer border-2 transition-all ${
                    penaltyWinnerId === localMatch.away_team_id 
                      ? "bg-green-100 border-green-500 text-green-900" 
                      : "bg-white border-transparent text-gray-700 hover:bg-gray-50"
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="penalty_winner"
                        value={localMatch.away_team_id}
                        checked={penaltyWinnerId === localMatch.away_team_id}
                        onChange={() => setPenaltyWinnerId(localMatch.away_team_id)}
                        disabled={localMatch.status === "finished"}
                        className="w-4 h-4 text-green-600 focus:ring-green-500"
                      />
                      <span className="font-bold text-sm truncate">{localMatch.away_team.name}</span>
                    </div>
                    {penaltyWinnerId === localMatch.away_team_id && (
                      <span className="text-[10px] uppercase tracking-wider font-black text-green-600 bg-white px-2 py-1 rounded-md shadow-sm">
                        ✓ Avansează
                      </span>
                    )}
                  </label>
                </div>
              </div>
            )}

            {/* Secțiune Neprezentare (Victorie la masă verde) */}
            {localMatch.status !== "finished" && (
              <div className="mb-5 p-4 rounded-xl border border-red-200 bg-red-50">
                <p className="text-sm font-bold text-red-900 mb-3">Neprezentare (Forfait)</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className={`flex-1 flex items-center justify-between p-3 rounded-xl cursor-pointer border-2 transition-all ${
                    forfeitLoserId === localMatch.home_team_id 
                      ? "bg-red-100 border-red-500 text-red-900" 
                      : "bg-white border-transparent text-gray-700 hover:bg-gray-50"
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="forfeit_loser"
                        value={localMatch.home_team_id}
                        checked={forfeitLoserId === localMatch.home_team_id}
                        onClick={(e) => {
                          if (forfeitLoserId === localMatch.home_team_id) {
                            e.preventDefault();
                            setForfeitLoserId(null);
                          } else {
                            setForfeitLoserId(localMatch.home_team_id);
                          }
                        }}
                        readOnly
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="font-bold text-sm truncate">{localMatch.home_team.name} absent</span>
                    </div>
                  </label>

                  <label className={`flex-1 flex items-center justify-between p-3 rounded-xl cursor-pointer border-2 transition-all ${
                    forfeitLoserId === localMatch.away_team_id 
                      ? "bg-red-100 border-red-500 text-red-900" 
                      : "bg-white border-transparent text-gray-700 hover:bg-gray-50"
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="forfeit_loser"
                        value={localMatch.away_team_id}
                        checked={forfeitLoserId === localMatch.away_team_id}
                        onClick={(e) => {
                          if (forfeitLoserId === localMatch.away_team_id) {
                            e.preventDefault();
                            setForfeitLoserId(null);
                          } else {
                            setForfeitLoserId(localMatch.away_team_id);
                          }
                        }}
                        readOnly
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="font-bold text-sm truncate">{localMatch.away_team.name} absent</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            {/* Acțiuni finale */}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={close}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Închide
              </button>
              {localMatch.status === "finished" ? (
                <button
                  onClick={handleReopen}
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-60 transition-colors"
                >
                  {isPending ? "Se procesează..." : "↺ Redeschide Meciul"}
                </button>
              ) : (
                <button
                  onClick={handleFinalize}
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-60 transition-colors"
                >
                  {isPending ? "Se finalizează..." : "✓ Finalizează Meciul"}
                </button>
              )}
            </div>
          </Modal>
        );
      })()}
    </>
  );
}
