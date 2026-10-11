"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getCurrentSport } from "@/lib/sport";

type ActionResult = { success: true; eventId?: string } | { error: string };

function getAdminClient() {
  return createAdminClient();
}

// ─── Adaugă un gol în match_events ──────────────────────────────────────────
export async function addGoalAction(formData: FormData): Promise<ActionResult> {
  const supabase = getAdminClient();
  const sport = await getCurrentSport();

  const match_id  = formData.get("match_id")  as string;
  const player_id = formData.get("player_id") as string;
  const team_id   = formData.get("team_id")   as string;
  const rawPoints = formData.get("points_value");
  const parsedPoints = rawPoints ? parseInt(rawPoints as string, 10) : 1;
  let event_type = (formData.get("event_type") as string) || "goal_scored";
  const points_value = event_type === "goal_scored" ? Math.max(1, isNaN(parsedPoints) ? 1 : parsedPoints) : 0;

  if (!match_id || !player_id || !team_id) {
    return { error: "Datele pentru eveniment sunt incomplete." };
  }

  // Logica pentru al doilea galben -> roșu (doar fotbal)
  if (sport === "football" && event_type === "yellow_card") {
    const { data: existingYellows } = await supabase
      .from("match_events")
      .select("id")
      .eq("match_id", match_id)
      .eq("player_id", player_id)
      .eq("event_type", "yellow_card");

    if (existingYellows && existingYellows.length >= 1) {
      event_type = "red_card";
    }
  }

  // Inserăm evenimentul
  const { data: insertedEvent, error: eventErr } = await supabase
    .from("match_events")
    .insert({
      match_id,
      player_id,
      team_id,
      event_type,
      sport_type: sport,
      points_value: event_type === "goal_scored" ? points_value : 0,
    });

  if (eventErr) {
    return { error: `Eroare la adăugarea evenimentului: ${eventErr.message}` };
  }

  // Setăm statusul meciului la "in_progress" dacă era "scheduled"
  await supabase
    .from("matches")
    .update({ status: "in_progress" })
    .eq("id", match_id)
    .eq("status", "scheduled");

  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/program");
  const eventId = Array.isArray(insertedEvent) ? (insertedEvent[0] as any)?.id : (insertedEvent as any)?.id;
  return { success: true, eventId };
}

// ─── Șterge un gol din match_events ─────────────────────────────────────────
export async function removeGoalAction(eventId: string): Promise<ActionResult> {
  const supabase = getAdminClient();

  // Triggerul trg_revert_player_stats din DB scade automat players.goals_scored
  const { error } = await supabase
    .from("match_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    return { error: `Eroare la ștergerea golului: ${error.message}` };
  }

  revalidatePath("/admin/meciuri");
  return { success: true };
}

