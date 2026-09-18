// Portado de app-financeiro/src/lib/importId.js (feature 011).
// Prefixos: "ofx:<FITID>", "gen:<hash>" (CSV/PDF), "agg:<hash>", "parc:<grupo>:<n>".
export function normalizeDescription(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// FNV-1a 32 bits em hex — determinístico e sem dependências.
export function hashString(s: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function makeImportId(tx: { date: string; amount: number; type: string; description: string }): string {
  const key = `${tx.date}|${tx.amount.toFixed(2)}|${tx.type}|${normalizeDescription(tx.description)}`;
  return `gen:${hashString(key)}`;
}

export function makeAggregateId(memberIds: string[]): string {
  return `agg:${hashString([...memberIds].sort().join("|"))}`;
}
