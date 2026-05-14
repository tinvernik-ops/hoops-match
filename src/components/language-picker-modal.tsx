import { useLang, LANGUAGES } from "@/hooks/use-lang";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export function LanguagePickerModal() {
  const { needsPick, lang, setLang, t, confirmPick } = useLang();

  return (
    <Dialog open={needsPick} onOpenChange={(o) => { if (!o) confirmPick(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-display text-2xl">🌐 {t("lang.pick.title")}</DialogTitle>
          <DialogDescription>{t("lang.pick.sub")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2">
          {LANGUAGES.map((l) => {
            const active = lang === l.code;
            return (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex items-center gap-2 rounded-xl border-2 p-3 text-sm font-semibold transition ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-secondary"
                }`}
              >
                <span className="text-xl">{l.flag}</span>
                <span className="flex-1 text-left">{l.name}</span>
                {active && <Check className="size-4" />}
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={confirmPick} className="w-full font-bold">{t("lang.continue")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
