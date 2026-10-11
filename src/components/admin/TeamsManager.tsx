"use client";

import { useState, useTransition, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createTeamAction,
  updateTeamAction,
  deleteTeamAction,
} from "@/lib/actions/teams";
import {
  createPlayerAction,
  updatePlayerAction,
  deletePlayerAction,
} from "@/lib/actions/players";

type PlayerRole = "player" | "goalkeeper";

interface Team {
  id: string;
  name: string;
  points: number;
  played: number;
  goals_scored: number;
  goals_conceded: number;
}

interface Player {
  id: string;
  name: string;
  jersey_number: number;
  role: PlayerRole;
  id_card_url: string | null;
  goals_scored: number;
  goals_conceded: number;
  team_id: string;
  yellow_cards?: number;
  red_cards?: number;
}

interface TeamsManagerProps {
  teams: Team[];
  players: Player[];
  sport: string;
}

/* ── Reusable Modal ── */
function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease]">
      <div className={`bg-white rounded-2xl shadow-2xl ${wide ? "w-full max-w-2xl" : "w-full max-w-md"} max-h-[90vh] overflow-y-auto animate-[fadeInUp_200ms_ease]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ── COMPONENTA PRINCIPALĂ ── */
export default function TeamsManager({ teams, players, sport }: TeamsManagerProps) {
  const [modal, setModal] = useState<"addTeam" | "editTeam" | "deleteTeam" | "players" | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Player sub-modals inside players panel
  const [playerModal, setPlayerModal] = useState<"add" | "edit" | "delete" | "viewCard" | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [cardSignedUrl, setCardSignedUrl] = useState<string | null>(null);
  const playerFormRef = useRef<HTMLFormElement>(null);

  function close() { setModal(null); setSelectedTeam(null); setError(null); }
  function closePlayerModal() { setPlayerModal(null); setSelectedPlayer(null); setPlayerError(null); }

  // ─── Team CRUD ─────────────────────────────────────────
  function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await createTeamAction(fd);
      if ("error" in result) { setError(result.error); return; }
      close();
    });
  }

  function handleEditTeam(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    fd.append("id", selectedTeam!.id);
    startTransition(async () => {
      const result = await updateTeamAction(fd);
      if ("error" in result) { setError(result.error); return; }
      close();
    });
  }

  function handleDeleteTeam() {
    startTransition(async () => {
      const result = await deleteTeamAction(selectedTeam!.id);
      if ("error" in result) { setError(result.error); return; }
      close();
    });
  }

  // ─── Player CRUD ───────────────────────────────────────
  function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(playerFormRef.current!);
    fd.set("team_id", selectedTeam!.id);
    startTransition(async () => {
      const result = await createPlayerAction(fd);
      if ("error" in result) { setPlayerError(result.error); return; }
      closePlayerModal();
    });
  }

  function handleEditPlayer(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(playerFormRef.current!);
    fd.set("id", selectedPlayer!.id);
    fd.set("team_id", selectedTeam!.id);
    startTransition(async () => {
      const result = await updatePlayerAction(fd);
      if ("error" in result) { setPlayerError(result.error); return; }
      closePlayerModal();
    });
  }

  function handleDeletePlayer() {
    startTransition(async () => {
      const result = await deletePlayerAction(selectedPlayer!.id);
      if ("error" in result) { setPlayerError(result.error); return; }
      closePlayerModal();
    });
  }

  async function openViewCard(player: Player) {
    setSelectedPlayer(player);
    if (player.id_card_url) {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from("player-id-cards")
        .createSignedUrl(player.id_card_url, 300);
      setCardSignedUrl(data?.signedUrl ?? null);
    }
    setPlayerModal("viewCard");
  }

  function openPlayersPanel(team: Team) {
    setSelectedTeam(team);
    setModal("players");
  }

  const teamPlayers = selectedTeam ? players.filter(p => p.team_id === selectedTeam.id) : [];

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">🛡️ Echipe & Jucători</h1>
          <p className="text-gray-500 text-sm mt-0.5">{teams.length} echipe · {players.length} jucători</p>
        </div>
        <button
          onClick={() => { setSelectedTeam(null); setError(null); setModal("addTeam"); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          + Adaugă Echipă
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-green-700 to-green-800 text-white">
                <th className="py-3.5 px-4 text-left font-bold text-xs uppercase tracking-wide">#</th>
                <th className="py-3.5 px-4 text-left font-bold text-xs uppercase tracking-wide">Echipă</th>
                <th className="py-3.5 px-4 text-center font-bold text-xs uppercase tracking-wide">MJ</th>
                <th className="py-3.5 px-4 text-center font-bold text-xs uppercase tracking-wide">Pct</th>
                <th className="py-3.5 px-4 text-center font-bold text-xs uppercase tracking-wide hidden sm:table-cell">GM / GP</th>
                <th className="py-3.5 px-4 text-center font-bold text-xs uppercase tracking-wide">Jucători</th>
                <th className="py-3.5 px-4 text-right font-bold text-xs uppercase tracking-wide">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <div className="text-4xl mb-2">🛡️</div>
                    Nicio echipă adăugată. Apasă &quot;Adaugă Echipă&quot; pentru a începe.
                  </td>
                </tr>
              ) : (
                teams.map((team, idx) => {
                  const teamPlayerCount = players.filter(p => p.team_id === team.id).length;
                  return (
                    <tr key={team.id} className="hover:bg-green-50/50 transition-colors group">
                      <td className="py-3 px-4">
                        <span className="w-7 h-7 rounded-lg bg-green-100 text-green-700 font-black text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-black text-xs">
                            {team.name.charAt(0)}
                          </div>
                          <span className="font-semibold text-gray-900">{team.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-600 font-medium">{team.played}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-9 h-6 rounded-lg bg-green-700 text-white font-black text-xs">{team.points}</span>
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        <span className="text-green-600 font-medium">{team.goals_scored}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className="text-red-400 font-medium">{team.goals_conceded}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openPlayersPanel(team)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          👤 {teamPlayerCount}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedTeam(team); setError(null); setModal("editTeam"); }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                          >Editează</button>
                          <button
                            onClick={() => { setSelectedTeam(team); setModal("deleteTeam"); }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >Șterge</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL: Adaugă Echipă
         ══════════════════════════════════════════════════════ */}
      {modal === "addTeam" && (
        <Modal title="Adaugă Echipă Nouă" onClose={close}>
          <form ref={formRef} onSubmit={handleAddTeam} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Numele echipei *</label>
              <input name="name" required placeholder="ex: FC Steaua" className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all text-sm" />
            </div>
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={close} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Anulează</button>
              <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-60 transition-colors">
                {isPending ? "Se salvează..." : "Adaugă Echipă"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: Editează Echipă
         ══════════════════════════════════════════════════════ */}
      {modal === "editTeam" && selectedTeam && (
        <Modal title={`Editează: ${selectedTeam.name}`} onClose={close}>
          <form ref={formRef} onSubmit={handleEditTeam} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Numele echipei *</label>
              <input name="name" required defaultValue={selectedTeam.name} className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all text-sm" />
            </div>
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={close} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Anulează</button>
              <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-60 transition-colors">
                {isPending ? "Se salvează..." : "Salvează Modificările"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: Șterge Echipă
         ══════════════════════════════════════════════════════ */}
      {modal === "deleteTeam" && selectedTeam && (
        <Modal title="Confirmare Ștergere" onClose={close}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-red-800 text-sm font-medium">
                Ești sigur că vrei să ștergi echipa <strong>&quot;{selectedTeam.name}&quot;</strong>?
              </p>
              <p className="text-red-600 text-xs mt-1">
                ⚠️ Această acțiune va șterge și toți jucătorii echipei (cascadă).
              </p>
            </div>
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="flex gap-3">
              <button onClick={close} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Anulează</button>
              <button onClick={handleDeleteTeam} disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-60 transition-colors">
                {isPending ? "Se șterge..." : "Șterge Definitiv"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: Jucătorii Echipei (Panel)
         ══════════════════════════════════════════════════════ */}
      {modal === "players" && selectedTeam && (
        <Modal title={`👤 Jucătorii: ${selectedTeam.name}`} onClose={close} wide>
          <div className="space-y-4">
            {/* Buton adaugă jucător */}
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-sm">{teamPlayers.length} jucători în echipă</p>
              <button
                onClick={() => { setSelectedPlayer(null); setPlayerError(null); setPlayerModal("add"); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs transition-all"
              >
                + Adaugă Jucător
              </button>
            </div>

            {/* Lista jucătorilor */}
            {teamPlayers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">👤</div>
                <p className="text-sm">Niciun jucător adăugat. Apasă &quot;Adaugă Jucător&quot;.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                {teamPlayers.map(player => (
                  <div key={player.id} className="flex items-center justify-between px-4 py-3 hover:bg-green-50/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-8 h-6 rounded-lg bg-green-100 text-green-700 font-black text-xs">
                        #{player.jersey_number}
                      </span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{player.name}</p>
                        <span className={`text-xs font-medium ${player.role === "goalkeeper" ? "text-blue-600" : "text-green-600"}`}>
                          {player.role === "goalkeeper" ? "🧤 Portar" : (sport === "basketball" ? "🏀 Jucător" : "⚽ Jucător")}
                          {player.role === "goalkeeper"
                            ? ` · ${player.goals_conceded} gp`
                            : (sport === "basketball" ? ` · ${player.goals_scored} puncte` : ` · ${player.goals_scored} goluri`)}
                        </span>
                        {sport === "football" && (
                          <span className="ml-2 inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            <span className="flex items-center gap-0.5 text-yellow-600"><span className="w-2.5 h-3.5 bg-yellow-400 rounded-sm"></span> {player.yellow_cards || 0}</span>
                            <span className="flex items-center gap-0.5 text-red-600 ml-1"><span className="w-2.5 h-3.5 bg-red-500 rounded-sm"></span> {player.red_cards || 0}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {player.id_card_url && (
                        <button
                          onClick={() => openViewCard(player)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                        >📸</button>
                      )}
                      <button
                        onClick={() => { setSelectedPlayer(player); setPlayerError(null); setPlayerModal("edit"); }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                      >Editează</button>
                      <button
                        onClick={() => { setSelectedPlayer(player); setPlayerModal("delete"); }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >Șterge</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sub-modal: Adaugă Jucător */}
          {playerModal === "add" && (
            <div className="mt-6 p-5 rounded-xl border-2 border-green-200 bg-green-50/30">
              <h4 className="font-bold text-gray-900 mb-4">Adaugă Jucător Nou</h4>
              <form ref={playerFormRef} onSubmit={handleAddPlayer} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nume *</label>
                    <input name="name" required placeholder="Ion Popescu" className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nr. Tricou *</label>
                    <input name="jersey_number" type="number" required min={1} max={99} placeholder="10" className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 text-sm" />
                  </div>
                </div>
                {sport !== "basketball" ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rol *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "player", label: "⚽ Jucător" },
                        { value: "goalkeeper", label: "🧤 Portar" },
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-gray-200 cursor-pointer has-[:checked]:border-green-500 has-[:checked]:bg-green-50 transition-all text-sm">
                          <input type="radio" name="role" value={value} defaultChecked={value === "player"} className="accent-green-600" />
                          <span className="font-medium text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <input type="hidden" name="role" value="player" />
                )}
                {playerError && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{playerError}</div>}
                <div className="flex gap-3">
                  <button type="button" onClick={closePlayerModal} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Anulează</button>
                  <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-60 transition-colors">
                    {isPending ? "Se salvează..." : "Adaugă"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sub-modal: Editează Jucător */}
          {playerModal === "edit" && selectedPlayer && (
            <div className="mt-6 p-5 rounded-xl border-2 border-green-200 bg-green-50/30">
              <h4 className="font-bold text-gray-900 mb-4">Editează: {selectedPlayer.name}</h4>
              <form ref={playerFormRef} onSubmit={handleEditPlayer} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nume *</label>
                    <input name="name" required defaultValue={selectedPlayer.name} className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nr. Tricou *</label>
                    <input name="jersey_number" type="number" required min={1} max={99} defaultValue={selectedPlayer.jersey_number} className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 text-sm" />
                  </div>
                </div>
                {sport !== "basketball" ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rol *</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "player", label: "⚽ Jucător" },
                        { value: "goalkeeper", label: "🧤 Portar" },
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-gray-200 cursor-pointer has-[:checked]:border-green-500 has-[:checked]:bg-green-50 transition-all text-sm">
                          <input type="radio" name="role" value={value} defaultChecked={selectedPlayer.role === value} className="accent-green-600" />
                          <span className="font-medium text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <input type="hidden" name="role" value="player" />
                )}
                {playerError && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{playerError}</div>}
                <div className="flex gap-3">
                  <button type="button" onClick={closePlayerModal} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Anulează</button>
                  <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-60 transition-colors">
                    {isPending ? "Se salvează..." : "Salvează"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Sub-modal: Șterge Jucător */}
          {playerModal === "delete" && selectedPlayer && (
            <div className="mt-6 p-5 rounded-xl border-2 border-red-200 bg-red-50/30">
              <p className="text-red-800 text-sm font-medium mb-4">
                Ești sigur că vrei să ștergi jucătorul <strong>&quot;{selectedPlayer.name}&quot;</strong> (#{selectedPlayer.jersey_number})?
              </p>
              {playerError && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-3">{playerError}</div>}
              <div className="flex gap-3">
                <button onClick={closePlayerModal} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Anulează</button>
                <button onClick={handleDeletePlayer} disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-60 transition-colors">
                  {isPending ? "Se șterge..." : "Șterge"}
                </button>
              </div>
            </div>
          )}

          {/* Sub-modal: Vezi Carnet */}
          {playerModal === "viewCard" && selectedPlayer && (
            <div className="mt-6 p-5 rounded-xl border-2 border-blue-200 bg-blue-50/30">
              <h4 className="font-bold text-gray-900 mb-3">📸 Carnet: {selectedPlayer.name}</h4>
              {cardSignedUrl ? (
                <img src={cardSignedUrl} alt="Carnet jucător" className="w-full object-contain max-h-64 rounded-xl border border-gray-200" />
              ) : (
                <div className="h-32 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">Nicio poză disponibilă</div>
              )}
              <div className="mt-3 flex justify-end">
                <button onClick={() => { closePlayerModal(); setCardSignedUrl(null); }} className="px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Închide</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