// ─── Finalizează meciul: calculează scorul din events și actualizează DB ─────
export async function finalizeMatchAction(matchId: string, penaltyWinnerId?: string, forfeitLoserId?: string): Promise<ActionResult> {
  const supabase = getAdminClient();

  // 1. Preluăm meciul actual
  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id, status, home_score, away_score, stage")
    .eq("id", matchId)
    .single();

  if (matchErr || !match) {
    return { error: `Meciul nu a fost găsit: ${matchErr?.message}` };
  }

  const sport = await getCurrentSport();
  let homeScore = 0;
  let awayScore = 0;

  if (forfeitLoserId) {
    // Dacă e neprezentare, ștergem evenimentele ca să nu fie numărate golurile la marcatori
    await supabase.from("match_events").delete().eq("match_id", matchId);
    
    const winScore = sport === "basketball" ? 7 : 3;
    if (forfeitLoserId === match.home_team_id) {
      homeScore = 0;
      awayScore = winScore;
    } else if (forfeitLoserId === match.away_team_id) {
      homeScore = winScore;
      awayScore = 0;
    }
  } else {
    // Sumăm punctele din match_events pentru fiecare echipă
    const { data: events, error: eventsErr } = await supabase
      .from("match_events")
      .select("team_id, event_type, points_value")
      .eq("match_id", matchId);

    if (eventsErr) {
      return { error: `Eroare la citirea evenimentelor: ${eventsErr.message}` };
    }

    const homeGoals = (events ?? []).filter(e => e.team_id === match.home_team_id && (!e.event_type || e.event_type === "goal_scored" || e.event_type === "goal"));
    const awayGoals = (events ?? []).filter(e => e.team_id === match.away_team_id && (!e.event_type || e.event_type === "goal_scored" || e.event_type === "goal"));
    
    homeScore = sport === "football" ? homeGoals.length : homeGoals.reduce((sum, e) => sum + (e.points_value !== undefined && e.points_value !== null ? e.points_value : 1), 0);
    awayScore = sport === "football" ? awayGoals.length : awayGoals.reduce((sum, e) => sum + (e.points_value !== undefined && e.points_value !== null ? e.points_value : 1), 0);
  }

  // 3. Dacă meciul era deja 'finished', revocăm statisticile vechi din teams DOAR dacă e meci de grupă
  if (match.stage === "group" && match.status === "finished" && match.home_score !== null && match.away_score !== null) {
    const revertErr = await revertTeamStats(
      supabase,
      match.home_team_id,
      match.away_team_id,
      match.home_score as number,
      match.away_score as number
    );
    if (revertErr) return { error: revertErr };
  }

  // 4. Actualizăm meciul cu statusul 'finished' și scorurile calculate
  const { error: updateErr } = await supabase
    .from("matches")
    .update({
      status:     "finished",
      home_score: homeScore,
      away_score: awayScore,
      penalty_winner_id: penaltyWinnerId || null,
      forfeit_loser_id: forfeitLoserId || null,
    })
    .eq("id", matchId);

  if (updateErr) {
    return { error: `Eroare la finalizarea meciului: ${updateErr.message}` };
  }

  // 5. Triggerul BD actualizează automat teams DACĂ meciul trece din scheduled→finished (DOAR pt grupe)
  //    Dacă meciul era deja finished și e din grupe, aplicăm manual statisticile noi
  if (match.stage === "group" && match.status === "finished") {
    const applyErr = await applyTeamStats(
      supabase,
      match.home_team_id,
      match.away_team_id,
      homeScore,
      awayScore
    );
    if (applyErr) return { error: applyErr };
  }

  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/program");
  revalidatePath("/admin/clasament");
  revalidatePath("/public");

  return { success: true };
}

// ─── Redeschide un meci (resetează golurile din match_events) ────────────────
export async function reopenMatchAction(matchId: string): Promise<ActionResult> {
  const supabase = getAdminClient();

  // 1. Preluăm meciul actual
  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id, status, home_score, away_score, stage")
    .eq("id", matchId)
    .single();

  if (matchErr || !match) {
    return { error: `Meciul nu a fost găsit: ${matchErr?.message}` };
  }

  if (match.status !== "finished") {
    return { error: "Meciul nu este finalizat, nu poate fi redeschis." };
  }

  // 2. Revocăm statisticile echipelor din scorul vechi DOAR pentru grupe
  if (match.stage === "group" && match.home_score !== null && match.away_score !== null) {
    const revertErr = await revertTeamStats(
      supabase,
      match.home_team_id,
      match.away_team_id,
      match.home_score as number,
      match.away_score as number
    );
    if (revertErr) return { error: revertErr };
  }

  // 3. Ștergem toate match_events ale acestui meci (triggerul DB scade goals jucători)
  const { error: delErr } = await supabase
    .from("match_events")
    .delete()
    .eq("match_id", matchId);

  if (delErr) {
    return { error: `Eroare la ștergerea evenimentelor: ${delErr.message}` };
  }

  // 4. Resetăm meciul la 'scheduled'
  const { error: updateErr } = await supabase
    .from("matches")
    .update({ status: "scheduled", home_score: null, away_score: null, penalty_winner_id: null, forfeit_loser_id: null })
    .eq("id", matchId);

  if (updateErr) {
    return { error: `Eroare la redeschiderea meciului: ${updateErr.message}` };
  }

  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/program");
  revalidatePath("/admin/clasament");
  revalidatePath("/public");

  return { success: true };
}

