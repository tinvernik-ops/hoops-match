import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "hr" | "es" | "de" | "fr" | "it";

export const LANGUAGES: { code: Lang; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "hr", name: "Hrvatski", flag: "🇭🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
];

type Dict = Record<string, string>;
const DICTS: Record<Lang, Dict> = {
  en: {
    "nav.court": "Court",
    "nav.leagues": "Leagues",
    "nav.profile": "Profile",
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.language": "Language",
    "settings.day": "Day mode",
    "settings.night": "Night mode",
    "lang.pick.title": "Choose your language",
    "lang.pick.sub": "You can change this later in Settings.",
    "lang.continue": "Continue",
  },
  hr: {
    "nav.court": "Teren",
    "nav.leagues": "Lige",
    "nav.profile": "Profil",
    "settings.title": "Postavke",
    "settings.appearance": "Izgled",
    "settings.language": "Jezik",
    "settings.day": "Dnevni način",
    "settings.night": "Noćni način",
    "lang.pick.title": "Odaberi jezik",
    "lang.pick.sub": "Možeš ga promijeniti kasnije u postavkama.",
    "lang.continue": "Nastavi",
  },
  es: {
    "nav.court": "Cancha",
    "nav.leagues": "Ligas",
    "nav.profile": "Perfil",
    "settings.title": "Ajustes",
    "settings.appearance": "Apariencia",
    "settings.language": "Idioma",
    "settings.day": "Modo día",
    "settings.night": "Modo noche",
    "lang.pick.title": "Elige tu idioma",
    "lang.pick.sub": "Puedes cambiarlo luego en Ajustes.",
    "lang.continue": "Continuar",
  },
  de: {
    "nav.court": "Court",
    "nav.leagues": "Ligen",
    "nav.profile": "Profil",
    "settings.title": "Einstellungen",
    "settings.appearance": "Darstellung",
    "settings.language": "Sprache",
    "settings.day": "Tagmodus",
    "settings.night": "Nachtmodus",
    "lang.pick.title": "Wähle deine Sprache",
    "lang.pick.sub": "Du kannst dies später in den Einstellungen ändern.",
    "lang.continue": "Weiter",
  },
  fr: {
    "nav.court": "Terrain",
    "nav.leagues": "Ligues",
    "nav.profile": "Profil",
    "settings.title": "Paramètres",
    "settings.appearance": "Apparence",
    "settings.language": "Langue",
    "settings.day": "Mode jour",
    "settings.night": "Mode nuit",
    "lang.pick.title": "Choisis ta langue",
    "lang.pick.sub": "Tu peux changer cela plus tard dans les Paramètres.",
    "lang.continue": "Continuer",
  },
  it: {
    "nav.court": "Campo",
    "nav.leagues": "Leghe",
    "nav.profile": "Profilo",
    "settings.title": "Impostazioni",
    "settings.appearance": "Aspetto",
    "settings.language": "Lingua",
    "settings.day": "Modalità giorno",
    "settings.night": "Modalità notte",
    "lang.pick.title": "Scegli la tua lingua",
    "lang.pick.sub": "Puoi cambiarla in seguito nelle Impostazioni.",
    "lang.continue": "Continua",
  },
};

const STORAGE_KEY = "hoops-lang";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  needsPick: boolean;
  confirmPick: () => void;
};
const LangContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
  needsPick: false,
  confirmPick: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [needsPick, setNeedsPick] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && DICTS[stored]) {
      setLangState(stored);
    } else {
      const browser = (navigator.language || "en").slice(0, 2).toLowerCase() as Lang;
      if (DICTS[browser]) setLangState(browser);
      setNeedsPick(true);
    }
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  }
  function confirmPick() {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, lang);
    setNeedsPick(false);
  }
  function t(key: string) {
    return DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t, needsPick, confirmPick }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
