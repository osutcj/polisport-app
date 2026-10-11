import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tragere la Sorți",
  description: "Vizualizarea tragerii la sorți pentru grupele turneului PoliSport.",
};

export default function TragereLaSortiPublicPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center max-w-xl mx-auto">
        <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-5xl mb-6 shadow-xl shadow-green-200">
          🎲
        </div>
        <h1 className="text-4xl font-black text-green-900 mb-3">Tragere la Sorți</h1>
        <p className="text-green-600 mb-8 leading-relaxed">
          Tragerea la sorți pentru generarea celor 4 meciuri per echipă
          se realizează de echipa de organizare. Rezultatele vor fi vizibile
          imediat după finalizare.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8 text-left space-y-3">
          <h2 className="font-bold text-green-900">Cum funcționează?</h2>
          <ul className="space-y-2 text-sm text-green-700">
            {[
              "Fiecare echipă este trasă la sorți aleatoriu",
              "Fiecare echipă joacă exact 4 meciuri în faza grupelor",
              "Nu există meciuri directe repetate",
              "Programul este generat automat de sistem",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-green-600 text-white text-xs flex items-center justify-center font-bold shrink-0">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/public"
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all hover:-translate-y-0.5"
        >
          ⚽ Vezi meciurile programate
        </Link>
      </div>
    </div>
  );
}
