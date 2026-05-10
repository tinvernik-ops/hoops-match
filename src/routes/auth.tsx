import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Hoops" }] }),
  component: AuthPage,
});

const signupSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(7, "Phone too short").max(20).regex(/^[+\d\s().-]+$/, "Invalid phone"),
  username: z.string().trim().min(3, "At least 3 characters").max(24).regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, _ . -"),
  password: z.string().min(8, "At least 8 characters").max(72),
  vertical_cm: z.union([z.literal(""), z.coerce.number().int().min(10).max(150)]).optional(),
  weight_kg: z.union([z.literal(""), z.coerce.number().int().min(30).max(250)]).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

function AuthPage() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", phone: "", username: "", password: "", vertical_cm: "", weight_kg: "" });

  useEffect(() => {
    if (!authLoading && user) nav({ to: "/app" });
  }, [user, authLoading, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const v = signupSchema.parse(form);

        // Pre-check duplicates (username + phone). Email duplicates are caught by auth.signUp.
        const { data: dupes, error: dupErr } = await supabase
          .from("profiles")
          .select("username, phone")
          .or(`username.ilike.${v.username},phone.eq.${v.phone}`);
        if (dupErr) throw dupErr;
        if (dupes?.some((d) => d.username.toLowerCase() === v.username.toLowerCase())) {
          throw new Error("Username already taken");
        }
        if (dupes?.some((d) => d.phone === v.phone)) {
          throw new Error("Phone number already in use");
        }

        const { data: signupData, error } = await supabase.auth.signUp({
          email: v.email,
          password: v.password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { username: v.username, phone: v.phone },
          },
        });
        if (error) throw error;
        // Optional fields go on the profile after signup
        const vertical = typeof v.vertical_cm === "number" ? v.vertical_cm : null;
        const weight = typeof v.weight_kg === "number" ? v.weight_kg : null;
        if (signupData.user && (vertical != null || weight != null)) {
          await supabase
            .from("profiles")
            .update({ vertical_cm: vertical, weight_kg: weight })
            .eq("id", signupData.user.id);
        }
        toast.success("Welcome to Hoops 🏀");
        nav({ to: "/app" });
      } else {
        const v = loginSchema.parse(form);
        const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
        if (error) throw error;
        nav({ to: "/app" });
      }
    } catch (err: unknown) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-2">🏀</div>
          <h1 className="text-display text-5xl font-bold text-primary">HOOPS</h1>
          <p className="text-sm text-muted-foreground mt-1">Run it back. Find your next sesh.</p>
        </div>

        <div className="flex rounded-lg bg-secondary p-1 mb-6">
          {(["signup", "login"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signup" ? "Sign up" : "Log in"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required maxLength={255}
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {mode === "signup" && (
            <>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" autoComplete="username" required maxLength={24}
                  value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" autoComplete="tel" required maxLength={20}
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="vertical">Vertical (cm) <span className="text-muted-foreground font-normal">opt.</span></Label>
                  <Input id="vertical" type="number" min={10} max={150} placeholder="e.g. 70"
                    value={form.vertical_cm} onChange={(e) => setForm({ ...form, vertical_cm: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg) <span className="text-muted-foreground font-normal">opt.</span></Label>
                  <Input id="weight" type="number" min={30} max={250} placeholder="e.g. 80"
                    value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
                </div>
              </div>
            </>
          )}
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required maxLength={72}
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>

          <Button type="submit" disabled={busy} className="w-full h-12 text-base font-bold" size="lg">
            {busy ? <Loader2 className="animate-spin" /> : mode === "signup" ? "Lace up" : "Check in"}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-6">
          By signing up you agree to share your location and receive notifications about hoop seshes.
        </p>
        <p className="text-xs text-center text-muted-foreground mt-3">
          <Link to="/app" className="underline">Skip for now</Link>
        </p>
      </div>
    </main>
  );
}
