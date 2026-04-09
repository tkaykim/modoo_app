import { createClient } from './supabase-client';
import { CoBuySession, CoBuyParticipant, CoBuyCustomField, CoBuySessionWithDetails, CoBuyPricingTier, CoBuySelectedItem, CoBuyDeliverySettings, CoBuyDeliveryMethod, CoBuyDeliveryInfo, CoBuyStatus, CoBuyPickupStatus } from '@/types/types';

// ============================================================================
// Type Definitions for Service Parameters
// ============================================================================

export interface CreateCoBuySessionData {
  savedDesignId: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  receiveByDate?: Date | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  maxParticipants?: number | null;
  pricingTiers?: CoBuyPricingTier[];
  customFields: CoBuyCustomField[];
  deliverySettings?: CoBuyDeliverySettings | null;
  isPublic?: boolean;
  paymentMode?: 'individual' | 'survey';
  sizePrices?: Record<string, number> | null;
}

export interface UpdateCoBuySessionData {
  title?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  maxParticipants?: number | null;
  customFields?: CoBuyCustomField[];
  status?: CoBuyStatus;
}

export interface AddParticipantData {
  sessionId: string;
  name: string;
  email: string;
  phone?: string;
  fieldResponses: Record<string, string>;
  selectedSize: string;
  selectedItems: CoBuySelectedItem[];
  deliveryMethod?: CoBuyDeliveryMethod | null;
  deliveryInfo?: CoBuyDeliveryInfo | null;
  deliveryFee?: number;
  paymentMode?: 'individual' | 'survey';
  estimatedAmount?: number | null;
}

// ============================================================================
// CoBuy Session Management
// ============================================================================

/**
 * Create a new CoBuy session
 * @param data Session configuration data
 * @returns The created session or null if failed
 */
export async function createCoBuySession(
  data: CreateCoBuySessionData
): Promise<CoBuySession | null> {
  const supabase = createClient();

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError);
      throw new Error('User must be authenticated to create CoBuy sessions');
    }

    const { data: savedDesign, error: savedDesignError } = await supabase
      .from('saved_designs')
      .select('user_id, product_id, title, color_selections, canvas_state, preview_url, price_per_item, image_urls, text_svg_exports, custom_fonts')
      .eq('id', data.savedDesignId)
      .single();

    if (savedDesignError || !savedDesign) {
      console.error('Error fetching saved design:', savedDesignError);
      throw savedDesignError || new Error('Saved design not found');
    }

    const { data: screenshot, error: screenshotError } = await supabase
      .from('saved_design_screenshots')
      .insert({
        user_id: savedDesign.user_id,
        product_id: savedDesign.product_id,
        title: savedDesign.title,
        color_selections: savedDesign.color_selections,
        canvas_state: savedDesign.canvas_state,
        preview_url: savedDesign.preview_url,
        price_per_item: savedDesign.price_per_item,
        image_urls: savedDesign.image_urls,
        text_svg_exports: savedDesign.text_svg_exports,
        custom_fonts: savedDesign.custom_fonts || [],
      })
      .select('id')
      .single();

    if (screenshotError || !screenshot) {
      console.error('Error creating saved design screenshot:', screenshotError);
      throw screenshotError || new Error('Failed to create design snapshot');
    }

    // Prepare the session data
    const sessionData = {
      user_id: user.id,
      saved_design_screenshot_id: screenshot.id,
      title: data.title,
      description: data.description || null,
      start_date: data.startDate.toISOString(),
      end_date: data.endDate.toISOString(),
      receive_by_date: data.receiveByDate ? data.receiveByDate.toISOString() : null,
      min_quantity: data.minQuantity ?? null,
      max_quantity: data.maxQuantity ?? null,
      max_participants: data.maxParticipants ?? null,
      pricing_tiers: data.pricingTiers || [],
      custom_fields: data.customFields,
      delivery_settings: data.deliverySettings ?? null,
      is_public: data.isPublic ?? false,
      payment_mode: data.paymentMode ?? 'individual',
      size_prices: data.sizePrices ?? null,
      status: 'gathering' as const,
      current_participant_count: 0,
      current_total_quantity: 0,
    };

    // Insert into cobuy_sessions table
    const { data: session, error: insertError } = await supabase
      .from('cobuy_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating CoBuy session:', JSON.stringify(insertError, null, 2));
      throw insertError;
    }

    return session;
  } catch (error) {
    console.error('Failed to create CoBuy session:', error);
    return null;
  }
}

