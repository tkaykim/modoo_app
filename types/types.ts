


export interface ColorOption {
  hex: string;
  colorCode: string;
}

export interface ProductLayer {
  id: string;
  name: string;
  imageUrl: string;
  zIndex: number;
  colorOptions: ColorOption[]; // Array of color options with hex and colorCode
}

export interface ProductSide {
  id: string;
  name: string;
  imageUrl?: string; // Optional for backward compatibility
  printArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Real-life dimensions in millimeters
  realLifeDimensions?: {
    printAreaWidthMm: number;   // Real-world width of print area in mm
    printAreaHeightMm: number;  // Real-world height of print area in mm
    productWidthMm: number;     // Real-world width of the entire product mockup in mm
  };
  // Zoom scale for the canvas (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
  zoomScale?: number;
  // Multi-layer support
  layers?: ProductLayer[];
  // Color options for single-layered mode (when layers is not used)
  colorOptions?: ColorOption[];
}

export interface ProductConfig {
  productId: string;
  sides: ProductSide[];
}

// Size option with display label and internal code
export interface SizeOption {
  label: string;      // Display name (e.g., "S", "M", "L")
  size_code: string;  // Internal code for admin/factory (e.g., "001", "ABC")
}

export interface CartItem {
  size: string;
  quantity: number;
}

export interface ProductColor {
  id: string;
  product_id: string;
  manufacturer_color_id: string;
  is_active: boolean;
  sort_order: number;
  side_mockups?: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  // Joined from manufacturer_colors
  manufacturer_colors: {
    id: string;
    name: string;
    hex: string;
    color_code: string;
  };
}

// Discount tier for quantity-based pricing
export interface DiscountTier {
  min_quantity: number;
  discount_rate: number; // Percentage (e.g., 5 means 5%)
}

export interface Product {
  id: string;
  title: string;
  base_price: number;
  configuration: ProductSide[];
  size_options?: SizeOption[];
  discount_rates?: DiscountTier[]; // Quantity-based discount tiers
  category: string | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  thumbnail_image_link?: string[] | null;
  description_image?: string[] | null;
  sizing_chart_image?: string | null;
  sizing_data?: SizingData | null;
  manufacturer_name?: string | null;
  product_code?: string | null;
  keywords?: string[] | null;
}

export interface SizingData {
  unit: string;
  headers: string[];
  rows: Record<string, (number | string)[]>;
  order?: string[];
}

