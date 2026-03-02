import { createClient } from './supabase-client';
import {
  CoBuyRequest,
  CoBuyRequestComment,
  CoBuyRequestWithComments,
  CoBuyCustomField,
  CoBuyDeliverySettings,
  CoBuyRequestSchedulePreferences,
  CoBuyRequestQuantityExpectations,
} from '@/types/types';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CreateCoBuyRequestData {
  productId: string;
  title: string;
  description?: string;
  freeformCanvasState: Record<string, unknown>;
  freeformColorSelections: Record<string, unknown>;
  freeformPreviewUrl?: string;
  schedulePreferences?: CoBuyRequestSchedulePreferences;
  quantityExpectations?: CoBuyRequestQuantityExpectations;
  deliveryPreferences?: CoBuyDeliverySettings;
  customFields?: CoBuyCustomField[];
  uploadedImagePaths?: string[];
  isPublic?: boolean;
  // Guest fields (for non-authenticated users)
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  requestType?: 'design' | 'consultation';
}

// ============================================================================
// CoBuy Request Management
// ============================================================================

export async function createDraftCoBuyRequest(data: {
  productId: string;
  title: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  estimatedQuantity?: number;
}): Promise<CoBuyRequest | null> {
  const supabase = createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const requestData = {
      user_id: user?.id || null,
      product_id: data.productId,
      title: data.title,
      freeform_canvas_state: {},
      status: 'draft' as const,
      guest_name: data.contactName,
      guest_email: data.contactEmail,
      guest_phone: data.contactPhone || null,
      quantity_expectations: data.estimatedQuantity
        ? { estimatedQuantity: data.estimatedQuantity }
        : null,
    };

    const { data: request, error } = await supabase
      .from('cobuy_requests')
      .insert(requestData)
      .select()
      .single();

    if (error) {
      console.error('Error creating draft CoBuy request:', error);
      throw error;
    }

    return request;
  } catch (error) {
    console.error('Failed to create draft CoBuy request:', error);
    return null;
  }
}

export async function updateCoBuyRequest(
  requestId: string,
  data: CreateCoBuyRequestData
): Promise<CoBuyRequest | null> {
  const supabase = createClient();

  try {
    const updateData = {
      title: data.title,
      description: data.description || null,
      freeform_canvas_state: data.freeformCanvasState,
      freeform_color_selections: data.freeformColorSelections,
      freeform_preview_url: data.freeformPreviewUrl || null,
      schedule_preferences: data.schedulePreferences || null,
      quantity_expectations: data.quantityExpectations || null,
      delivery_preferences: data.deliveryPreferences || null,
      custom_fields: data.customFields || [],
      uploaded_image_paths: data.uploadedImagePaths || [],
      is_public: data.isPublic ?? false,
      status: 'pending' as const,
      guest_name: data.guestName || null,
      guest_email: data.guestEmail || null,
      guest_phone: data.guestPhone || null,
      request_type: data.requestType || 'design',
      updated_at: new Date().toISOString(),
    };

    const { data: request, error } = await supabase
      .from('cobuy_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Error updating CoBuy request:', error);
      throw error;
    }

    return request;
  } catch (error) {
    console.error('Failed to update CoBuy request:', error);
    return null;
  }
}

export async function createCoBuyRequest(
  data: CreateCoBuyRequestData
): Promise<CoBuyRequest | null> {
  const supabase = createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const requestData = {
      user_id: user?.id || null,
      product_id: data.productId,
      title: data.title,
      description: data.description || null,
      freeform_canvas_state: data.freeformCanvasState,
      freeform_color_selections: data.freeformColorSelections,
      freeform_preview_url: data.freeformPreviewUrl || null,
      schedule_preferences: data.schedulePreferences || null,
      quantity_expectations: data.quantityExpectations || null,
      delivery_preferences: data.deliveryPreferences || null,
      custom_fields: data.customFields || [],
      uploaded_image_paths: data.uploadedImagePaths || [],
      is_public: data.isPublic ?? false,
      status: 'pending' as const,
      guest_name: data.guestName || null,
      guest_email: data.guestEmail || null,
      guest_phone: data.guestPhone || null,
      request_type: data.requestType || 'design',
    };

    const { data: request, error } = await supabase
      .from('cobuy_requests')
      .insert(requestData)
      .select()
      .single();

    if (error) {
      console.error('Error creating CoBuy request:', error);
      throw error;
    }

    return request;
  } catch (error) {
    console.error('Failed to create CoBuy request:', error);
    return null;
  }
}

export async function getUserCoBuyRequests(): Promise<CoBuyRequest[]> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return [];

    const { data, error } = await supabase
      .from('cobuy_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch user CoBuy requests:', error);
    return [];
  }
}

export async function getCoBuyRequestByShareToken(
  shareToken: string
): Promise<CoBuyRequestWithComments | null> {
  const supabase = createClient();

  try {
    const { data: request, error } = await supabase
      .from('cobuy_requests')
      .select(`
        *,
        product:products (
          id,
          title,
          thumbnail_image_link,
          configuration,
          size_options
        )
      `)
      .eq('share_token', shareToken)
      .single();

    if (error) throw error;
    if (!request) return null;

    // Transform nested product array to object
    const transformed = { ...request } as any;
    if (Array.isArray(transformed.product)) {
      transformed.product = transformed.product[0];
    }

    // Fetch comments
    const { data: comments } = await supabase
      .from('cobuy_request_comments')
      .select('*')
      .eq('request_id', request.id)
      .order('created_at', { ascending: true });

    transformed.comments = comments || [];
    return transformed as CoBuyRequestWithComments;
  } catch (error) {
    console.error('Failed to fetch CoBuy request by token:', error);
    return null;
  }
}

export async function addRequestComment(
  requestId: string,
  content: string
): Promise<CoBuyRequestComment | null> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User must be authenticated');

    const { data: comment, error } = await supabase
      .from('cobuy_request_comments')
      .insert({
        request_id: requestId,
        user_id: user.id,
        content,
        is_admin: false,
      })
      .select()
      .single();

    if (error) throw error;
    return comment;
  } catch (error) {
    console.error('Failed to add comment:', error);
    return null;
  }
}

export async function getRequestComments(
  requestId: string
): Promise<CoBuyRequestComment[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('cobuy_request_comments')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return [];
  }
}