/**
 * Get a CoBuy session by ID (for authenticated users)
 * @param sessionId The session ID
 * @param userId The user ID (optional, for ownership check)
 * @returns The session data or null if not found
 */
export async function getCoBuySession(
  sessionId: string,
  userId?: string
): Promise<CoBuySessionWithDetails | null> {
  const supabase = createClient();

  try {
    let query = supabase
      .from('cobuy_sessions')
      .select(`
        *,
        saved_design_screenshot:saved_design_screenshots (
          id,
          user_id,
          product_id,
          title,
          color_selections,
          canvas_state,
          preview_url,
          created_at,
          updated_at,
          price_per_item,
          image_urls,
          text_svg_exports,
          custom_fonts
        )
      `)
      .eq('id', sessionId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: session, error } = await query.single();

    if (error) {
      console.error('Error fetching CoBuy session:', error);
      throw error;
    }

    return session as CoBuySessionWithDetails;
  } catch (error) {
    console.error('Failed to fetch CoBuy session:', error);
    return null;
  }
}

/**
 * Get a CoBuy session by share token (public access)
 * @param shareToken The unique share token
 * @returns The session data or null if not found
 */
export async function getCoBuySessionByToken(
  shareToken: string
): Promise<CoBuySessionWithDetails | null> {
  const supabase = createClient();

  try {
    const { data: session, error } = await supabase
      .from('cobuy_sessions')
      .select(`
        *,
        saved_design_screenshot:saved_design_screenshots (
          id,
          title,
          preview_url,
          canvas_state,
          color_selections,
          price_per_item,
          text_svg_exports,
          custom_fonts,
          product:products (
            id,
            title,
            configuration,
            size_options,
            sizing_chart_image
          )
        )
      `)
      .eq('share_token', shareToken)
      .single();

    if (error) {
      console.error('Error fetching CoBuy session by token:', error);
      throw error;
    }

    // Transform the nested product array to object
    if (session && session.saved_design_screenshot) {
      const design = session.saved_design_screenshot as any;
      if (Array.isArray(design.product)) {
        design.product = design.product[0];
      }
    }

    return session as CoBuySessionWithDetails;
  } catch (error) {
    console.error('Failed to fetch CoBuy session by token:', error);
    return null;
  }
}

/**
 * Get public CoBuy sessions (where is_public is true and status is 'gathering')
 * @param limit Optional limit for the number of sessions to return
 * @returns Array of sessions with design screenshot details
 */
export async function getPublicCoBuySessions(limit?: number): Promise<CoBuySessionWithDetails[]> {
  const supabase = createClient();

  try {
    let query = supabase
      .from('cobuy_sessions')
      .select(`
        *,
        saved_design_screenshot:saved_design_screenshots (
          id,
          title,
          preview_url
        )
      `)
      .eq('is_public', true)
      .eq('status', 'gathering')
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching public CoBuy sessions:', error);
      throw error;
    }

    return (sessions || []) as CoBuySessionWithDetails[];
  } catch (error) {
    console.error('Failed to fetch public CoBuy sessions:', error);
    return [];
  }
}

/**
 * Get all CoBuy sessions for the current user
 * @returns Array of sessions or empty array if failed
 */