export interface ProductionExample {
  id: string;
  product_id: string;
  title: string;
  description: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  // bg_color: string;
  bg_image: string | null;
  image_link: string | null;
  redirect_link: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type InquiryStatus = 'pending' | 'ongoing' | 'completed';

export interface Inquiry {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  status: InquiryStatus;
  group_name?: string;
  manager_name?: string;
  phone?: string;
  kakao_id?: string;
  desired_date?: string;
  expected_qty?: number;
  fabric_color?: string;
  password?: string;
  file_urls?: string[];
  created_at: string;
  updated_at: string;
}

export interface InquiryProduct {
  id: string;
  inquiry_id: string;
  product_id: string;
  created_at: string;
}

export interface InquiryReply {
  id: string;
  inquiry_id: string;
  admin_id: string | null;
  content: string;
  file_urls?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface InquiryWithDetails extends Inquiry {
  products?: (InquiryProduct & { product: Product })[];
  replies?: (InquiryReply & { admin?: { name: string } })[];
  user?: { name: string };
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  tags: string[];
  sort_order: number;
  is_published: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// Print option types
export type PrintMethod = 'dtf' | 'dtg' | 'screen_printing' | 'embroidery' | 'applique';

export interface PrintMethodRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  pricing: Record<string, number | { basePrice: number; baseQuantity: number; additionalPricePerPiece: number }> | null;
}

export interface PrintOption {
  method: PrintMethod;
  price: number; // Additional cost for this print method
}

// Size categories for printing
export type PrintSize = '10x10' | 'A4' | 'A3';

// Pricing configuration for different print methods
export interface TransferPricing {
  method: 'dtf' | 'dtg';
  sizes: {
    '10x10': number;
    A4: number;
    A3: number;
  };
}

export interface BulkPricing {
  method: 'screen_printing' | 'embroidery' | 'applique';
  sizes: {
    '10x10': {
      basePrice: number; // Price for first 100 pieces
      baseQuantity: number; // Usually 100
      additionalPricePerPiece: number; // Price per piece after baseQuantity
    };
    A4: {
      basePrice: number;
      baseQuantity: number;
      additionalPricePerPiece: number;
    };
    A3: {
      basePrice: number;
      baseQuantity: number;
      additionalPricePerPiece: number;
    };
  };
}

export interface PrintPricingConfig {
  dtf: TransferPricing;
  dtg: TransferPricing;
  screen_printing: BulkPricing;
  embroidery: BulkPricing;
  applique: BulkPricing;
}

export interface CanvasObjectPrintData {
  printMethod?: PrintMethod;
  // Additional metadata for pricing and production
  estimatedCost?: number;
}

// Supabase storage metadata for canvas objects
export interface CanvasObjectStorageData {
  supabaseUrl?: string;
  supabasePath?: string;
  uploadedAt?: string;
}

// Order item SVG export types (server-generated during checkout)
export type TextSvgObjectExports = Record<string, Record<string, string>>;

export interface TextSvgExports {
  __objects?: TextSvgObjectExports; // sideId -> objectId -> url
  [sideId: string]: string | TextSvgObjectExports | undefined; // sideId -> combined SVG url
}

// Combined canvas object data type
export interface CanvasObjectData extends CanvasObjectPrintData, CanvasObjectStorageData {
  id?: string;
  objectId?: string;
  [key: string]: unknown; // Allow additional custom properties
}

// Database types
export interface SavedDesign {
  id: string;
  user_id: string;
  product_id: string;
  title: string;
  color_selections: Record<string, unknown>;
  canvas_state: Record<string, unknown>;
  preview_url: string | null;
  created_at: string;
  updated_at: string;
  price_per_item: number;
  image_urls: Record<string, unknown>;
}

export interface SavedDesignScreenshot {
  id: string;
  user_id: string;
  product_id: string;
  title: string;
  color_selections: Record<string, unknown>;
  canvas_state: Record<string, unknown>;
  preview_url: string | null;
  created_at: string;
  updated_at: string;
  price_per_item: number;
  image_urls: Record<string, unknown>;
}

// ============================================================================
// Legacy slot types (single template only — group templates use CompositionSlot)
// ============================================================================
// Design Template — replaceable image slot manifest entry.
// admin tags Fabric image objects so customers see only the parts that should be swapped.
export interface ImageSlot {
  slot_id: string;             // matches Fabric object data.slot_id
  side_id: string;             // ProductSide.id
  label: string;               // user-facing label (e.g. "메인 사진")
  default_image_url: string;
  aspect_ratio: number;        // width / height — enforced by SlotImageCropper
  print_method_id: string;     // locked print method id (자수/실사/전사 등)
  accepts: 'photo' | 'logo';
  bg_removal_default?: boolean; // default ON for photo/logo slots
}

export interface TextSlot {
  slot_id: string;
  side_id: string;
  label: string;
  placeholder?: string;
  max_length?: number;
  lock_style: boolean; // true: keep template font/color/size, only swap text
}

// ============================================================================
// Composition slots — live in template_groups.design_composition.
// These describe WHAT the design contains; placement (where on canvas) is
// stored separately on each design_templates row in placement_map.
// ============================================================================

/** Reusable text slot (defined once in a group, reused across product instances). */
export interface CompositionTextSlot {
  slot_id: string;
  kind: 'text';
  label: string;                    // "펫 이름", "생년월일" 등
  default_text: string;             // 기본 텍스트
  placeholder?: string;
  max_length?: number;
  lock_style: boolean;              // true: 사용자가 폰트/색은 못 바꾸고 텍스트만 교체
  // Style hints used when no per-instance override exists:
  font_family?: string;
  font_weight?: string;             // 'normal' | 'bold' | numeric string
  font_color?: string;              // hex
  print_method_id?: string;         // 그룹 기본 인쇄 방식 (인스턴스 override 가능)
}

/** Reusable image slot. */
export interface CompositionImageSlot {
  slot_id: string;
  kind: 'image';
  label: string;                    // "반려동물 사진"
  default_image_url: string;        // 미리보기·기본 이미지
  aspect_ratio: number;             // width/height — 크로퍼 강제 비율
  accepts: 'photo' | 'logo';
  bg_removal_default?: boolean;     // 인물·펫·로고 슬롯 기본 ON
  print_method_id?: string;         // 그룹 기본 인쇄 방식
}

export type CompositionSlot = CompositionTextSlot | CompositionImageSlot;

export interface DesignComposition {
  slots: CompositionSlot[];
}

/**
 * Per-instance placement of a composition slot on a specific product canvas.
 * All coordinates are normalized (0-1) relative to the side's print area so
 * the same composition can map cleanly across products of different sizes.
 */
export interface PlacementEntry {
  side_id: string;            // ProductSide.id
  x: number;                  // 0-1, relative to print area width  (origin reference below)
  y: number;                  // 0-1, relative to print area height
  width: number;              // 0-1
  height: number;             // 0-1
  angle?: number;             // degrees
  origin_x?: 'left' | 'center' | 'right';
  origin_y?: 'top' | 'center' | 'bottom';
  // Per-instance overrides (fall back to composition slot defaults):
  print_method_id?: string;
  font_family?: string;
  font_color?: string;
  font_weight?: string;
}

/** Map slot_id → placement on this product's canvas. */
export type PlacementMap = Record<string, PlacementEntry>;

// Design Template - Admin-managed pre-made designs for products
export interface DesignTemplate {
  id: string;
  product_id: string;
  template_group_id: string | null;
  title: string;
  description: string | null;
  canvas_state: Record<string, any>; // sideId -> canvas state (objects, layerColors)
  preview_url: string | null;
  layer_colors: Record<string, Record<string, string>>; // sideId -> layerId -> hex color
  sort_order: number;
  is_active: boolean;
  type: string; // 'template' | 'cobuy_preset'
  category: string | null;
  tags: string[];
  is_featured: boolean;
  // Legacy slot manifests (used by single templates that don't belong to a group)
  image_slots: ImageSlot[];
  text_slots: TextSlot[];
  /** @deprecated Use side_id + transform. Will be removed once all templates migrate. */
  placement_map: PlacementMap;
  /** Which side of the product this instance places the group on. */
  side_id: string | null;
  /** Group transform on the product canvas (normalized 0-1 within printArea). */
  transform: GroupTransform | null;
  created_at: string;
  updated_at: string;
}

/**
 * Template Group — bundles N product-specific templates that share the same
 * design concept (e.g. "왼쪽 가슴 로고", "가족사진 정중앙"). Customers pick a
 * concept first and then choose which product to apply it to.
 */
// ============================================================================
// Slot Manifest — entries inside the group artwork that customers can replace.
// Each entry references a Fabric object inside artwork_state by `object_id`.
// ============================================================================
export interface SlotManifestTextEntry {
  object_id: string;          // Fabric object's data.object_id (admin-tagged)
  kind: 'text';
  label: string;
  placeholder?: string;
  max_length?: number;
  lock_style: boolean;
}

export interface SlotManifestImageEntry {
  object_id: string;
  kind: 'image';
  label: string;
  aspect_ratio?: number;       // optional: enforce crop ratio (defaults to current object's ratio)
  accepts: 'photo' | 'logo';
  bg_removal_default?: boolean;
  print_method_id?: string;
}

export type SlotManifestEntry = SlotManifestTextEntry | SlotManifestImageEntry;

export interface ArtworkCanvasSize {
  width: number;
  height: number;
}

/** Group's transform when placed on a product canvas (normalized 0-1 within printArea). */
export interface GroupTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  origin_x?: 'left' | 'center' | 'right';
  origin_y?: 'top' | 'center' | 'bottom';
}

export interface TemplateGroup {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  preview_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  /** Fabric.js canvas JSON for the group artwork (actual visual design). */
  artwork_state: Record<string, any>;
  /** Group's own canvas dimensions. */
  artwork_canvas_size: ArtworkCanvasSize;
  /** Tagged objects inside artwork that customers can replace. */
  slot_manifest: SlotManifestEntry[];
  /** @deprecated Use artwork_state + slot_manifest. */
  design_composition?: DesignComposition;
  created_at: string;
  updated_at: string;
}

/** Group + its product instances (used in detail/management views) */
export interface TemplateGroupWithInstances extends TemplateGroup {
  templates: Array<{
    id: string;
    product_id: string;
    title: string;
    preview_url: string | null;
    is_active: boolean;
    sort_order: number;
    product?: {
      id: string;
      title: string;
      base_price: number;
      thumbnail_image_link: string[] | null;
    } | null;
  }>;
}

// Lightweight type for template picker display
export interface TemplatePickerItem {
  id: string;
  title: string;
  description: string | null;
  preview_url: string | null;
  category?: string | null;
  tags?: string[];
  template_group_id?: string | null;
  // Joined product info for global gallery cards
  product?: {
    id: string;
    title: string;
    base_price: number;
    thumbnail_image_link: string[] | null;
  } | null;
}

/**
 * Lightweight gallery item — either a TemplateGroup card or a stand-alone
 * (group_id NULL) DesignTemplate. The customer gallery mixes both.
 */
export type TemplateGalleryItem =
  | {
      kind: 'group';
      id: string;
      title: string;
      description: string | null;
      preview_url: string | null;
      category: string | null;
      tags: string[];
      instance_count: number;
      sort_order: number;
      is_featured: boolean;
    }
  | {
      kind: 'single';
      id: string;          // template id
      product_id: string;  // for direct ?templateId= entry
      title: string;
      description: string | null;
      preview_url: string | null;
      category: string | null;
      tags: string[];
      sort_order: number;
      is_featured: boolean;
      product?: {
        id: string;
        title: string;
        base_price: number;
        thumbnail_image_link: string[] | null;
      } | null;
    };

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  quantity: number;
  price_per_item: number;
  design_id: string | null;
  design_title: string | null;
  product_variant_id: string | null;
  canvas_state: Record<string, unknown>;
  color_selections: Record<string, unknown>;
  item_options: {
    variants: Array<{
      size_id: string;
      size_name: string;
      color_id: string;
      color_name: string;
      color_hex: string;
      quantity: number;
    }>;
  };
  thumbnail_url: string | null;
  sizing_chart_image?: string | null;
  sizing_data?: SizingData | null;
  text_svg_exports: TextSvgExports | null;
  image_urls: Record<string, unknown> | null;

