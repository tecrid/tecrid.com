import { inArray } from "drizzle-orm";
import { getDb } from "../db";
import { organizations } from "../db/schema";

export async function organizationsByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const db = getDb();
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      code: organizations.issuerCode,
      type: organizations.organizationType,
    })
    .from(organizations)
    .where(inArray(organizations.id, unique));
}
