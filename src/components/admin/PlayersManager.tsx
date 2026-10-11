"use client";

import { useState, useTransition, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createPlayerAction,
  updatePlayerAction,
  deletePlayerAction,
} from "@/lib/actions/players";

type PlayerRole = "player" | "goalkeeper";

interface Team  { id: string; name: string; }
interface Player {
  id: string;
  name: string;
  jersey_number: number;
  role: PlayerRole;
  id_card_url: string | null;
  goals_scored: number;
  goals_conceded: number;
  team_id: string;
  teams: { name: string } | null;
}

interface PlayersManagerProps {
  players: Player[];
  teams:   Team[];
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Upload carnet cu preview ───────────────────────────────────────────────
function IdCardUploader({
  currentUrl,
  onUpload,
}: {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState<string | null>(currentUrl ?? null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validare client-side
    if (!file.type.startsWith("image/")) {
      setUploadErr("Fișierul trebuie să fie o imagine (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadErr("Imaginea nu poate depăși 5MB.");
      return;
    }

    setUploading(true);
    setUploadErr(null);

    const supabase  = createClient();
    const ext       = file.name.split(".").pop();
    const fileName  = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath  = `id-cards/${fileName}`;

    const { error: storageErr } = await supabase.storage
      .from("player-id-cards")
      .upload(filePath, file, { upsert: false });

    if (storageErr) {
      setUploadErr(`Upload eșuat: ${storageErr.message}`);
      setUploading(false);
      return;
    }

    // Generare URL semnat (privat, valabil 1 oră)
    const { data: signedData } = await supabase.storage
      .from("player-id-cards")
      .createSignedUrl(filePath, 3600);

    const publicPath = filePath; // salvăm calea, nu URL-ul semnat
    setPreview(signedData?.signedUrl ?? null);
    onUpload(publicPath);
    setUploading(false);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        📸 Poză Carnet Jucător
        <span className="ml-1.5 text-xs font-normal text-gray-400">(Admin only • max 5MB)</span>
      </label>

      <div
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center gap-2 transition-all
          ${uploading ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-green-400 hover:bg-green-50/50"}
        `}
      >
        {preview ? (
          <div className="relative">
            <img src={preview} alt="Carnet" className="w-32 h-20 object-cover rounded-lg border border-gray-200" />
            <div className="absolute inset-0 rounded-lg bg-black/0 hover:bg-black/20 transition-all flex items-center justify-center">
              <span className="text-white text-xs font-semibold opacity-0 hover:opacity-100">Schimbă</span>
            </div>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">
              {uploading ? "⏳" : "📷"}
            </div>
            <span className="text-sm text-gray-500 font-medium">
              {uploading ? "Se încarcă..." : "Click pentru a încărca poza"}
            </span>
            <span className="text-xs text-gray-400">JPG, PNG, WEBP</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
          disabled={uploading}
        />
      </div>

      {uploadErr && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadErr}</p>
      )}
      {preview && !uploading && (
        <p className="text-xs text-green-600 font-medium">✅ Poza a fost încărcată cu succes</p>
      )}
    </div>
  );
}

// ─── Formular Add/Edit Jucător ──────────────────────────────────────────────
function PlayerForm({
  teams,
  initial,
  onSubmit,
  isPending,
  error,
}: {
  teams: Team[];
  initial?: Player | null;
  onSubmit: (fd: FormData) => void;
  isPending: boolean;
  error: string | null;
}) {
  const formRef  = useRef<HTMLFormElement>(null);
  const [idCardPath, setIdCardPath] = useState<string | null>(initial?.id_card_url ?? null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    if (idCardPath) fd.set("id_card_url", idCardPath);
    if (initial)    fd.set("id", initial.id);
    onSubmit(fd);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* Echipă */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Echipă *</label>
        <select
          name="team_id"
          required
          defaultValue={initial?.team_id ?? ""}
          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all text-sm bg-white"
        >
          <option value="" disabled>Selectează echipa...</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Nume + Tricou */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nume Jucător *</label>
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ""}
            placeholder="Ion Popescu"
            className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all text-sm"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Număr Tricou *</label>
          <input
            name="jersey_number"
            type="number"
            required
            min={1}
            max={99}
            defaultValue={initial?.jersey_number ?? ""}
            placeholder="10"
            className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all text-sm"
          />
        </div>
      </div>

      {/* Rol */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rol *</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: "player",     label: "⚽ Jucător de câmp" },
            { value: "goalkeeper", label: "🧤 Portar" },
          ].map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2.5 p-3 rounded-xl border-2 border-gray-200 cursor-pointer has-[:checked]:border-green-500 has-[:checked]:bg-green-50 transition-all"
            >
              <input
                type="radio"
                name="role"
                value={value}
                defaultChecked={initial ? initial.role === value : value === "player"}
                className="accent-green-600"
              />
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Upload carnet */}
      <IdCardUploader
        currentUrl={initial?.id_card_url}
        onUpload={setIdCardPath}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 disabled:opacity-60 transition-colors"
        >
          {isPending
            ? "Se salvează..."
            : initial ? "Salvează Modificările" : "Adaugă Jucător"}
        </button>
      </div>
    </form>
  );
}

// ─── COMPONENTA PRINCIPALĂ ─────────────────────────────────────────────────
export default function PlayersManager({ players, teams }: PlayersManagerProps) {
  const [modal, setModal]       = useState<"add" | "edit" | "delete" | "view-card" | null>(null);
  const [selected, setSelected] = useState<Player | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cardSignedUrl, setCardSignedUrl] = useState<string | null>(null);
  const [search, setSearch]     = useState("");

  function close() { setModal(null); setSelected(null); setError(null); }

  async function openViewCard(player: Player) {
    setSelected(player);
    if (player.id_card_url) {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from("player-id-cards")
        .createSignedUrl(player.id_card_url, 300);
      setCardSignedUrl(data?.signedUrl ?? null);
    }
    setModal("view-card");
  }

  function handleAddSubmit(fd: FormData) {
    startTransition(async () => {
      const result = await createPlayerAction(fd);
      if ("error" in result) { setError(result.error); return; }
      close();
    });
  }

  function handleEditSubmit(fd: FormData) {
    startTransition(async () => {
      const result = await updatePlayerAction(fd);
      if ("error" in result) { setError(result.error); return; }
      close();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePlayerAction(selected!.id);
      if ("error" in result) { setError(result.error); return; }
      close();
    });
  }

  // Filtrare după search
  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.teams?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">👤 Jucători</h1>
          <p className="text-gray-500 text-sm mt-0.5">{players.length} jucători înregistrați</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Caută jucător sau echipă..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-green-500 text-sm w-full sm:w-52 transition-all"
          />
          <button
            onClick={() => { setSelected(null); setError(null); setModal("add"); }}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all hover:-translate-y-0.5"
          >
            + Adaugă
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-green-700 to-green-800 text-white">
                <th className="py-3.5 px-4 text-left font-bold text-xs uppercase tracking-wide">Jucător</th>
                <th className="py-3.5 px-4 text-left font-bold text-xs uppercase tracking-wide">Echipă</th>
                <th className="py-3.5 px-4 text-center font-bold text-xs uppercase tracking-wide w-12">#</th>
                <th className="py-3.5 px-4 text-center font-bold text-xs uppercase tracking-wide">Rol</th>
                <th className="py-3.5 px-4 text-center font-bold text-xs uppercase tracking-wide hidden sm:table-cell">Stats</th>
                <th className="py-3.5 px-4 text-center font-bold text-xs uppercase tracking-wide">Carnet</th>
                <th className="py-3.5 px-4 text-right font-bold text-xs uppercase tracking-wide">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <div className="text-4xl mb-2">👤</div>
                    {search ? `Niciun jucător găsit pentru "${search}"` : "Niciun jucător adăugat încă."}
                  </td>
                </tr>
              ) : (
                filtered.map(player => (
                  <tr key={player.id} className="hover:bg-green-50/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">{player.name}</td>
                    <td className="py-3 px-4 text-gray-600">{player.teams?.name ?? "—"}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-6 rounded-lg bg-green-100 text-green-700 font-black text-xs">
                        #{player.jersey_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold
                        ${player.role === "goalkeeper" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                        {player.role === "goalkeeper" ? "🧤 Portar" : "⚽ Jucător"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center hidden sm:table-cell">
                      {player.role === "goalkeeper"
                        ? <span className="text-red-500 text-xs font-medium">{player.goals_conceded} gp</span>
                        : <span className="text-green-600 text-xs font-medium">{player.goals_scored} goluri</span>
                      }
                    </td>
                    <td className="py-3 px-4 text-center">
                      {player.id_card_url ? (
                        <button
                          onClick={() => openViewCard(player)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline transition-colors"
                        >
                          📸 Vezi
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelected(player); setError(null); setModal("edit"); }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                        >Editează</button>
                        <button
                          onClick={() => { setSelected(player); setModal("delete"); }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        >Șterge</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: Add ── */}
      {modal === "add" && (
        <Modal title="Adaugă Jucător Nou" onClose={close}>
          <PlayerForm teams={teams} onSubmit={handleAddSubmit} isPending={isPending} error={error} />
        </Modal>
      )}

      {/* ── MODAL: Edit ── */}
      {modal === "edit" && selected && (
        <Modal title={`Editează: ${selected.name}`} onClose={close}>
          <PlayerForm teams={teams} initial={selected} onSubmit={handleEditSubmit} isPending={isPending} error={error} />
        </Modal>
      )}

      {/* ── MODAL: Delete ── */}
      {modal === "delete" && selected && (
        <Modal title="Confirmare Ștergere" onClose={close}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-red-800 text-sm font-medium">
                Ștergi jucătorul <strong>&quot;{selected.name}&quot;</strong> (#{ selected.jersey_number}) din <strong>{selected.teams?.name}</strong>?
              </p>
            </div>
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <div className="flex gap-3">
              <button onClick={close} className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">Anulează</button>
              <button onClick={handleDelete} disabled={isPending} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-60 transition-colors">
                {isPending ? "Se șterge..." : "Șterge"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: View ID Card ── */}
      {modal === "view-card" && selected && (
        <Modal title={`Carnet: ${selected.name}`} onClose={() => { close(); setCardSignedUrl(null); }}>
          <div className="space-y-4">
            {cardSignedUrl ? (
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <img src={cardSignedUrl} alt="Carnet jucător" className="w-full object-contain max-h-64" />
              </div>
            ) : (
              <div className="h-40 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="text-3xl mb-2">📷</div>
                  <div className="text-sm">Nicio poză disponibilă</div>
                </div>
              </div>
            )}
            <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200">
              <p className="text-yellow-800 text-xs font-medium">
                🔒 Această imagine este vizibilă EXCLUSIV administratorilor.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
