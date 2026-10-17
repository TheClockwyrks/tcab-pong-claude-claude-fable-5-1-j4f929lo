// Small numeric helpers shared by the simulation.

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
