"use client";

import { useActionState, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signInAction, type SignInState } from "@/lib/actions/auth";

const initialState: SignInState = { error: null };

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin";
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const [showPass, setShowPass] = useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-green-800 mb-1.5">
          Adresă Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="admin@polisport.ro"
          className={`w-full px-4 py-3 rounded-xl border-2 text-green-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 text-sm
            ${state.fieldErrors?.email
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
              : "border-green-200 focus:border-green-500 focus:ring-green-500/10"
            }`}
        />
        {state.fieldErrors?.email && (
          <p className="text-red-600 text-xs mt-1 font-medium">{state.fieldErrors.email}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-green-800 mb-1.5">
          Parolă
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className={`w-full px-4 py-3 pr-12 rounded-xl border-2 text-green-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 text-sm
              ${state.fieldErrors?.password
                ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
                : "border-green-200 focus:border-green-500 focus:ring-green-500/10"
              }`}
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors"
            aria-label="Afișează/ascunde parola"
          >
            {showPass ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p className="text-red-600 text-xs mt-1 font-medium">{state.fieldErrors.password}</p>
        )}
      </div>

      {/* Eroare generală */}
      {state.error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-200 disabled:translate-y-0 disabled:shadow-none text-sm flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Se autentifică...
          </>
        ) : (
          <>🔐 Autentificare Admin</>
        )}
      </button>

      {/* Info sesiune */}
      <p className="text-center text-xs text-gray-400">
        Sesiunile anterioare sunt șterse automat la fiecare login.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-green-200/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-green-300/30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-green-100 border border-green-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-green-700 to-green-900 px-8 py-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 shadow-lg">
              <span className="text-3xl font-black text-white">P</span>
            </div>
            <h1 className="text-2xl font-black text-white">Admin Panel</h1>
            <p className="text-green-300 text-sm mt-1">PoliSport Tournament</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <p className="text-sm text-green-600 text-center mb-6">
              Autentifică-te cu contul tău de administrator.
            </p>

            <Suspense fallback={
              <div className="flex justify-center py-8">
                <svg className="w-6 h-6 animate-spin text-green-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            }>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
