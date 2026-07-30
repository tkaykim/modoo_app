export const SYNTHETIC_ITALIC_DEG = 12;
export const SYNTHETIC_BOLD_EM = 0.035;

export function isBoldWeight(fontWeight: unknown): boolean {
  if (typeof fontWeight === 'string' && fontWeight.toLowerCase() === 'bold') {
    return true;
  }
  const numeric = Number(fontWeight);
  return Number.isFinite(numeric) && numeric >= 600;
}

export function isPathOnlyTextSvg(svg: string): boolean {
  return /<path\b/i.test(svg) && !/<text\b/i.test(svg);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export function styledPathMarkup(options: {
  pathData: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontWeight: unknown;
  fontStyle: unknown;
  opacity: number;
  applyItalicTransform?: boolean;
}): string {
  const {
    pathData,
    fill,
    stroke,
    strokeWidth,
    fontSize,
    fontWeight,
    fontStyle,
    opacity,
    applyItalicTransform = true,
  } = options;
  const boldWidth = isBoldWeight(fontWeight) ? fontSize * SYNTHETIC_BOLD_EM : 0;
  const hasUserStroke = Boolean(stroke) && strokeWidth > 0;
  const paths: string[] = [];

  if (hasUserStroke && boldWidth > 0) {
    paths.push(
      `<path d="${pathData}" fill="none" stroke="${escapeXml(stroke)}" ` +
      `stroke-width="${formatNumber(strokeWidth + boldWidth)}" stroke-linejoin="round" />`
    );
  }

  const effectiveStroke = boldWidth > 0 ? fill : stroke;
  const effectiveStrokeWidth = boldWidth > 0 ? boldWidth : strokeWidth;
  const strokeAttrs = effectiveStroke && effectiveStrokeWidth > 0
    ? ` stroke="${escapeXml(effectiveStroke)}" stroke-width="${formatNumber(effectiveStrokeWidth)}"` +
      ` paint-order="stroke fill" stroke-linejoin="round"`
    : '';
  paths.push(
    `<path d="${pathData}" fill="${escapeXml(fill)}"${strokeAttrs} />`
  );

  const body = paths.join('\n  ');
  const needsItalic =
    applyItalicTransform &&
    typeof fontStyle === 'string' &&
    fontStyle.toLowerCase() === 'italic';
  return needsItalic
    ? `<g transform="skewX(${-SYNTHETIC_ITALIC_DEG})" opacity="${opacity}">\n  ${body}\n</g>`
    : `<g opacity="${opacity}">\n  ${body}\n</g>`;
}
