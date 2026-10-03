import heads from '../data/heads.json';

/** pixel-perfect portrait cropped from the zkSNARKs atlas */
export function portrait(role: string, size = 32, extra = '') {
  const h = heads.heads.find((x) => x.role === role) ?? heads.heads.find((x) => x.role === 'crowd')!;
  return portraitById(h.i, size, extra);
}
export function portraitById(i: number, size = 32, extra = '') {
  const cols = heads.cols;
  const rows = Math.ceil(heads.count / cols);
  const k = size / 26;
  const x = (i % cols) * 26 * k;
  const y = Math.floor(i / cols) * 26 * k;
  return `<span class="pt ${extra}" style="width:${size}px;height:${size}px;background-size:${cols * 26 * k}px ${rows * 26 * k}px;background-position:-${x}px -${y}px"></span>`;
}
