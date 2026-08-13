/**
 * System-Wide Search (Module 17).
 *
 * One search bar to find members, transactions, loans, payment references,
 * organizations and support tickets. Backed by the system_search_index view
 * created in migration 003.
 */
import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();

router.use(requireAuth);

const SEARCHABLE_TYPES = ["member", "transaction", "loan", "ticket", "organization"] as const;
type EntityType = (typeof SEARCHABLE_TYPES)[number];

/** GET /search?q=&type=&limit= — unified search across entities. */
router.get("/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string | undefined)?.trim();
  const type = req.query.type as string | undefined;
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

  if (!q || q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  let query = supabase
    .from("system_search_index")
    .select("entity_id, entity_type, title, subtitle, extra")
    .or(`title.ilike.%${q}%,subtitle.ilike.%${q}%,extra.ilike.%${q}%`)
    .limit(limit);

  if (type) {
    const allowed = (SEARCHABLE_TYPES as readonly string[]).includes(type) ? (type as EntityType) : null;
    if (!allowed) {
      res.status(400).json({ error: `Invalid type. Valid: ${SEARCHABLE_TYPES.join(", ")}` });
      return;
    }
    query = query.eq("entity_type", allowed);
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const grouped: Record<string, any[]> = {};
  for (const row of data ?? []) {
    if (!grouped[row.entity_type]) grouped[row.entity_type] = [];
    grouped[row.entity_type].push(row);
  }

  res.json({ success: true, query: q, results: data ?? [], grouped });
});

export default router;
