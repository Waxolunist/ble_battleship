import type { Field } from "@/models/types";

export function pickAiTarget(fields: Field[][]): { x: number; y: number } | null {
  const empty: { x: number; y: number }[] = [];
  for (const row of fields) {
    for (const f of row) {
      if (f.status === "empty") empty.push({ x: f.x, y: f.y });
    }
  }
  if (empty.length === 0) return null;
  return empty[Math.floor(Math.random() * empty.length)];
}
