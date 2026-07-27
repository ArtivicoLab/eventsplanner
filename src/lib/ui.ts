// Small UI helpers shared across screens.

import type { Priority, TaskStatus } from "./types";
import { useSettings } from "../stores/useSettings";

const FIXED_CATEGORY: Record<string, string> = {
  Wedding: "var(--cat-rose)",
  Corporate: "var(--cat-sky)",
  Concert: "var(--cat-plum)",
  Conference: "var(--cat-marigold)",
  Birthday: "var(--cat-clay)",
  "Baby Shower": "var(--cat-sage)",
};

// A separate pool for user-created categories, distinct from the 6 tokens
// FIXED_CATEGORY already claims — otherwise every custom category is
// guaranteed to hash onto a color one of the defaults already uses.
const EXTENDED_PASTELS = [
  "var(--cat-teal)",
  "var(--cat-berry)",
  "var(--cat-honey)",
  "var(--cat-slate)",
  "var(--cat-moss)",
  "var(--cat-lilac)",
];

export const PICKABLE_CATEGORY_COLORS = [
  "var(--cat-rose)", "var(--cat-sky)", "var(--cat-plum)", "var(--cat-marigold)", "var(--cat-clay)", "var(--cat-sage)",
  "var(--cat-teal)", "var(--cat-berry)", "var(--cat-honey)", "var(--cat-slate)", "var(--cat-moss)", "var(--cat-lilac)",
];

export function hashColor(key: string, pool: string[]): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function categoryColor(cat: string): string {
  const picked = useSettings.getState().categoryColors[cat];
  if (picked) return picked;
  if (FIXED_CATEGORY[cat]) return FIXED_CATEGORY[cat];
  return hashColor(cat, EXTENDED_PASTELS);
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  VeryHigh: "Very High",
  High: "High",
  Medium: "Medium",
  Low: "Low",
  VeryLow: "Very Low",
  OnHold: "On Hold",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  VeryHigh: "var(--pri-veryhigh)",
  High: "var(--pri-high)",
  Medium: "var(--pri-medium)",
  Low: "var(--pri-low)",
  VeryLow: "var(--pri-verylow)",
  OnHold: "var(--pri-onhold)",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NotStarted: "Not Started",
  InProgress: "In Progress",
  Review: "Review",
  OnHold: "On Hold",
  Cancelled: "Cancelled",
  Complete: "Complete",
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  NotStarted: "#aeb6c7", // slate
  InProgress: "var(--accent-2)",
  Review: "var(--warn)",
  OnHold: "#9b8f6f",
  Cancelled: "var(--alert)",
  Complete: "var(--success)",
};

// Event status is a free string from Settings.eventStatuses (Setup-
// customizable), not a fixed union — the 6 defaults get deliberate, semantic
// colors; anything the user adds/renames falls back to a hash-assigned slot
// in a color pool distinct from the priority/category ramps shown alongside
// it on the same row.
const FIXED_EVENT_STATUS: Record<string, string> = {
  Prospect: "#8b8598",
  Tentative: "var(--warn)",
  Confirmed: "var(--accent-2)",
  Active: "var(--accent)",
  Complete: "var(--success)",
  Cancelled: "var(--alert)",
};
const EVENT_STATUS_POOL = ["var(--cat-teal)", "var(--cat-berry)", "var(--cat-honey)", "var(--cat-slate)"];

export function eventStatusColor(status: string): string {
  if (FIXED_EVENT_STATUS[status]) return FIXED_EVENT_STATUS[status];
  return hashColor(status, EVENT_STATUS_POOL);
}

export function money(n: number, symbol = "$"): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}${symbol}${abs.toLocaleString(undefined, {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
