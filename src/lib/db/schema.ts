/**
 * Canonical database schema (dialect-agnostic).
 *
 * Conventions
 *  - IDs: prefixed ULID-like text (see src/lib/ids.ts)
 *  - Money: integer minor units (satang)
 *  - Timestamps: ISO-8601 UTC text — sortable lexicographically in every dialect
 *  - Booleans: integer 0/1 (portable across SQLite + PostgreSQL)
 *  - Localised content lives in dedicated *_translations tables
 */
export interface UsersTable {
  id: string;
  email: string | null;
  email_verified_at: string | null;
  password_hash: string | null;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  role_id: string;
  status: string; // pending | active | disabled
  locale: string;
  marketing_consent: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RolesTable {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: string; // JSON string[]
  is_system: number;
  created_at: string;
  updated_at: string;
}

export interface AccountsTable {
  id: string;
  user_id: string;
  provider: string; // line | google
  provider_account_id: string;
  email: string | null;
  display_name: string | null;
  picture_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionsTable {
  id: string;
  user_id: string;
  token_hash: string;
  user_agent: string | null;
  ip: string | null;
  expires_at: string;
  created_at: string;
  last_used_at: string;
  revoked_at: string | null;
}

export interface AuthTokensTable {
  id: string;
  user_id: string;
  type: string; // password_reset | email_verification
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface OauthStatesTable {
  id: string;
  provider: string;
  state: string;
  nonce: string | null;
  code_verifier: string | null;
  redirect_to: string | null;
  link_user_id: string | null;
  expires_at: string;
  created_at: string;
}

export interface AddressesTable {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
  is_default: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CategoriesTable {
  id: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  sort_order: number;
  status: string; // active | hidden
  kind: string; // category | collection | occasion
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CategoryTranslationsTable {
  id: string;
  category_id: string;
  locale: string;
  name: string;
  description: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductsTable {
  id: string;
  sku: string;
  slug: string;
  category_id: string | null;
  type: string;
  status: string; // draft | published | scheduled | archived
  published_at: string | null;
  featured: number;
  new_arrival: number;
  price: number;
  sale_price: number | null;
  cost_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  weight_grams: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  flower_type: string | null;
  flower_color: string | null;
  bouquet_size: string | null;
  flower_count: number | null;
  sold_count: number;
  view_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  archived_at: string | null;
}

export interface ProductTranslationsTable {
  id: string;
  product_id: string;
  locale: string;
  name: string;
  short_description: string | null;
  description: string | null;
  care_instructions: string | null;
  delivery_information: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImagesTable {
  id: string;
  product_id: string;
  url: string;
  alt_th: string | null;
  alt_en: string | null;
  sort_order: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface ProductVariantsTable {
  id: string;
  product_id: string;
  sku: string;
  name_th: string;
  name_en: string;
  price_delta: number;
  stock_quantity: number;
  image_url: string | null;
  status: string; // active | inactive
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductOccasionsTable {
  product_id: string;
  occasion_id: string;
  sort_order: number;
}

export interface AddonsTable {
  id: string;
  sku: string;
  name_th: string;
  name_en: string;
  price: number;
  stock_quantity: number | null;
  image_url: string | null;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovementsTable {
  id: string;
  product_id: string;
  variant_id: string | null;
  type: string; // in | out | adjust | sale | reserve | release | return | waste
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InventoryBatchesTable {
  id: string;
  product_id: string;
  batch_code: string;
  received_at: string;
  expiry_at: string | null;
  quantity: number;
  remaining: number;
  status: string; // fresh | near_expiry | expired | wasted
  note: string | null;
  created_at: string;
}

export interface CartsTable {
  id: string;
  user_id: string | null;
  guest_token: string | null;
  coupon_code: string | null;
  status: string; // active | converted | abandoned
  locale: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  abandoned_notified_at: string | null;
}

export interface CartItemsTable {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  addon_ids: string; // JSON string[]
  addon_signature: string;
  unit_price_snapshot: number;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface WishlistsTable {
  id: string;
  user_id: string;
  created_at: string;
}

export interface WishlistItemsTable {
  id: string;
  wishlist_id: string;
  product_id: string;
  created_at: string;
}

export interface OrdersTable {
  id: string;
  order_number: string;
  user_id: string | null;
  locale: string;
  status: string;
  payment_status: string;
  email: string;
  customer_name: string;
  customer_phone: string;
  recipient_name: string;
  recipient_phone: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  delivery_notes: string | null;
  delivery_date: string | null;
  delivery_slot_id: string | null;
  delivery_slot_label: string | null;
  gift_message: string | null;
  sender_name: string | null;
  anonymous: number;
  card_design: string | null;
  subtotal: number;
  addons_total: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  grand_total: number;
  currency: string;
  coupon_code: string | null;
  coupon_id: string | null;
  customer_note: string | null;
  internal_note: string | null;
  idempotency_key: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  refunded_total: number;
}

export interface OrderItemsTable {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string;
  name_th: string;
  name_en: string;
  variant_name_th: string | null;
  variant_name_en: string | null;
  unit_price: number;
  quantity: number;
  addons_json: string;
  addons_total: number;
  line_total: number;
  image_url: string | null;
  snapshot_json: string;
  created_at: string;
}

export interface OrderEventsTable {
  id: string;
  order_id: string;
  type: string;
  message: string;
  from_status: string | null;
  to_status: string | null;
  actor_type: string; // customer | admin | system
  actor_id: string | null;
  visible_to_customer: number;
  created_at: string;
}

export interface PaymentsTable {
  id: string;
  order_id: string;
  provider: string;
  method: string;
  status: string;
  amount: number;
  currency: string;
  provider_reference: string | null;
  checkout_url: string | null;
  qr_payload: string | null;
  expires_at: string | null;
  paid_at: string | null;
  failure_reason: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransactionsTable {
  id: string;
  payment_id: string;
  type: string; // charge | webhook | verify | refund
  provider_event_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string;
  payload_json: string | null;
  note: string | null;
  created_at: string;
}

export interface RefundsTable {
  id: string;
  payment_id: string;
  order_id: string;
  amount: number;
  reason: string | null;
  status: string; // pending | succeeded | failed
  provider_refund_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface ShippingTable {
  id: string;
  order_id: string;
  carrier: string | null;
  tracking_number: string | null;
  status: string;
  note: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliverySlotsTable {
  id: string;
  date: string; // YYYY-MM-DD (Asia/Bangkok)
  start_time: string; // HH:mm
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string; // open | closed
  created_at: string;
  updated_at: string;
}

export interface DeliveryBlockedDatesTable {
  id: string;
  date: string;
  reason: string | null;
  created_at: string;
}

export interface CouponsTable {
  id: string;
  code: string;
  description_th: string | null;
  description_en: string | null;
  type: string; // fixed | percent | free_shipping
  value: number;
  min_spend: number;
  max_discount: number | null;
  usage_limit: number | null;
  per_customer_limit: number;
  starts_at: string;
  ends_at: string | null;
  status: string; // active | inactive
  applies_to: string; // all | products | categories
  product_ids: string | null;
  category_ids: string | null;
  free_shipping: number;
  created_at: string;
  updated_at: string;
}

export interface CouponUsagesTable {
  id: string;
  coupon_id: string;
  user_id: string | null;
  order_id: string;
  email: string | null;
  created_at: string;
}

export interface ReviewsTable {
  id: string;
  product_id: string;
  user_id: string;
  order_item_id: string;
  order_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string; // pending | approved | rejected
  admin_reply: string | null;
  replied_at: string | null;
  verified: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewImagesTable {
  id: string;
  review_id: string;
  url: string;
  created_at: string;
}

export interface BannersTable {
  id: string;
  placement: string; // home_hero | announcement | home_special | social
  title_th: string;
  title_en: string;
  subtitle_th: string | null;
  subtitle_en: string | null;
  image_url: string | null;
  link_url: string | null;
  cta_th: string | null;
  cta_en: string | null;
  sort_order: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentPagesTable {
  id: string;
  slug: string;
  template: string; // about | contact | faq | policy | care
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ContentPageTranslationsTable {
  id: string;
  page_id: string;
  locale: string;
  title: string;
  body: string;
  meta_title: string | null;
  meta_description: string | null;
}

export interface FaqsTable {
  id: string;
  category: string | null;
  question_th: string;
  question_en: string;
  answer_th: string;
  answer_en: string;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BlogPostsTable {
  id: string;
  slug: string;
  cover_image: string | null;
  author_id: string | null;
  category: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostTranslationsTable {
  id: string;
  post_id: string;
  locale: string;
  title: string;
  excerpt: string | null;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
}

export interface CareGuidesTable {
  id: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CareGuideTranslationsTable {
  id: string;
  guide_id: string;
  locale: string;
  title: string;
  body: string;
}

export interface SiteGalleryTable {
  id: string;
  image_url: string;
  link_url: string | null;
  caption: string | null;
  sort_order: number;
  status: string;
  created_at: string;
}

export interface NotificationsTable {
  id: string;
  user_id: string | null;
  audience: string; // customer | admin | broadcast
  type: string;
  title_th: string;
  title_en: string;
  body_th: string | null;
  body_en: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NewsletterSubscribersTable {
  id: string;
  email: string;
  locale: string;
  consent: number;
  status: string;
  token: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreSettingsTable {
  key: string;
  value: string;
  updated_at: string;
}

export interface ActivityLogsTable {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta_json: string | null;
  ip: string | null;
  created_at: string;
}

export interface OccasionRemindersTable {
  id: string;
  user_id: string;
  recipient_name: string;
  occasion: string;
  event_date: string;
  remind_days_before: number;
  notify_email: number;
  notify_line: number;
  note: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface RecipientsTable {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  note: string | null;
  birthday: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RecentlyViewedTable {
  id: string;
  user_id: string | null;
  guest_token: string | null;
  product_id: string;
  viewed_at: string;
}

export interface WebhookEventsTable {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payload_json: string;
  status: string;
  error: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface RateLimitsTable {
  key: string;
  window_start: string;
  count: number;
}

export interface SequencesTable {
  name: string;
  value: number;
}

export interface EmailLogTable {
  id: string;
  to_email: string;
  template: string;
  subject: string;
  status: string;
  error: string | null;
  created_at: string;
}

export interface UploadsTable {
  id: string;
  storage_key: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Database {
  users: UsersTable;
  roles: RolesTable;
  accounts: AccountsTable;
  sessions: SessionsTable;
  auth_tokens: AuthTokensTable;
  oauth_states: OauthStatesTable;
  addresses: AddressesTable;
  categories: CategoriesTable;
  category_translations: CategoryTranslationsTable;
  products: ProductsTable;
  product_translations: ProductTranslationsTable;
  product_images: ProductImagesTable;
  product_variants: ProductVariantsTable;
  product_occasions: ProductOccasionsTable;
  addons: AddonsTable;
  inventory_movements: InventoryMovementsTable;
  inventory_batches: InventoryBatchesTable;
  carts: CartsTable;
  cart_items: CartItemsTable;
  wishlists: WishlistsTable;
  wishlist_items: WishlistItemsTable;
  orders: OrdersTable;
  order_items: OrderItemsTable;
  order_events: OrderEventsTable;
  payments: PaymentsTable;
  payment_transactions: PaymentTransactionsTable;
  refunds: RefundsTable;
  shipping: ShippingTable;
  delivery_slots: DeliverySlotsTable;
  delivery_blocked_dates: DeliveryBlockedDatesTable;
  coupons: CouponsTable;
  coupon_usages: CouponUsagesTable;
  reviews: ReviewsTable;
  review_images: ReviewImagesTable;
  banners: BannersTable;
  content_pages: ContentPagesTable;
  content_page_translations: ContentPageTranslationsTable;
  faqs: FaqsTable;
  blog_posts: BlogPostsTable;
  blog_post_translations: BlogPostTranslationsTable;
  care_guides: CareGuidesTable;
  care_guide_translations: CareGuideTranslationsTable;
  site_gallery: SiteGalleryTable;
  notifications: NotificationsTable;
  newsletter_subscribers: NewsletterSubscribersTable;
  store_settings: StoreSettingsTable;
  activity_logs: ActivityLogsTable;
  occasion_reminders: OccasionRemindersTable;
  recipients: RecipientsTable;
  recently_viewed: RecentlyViewedTable;
  webhook_events: WebhookEventsTable;
  rate_limits: RateLimitsTable;
  sequences: SequencesTable;
  email_log: EmailLogTable;
  uploads: UploadsTable;
  _migrations: { name: string; applied_at: string };
}

export type OrderStatus =
  | "pending_payment"
  | "awaiting_verification"
  | "paid"
  | "confirmed"
  | "preparing"
  | "arranging"
  | "quality_check"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refund_requested"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "awaiting_verification"
  | "succeeded"
  | "failed"
  | "expired"
  | "cancelled"
  | "partially_refunded"
  | "refunded";
