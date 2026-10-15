export function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { mean: Math.round(mean), p10: q(0.1), median: q(0.5), p90: q(0.9), max: s[s.length - 1]! };
}
