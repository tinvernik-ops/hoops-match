import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export function useGeoAndNotify() {
  const { user } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!user || typeof navigator === "undefined") return;

    // Request notification permission (best-effort)
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    if (!("geolocation" in navigator)) {
      setDenied(true);
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        await supabase
          .from("profiles")
          .update({ lat: c.lat, lng: c.lng, location_updated_at: new Date().toISOString() })
          .eq("id", user.id);
      },
      (err) => {
        setDenied(true);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Enable location to see hoopers near you");
        }
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [user]);

  return { coords, denied };
}
