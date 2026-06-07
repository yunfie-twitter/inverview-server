import { createContext } from "react";
import type { MiniPlayerContextValue, SettingsContextValue } from "./types";

export const SettingsContext = createContext<SettingsContextValue | null>(null);
export const MiniPlayerContext = createContext<MiniPlayerContextValue | null>(null);
