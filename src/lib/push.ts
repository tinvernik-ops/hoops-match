// VAPID public key for web push subscription (safe to expose).
export const VAPID_PUBLIC_KEY = "BChFv_76vzSxyq4SERSQMZ-CpzlKAWg1Nv64Mm7p1DmffCIsF1Gz-htss51h4IwnOKkafSaoIy7PybUosGyAqDM";

import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function ensurePushSubscription(userId: string) {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!("Notification" in window)) return;

  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return;

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" }
  );
}

export async function sendPushTo(opts: { toUserId: string; title: string; body: string; url?: string; tag?: string }) {
  try {
    await supabase.functions.invoke("send-push", { body: opts });
  } catch (e) {
    console.warn("send-push failed", e);
  }
}
