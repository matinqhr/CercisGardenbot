const XP_KEY = 'cercis-xp';

export function getXP(): number {
  const raw = localStorage.getItem(XP_KEY);
  const xp = raw ? Number(raw) : 0;
  return Number.isFinite(xp) && xp >= 0 ? xp : 0;
}

export function addXP(amount: number): number {
  const next = getXP() + Math.max(0, amount);
  localStorage.setItem(XP_KEY, String(next));
  return next;
}

export function resetXP(): void {
  localStorage.removeItem(XP_KEY);
}
