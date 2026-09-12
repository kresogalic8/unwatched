/** One small Harbor-style drawing shared by the live world and construction replay. */
export function gardenArt(progress = 1): string {
  const ratio = Math.max(0, Math.min(1, progress));
  const beds = Array.from({ length: 3 }, (_, row) => {
    const y = -32 + row * 22;
    const plants = Array.from({ length: Math.floor(ratio * 6) }, (_, i) => {
      const x = -52 + i * 20;
      return `<g transform="translate(${x} ${y})"><path d="M0 2Q-1 -8 -7 -9Q-10 -1 0 2Q10 -2 7 -10Q1 -8 0 2Z" fill="${i % 2 ? '#789b75' : '#93ad7a'}" stroke="#46675a" stroke-width=".7"/><path d="M0 3V-7" stroke="#416356" stroke-width=".7"/></g>`;
    }).join('');
    return `<g><path d="M-72 ${y-9}L58 ${y-9}L77 ${y+3}L-54 ${y+3}Z" fill="#b99d76" stroke="#8c7e62"/><path d="M-54 ${y+3}H77V${y+8}H-54Z" fill="#cfb78b" stroke="#8c7e62" stroke-width=".8"/>${plants}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -90 220 155" width="220" height="155"><ellipse cx="0" cy="15" rx="105" ry="42" fill="#a8b49a" opacity=".23"/><path d="M-98 -40L40 -68L103 -1L-34 50Z" fill="#d8d1b0" stroke="#b8b593"/>${beds}<g fill="#b79f7d" stroke="#687862" stroke-width="1"><path d="M-89 -49V1H-85V-49Z"/><path d="M88 -21V26H92V-21Z"/><path d="M-88 -35L90 -6V-1L-88 -30Z"/></g><path d="M-95 -46L-68 -43V-25L-95 -28Z" fill="#d9c79e" stroke="#8b8169"/><path d="M-89 -39L-75 -37M-89 -34L-79 -33" stroke="#638172"/><g transform="translate(87 28)" stroke="#5b796c" stroke-width="1.1"><ellipse cx="0" cy="0" rx="10" ry="4" fill="#a1b8a2"/><path d="M-10 0L-8 14Q0 19 8 14L10 0" fill="#93ad9b"/><path d="M8 3Q20 -1 17 10Q13 15 8 11" fill="none"/></g></svg>`;
}
