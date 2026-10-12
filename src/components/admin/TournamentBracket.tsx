"use client";

import React from "react";

type TeamInfo = { id: string; name: string };
type MatchInfo = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  penalty_winner_id: string | null;
  forfeit_loser_id?: string | null;
  status: string;
  stage: string;
  round: number;
  bracket_position?: string;
  home_team: TeamInfo;
  away_team: TeamInfo;
};

function MatchBox({ match, label, sport }: { match: MatchInfo | undefined; label: string; sport?: "football" | "basketball" }) {
  if (!match) {
    return (
      <div className="w-48 sm:w-56 bg-white border border-dashed border-gray-300 rounded-xl p-3 shadow-sm flex flex-col justify-center h-[72px] shrink-0">
        <span className="text-xs text-center font-semibold text-gray-400">{label}</span>
      </div>
    );
  }

  const isBasketball = sport === "basketball";
  const borderColor = isBasketball ? "border-amber-300" : "border-green-200";
  const winBg = isBasketball ? "bg-amber-50" : "bg-green-50";
  const winText = isBasketball ? "text-amber-900" : "text-green-900";
  const scoreText = isBasketball ? "text-amber-700" : "text-green-700";

  const isForfeit = !!match.forfeit_loser_id;
  const homeWin = match.status === "finished" && (
    (match.forfeit_loser_id && match.forfeit_loser_id === match.away_team_id) ||
    (!match.forfeit_loser_id && ((match.home_score ?? 0) > (match.away_score ?? 0) || match.penalty_winner_id === match.home_team_id))
  );
  const awayWin = match.status === "finished" && (
    (match.forfeit_loser_id && match.forfeit_loser_id === match.home_team_id) ||
    (!match.forfeit_loser_id && ((match.away_score ?? 0) > (match.home_score ?? 0) || match.penalty_winner_id === match.away_team_id))
  );

  return (
    <div className={`w-48 sm:w-56 bg-white border ${borderColor} rounded-xl shadow-md overflow-hidden flex flex-col relative h-[72px] shrink-0 transition-transform hover:scale-105`}>
      <div className={`flex justify-between items-center px-3 py-1.5 flex-1 border-b border-gray-100 ${homeWin ? winBg : ''}`}>
        <span className={`text-xs sm:text-sm font-bold truncate pr-2 ${homeWin ? winText : 'text-gray-700'}`}>
          {match.home_team?.name || "TBD"}
        </span>
        <span className={`font-black text-sm ${scoreText} flex items-center gap-1`}>
          {match.home_score !== null ? match.home_score : "-"}
          {!isBasketball && match.penalty_winner_id === match.home_team_id && <span className="text-[10px] text-green-500">(p)</span>}
          {isForfeit && match.forfeit_loser_id === match.away_team_id && <span className="text-[9px] text-red-500 font-bold">(mv)</span>}
        </span>
      </div>
      <div className={`flex justify-between items-center px-3 py-1.5 flex-1 ${awayWin ? winBg : ''}`}>
        <span className={`text-xs sm:text-sm font-bold truncate pr-2 ${awayWin ? winText : 'text-gray-700'}`}>
          {match.away_team?.name || "TBD"}
        </span>
        <span className={`font-black text-sm ${scoreText} flex items-center gap-1`}>
          {match.away_score !== null ? match.away_score : "-"}
          {!isBasketball && match.penalty_winner_id === match.away_team_id && <span className="text-[10px] text-green-500">(p)</span>}
          {isForfeit && match.forfeit_loser_id === match.home_team_id && <span className="text-[9px] text-red-500 font-bold">(mv)</span>}
        </span>
      </div>
    </div>
  );
}

export default function TournamentBracket({ matches, sport }: { matches: MatchInfo[], sport?: "football" | "basketball" }) {
  const byBracket = (pos: string) => matches.find(m => m.bracket_position === pos) || undefined;

  return (
    <div className="w-full overflow-x-auto pb-8 pt-4">
      <div className="min-w-[1100px] flex justify-between gap-4 px-4">

        {/* PARTEA STÂNGĂ */}
        <div className="flex gap-4 relative">
          {/* Optimi Stânga */}
          {sport !== "basketball" && (
            <div className="flex flex-col justify-around gap-4 py-2">
              {[0, 1, 2, 3].map(i => <MatchBox key={`ro16_${i}`} match={byBracket(`ro16_${i}`)} label={`Optimi ${i + 1}`} sport={sport} />)}
            </div>
          )}
          {/* Sferturi Stânga */}
          <div className={`flex flex-col justify-around ${sport === "basketball" ? "py-2" : "py-12"}`}>
            {[0, 1].map(i => <MatchBox key={`quarter_${i}`} match={byBracket(`quarter_${i}`)} label={`Sfert ${i + 1}`} sport={sport} />)}
          </div>
          {/* Semi Stânga */}
          <div className={`flex flex-col justify-around ${sport === "basketball" ? "py-12" : "py-32"}`}>
            <MatchBox match={byBracket('semi_0')} label="Semifinala 1" sport={sport} />
          </div>
        </div>

        {/* CENTRU */}
        <div className="flex flex-col justify-center items-center px-4 gap-8">
          <div className="text-center">
            <span className="text-3xl">🏆</span>
            <h2 className={`text-lg font-black uppercase tracking-widest mt-2 mb-3 ${sport === "basketball" ? "text-amber-900" : "text-green-900"}`}>Finala Mare</h2>
            <MatchBox match={byBracket('final_0')} label="Finala" sport={sport} />
          </div>
          <div className="text-center">
            <span className="text-2xl">🥉</span>
            <h2 className="text-sm font-black text-gray-600 uppercase tracking-widest mt-2 mb-3">Finala Mică</h2>
            <MatchBox match={byBracket('third_place_0')} label="Locul 3" sport={sport} />
          </div>
        </div>

        {/* PARTEA DREAPTĂ */}
        <div className="flex gap-4 relative">
          {/* Semi Dreapta */}
          <div className={`flex flex-col justify-around ${sport === "basketball" ? "py-12" : "py-32"}`}>
            <MatchBox match={byBracket('semi_1')} label="Semifinala 2" sport={sport} />
          </div>
          {/* Sferturi Dreapta */}
          <div className={`flex flex-col justify-around ${sport === "basketball" ? "py-2" : "py-12"}`}>
            {[2, 3].map(i => <MatchBox key={`quarter_${i}`} match={byBracket(`quarter_${i}`)} label={`Sfert ${i + 1}`} sport={sport} />)}
          </div>
          {/* Optimi Dreapta */}
          {sport !== "basketball" && (
            <div className="flex flex-col justify-around gap-4 py-2">
              {[4, 5, 6, 7].map(i => <MatchBox key={`ro16_${i}`} match={byBracket(`ro16_${i}`)} label={`Optimi ${i + 1}`} sport={sport} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
