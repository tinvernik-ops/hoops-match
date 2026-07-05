/**
 * Integration test: "Call up for a hoop sesh".
 *
 * Creates two throwaway players, drops them onto the same court (a shared
 * court session — same lat/lng, fresh location timestamp), then has player A
 * send a hoop-sesh invite to player B and verifies:
 *   - The insert succeeds under the invites RLS policy (from_id = auth.uid()).
 *   - Player B (the target) can read the invite via the participants policy.
 *   - Player B can accept it (participants can update status).
 *   - A non-participant CANNOT see the invite.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY to mint pre-confirmed users.
 * Run with:
 *   bunx vitest run tests/call-hoop-sesh.integration.test.ts
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

type TestUser = { client: SupabaseClient; userId: string; email: string };

async function signUpThrowaway(): Promise<TestUser | null> {
  if (!SERVICE) return null;
  const email = `it-${crypto.randomUUID()}@integration.test`;
  const password = `Pw!${crypto.randomUUID()}`;
  const admin = adminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) return null;
  const client = freshClient();
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) return null;
  return { client, userId: created.user.id, email };
}

async function cleanup(u: TestUser | null) {
  if (!u) return;
  await u.client.auth.signOut();
  if (SERVICE) {
    try {
      await adminClient().auth.admin.deleteUser(u.userId);
    } catch {
      /* best effort */
    }
  }
}

// Place a user at the given lat/lng with a fresh location timestamp so they
// register as "at" the court.
async function placeAtCourt(u: TestUser, lat: number, lng: number) {
  const { error } = await u.client
    .from("profiles")
    .update({ lat, lng, location_updated_at: new Date().toISOString() })
    .eq("id", u.userId);
  if (error) throw error;
}

describe("call up for a hoop sesh", () => {
  beforeAll(() => {
    if (!URL || !ANON) throw new Error("Missing Supabase env vars");
  });

  it("two players at the same court — A can invite B, B receives and accepts, outsider cannot see it", async () => {
    if (!SERVICE) {
      console.warn("Skipping — SUPABASE_SERVICE_ROLE_KEY not set.");
      return;
    }

    const a = await signUpThrowaway();
    const b = await signUpThrowaway();
    const outsider = await signUpThrowaway();
    if (!a || !b || !outsider) {
      await cleanup(a);
      await cleanup(b);
      await cleanup(outsider);
      throw new Error("Failed to create test users");
    }

    let courtId: string | null = null;
    try {
      // 1. Player A creates a court (a shared court session).
      const lat = 40.7128 + Math.random() * 0.001;
      const lng = -74.006 + Math.random() * 0.001;
      const courtName = `IT Court ${crypto.randomUUID().slice(0, 8)}`;
      const { data: court, error: courtErr } = await a.client
        .from("courts")
        .insert({ name: courtName, lat, lng, created_by: a.userId })
        .select("id, lat, lng")
        .single();
      expect(courtErr).toBeNull();
      expect(court).not.toBeNull();
      courtId = court!.id;

      // 2. Both players "check in" at the court.
      await placeAtCourt(a, court!.lat, court!.lng);
      await placeAtCourt(b, court!.lat, court!.lng);

      // Sanity: both profiles are visible & co-located.
      const { data: nearby, error: nearbyErr } = await a.client
        .from("profiles")
        .select("id, lat, lng, location_updated_at")
        .in("id", [a.userId, b.userId]);
      expect(nearbyErr).toBeNull();
      expect(nearby?.length).toBe(2);
      for (const p of nearby!) {
        expect(p.lat).toBeCloseTo(court!.lat, 6);
        expect(p.lng).toBeCloseTo(court!.lng, 6);
      }

      // 3. Player A calls B up for a hoop sesh.
      const message = "Yo, run it? 🏀";
      const { data: invite, error: inviteErr } = await a.client
        .from("invites")
        .insert({ from_id: a.userId, to_id: b.userId, message })
        .select("id, from_id, to_id, status, message")
        .single();
      expect(inviteErr).toBeNull();
      expect(invite).not.toBeNull();
      expect(invite!.from_id).toBe(a.userId);
      expect(invite!.to_id).toBe(b.userId);
      expect(invite!.status).toBe("pending");
      expect(invite!.message).toBe(message);
      const inviteId = invite!.id;

      // 4. Player B can see the invite (participants SELECT policy).
      const { data: bView, error: bViewErr } = await b.client
        .from("invites")
        .select("id, from_id, to_id, status, message")
        .eq("id", inviteId)
        .maybeSingle();
      expect(bViewErr).toBeNull();
      expect(bView).not.toBeNull();
      expect(bView!.from_id).toBe(a.userId);
      expect(bView!.to_id).toBe(b.userId);
      expect(bView!.message).toBe(message);

      // 5. An unrelated user MUST NOT see the invite.
      const { data: outsiderView } = await outsider.client
        .from("invites")
        .select("id")
        .eq("id", inviteId);
      expect(outsiderView ?? []).toEqual([]);

      // 6. Player B accepts the invite.
      const { data: accepted, error: acceptErr } = await b.client
        .from("invites")
        .update({ status: "accepted" })
        .eq("id", inviteId)
        .select("status")
        .single();
      expect(acceptErr).toBeNull();
      expect(accepted!.status).toBe("accepted");
    } finally {
      if (courtId) {
        try {
          await a.client.from("courts").delete().eq("id", courtId);
        } catch {
          /* best effort */
        }
      }
      await cleanup(a);
      await cleanup(b);
      await cleanup(outsider);
    }
  }, 60_000);

  it("a non-participant cannot forge an invite from another user (from_id must equal auth.uid())", async () => {
    if (!SERVICE) return;
    const a = await signUpThrowaway();
    const b = await signUpThrowaway();
    const attacker = await signUpThrowaway();
    if (!a || !b || !attacker) {
      await cleanup(a);
      await cleanup(b);
      await cleanup(attacker);
      throw new Error("Failed to create test users");
    }
    try {
      const { error } = await attacker.client
        .from("invites")
        .insert({ from_id: a.userId, to_id: b.userId, message: "spoofed" });
      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toMatch(/policy|permission|denied|violates|row-level/);
    } finally {
      await cleanup(a);
      await cleanup(b);
      await cleanup(attacker);
    }
  }, 60_000);
});
