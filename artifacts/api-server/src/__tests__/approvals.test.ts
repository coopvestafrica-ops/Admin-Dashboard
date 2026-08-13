/**
 * Maker-Checker (four-eyes) enforcement tests.
 *
 * These tests mock the *actual* import paths used by the approval route
 * (../lib/supabase.js, ../lib/audit.js, ../lib/approval-executors.js,
 * ../middleware/auth.js) so they exercise the real handler logic without
 * depending on the broken tsconfig project references.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// ── Mock supabase client with chainable builder ───────────────────────────────
type Row = Record<string, any>;
interface QueryState {
  data: Row | Row[] | null;
  error: any;
}

function makeChainable(state: QueryState) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({ data: state.data, error: state.error })),
    maybeSingle: vi.fn(async () => ({ data: state.data, error: state.error })),
    then: undefined,
  };
  // Make the chain itself awaitable (supabase queries are thenable).
  (chain as any).then = (resolve: any, reject: any) =>
    Promise.resolve({ data: state.data, error: state.error }).then(resolve, reject);
  return chain;
}

const state: QueryState = { data: null, error: null };
let lastInsertPayload: any = null;
let lastUpdateFilter: any = null;

const supabaseMock: any = {
  from: vi.fn((table: string) => {
    const chain = makeChainable(state);
    // Track inserts / updates for assertions.
    chain.insert = vi.fn((payload: any) => {
      lastInsertPayload = payload;
      const insChain = makeChainable(state);
      return insChain;
    });
    chain.update = vi.fn((payload: any) => {
      const updChain = makeChainable(state);
      updChain.eq = vi.fn((field: string, val: any) => {
        lastUpdateFilter = { field, val };
        return updChain;
      });
      // also support chained second eq (optimistic lock)
      const origEq = updChain.eq;
      return updChain;
    });
    return chain;
  }),
};

vi.mock("../lib/supabase.js", () => ({ supabase: supabaseMock }));
vi.mock("../lib/audit.js", () => ({
  logAudit: vi.fn(async () => {}),
}));
vi.mock("../lib/approval-executors.js", () => ({
  executeApprovedAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn((req: any, _res: any, next: any) => {
    // Allow tests to inject the authenticated user via a custom header.
    const headerUser = req.headers["x-test-user"];
    (req as any).user = headerUser
      ? JSON.parse(headerUser)
      : { profileId: "reviewer-1", email: "reviewer@test", role: "super_admin" };
    next();
  }),
  requireRole: vi.fn((..._roles: any[]) => (_req: any, _res: any, next: any) => next()),
}));

async function buildApp() {
  const { default: r } = await import("../routes/approvals");
  const app = express();
  app.use(express.json());
  app.use("/api", r);
  return app;
}

describe("Maker-Checker four-eyes enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.data = { id: "appr-1", status: "pending", request_type: "contributions.adjust", new_value: {}, initiated_by: "maker-1", initiated_by_email: "maker@test", action: "create_contribution" };
    state.error = null;
    lastInsertPayload = null;
    lastUpdateFilter = null;
  });

  it("blocks self-approval (initiator cannot approve their own request)", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/approvals/appr-1/approve")
      .set("x-test-user", JSON.stringify({ profileId: "maker-1", email: "maker@test", role: "super_admin" }))
      .send({ confirmPhrase: "APPROVED", reviewNotes: "ok" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/four-eyes/i);
  });

  it("approves when reviewer differs from initiator", async () => {
    // Default user is reviewer-1; approval initiated_by is maker-1.
    const app = await buildApp();
    const res = await request(app)
      .post("/api/approvals/appr-1/approve")
      .send({ confirmPhrase: "APPROVED", reviewNotes: "looks good" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.approved).toBe(true);
    expect(res.body.executed).toBe(true);
  });

  it("requires the APPROVED confirm phrase", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/approvals/appr-1/approve")
      .send({ confirmPhrase: "yes", reviewNotes: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/APPROVED/i);
  });

  it("rejects an approval request", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/approvals/appr-1/reject")
      .send({ reviewNotes: "invalid amount" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("only allows the initiator to cancel", async () => {
    // Default user is reviewer-1, not maker-1 -> forbidden.
    const app = await buildApp();
    const res = await request(app)
      .post("/api/approvals/appr-1/cancel")
      .send();

    expect(res.status).toBe(403);
  });

  it("flags already-processed requests", async () => {
    state.data = { ...state.data, status: "approved" };
    const app = await buildApp();
    const res = await request(app)
      .post("/api/approvals/appr-1/approve")
      .send({ confirmPhrase: "APPROVED", reviewNotes: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already been processed/i);
  });
});
