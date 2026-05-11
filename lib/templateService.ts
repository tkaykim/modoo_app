import { createClient } from './supabase-client';
import {
  DesignTemplate,
  TemplatePickerItem,
  TemplateGroup,
  TemplateGroupWithInstances,
  TemplateGalleryItem,
} from '@/types/types';
import { TemplateCategory } from './templateCategories';

type ProductJoin = {
  id: string;
  title: string;
  base_price: number;
  thumbnail_image_link: string[] | null;
};

function mapJoinedToPickerItem(row: {
  id: string;
  title: string;
  description: string | null;
  preview_url: string | null;
  category: string | null;
  tags: string[] | null;
  products?: ProductJoin | ProductJoin[] | null;
}): TemplatePickerItem {
  const productRaw = Array.isArray(row.products) ? row.products[0] : row.products;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    preview_url: row.preview_url,
    category: row.category,
    tags: row.tags ?? [],
    product: productRaw ?? null,
  };
}

/**
 * Featured templates surfaced on the home page and global gallery.
 */
export async function getFeaturedTemplates(limit = 8): Promise<TemplatePickerItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('design_templates')
    .select(
      'id, title, description, preview_url, category, tags, products:product_id (id, title, base_price, thumbnail_image_link)',
    )
    .eq('is_active', true)
    .eq('is_featured', true)
    .neq('type', 'cobuy_preset')
    .order('sort_order', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch featured templates:', error);
    return [];
  }
  return (data ?? []).map(mapJoinedToPickerItem);
}

/**
 * Filter templates for the global /templates gallery (and category sub-pages).
 */
export async function getTemplatesByFilter(opts: {
  category?: TemplateCategory;
  tag?: string;
  productId?: string;
  limit?: number;
}): Promise<TemplatePickerItem[]> {
  const supabase = createClient();
  let query = supabase
    .from('design_templates')
    .select(
      'id, title, description, preview_url, category, tags, products:product_id (id, title, base_price, thumbnail_image_link)',
    )
    .eq('is_active', true)
    .neq('type', 'cobuy_preset')
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });

  if (opts.category) query = query.eq('category', opts.category);
  if (opts.productId) query = query.eq('product_id', opts.productId);
  if (opts.tag) query = query.contains('tags', [opts.tag]);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) {
    console.error('Failed to fetch templates by filter:', error);
    return [];
  }
  return (data ?? []).map(mapJoinedToPickerItem);
}

// ============================================================================
// Template Groups (concept-level bundles of product-specific templates)
// ============================================================================

type GroupRow = TemplateGroup & {
  // Joined count of active instance templates (group page filters out inactive)
  active_instance_count?: number;
};

/**
 * Build a unified gallery feed: groups + stand-alone templates (group_id NULL).
 * Featured items first, then sort_order. Cobuy presets are excluded.
 */
export async function getGalleryFeed(opts: {
  category?: TemplateCategory;
  tag?: string;
  limit?: number;
} = {}): Promise<TemplateGalleryItem[]> {
  const supabase = createClient();

  // 1) Active groups (with their active instance count)
  let groupQuery = supabase
    .from('template_groups')
    .select(
      'id, title, description, preview_url, category, tags, sort_order, is_featured, is_active, design_templates:design_templates!design_templates_template_group_id_fkey (id, is_active, type, preview_url)',
    )
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  if (opts.category) groupQuery = groupQuery.eq('category', opts.category);
  if (opts.tag) groupQuery = groupQuery.contains('tags', [opts.tag]);

  // 2) Stand-alone templates (group_id NULL)
  let singleQuery = supabase
    .from('design_templates')
    .select(
      'id, product_id, title, description, preview_url, category, tags, sort_order, is_featured, products:product_id (id, title, base_price, thumbnail_image_link)',
    )
    .eq('is_active', true)
    .neq('type', 'cobuy_preset')
    .is('template_group_id', null)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true });
  if (opts.category) singleQuery = singleQuery.eq('category', opts.category);
  if (opts.tag) singleQuery = singleQuery.contains('tags', [opts.tag]);

  const [groupsRes, singlesRes] = await Promise.all([groupQuery, singleQuery]);

  if (groupsRes.error) console.error('groups feed error:', groupsRes.error);
  if (singlesRes.error) console.error('singles feed error:', singlesRes.error);

  const groupItems: TemplateGalleryItem[] = (groupsRes.data ?? [])
    .map((g) => {
      const instances = ((g as unknown as { design_templates?: { is_active: boolean; type: string; preview_url: string | null }[] }).design_templates ?? [])
        .filter((t) => t.is_active && t.type !== 'cobuy_preset');
      const fallbackPreview = instances.find((t) => t.preview_url)?.preview_url ?? null;
      return {
        kind: 'group' as const,
        id: g.id as string,
        title: g.title as string,
        description: (g.description as string | null) ?? null,
        preview_url: ((g.preview_url as string | null) ?? fallbackPreview) ?? null,
        category: (g.category as string | null) ?? null,
        tags: ((g.tags as string[] | null) ?? []),
        instance_count: instances.length,
        sort_order: (g.sort_order as number) ?? 0,
        is_featured: !!g.is_featured,
      };
    })
    .filter((g) => g.instance_count > 0);

  const singleItems: TemplateGalleryItem[] = (singlesRes.data ?? []).map((row) => {
    const productRaw = Array.isArray(row.products) ? row.products[0] : row.products;
    return {
      kind: 'single' as const,
      id: row.id as string,
      product_id: row.product_id as string,
      title: row.title as string,
      description: (row.description as string | null) ?? null,
      preview_url: (row.preview_url as string | null) ?? null,
      category: (row.category as string | null) ?? null,
      tags: ((row.tags as string[] | null) ?? []),
      sort_order: (row.sort_order as number) ?? 0,
      is_featured: !!row.is_featured,
      product: productRaw ?? null,
    };
  });

  const merged = [...groupItems, ...singleItems].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  return opts.limit ? merged.slice(0, opts.limit) : merged;
}