// ─── Helpers pentru statistici echipe ───────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyTeamStats(supabase: any, homeId: string, awayId: string, homeScore: number, awayScore: number): Promise<string | null> {
  let homePts = 0, awayPts = 0;
  if (homeScore > awayScore)      { homePts = 3; awayPts = 0; }
  else if (homeScore < awayScore) { homePts = 0; awayPts = 3; }
  else                             { homePts = 1; awayPts = 1; }

  const { data: ht } = await supabase.from("teams").select("points,played,won,drawn,lost,goals_scored,goals_conceded").eq("id", homeId).single();
  if (!ht) return "Echipa gazdă nu a fost găsită.";
  await supabase.from("teams").update({
    points: ht.points + homePts, played: ht.played + 1,
    won:    ht.won    + (homeScore > awayScore ? 1 : 0),
    drawn:  ht.drawn  + (homeScore === awayScore ? 1 : 0),
    lost:   ht.lost   + (homeScore < awayScore ? 1 : 0),
    goals_scored:   ht.goals_scored   + homeScore,
    goals_conceded: ht.goals_conceded + awayScore,
  }).eq("id", homeId);

  const { data: at } = await supabase.from("teams").select("points,played,won,drawn,lost,goals_scored,goals_conceded").eq("id", awayId).single();
  if (!at) return "Echipa oaspete nu a fost găsită.";
  await supabase.from("teams").update({
    points: at.points + awayPts, played: at.played + 1,
    won:    at.won    + (awayScore > homeScore ? 1 : 0),
    drawn:  at.drawn  + (awayScore === homeScore ? 1 : 0),
    lost:   at.lost   + (awayScore < homeScore ? 1 : 0),
    goals_scored:   at.goals_scored   + awayScore,
    goals_conceded: at.goals_conceded + homeScore,
  }).eq("id", awayId);

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function revertTeamStats(supabase: any, homeId: string, awayId: string, homeScore: number, awayScore: number): Promise<string | null> {
  let homePts = 0, awayPts = 0;
  if (homeScore > awayScore)      { homePts = 3; awayPts = 0; }
  else if (homeScore < awayScore) { homePts = 0; awayPts = 3; }
  else                             { homePts = 1; awayPts = 1; }

  const { data: ht } = await supabase.from("teams").select("points,played,won,drawn,lost,goals_scored,goals_conceded").eq("id", homeId).single();
  if (!ht) return "Echipa gazdă nu a fost găsită.";
  await supabase.from("teams").update({
    points: Math.max(0, ht.points - homePts), played: Math.max(0, ht.played - 1),
    won:    Math.max(0, ht.won  - (homeScore > awayScore ? 1 : 0)),
    drawn:  Math.max(0, ht.drawn - (homeScore === awayScore ? 1 : 0)),
    lost:   Math.max(0, ht.lost  - (homeScore < awayScore ? 1 : 0)),
    goals_scored:   Math.max(0, ht.goals_scored   - homeScore),
    goals_conceded: Math.max(0, ht.goals_conceded - awayScore),
  }).eq("id", homeId);

  const { data: at } = await supabase.from("teams").select("points,played,won,drawn,lost,goals_scored,goals_conceded").eq("id", awayId).single();
  if (!at) return "Echipa oaspete nu a fost găsită.";
  await supabase.from("teams").update({
    points: Math.max(0, at.points - awayPts), played: Math.max(0, at.played - 1),
    won:    Math.max(0, at.won  - (awayScore > homeScore ? 1 : 0)),
    drawn:  Math.max(0, at.drawn - (awayScore === homeScore ? 1 : 0)),
    lost:   Math.max(0, at.lost  - (awayScore < homeScore ? 1 : 0)),
    goals_scored:   Math.max(0, at.goals_scored   - awayScore),
    goals_conceded: Math.max(0, at.goals_conceded - homeScore),
  }).eq("id", awayId);

  return null;
}

export async function rescheduleMatchAction(matchId: string): Promise<ActionResult> {
  const supabase = getAdminClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id, status, home_score, away_score, stage")
    .eq("id", matchId)
    .single();

  if (match && match.stage === "group" && match.status === "finished" && match.home_score !== null && match.away_score !== null) {
    const revertErr = await revertTeamStats(
      supabase,
      match.home_team_id,
      match.away_team_id,
      match.home_score as number,
      match.away_score as number
    );
    if (revertErr) return { error: revertErr };
  }

  const { error: eventsErr } = await supabase
    .from("match_events")
    .delete()
    .eq("match_id", matchId);

  if (eventsErr) return { error: `Eroare la ștergerea evenimentelor: ${eventsErr.message}` };

  const { error: matchErr } = await supabase
    .from("matches")
    .update({
      match_time: null,
      status: "scheduled",
      home_score: null,
      away_score: null,
      penalty_winner_id: null,
      forfeit_loser_id: null
    })
    .eq("id", matchId);

  if (matchErr) return { error: `Eroare la reprogramarea meciului: ${matchErr.message}` };

  revalidatePath("/admin/meciuri");
  revalidatePath("/admin/program");
  revalidatePath("/admin/clasament");
  revalidatePath("/public");
  return { success: true };
}
