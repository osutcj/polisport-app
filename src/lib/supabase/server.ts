import { getDb } from "@/lib/db";
import { QueryBuilder } from "@/lib/db/query-builder";
import * as localAuth from "@/lib/db/auth";

/**
 * Client Server pentru Server Components, Route Handlers și Server Actions.
 * Conectat direct la SQLite local cu structura și datele din Supabase.
 */
export async function createClient() {
  const db = getDb();
  return {
     
    from: (table: string) => new QueryBuilder<any>(db, table),
    auth: localAuth,
  };
}
