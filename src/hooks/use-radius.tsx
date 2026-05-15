import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Ctx = {
  courtsKm: number;
  hoopersKm: number;
  setCourtsKm: (n: number) => void;
  setHoopersKm: (n: number) => void;
};

const KEY_C = "hoops-radius-courts";
const KEY_H = "hoops-radius-hoopers";
const DEFAULT = 10;

const RadiusContext = createContext<Ctx>({
  courtsKm: DEFAULT,
  hoopersKm: DEFAULT,
  setCourtsKm: () => {},
  setHoopersKm: () => {},
});

export function RadiusProvider({ children }: { children: ReactNode }) {
  const [courtsKm, setC] = useState(DEFAULT);
  const [hoopersKm, setH] = useState(DEFAULT);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = Number(localStorage.getItem(KEY_C));
    const h = Number(localStorage.getItem(KEY_H));
    if (c > 0) setC(c);
    if (h > 0) setH(h);
  }, []);

  function setCourtsKm(n: number) {
    setC(n);
    if (typeof window !== "undefined") localStorage.setItem(KEY_C, String(n));
  }
  function setHoopersKm(n: number) {
    setH(n);
    if (typeof window !== "undefined") localStorage.setItem(KEY_H, String(n));
  }

  return (
    <RadiusContext.Provider value={{ courtsKm, hoopersKm, setCourtsKm, setHoopersKm }}>
      {children}
    </RadiusContext.Provider>
  );
}

export const useRadius = () => useContext(RadiusContext);
