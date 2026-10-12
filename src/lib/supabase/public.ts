import { getDb } from "@/lib/db";
import { QueryBuilder } from "@/lib/db/query-builder";

/**
 * Client Public pentru Server Components.
 * Conectat direct la SQLite local cu structura și datele din Supabase.
 */
export function createPublicClient() {
  const db = getDb();
  return {
     
    from: (table: string) => new QueryBuilder<any>(db, table),
  };
}
