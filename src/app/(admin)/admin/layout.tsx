import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AdminSidebar from "@/components/admin/AdminSidebar";
import type { SportType } from "@/lib/sport";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.user_metadata?.role !== "admin") {
    redirect("/auth/login");
  }

  // Check sport cookie
  const cookieStore = await cookies();
  const sportCookie = cookieStore.get("polisport_sport_type")?.value;
  if (!sportCookie) {
    redirect("/select-sport");
  }
  const sport = (sportCookie === "basketball" ? "basketball" : "football") as SportType;

  return (
    <div className="flex min-h-screen bg-gray-50 flex-col lg:flex-row">
      <AdminSidebar sport={sport} userEmail={user.email} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
