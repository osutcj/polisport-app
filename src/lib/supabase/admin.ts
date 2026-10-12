import { getDb } from "@/lib/db";
import { QueryBuilder } from "@/lib/db/query-builder";
import * as localAuth from "@/lib/db/auth";

/**
 * Client Admin pentru Server Actions / API Routes.
 * Conectat direct la SQLite local cu structura și datele din Supabase.
 */
export function createAdminClient() {
  const db = getDb();
  return {
     
    from: (table: string) => new QueryBuilder<any>(db, table),
    auth: localAuth,
  };
}
