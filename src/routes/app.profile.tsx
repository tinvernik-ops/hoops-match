import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LogOut, Settings } from "lucide-react";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

const schema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_.-]+$/),
  phone: z.string().trim().min(7).max(20).regex(/^[+\d\s().-]+$/),
  height_cm: z.number().int().min(120).max(250),
  vertical_cm: z.number().int().min(10).max(150).nullable(),
  weight_kg: z.number().int().min(30).max(250).nullable(),
});

function ProfilePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: "", phone: "", height_cm: "", vertical_cm: "", weight_kg: "" });

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username ?? "",
        phone: profile.phone ?? "",
        height_cm: profile.height_cm?.toString() ?? "",
        vertical_cm: profile.vertical_cm?.toString() ?? "",
        weight_kg: profile.weight_kg?.toString() ?? "",
      });
    }
  }, [profile]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const v = schema.parse({
        username: form.username,
        phone: form.phone,
        height_cm: Number(form.height_cm),
        vertical_cm: form.vertical_cm ? Number(form.vertical_cm) : null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      });
      const { error } = await supabase.from("profiles").update(v).eq("id", user!.id);
      if (error) throw error;
      toast.success("Profile saved");
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <header className="flex items-center gap-4 mb-6">
        <div className="grid place-items-center size-20 rounded-full bg-gradient-to-br from-primary to-rim text-primary-foreground text-display text-3xl font-bold">
          {(profile?.username ?? "H").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-display text-2xl font-bold truncate">@{profile?.username}</h1>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Link to="/app/settings" className="grid place-items-center size-10 rounded-full bg-secondary" aria-label="Settings">
          <Settings className="size-5" />
        </Link>
      </header>

      <form onSubmit={onSave} className="space-y-4">
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" maxLength={24} value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" maxLength={20} value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="height">Height (cm)</Label>
          <Input id="height" type="number" min={120} max={250} value={form.height_cm}
            onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
            placeholder="e.g. 185" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="vertical">Vertical (cm)</Label>
            <Input id="vertical" type="number" min={10} max={150} value={form.vertical_cm}
              onChange={(e) => setForm({ ...form, vertical_cm: e.target.value })}
              placeholder="opt." />
          </div>
          <div>
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input id="weight" type="number" min={30} max={250} value={form.weight_kg}
              onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
              placeholder="opt." />
          </div>
        </div>
        <Button type="submit" disabled={busy} className="w-full h-12 font-bold" size="lg">
          {busy ? <Loader2 className="animate-spin" /> : "Save"}
        </Button>
      </form>

      <button
        onClick={signOut}
        className="mt-8 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </main>
  );
}