  // Design proof status
  design_status?: 'pending' | 'in_progress' | 'design_shared' | 'revision_requested' | 'confirmed';
  design_shared_at?: string | null;
  design_confirmed_at?: string | null;
  design_revision_note?: string | null;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// Custom Order (맞춤 주문 링크) Types
// ============================================================================

export interface CustomOrderData {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_method: 'domestic' | 'international' | 'pickup';
  country_code: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  delivery_fee: number;
  total_amount: number;
  original_amount: number | null;
  admin_discount: number;
  admin_surcharge: number;
  coupon_discount: number;
  pricing_note: string | null;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  order_status: string;
  order_items: (OrderItem & { design_preview_url?: string | null })[];
  order_name: string;
  product_title: string;
  design_preview_url: string | null;

  customer_editable_fields?: {
    quantities?: boolean;
    customerInfo?: boolean;
    shipping?: boolean;
  } | null;
}

// ============================================================================
// CoBuy (공동구매) Types
// ============================================================================

export interface CoBuyCustomField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'dropdown';
  label: string;
  required: boolean;
  fixed?: boolean; // True for size dropdown (cannot be removed)
  options?: string[]; // For dropdown type
}

// Pricing tier for quantity-based discounts
export interface CoBuyPricingTier {
  minQuantity: number;
  pricePerItem: number;
}

