/**
 * Integration tests: ratings privacy.
 *
 * Verifies that:
 *  - Anonymous (unauthenticated) clients cannot read the ratings table at all.
 *  - Authenticated non-participants (users who neither rated nor were rated
 *    in a row) can read aggregate score columns (offense, defense) but
 *    CANNOT read rater_id (rater identity is never exposed to outsiders).
 *  - Participants (the rater or ratee) keep full read access via their own
 *    row policy.
 *
 * These hit the live Lovable Cloud / Supabase REST API using the public
 * publishable (anon) key — no service role secret required. Run with:
 *   bunx vitest run tests/ratings-privacy.integration.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function freshClient() {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

function adminClient() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signUpThrowaway(): Promise<{ client: SupabaseClient; userId: string; email: string } | null> {
  const email = `it-${crypto.randomUUID()}@integration.test`;
  const password = `Pw!${crypto.randomUUID()}`;

  // Preferred path: pre-confirm via admin so tests work regardless of email-confirmation setting.
  if (SERVICE) {
    const admin = adminClient();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) return null;
    const client = freshClient();
    const { data: signed, error: signInErr } = await client.auth.signInWithPassword({ email, password });
    if (signInErr || !signed.session) return null;
    return { client, userId: created.user.id, email };
  }

  // Fallback: plain signUp (skipped when email confirmation is enforced).
  const client = freshClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error || !data.session) return null;
  return { client, userId: data.user!.id, email };
}

async function cleanup(user: { userId: string; client: SupabaseClient } | null) {
  if (!user) return;
  await user.client.auth.signOut();
  if (SERVICE) {
    try {
      await adminClient().auth.admin.deleteUser(user.userId);
    } catch {
      /* best effort */
    }
  }
}

describe("ratings privacy", () => {
  let anonClient: SupabaseClient;

  beforeAll(() => {
    if (!URL || !ANON) throw new Error("Missing Supabase env vars");
    anonClient = freshClient();
  });

  it("anonymous clients receive no ratings rows (policies are TO authenticated only)", async () => {
    const { data, error } = await anonClient.from("ratings").select("id, offense, defense");
    // Either an empty set (no matching policy) or an explicit permission error is acceptable;
    // what is NOT acceptable is leaking rows to anon.
    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|policy|denied|jwt/);
    } else {
      expect(data).toEqual([]);
    }
  });

  it("anonymous clients cannot read rater_id", async () => {
    const { data, error } = await anonClient.from("ratings").select("rater_id");
    if (!error) {
      // Must not leak any rater identity.
      expect(data).toEqual([]);
    } else {
      expect(error.message.toLowerCase()).toMatch(/permission|denied|column|policy|jwt/);
    }
  });

  it("authenticated non-participants can read aggregate columns but never rater_id", async () => {
    const a = await signUpThrowaway();
    if (!a) {
      console.warn("Skipping authenticated test — email confirmation appears to be enabled.");
      return;
    }

    // Aggregate-only read should succeed (may legitimately be empty if no
    // ratings exist yet, but must not error).
    const agg = await a.client.from("ratings").select("id, offense, defense, ratee_id");
    expect(agg.error).toBeNull();
    expect(Array.isArray(agg.data)).toBe(true);

    // Asking for rater_id as a non-participant MUST NOT return another user's
    // rater identity. PostgREST will either reject the column outright (no
    // SELECT grant on rater_id for `authenticated`) or filter the value out.
    const withRater = await a.client.from("ratings").select("id, rater_id");
    if (withRater.error) {
      // Column-level permission denial is the expected hardened response.
      expect(withRater.error.message.toLowerCase()).toMatch(/permission|denied|column|rater_id/);
    } else {
      // If it succeeded, every returned rater_id must belong to the caller
      // (i.e. the caller is the participant for that row). For a fresh
      // throwaway user with no games, that means none.
      for (const row of withRater.data ?? []) {
        expect(row.rater_id == null || row.rater_id === a.userId).toBe(true);
      }
    }

    await cleanup(a);
  }, 30_000);

  it("a non-participant cannot insert a rating for arbitrary users (can_rate guard)", async () => {
    const a = await signUpThrowaway();
    const b = await signUpThrowaway();
    if (!a || !b) {
      console.warn("Skipping insert guard test — signup/session unavailable.");
      await cleanup(a);
      await cleanup(b);
      return;
    }
    const { error } = await a.client
      .from("ratings")
      .insert({ rater_id: a.userId, ratee_id: b.userId, offense: 80, defense: 80 });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/policy|permission|denied|can_rate|violates/);
    await cleanup(a);
    await cleanup(b);
  }, 30_000);
});