export async function getUserCoBuySessions(): Promise<CoBuySession[]> {
  const supabase = createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('User not authenticated:', userError);
      return [];
    }

    const { data: sessions, error } = await supabase
      .from('cobuy_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user CoBuy sessions:', error);
      throw error;
    }

    return sessions || [];
  } catch (error) {
    console.error('Failed to fetch user CoBuy sessions:', error);
    return [];
  }
}

/**
 * Update an existing CoBuy session
 * @param sessionId The session ID
 * @param data Updated session data
 * @returns The updated session or null if failed
 */
export async function updateCoBuySession(
  sessionId: string,
  data: UpdateCoBuySessionData
): Promise<CoBuySession | null> {
  const supabase = createClient();

  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.startDate !== undefined) {
      updateData.start_date = data.startDate.toISOString();
    }
    if (data.endDate !== undefined) {
      updateData.end_date = data.endDate.toISOString();
    }
    if (data.maxParticipants !== undefined) {
      updateData.max_participants = data.maxParticipants;
    }
    if (data.customFields !== undefined) {
      updateData.custom_fields = data.customFields;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const { data: updatedSession, error } = await supabase
      .from('cobuy_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating CoBuy session:', error);
      throw error;
    }

    return updatedSession;
  } catch (error) {
    console.error('Failed to update CoBuy session:', error);
    return null;
  }
}

/**
 * Close a CoBuy session (set status to 'gather_complete')
 * @param sessionId The session ID
 * @returns The updated session or null if failed
 */
export async function closeCoBuySession(sessionId: string): Promise<CoBuySession | null> {
  return updateCoBuySession(sessionId, { status: 'gather_complete' });
}

/**
 * Delete a CoBuy session
 * @param sessionId The session ID
 * @returns true if successful, false otherwise
 */
export async function deleteCoBuySession(sessionId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('cobuy_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Error deleting CoBuy session:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete CoBuy session:', error);
    return false;
  }
}

// ============================================================================
// Participant Management
// ============================================================================

/**
 * Add a participant to a CoBuy session
 * @param data Participant data
 * @returns The created participant or null if failed
 */
