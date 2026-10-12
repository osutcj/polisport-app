"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LogoLink() {
  const searchParams = useSearchParams();
  const sport = searchParams.get("sport");
  const href = sport === "basketball" ? "/public?sport=basketball" : "/public";

  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-md group-hover:shadow-green-300 transition-shadow duration-200">
        <span className="text-white text-lg font-black leading-none">P</span>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-green-700 font-black text-lg tracking-tight">Poli</span>
        <span className="text-green-500 font-semibold text-xs tracking-widest uppercase -mt-0.5">Sport</span>
      </div>
    </Link>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-green-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Suspense fallback={
            <Link href="/public" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-md">
                <span className="text-white text-lg font-black leading-none">P</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-green-700 font-black text-lg tracking-tight">Poli</span>
                <span className="text-green-500 font-semibold text-xs tracking-widest uppercase -mt-0.5">Sport</span>
              </div>
            </Link>
          }>
            <LogoLink />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
