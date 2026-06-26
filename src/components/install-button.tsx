import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function InstallButton() {
  const [prompt, setPrompt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const onBip = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      toast.success("App installed");
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setPrompt(null);
      return;
    }
    if (isIOS()) {
      setShowIosHint(true);
      return;
    }
    toast.info("Use your browser menu → 'Install app' or 'Add to Home Screen'.");
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="grid place-items-center size-9 rounded-full bg-primary text-primary-foreground"
        aria-label="Download app"
        title="Download app"
      >
        <Download className="size-4" />
      </button>
      {showIosHint && (
        <div
          onClick={() => setShowIosHint(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-6"
        >
          <div className="max-w-xs rounded-2xl bg-card p-5 text-center">
            <Download className="size-6 mx-auto text-primary mb-2" />
            <div className="font-semibold mb-1">Install on iPhone</div>
            <p className="text-xs text-muted-foreground">
              Tap the Share button in Safari, then <b>Add to Home Screen</b> to install Hoops.
            </p>
            <button className="mt-3 text-xs font-bold text-primary">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
