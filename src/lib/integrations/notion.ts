/**
 * ─────────────────────────────────────────────────────────────
 *  NOTION (NOVA OS / "the NOS") INTEGRATION STUB  (PRD §7 — Phase 2)
 * ─────────────────────────────────────────────────────────────
 *
 * The NOS holds Tasks/Registry, SOPs, Learning Vault, Seller Discovery and
 * Contacts. Diana's OS READS these via the Notion API (Notion has no push
 * webhooks, so this is polled every 5–15 min by a cron job) and surfaces them
 * in context — tasks, SOP references and pipeline notes — linked by `notion_id`.
 *
 * WHAT TO BUILD HERE (Phase 2):
 *   - Auth: internal integration token (NOTION_TOKEN).
 *   - Read databases: NOTION_DB_TASKS, NOTION_DB_CONTACTS, NOTION_DB_SOPS,
 *     NOTION_DB_SELLER_DISCOVERY.
 *   - Map pages → Supabase rows, upsert on `notion_id`.
 *   - Seed the task/deadline templates from the NOS SOPs on first run (PRD §5).
 */

export interface NotionConfig {
  token: string;
  dbTasks?: string;
  dbContacts?: string;
  dbSops?: string;
  dbSellerDiscovery?: string;
}

export function getNotionConfig(): NotionConfig | null {
  const token = process.env.NOTION_TOKEN;
  if (!token) return null;
  return {
    token,
    dbTasks: process.env.NOTION_DB_TASKS,
    dbContacts: process.env.NOTION_DB_CONTACTS,
    dbSops: process.env.NOTION_DB_SOPS,
    dbSellerDiscovery: process.env.NOTION_DB_SELLER_DISCOVERY,
  };
}

export function isNotionConfigured(): boolean {
  return Boolean(process.env.NOTION_TOKEN);
}

/** Phase 2: poll the NOS databases and upsert into Supabase. TODO. */
export async function syncFromNotion(): Promise<{ synced: number }> {
  const config = getNotionConfig();
  if (!config) {
    throw new Error(
      "Notion (NOS) is not configured. Set NOTION_TOKEN to enable sync.",
    );
  }
  throw new Error("Notion sync not implemented yet — integration stub.");
}
