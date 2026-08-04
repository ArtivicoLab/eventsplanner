import { create } from "zustand";
import { getKV, setKV } from "../lib/db";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_EVENT_STATUS_ICONS,
  DEFAULT_EVENT_STATUSES,
  DEFAULT_EVENT_TYPES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_STATES,
  type Settings,
} from "../lib/types";

const KEY = "settings";
const DEFAULTS: Settings = {
  name: "",
  currency: "$",
  weekStart: 0,
  theme: "auto",
  categories: [...DEFAULT_CATEGORIES],
  categoryColors: {},
  eventTypes: [...DEFAULT_EVENT_TYPES],
  marketRegions: [],
  states: [...DEFAULT_STATES],
  owners: [],
  eventStatuses: [...DEFAULT_EVENT_STATUSES],
  eventStatusIcons: { ...DEFAULT_EVENT_STATUS_ICONS },
  expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
  accessCode: "",
  activated: false,
  googleAccountEmail: "",
};

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
}

function applyTheme(theme: Settings["theme"]) {
  document.documentElement.setAttribute("data-theme", theme);
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    const stored = (await getKV<Settings>(KEY)) ?? {};
    const merged = { ...DEFAULTS, ...stored };
    applyTheme(merged.theme);
    set({ ...merged, loaded: true });
  },
  update: (patch) => {
    const prev = pickSettings(get());
    const next = { ...prev, ...patch };
    if (patch.theme) applyTheme(patch.theme);
    set(patch);
    void setKV(KEY, next);
  },
}));

function pickSettings(s: Settings): Settings {
  return {
    name: s.name,
    currency: s.currency,
    weekStart: s.weekStart,
    theme: s.theme,
    categories: s.categories,
    categoryColors: s.categoryColors,
    eventTypes: s.eventTypes,
    marketRegions: s.marketRegions,
    states: s.states,
    owners: s.owners,
    eventStatuses: s.eventStatuses,
    eventStatusIcons: s.eventStatusIcons,
    expenseCategories: s.expenseCategories,
    accessCode: s.accessCode,
    activated: s.activated,
    googleAccountEmail: s.googleAccountEmail,
  };
}