// Selected item with size and quantity
export interface CoBuySelectedItem {
  size: string;
  quantity: number;
}

// Delivery method options
export type CoBuyDeliveryMethod = 'pickup' | 'delivery';

// Pickup status for tracking distribution (배부 기능)
export type CoBuyPickupStatus = 'pending' | 'picked_up'; // 미수령 | 수령

// Delivery address info for participants who choose delivery
export interface CoBuyDeliveryInfo {
  recipientName: string;
  phone: string;
  address: string;
  addressDetail: string; // 상세주소
  postalCode: string;
  memo?: string; // 배송 요청사항
}

// Address information for CoBuy delivery settings
export interface CoBuyAddressInfo {
  roadAddress: string; // 도로명 주소
  jibunAddress?: string; // 지번 주소
  postalCode: string; // 우편번호
  addressDetail?: string; // 상세주소
}

// Delivery settings configured by session creator
export interface CoBuyDeliverySettings {
  enabled: boolean; // Whether delivery option is available
  deliveryFee: number; // Extra fee for delivery (0 if free)
  pickupLocation?: string; // Optional pickup location description (legacy, for display)
  deliveryAddress?: CoBuyAddressInfo; // 배송받을 장소 - where organizer receives products
  pickupAddress?: CoBuyAddressInfo; // 배부 장소 - where participants pick up orders
}

