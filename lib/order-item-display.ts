export interface OrderDisplayVariant {
  size_id?: string | null;
  size_name?: string | null;
  color_name?: string | null;
  color_code?: string | null;
  color_hex?: string | null;
  quantity?: number | null;
}

export interface OrderDisplayItem {
  quantity?: number | null;
  item_options?: {
    size_id?: string | null;
    size_name?: string | null;
    color_name?: string | null;
    color_code?: string | null;
    color_hex?: string | null;
    variants?: OrderDisplayVariant[] | null;
  } | null;
}

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function includesToken(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^0-9a-z])${escaped}(?=$|[^0-9a-z])`, 'i').test(text);
}

export function formatOrderColor(colorName?: string | null, colorCode?: string | null): string | null {
  const name = cleanText(colorName);
  const code = cleanText(colorCode);

  if (name && code) return `${name}(${code})`;
  return name || code;
}

export function getOrderItemVariants(item: OrderDisplayItem): OrderDisplayVariant[] {
  const options = item.item_options;
  if (Array.isArray(options?.variants) && options.variants.length > 0) {
    return options.variants;
  }

  return [{
    size_id: options?.size_id,
    size_name: options?.size_name,
    color_name: options?.color_name,
    color_code: options?.color_code,
    color_hex: options?.color_hex,
    quantity: item.quantity ?? 0,
  }];
}

export function getOrderItemColorLabel(item: OrderDisplayItem): string | null {
  const variants = getOrderItemVariants(item);
  const variantWithColor = variants.find((variant) =>
    cleanText(variant.color_name) || cleanText(variant.color_code)
  );

  return formatOrderColor(
    variantWithColor?.color_name ?? item.item_options?.color_name,
    variantWithColor?.color_code ?? item.item_options?.color_code,
  );
}

export function formatOrderSize(variant: OrderDisplayVariant): string {
  const name = cleanText(variant.size_name);
  const code = cleanText(variant.size_id);

  if (name && code && !includesToken(name, code)) {
    return `${name} (${code})`;
  }

  return name || code || '사이즈 미지정';
}

export function formatOrderVariantQuantity(variant: OrderDisplayVariant): string {
  return `${formatOrderSize(variant)} × ${variant.quantity ?? 0}`;
}