/**
 * Featured items for the home carousel — groups + featured single templates.
 */
export async function getFeaturedGalleryItems(limit = 8): Promise<TemplateGalleryItem[]> {
  const all = await getGalleryFeed();
  return all.filter((it) => it.is_featured).slice(0, limit);
}

/**
 * Fetch a single template group's full row (including design_composition).
 * Returned even if not active — used by admin and runtime composition.
 */
export async function getGroup(groupId: string): Promise<TemplateGroup | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('template_groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('group fetch error:', error);
    return null;
  }
  return data as TemplateGroup;
}

/**
 * Group detail page — group meta + its active product instances.
 */
export async function getGroupWithInstances(
  groupId: string,
): Promise<TemplateGroupWithInstances | null> {
  const supabase = createClient();
  const { data: group, error } = await supabase
    .from('template_groups')
    .select('*')
    .eq('id', groupId)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !group) {
    if (error) console.error('group fetch error:', error);
    return null;
  }

  const { data: templates, error: tErr } = await supabase
    .from('design_templates')
    .select(
      'id, product_id, title, preview_url, is_active, sort_order, products:product_id (id, title, base_price, thumbnail_image_link)',
    )
    .eq('template_group_id', groupId)
    .eq('is_active', true)
    .neq('type', 'cobuy_preset')
    .order('sort_order', { ascending: true });
  if (tErr) console.error('group instances fetch error:', tErr);

  type InstanceRow = {
    id: string;
    product_id: string;
    title: string;
    preview_url: string | null;
    is_active: boolean;
    sort_order: number | null;
    products?: { id: string; title: string; base_price: number; thumbnail_image_link: string[] | null } | { id: string; title: string; base_price: number; thumbnail_image_link: string[] | null }[] | null;
  };
  const instances = (templates ?? []).map((row: InstanceRow) => ({
    id: row.id,
    product_id: row.product_id,
    title: row.title,
    preview_url: row.preview_url,
    is_active: row.is_active,
    sort_order: row.sort_order ?? 0,
    product: Array.isArray(row.products) ? row.products[0] : row.products,
  }));

  return { ...(group as TemplateGroup), templates: instances };
}

/**
 * Get all active templates for a product (lightweight version for picker)
 * @param productId The product ID to fetch templates for
 * @returns Array of template picker items
 */
export async function getProductTemplates(
  productId: string
): Promise<TemplatePickerItem[]> {
  const supabase = createClient();

  try {
    const { data: templates, error } = await supabase
      .from('design_templates')
      .select('id, title, description, preview_url')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }

    return templates || [];
  } catch (error) {
    console.error('Failed to fetch product templates:', error);
    return [];
  }
}

/**
 * Get a single template by ID (full data for applying)
 * @param templateId The template ID to fetch
 * @returns The full template data or null if not found
 */
export async function getTemplate(
  templateId: string
): Promise<DesignTemplate | null> {
  const supabase = createClient();

  try {
    const { data: template, error } = await supabase
      .from('design_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      throw error;
    }

    return template;
  } catch (error) {
    console.error('Failed to fetch template:', error);
    return null;
  }
}

/**
 * Get the active cobuy preset for a product (auto-loaded in cobuy creation)
 */
export async function getCobuyPreset(
  productId: string
): Promise<DesignTemplate | null> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('design_templates')
      .select('*')
      .eq('product_id', productId)
      .eq('type', 'cobuy_preset')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching cobuy preset:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch cobuy preset:', error);
    return null;
  }
}

// ============================================================================
// Admin Functions (for template management)
// ============================================================================

/**
 * Create a new template (admin only)
 */
export async function createTemplate(
  data: Omit<DesignTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<DesignTemplate | null> {
  const supabase = createClient();

  try {
    const { data: template, error } = await supabase
      .from('design_templates')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      throw error;
    }

    return template;
  } catch (error) {
    console.error('Failed to create template:', error);
    return null;
  }
}

/**
 * Update an existing template (admin only)
 */
export async function updateTemplate(
  templateId: string,
  data: Partial<Omit<DesignTemplate, 'id' | 'created_at' | 'updated_at'>>
): Promise<DesignTemplate | null> {
  const supabase = createClient();

  try {
    const { data: template, error } = await supabase
      .from('design_templates')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      throw error;
    }

    return template;
  } catch (error) {
    console.error('Failed to update template:', error);
    return null;
  }
}

/**
 * Delete a template (admin only)
 */
export async function deleteTemplate(templateId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('design_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('Error deleting template:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete template:', error);
    return false;
  }
}

/**
 * Get all templates for a product (including inactive) - for admin management
 */
export async function getAllProductTemplates(
  productId: string
): Promise<DesignTemplate[]> {
  const supabase = createClient();

  try {
    const { data: templates, error } = await supabase
      .from('design_templates')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching all templates:', error);
      throw error;
    }

    return templates || [];
  } catch (error) {
    console.error('Failed to fetch all product templates:', error);
    return [];
  }
}
