export function rowFor(f) {
  const ax = Math.abs(f.x), ay = Math.abs(f.y);
  if (ax < 0.3) return f.y > 0 ? 0 : 4;
  const el = Math.atan2(ay, ax);
  if (el < 0.4) return 2;
  return f.y > 0 ? 1 : 3;
}

export function sheetPose(dir) {
  const row = rowFor(dir);
  const flip = dir.x < -0.05 && (row === 1 || row === 2 || row === 3);
  return { row, flip };
}