export async function addParticipant(
  data: AddParticipantData
): Promise<CoBuyParticipant | null> {
  const supabase = createClient();

  try {
    // First, check if the session can accept participants
    const canJoin = await canAcceptParticipants(data.sessionId);
    if (!canJoin) {
      throw new Error('Session cannot accept more participants (closed, full, or expired)');
    }

    // Calculate total quantity from selected items
    const totalQuantity = data.selectedItems.reduce((sum, item) => sum + item.quantity, 0);

    const isSurvey = data.paymentMode === 'survey';

    // Create participant record
    const participantData: Record<string, unknown> = {
      cobuy_session_id: data.sessionId,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      field_responses: data.fieldResponses,
      selected_size: data.selectedSize,
      selected_size_code: null,
      selected_items: data.selectedItems,
      total_quantity: totalQuantity,
      delivery_method: data.deliveryMethod || null,
      delivery_info: data.deliveryInfo || null,
      delivery_fee: data.deliveryFee || 0,
      pickup_status: 'pending',
      payment_status: isSurvey ? 'not_required' : 'pending',
    };

    if (isSurvey && data.estimatedAmount != null) {
      participantData.payment_amount = data.estimatedAmount;
    }

    const { data: participant, error: insertError } = await supabase
      .from('cobuy_participants')
      .insert(participantData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Error adding participant:', insertError);
      throw insertError;
    }

    if (!participant?.id) {
      return null;
    }

    // Survey mode: immediately increment session counts
    if (isSurvey) {
      await incrementSessionCounts(data.sessionId, totalQuantity);
    }

    return {
      id: participant.id,
      cobuy_session_id: data.sessionId,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      field_responses: data.fieldResponses,
      selected_size: data.selectedSize,
      selected_size_code: null,
      selected_items: data.selectedItems,
      total_quantity: totalQuantity,
      delivery_method: data.deliveryMethod || null,
      delivery_info: data.deliveryInfo || null,
      delivery_fee: data.deliveryFee || 0,
      pickup_status: 'pending' as const,
      payment_status: isSurvey ? 'not_required' as const : 'pending' as const,
      payment_key: null,
      payment_amount: isSurvey ? (data.estimatedAmount ?? null) : null,
      paid_at: null,
      joined_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to add participant:', error);
    return null;
  }
}

/**
 * Update participant payment status
 * @param participantId The participant ID
 * @param paymentData Payment information
 * @returns The updated participant or null if failed
 */
export async function updateParticipantPayment(
  participantId: string,
  paymentData: {
    paymentStatus: 'completed' | 'failed' | 'refunded';
    paymentKey?: string;
    paymentAmount?: number;
  }
): Promise<CoBuyParticipant | null> {
  const supabase = createClient();

  try {
    const updateData: any = {
      payment_status: paymentData.paymentStatus,
    };

    if (paymentData.paymentKey) {
      updateData.payment_key = paymentData.paymentKey;
    }
    if (paymentData.paymentAmount !== undefined) {
      updateData.payment_amount = paymentData.paymentAmount;
    }
    if (paymentData.paymentStatus === 'completed') {
      updateData.paid_at = new Date().toISOString();
    }

    const { data: updatedParticipant, error } = await supabase
      .from('cobuy_participants')
      .update(updateData)
      .eq('id', participantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating participant payment:', error);
      throw error;
    }

    // If payment is completed, increment session counts
    if (paymentData.paymentStatus === 'completed' && updatedParticipant) {
      const quantity = updatedParticipant.total_quantity || 1;
      await incrementSessionCounts(updatedParticipant.cobuy_session_id, quantity);
    }

    return updatedParticipant;
  } catch (error) {
    console.error('Failed to update participant payment:', error);
    return null;
  }
}

/**
 * Get all participants for a session
 * @param sessionId The session ID
 * @returns Array of participants or empty array if failed
 */
export async function getParticipants(sessionId: string): Promise<CoBuyParticipant[]> {
  const supabase = createClient();

  try {
    const { data: participants, error } = await supabase
      .from('cobuy_participants')
      .select('*')
      .eq('cobuy_session_id', sessionId)
      .order('joined_at', { ascending: false });

    if (error) {
      console.error('Error fetching participants:', error);
      throw error;
    }

    return participants || [];
  } catch (error) {
    console.error('Failed to fetch participants:', error);
    return [];
  }
}

// ============================================================================
// Validation & Helper Functions
// ============================================================================

/**
 * Check if a session can accept new participants
 * @param sessionId The session ID
 * @param additionalQuantity Optional - check if this many additional items can be added
 * @returns true if session can accept participants, false otherwise
 */
export async function canAcceptParticipants(sessionId: string, additionalQuantity?: number): Promise<boolean> {
  const supabase = createClient();

  try {
    const { data: session, error } = await supabase
      .from('cobuy_sessions')
      .select('status, end_date, max_participants, current_participant_count, max_quantity, current_total_quantity')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return false;
    }

    // Check status - only allow participation when status is 'gathering'
    if (session.status !== 'gathering') {
      return false;
    }

    // Check expiry
    const now = new Date();
    const endDate = new Date(session.end_date);
    if (now > endDate) {
      return false;
    }

    // Check participant limit
    if (session.max_participants !== null) {
      if (session.current_participant_count >= session.max_participants) {
        return false;
      }
    }

    // Check quantity limit if max_quantity is set
    if (session.max_quantity !== null && additionalQuantity) {
      if ((session.current_total_quantity || 0) + additionalQuantity > session.max_quantity) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking if session can accept participants:', error);
    return false;
  }
}

/**
 * Check if a session has expired
 * @param sessionId The session ID
 * @returns true if expired, false otherwise
 */
export async function checkSessionExpiry(sessionId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    const { data: session, error } = await supabase
      .from('cobuy_sessions')
      .select('end_date')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return true; // Treat as expired if session not found
    }

    const now = new Date();
    const endDate = new Date(session.end_date);
    return now > endDate;
  } catch (error) {
    console.error('Error checking session expiry:', error);
    return true; // Treat as expired on error
  }
}