export type CoBuyStatus =
  | 'gathering'           // 모집중
  | 'gather_complete'     // 모집 완료
  | 'order_complete'      // 주문 완료
  | 'manufacturing'       // 제작중
  | 'manufacture_complete' // 제작 완료
  | 'delivering'          // 배송중
  | 'delivery_complete'   // 배송 완료
  | 'cancelled';          // 취소됨

export interface CoBuySession {
  id: string;
  user_id: string;
  saved_design_screenshot_id: string;
  title: string;
  description: string | null;
  status: CoBuyStatus;
  share_token: string;
  start_date: string;
  end_date: string;
  receive_by_date: string | null; // Date when items need to be received by (can be after end_date)
  min_quantity: number | null; // Minimum total quantity to proceed
  max_quantity: number | null; // Maximum total quantity (optional cap)
  max_participants: number | null; // Max number of participants (legacy, optional)
  current_participant_count: number;
  current_total_quantity: number; // Total items ordered so far
  pricing_tiers: CoBuyPricingTier[]; // Quantity-based pricing tiers
  custom_fields: CoBuyCustomField[];
  delivery_settings: CoBuyDeliverySettings | null; // Delivery configuration
  is_public: boolean; // Whether the session is publicly discoverable
  cobuy_image_urls: string[] | null; // When set, indicates image-only CoBuy (no canvas design)
  payment_mode: 'individual' | 'survey'; // individual: each participant pays, survey: organizer pays in bulk
  size_prices: Record<string, number> | null; // Per-size pricing override (e.g. {"S": 50000, "XL": 52000})
  bulk_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoBuyParticipant {
  id: string;
  cobuy_session_id: string;
  name: string;
  email: string;
  phone: string | null;
  field_responses: Record<string, string>;
  selected_size: string; // Display label (e.g., "S", "M", "L")
  selected_size_code: string | null; // Internal size code for admin/factory tracking
  selected_items: CoBuySelectedItem[]; // New - supports multiple sizes with quantities
  total_quantity: number; // Total items this participant ordered
  delivery_method: CoBuyDeliveryMethod | null; // 'pickup' or 'delivery'
  delivery_info: CoBuyDeliveryInfo | null; // Address info if delivery method is 'delivery'
  delivery_fee: number; // Fee paid for delivery (0 for pickup)
  pickup_status: CoBuyPickupStatus; // 수령 상태 for pickup participants (배부 기능)
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded' | 'not_required';
  payment_key: string | null;
  payment_amount: number | null;
  paid_at: string | null;
  joined_at: string;
}

export interface CoBuyNotification {
  id: string;
  cobuy_session_id: string;
  participant_id: string | null;
  notification_type: 'participant_joined' | 'session_closing' | 'session_closed' | 'payment_confirmed';
  recipient_email: string;
  sent_at: string;
  metadata: Record<string, unknown> | null;
}

// CoBuy session with related data (for detail views)
export interface CoBuySessionWithDetails extends CoBuySession {
  saved_design_screenshot?: SavedDesignScreenshot;
  participants?: CoBuyParticipant[];
}

// ============================================================================
// CoBuy Request Types (Request-based CoBuy flow)
// ============================================================================

export type CoBuyRequestStatus =
  | 'pending'           // User submitted, waiting for admin
  | 'in_progress'       // Admin is working on the design
  | 'design_shared'     // Admin shared the design link to user
  | 'feedback'          // User left feedback
  | 'confirmed'         // Price and design confirmed
  | 'session_created'   // CoBuy session has been created
  | 'rejected';         // Admin rejected the request

export interface CoBuyRequestSchedulePreferences {
  preferredStartDate?: string;
  preferredEndDate?: string;
  receiveByDate?: string;
}

export interface CoBuyRequestQuantityExpectations {
  estimatedQuantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
}

export interface CoBuyRequest {
  id: string;
  user_id: string | null;
  product_id: string;
  title: string;
  description: string | null;
  freeform_canvas_state: Record<string, unknown>;
  freeform_color_selections: Record<string, unknown>;
  freeform_preview_url: string | null;
  status: CoBuyRequestStatus;
  admin_design_id: string | null;
  admin_design_preview_url: string | null;
  confirmed_price: number | null;
  cobuy_session_id: string | null;
  share_token: string;
  schedule_preferences: CoBuyRequestSchedulePreferences | null;
  quantity_expectations: CoBuyRequestQuantityExpectations | null;
  delivery_preferences: CoBuyDeliverySettings | null;
  custom_fields: CoBuyCustomField[];
  is_public: boolean;
  uploaded_image_paths: string[];
  promo_image_url: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoBuyRequestComment {
  id: string;
  request_id: string;
  user_id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
}

export interface CoBuyRequestWithComments extends CoBuyRequest {
  comments?: CoBuyRequestComment[];
  product?: Product;
}

// ============================================================================
// Review Types
// ============================================================================

export interface Review {
  id: string;
  product_id: string;
  user_id: string | null;
  rating: number;
  title: string;
  content: string;
  author_name: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  is_best: boolean;
  review_image_urls: string[];
  created_at: string;
  updated_at: string;
}

// Review with product details for best reviews display
export interface ReviewWithProduct extends Review {
  product?: {
    id: string;
    title: string;
    thumbnail_image_link: string[] | null;
  };
}

// ============================================================================
// Coupon Types
// ============================================================================

export type CouponDiscountType = 'percentage' | 'fixed_amount';

export interface Coupon {
  id: string;
  code: string;
  display_name: string | null;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  /** 전체 사용 한도(전 사용자 합산). null = 무제한 */
  max_uses: number | null;
  /** 1인당 사용 횟수 제한. null = 무제한, 정수 = 해당 횟수 */
  max_uses_per_user: number | null;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  valid_days_after_registration: number | null;
  created_at: string;
  updated_at: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  user_id: string;
  registered_at: string;
  expires_at: string | null;
  used_at: string | null;
  order_id: string | null;
  discount_applied: number | null;
  /** 해당 유저가 이 쿠폰을 실제 사용(결제)한 횟수 */
  uses_count: number;
  created_at: string;
  // Joined relations
  coupon?: Coupon;
}

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon?: Coupon;
  couponUsage?: CouponUsage;
  discountAmount?: number;
  finalTotal?: number;
}

// Partner Mall Types
// ============================================================================

export interface LogoPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PartnerMallSalesmanPublic {
  id: string;
  display_name: string | null;
  salesman_code: string | null;
  phone?: string | null;
  kakao_id?: string | null;
  business_card_url?: string | null;
  profile_image_url?: string | null;
}

export interface PartnerMallPublic {
  id: string;
  name: string;
  logo_url: string;
  slug: string | null;
  is_active: boolean;
  salesman_id: string | null;
  partner_mall_products?: PartnerMallProductPublic[];
  partner_mall_assets?: PartnerMallAssetPublic[];
  attributed_salesman?: PartnerMallSalesmanPublic | null;
}

export type PartnerMallActorRole = 'salesman' | 'admin' | 'guest' | 'owner';

export type PartnerMallAssetType = 'logo' | 'image' | 'document' | 'reference';

export interface PartnerMallAssetPublic {
  id: string;
  partner_mall_id: string;
  asset_type: PartnerMallAssetType;
  url: string;
  name: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
  created_by_role?: PartnerMallActorRole | null;
  created_at: string;
}

export interface PartnerMallProductPublic {
  id: string;
  partner_mall_id: string;
  product_id: string;
  display_name: string | null;
  color_hex: string | null;
  color_name: string | null;
  color_code: string | null;
  logo_placements: Record<string, LogoPlacement>;
  canvas_state: Record<string, unknown>;
  preview_url: string | null;
  price: number | null;
  created_by_role?: PartnerMallActorRole | null;
  product?: Product;
}

export interface EditorChatMessageSender {
  name: string | null;
  role: 'admin' | 'customer' | 'factory';
  email: string;
}

export interface EditorChatMessage {
  id: string;
  order_item_id: string;
  sender_id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'resolved';
  attachment_urls: string[];
  created_at: string;
  updated_at: string;
  sender?: EditorChatMessageSender;
}
