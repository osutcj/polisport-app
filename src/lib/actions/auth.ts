"use server";

import { redirect } from "next/navigation";
import { signInWithPassword, signOut } from "@/lib/db/auth";

export type SignInState = {
  error: string | null;
  fieldErrors?: { email?: string; password?: string };
};

/**
 * Server Action pentru autentificare locală.
 */
export async function signInAction(
  prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  // Validare de bază
  if (!email) return { error: null, fieldErrors: { email: "Email-ul este obligatoriu." } };
  if (!password) return { error: null, fieldErrors: { password: "Parola este obligatorie." } };

  // Autentificare
  const { data, error } = await signInWithPassword({
    email,
    password,
  });

  if (error) {
    let msg = error.message;
    if (error.message === "Invalid login credentials") {
      msg = "Email sau parolă incorectă.";
    }
    return { error: msg };
  }

  // Verificare rol admin
  const role = data.user?.user_metadata?.role as string | undefined;
  if (role !== "admin") {
    await signOut();
    return {
      error: `Contul nu are permisiuni de admin.`,
    };
  }

  console.log("[signInAction] ✅ Login reușit pentru:", data.user?.email);

  const rawRedirect = formData.get("redirectTo") as string | null;
  const safeRedirect =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/admin";

  // Redirect server-side — cookie-ul de sesiune este deja setat
  redirect(safeRedirect);
}

/**
 * Server Action pentru deconectare.
 * Șterge sesiunea și redirecționează la pagina de login.
 */
export async function signOutAction() {
  await signOut();
  redirect("/auth/login");
}