/**
 * Increment the participant count and total quantity for a session
 * @param sessionId The session ID
 * @param quantity The quantity to add to the total
 * @returns true if successful, false otherwise
 */
async function incrementSessionCounts(sessionId: string, quantity: number = 0): Promise<boolean> {
  const supabase = createClient();

  try {
    // Get current counts
    const { data: session, error: fetchError } = await supabase
      .from('cobuy_sessions')
      .select('current_participant_count, current_total_quantity')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      throw fetchError || new Error('Session not found');
    }

    // Update counts
    const { error: updateError } = await supabase
      .from('cobuy_sessions')
      .update({
        current_participant_count: session.current_participant_count + 1,
        current_total_quantity: (session.current_total_quantity || 0) + quantity,
      })
      .eq('id', sessionId);

    if (updateError) {
      throw updateError;
    }

    return true;
  } catch (error) {
    console.error('Failed to increment session counts:', error);
    return false;
  }
}

/**
 * Request cancellation of a CoBuy session (sets status to 'cancelled')
 * Note: This should trigger admin notification in production
 * @param sessionId The session ID
 * @returns The updated session or null if failed
 */
export async function requestCancellation(sessionId: string): Promise<CoBuySession | null> {
  // In production, this would create a notification for admin review
  // For now, we'll just set the status to 'cancelled'
  return updateCoBuySession(sessionId, { status: 'cancelled' });
}

/**
 * Update participant pickup status (배부 기능)
 * Only applicable for participants with delivery_method = 'pickup'
 * @param participantId The participant ID
 * @param pickupStatus The new pickup status ('pending' = 미수령, 'picked_up' = 수령)
 * @returns The updated participant or null if failed
 */
export async function updateParticipantPickupStatus(
  participantId: string,
  pickupStatus: CoBuyPickupStatus
): Promise<CoBuyParticipant | null> {
  const supabase = createClient();

  try {
    const { data: updatedParticipant, error } = await supabase
      .from('cobuy_participants')
      .update({ pickup_status: pickupStatus })
      .eq('id', participantId)
      .select()
      .single();

    if (error) {
      console.error('Error updating participant pickup status:', error);
      throw error;
    }

    return updatedParticipant;
  } catch (error) {
    console.error('Failed to update participant pickup status:', error);
    return null;
  }
}

/**
 * Update delivery settings for a CoBuy session
 * Only allowed before 'order_complete' status
 * @param sessionId The session ID
 * @param deliverySettings The updated delivery settings
 * @returns The updated session or null if failed
 */
export async function updateDeliverySettings(
  sessionId: string,
  deliverySettings: CoBuyDeliverySettings
): Promise<CoBuySession | null> {
  const supabase = createClient();

  try {
    // First check that the session is not past order_complete
    const { data: session, error: fetchError } = await supabase
      .from('cobuy_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      throw fetchError || new Error('Session not found');
    }

    const blockedStatuses: CoBuyStatus[] = ['order_complete', 'manufacturing', 'manufacture_complete', 'delivering', 'delivery_complete', 'cancelled'];
    if (blockedStatuses.includes(session.status)) {
      throw new Error('Cannot update delivery settings after order is complete');
    }

    const { data: updatedSession, error } = await supabase
      .from('cobuy_sessions')
      .update({
        delivery_settings: deliverySettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating delivery settings:', error);
      throw error;
    }

    return updatedSession;
  } catch (error) {
    console.error('Failed to update delivery settings:', error);
    return null;
  }
}
