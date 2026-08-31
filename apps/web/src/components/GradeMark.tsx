/**
 * A grade is shown as a picture plus its Hindi word — never a bare letter
 * (CLAUDE.md §5). The single-letter codes are for storage and the printed
 * register only.
 *
 * We have no photographs of the household's actual grades yet, so this draws a
 * silhouette whose size, shape and colour carry the same information the word
 * does: मोटा is large, गुल्ला is small and round, किर्री is tiny, हरा is green.
 * When `photoUrl` is set the real photograph replaces it — that is the state
 * §5 actually asks for, and it should be reached as soon as there are photos.
 */
export interface GradeLike {
  code: string;
  labelHi: string;
  photoUrl?: string | null;
}

/** Radius and tint per register code. Unknown codes get a neutral medium potato. */
const SHAPE: Record<string, { rx: number; ry: number; fill: string }> = {
  M: { rx: 30, ry: 23, fill: '#c8a05a' }, // मोटा — large
  B: { rx: 32, ry: 25, fill: '#d2ab63' }, // बम्पर — largest
  G: { rx: 20, ry: 19, fill: '#c9a463' }, // गुल्ला — small, round
  H: { rx: 26, ry: 21, fill: '#8aa05a' }, // हरा — green, sun-exposed
  K: { rx: 14, ry: 12, fill: '#bd9a5f' }, // किर्री — undersized
};

export function GradeMark({ grade, size = 56 }: { grade: GradeLike; size?: number }) {
  if (grade.photoUrl) {
    return (
      <img
        src={grade.photoUrl}
        alt={grade.labelHi}
        width={size}
        height={size}
        className="shrink-0 rounded-full border-2 border-line object-cover"
      />
    );
  }

  const shape = SHAPE[grade.code] ?? { rx: 24, ry: 20, fill: '#c4a06a' };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      className="shrink-0"
      role="img"
      aria-label={grade.labelHi}
    >
      <circle cx="36" cy="36" r="35" fill="#f3ede0" stroke="#d9d2c4" strokeWidth="2" />
      <ellipse cx="36" cy="36" rx={shape.rx} ry={shape.ry} fill={shape.fill} />
      {/* Eyes, so it reads as a potato rather than a coloured blob. */}
      <circle cx={36 - shape.rx * 0.4} cy={36 - shape.ry * 0.25} r="2" fill="#00000022" />
      <circle cx={36 + shape.rx * 0.3} cy={36 + shape.ry * 0.3} r="2.4" fill="#00000022" />
    </svg>
  );
}
