export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((part) => part.length > 1);
}

export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const left = new Set(a.map(normalizeName));
  const right = new Set(b.map(normalizeName));
  let inter = 0;
  for (const item of left) if (right.has(item)) inter += 1;
  return inter / (left.size + right.size - inter);
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
