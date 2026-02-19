const STORAGE_KEY = "savedBriefings";

export interface SavedBriefing {
  id: string;
  savedAt: string;
  days: number;
  mode: "simple" | "extended";
  language: "en" | "de";
  keywords: string[];
  briefing: string;
  sources: Array<{ title: string; url: string; source_name: string }>;
}

export function getSavedBriefings(): SavedBriefing[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveBriefing(
  briefing: Omit<SavedBriefing, "id" | "savedAt">
): SavedBriefing {
  const newBriefing: SavedBriefing = {
    ...briefing,
    id: crypto.randomUUID?.() || Date.now().toString(),
    savedAt: new Date().toISOString(),
  };
  const existing = getSavedBriefings();
  const updated = [newBriefing, ...existing];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newBriefing;
}

export function deleteBriefing(id: string): void {
  const existing = getSavedBriefings();
  const updated = existing.filter((b) => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getBriefingById(id: string): SavedBriefing | null {
  const briefings = getSavedBriefings();
  return briefings.find((b) => b.id === id) || null;
}
