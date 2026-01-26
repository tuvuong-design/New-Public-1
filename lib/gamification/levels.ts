export function levelFromXp(xp: number) {
  const safe = Math.max(0, Math.floor(xp || 0));
  // Simple curve (MVP): 100 XP per level.
  return Math.max(1, Math.floor(safe / 100) + 1);
}

export function nextLevelXp(level: number) {
  const lv = Math.max(1, Math.floor(level || 1));
  return lv * 100;
}
