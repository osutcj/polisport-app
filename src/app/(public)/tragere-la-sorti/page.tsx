import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tragere la Sorți",
  description: "Vizualizarea tragerii la sorți pentru grupele turneului PoliSport.",
};

export default async function TragereLaSortiPublicPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>;
}) {
  const params = await searchParams;
  const sport = params.sport === "basketball" ? "basketball" : "football";
  const isBasketball = sport === "basketball";
  const matchesPerTeam = isBasketball ? "3 meciuri per echipă în faza grupelor (4 grupe de 4)" : "4 meciuri per echipă în faza grupelor";
  const publicHref = isBasketball ? "/public?sport=basketball" : "/public";
  const icon = isBasketball ? "🏀" : "⚽";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center max-w-xl mx-auto">
        <div className={`w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br ${isBasketball ? "from-orange-500 to-amber-600 shadow-orange-200" : "from-green-500 to-green-700 shadow-green-200"} flex items-center justify-center text-5xl mb-6 shadow-xl`}>
          🎲
        </div>
        <h1 className={`text-4xl font-black ${isBasketball ? "text-amber-900" : "text-green-900"} mb-3`}>Tragere la Sorți</h1>
        <p className={`${isBasketball ? "text-amber-700" : "text-green-600"} mb-8 leading-relaxed`}>
          Tragerea la sorți pentru stabilirea meciurilor
          se realizează de echipa de organizare. Rezultatele vor fi vizibile
          imediat după finalizare.
        </p>

        <div className={`${isBasketball ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"} border rounded-2xl p-6 mb-8 text-left space-y-3`}>
          <h2 className={`font-bold ${isBasketball ? "text-amber-900" : "text-green-900"}`}>Cum funcționează?</h2>
          <ul className={`space-y-2 text-sm ${isBasketball ? "text-amber-800" : "text-green-700"}`}>
            {[
              "Fiecare echipă este trasă la sorți aleatoriu în una din cele 4 grupe",
              matchesPerTeam,
              "Nu există meciuri directe repetate",
              "Programul este generat automat de sistem",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 w-5 h-5 rounded-full ${isBasketball ? "bg-amber-600" : "bg-green-600"} text-white text-xs flex items-center justify-center font-bold shrink-0`}>
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href={publicHref}
          className={`inline-flex items-center gap-2 px-6 py-3 ${isBasketball ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"} text-white font-bold rounded-xl transition-all hover:-translate-y-0.5`}
        >
          {icon} Vezi meciurile programate
        </Link>
      </div>
    </div>
  );
}
