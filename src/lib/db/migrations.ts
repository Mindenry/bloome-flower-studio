import { sql, type Kysely } from "kysely";
import type { Database } from "./schema";
import { nowIso } from "./index";

/**
 * Portable migrations (SQLite development + PostgreSQL production).
 * Every identifier is snake_case, every timestamp is ISO-8601 text and every
 * boolean is an integer 0/1 so the exact same statement set runs on both engines.
 */

type Migration = { name: string; up: (db: Kysely<Database>) => Promise<void> };

const migration001: Migration = {
  name: "001_initial_schema",
  async up(db) {
    const s = db.schema;

    // ---- Identity -----------------------------------------------------------
    await s
      .createTable("roles")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("slug", "text", (c) => c.notNull().unique())
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("description", "text")
      .addColumn("permissions", "text", (c) => c.notNull())
      .addColumn("is_system", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("users")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("email", "text", (c) => c.unique())
      .addColumn("email_verified_at", "text")
      .addColumn("password_hash", "text")
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("phone", "text")
      .addColumn("avatar_url", "text")
      .addColumn("role_id", "text", (c) => c.notNull().references("roles.id"))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
      .addColumn("locale", "text", (c) => c.notNull().defaultTo("th"))
      .addColumn("marketing_consent", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("last_login_at", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addColumn("deleted_at", "text")
      .execute();

    await s
      .createTable("accounts")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
      .addColumn("provider", "text", (c) => c.notNull())
      .addColumn("provider_account_id", "text", (c) => c.notNull())
      .addColumn("email", "text")
      .addColumn("display_name", "text")
      .addColumn("picture_url", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addUniqueConstraint("accounts_provider_account_unique", ["provider", "provider_account_id"])
      .execute();

    await s
      .createTable("sessions")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
      .addColumn("token_hash", "text", (c) => c.notNull().unique())
      .addColumn("user_agent", "text")
      .addColumn("ip", "text")
      .addColumn("expires_at", "text", (c) => c.notNull())
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("last_used_at", "text", (c) => c.notNull())
      .addColumn("revoked_at", "text")
      .execute();

    await s
      .createTable("auth_tokens")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
      .addColumn("type", "text", (c) => c.notNull())
      .addColumn("token_hash", "text", (c) => c.notNull().unique())
      .addColumn("expires_at", "text", (c) => c.notNull())
      .addColumn("used_at", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("oauth_states")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("provider", "text", (c) => c.notNull())
      .addColumn("state", "text", (c) => c.notNull().unique())
      .addColumn("nonce", "text")
      .addColumn("code_verifier", "text")
      .addColumn("redirect_to", "text")
      .addColumn("link_user_id", "text")
      .addColumn("expires_at", "text", (c) => c.notNull())
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("addresses")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
      .addColumn("label", "text", (c) => c.notNull().defaultTo("home"))
      .addColumn("recipient_name", "text", (c) => c.notNull())
      .addColumn("phone", "text", (c) => c.notNull())
      .addColumn("address_line", "text", (c) => c.notNull())
      .addColumn("subdistrict", "text", (c) => c.notNull())
      .addColumn("district", "text", (c) => c.notNull())
      .addColumn("province", "text", (c) => c.notNull())
      .addColumn("postal_code", "text", (c) => c.notNull())
      .addColumn("country", "text", (c) => c.notNull().defaultTo("TH"))
      .addColumn("is_default", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addColumn("deleted_at", "text")
      .execute();

    // ---- Catalog ------------------------------------------------------------
    await s
      .createTable("categories")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("slug", "text", (c) => c.notNull().unique())
      .addColumn("parent_id", "text")
      .addColumn("image_url", "text")
      .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
      .addColumn("kind", "text", (c) => c.notNull().defaultTo("category"))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addColumn("deleted_at", "text")
      .execute();

    await s
      .createTable("category_translations")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("category_id", "text", (c) => c.notNull().references("categories.id").onDelete("cascade"))
      .addColumn("locale", "text", (c) => c.notNull())
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("description", "text")
      .addColumn("meta_title", "text")
      .addColumn("meta_description", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addUniqueConstraint("category_translations_unique", ["category_id", "locale"])
      .execute();

    await s
      .createTable("products")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("sku", "text", (c) => c.notNull().unique())
      .addColumn("slug", "text", (c) => c.notNull().unique())
      .addColumn("category_id", "text")
      .addColumn("type", "text", (c) => c.notNull().defaultTo("bouquet"))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("draft"))
      .addColumn("published_at", "text")
      .addColumn("featured", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("new_arrival", "integer", (c) => c.notNull().defaultTo(1))
      .addColumn("price", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("sale_price", "integer")
      .addColumn("cost_price", "integer")
      .addColumn("stock_quantity", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("low_stock_threshold", "integer", (c) => c.notNull().defaultTo(5))
      .addColumn("weight_grams", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("length_cm", "integer")
      .addColumn("width_cm", "integer")
      .addColumn("height_cm", "integer")
      .addColumn("flower_type", "text")
      .addColumn("flower_color", "text")
      .addColumn("bouquet_size", "text")
      .addColumn("flower_count", "integer")
      .addColumn("sold_count", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("view_count", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("created_by", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addColumn("deleted_at", "text")
      .addColumn("archived_at", "text")
      .execute();

    await s
      .createTable("product_translations")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("product_id", "text", (c) => c.notNull().references("products.id").onDelete("cascade"))
      .addColumn("locale", "text", (c) => c.notNull())
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("short_description", "text")
      .addColumn("description", "text")
      .addColumn("care_instructions", "text")
      .addColumn("delivery_information", "text")
      .addColumn("meta_title", "text")
      .addColumn("meta_description", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addUniqueConstraint("product_translations_unique", ["product_id", "locale"])
      .execute();

    await s
      .createTable("product_images")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("product_id", "text", (c) => c.notNull().references("products.id").onDelete("cascade"))
      .addColumn("url", "text", (c) => c.notNull())
      .addColumn("alt_th", "text")
      .addColumn("alt_en", "text")
      .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("width", "integer")
      .addColumn("height", "integer")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("product_variants")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("product_id", "text", (c) => c.notNull().references("products.id").onDelete("cascade"))
      .addColumn("sku", "text", (c) => c.notNull())
      .addColumn("name_th", "text", (c) => c.notNull())
      .addColumn("name_en", "text", (c) => c.notNull())
      .addColumn("price_delta", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("stock_quantity", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("image_url", "text")
      .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
      .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addUniqueConstraint("product_variants_sku_unique", ["product_id", "sku"])
      .execute();

    await s
      .createTable("addons")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("sku", "text", (c) => c.notNull().unique())
      .addColumn("name_th", "text", (c) => c.notNull())
      .addColumn("name_en", "text", (c) => c.notNull())
      .addColumn("price", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("stock_quantity", "integer")
      .addColumn("image_url", "text")
      .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
      .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("inventory_movements")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("product_id", "text", (c) => c.notNull().references("products.id").onDelete("cascade"))
      .addColumn("variant_id", "text")
      .addColumn("type", "text", (c) => c.notNull())
      .addColumn("quantity", "integer", (c) => c.notNull())
      .addColumn("reference_type", "text")
      .addColumn("reference_id", "text")
      .addColumn("note", "text")
      .addColumn("created_by", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("inventory_batches")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("product_id", "text", (c) => c.notNull().references("products.id").onDelete("cascade"))
      .addColumn("batch_code", "text", (c) => c.notNull())
      .addColumn("received_at", "text", (c) => c.notNull())
      .addColumn("expiry_at", "text")
      .addColumn("quantity", "integer", (c) => c.notNull())
      .addColumn("remaining", "integer", (c) => c.notNull())
      .addColumn("status", "text", (c) => c.notNull().defaultTo("fresh"))
      .addColumn("note", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    // ---- Cart ---------------------------------------------------------------
    await s
      .createTable("carts")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text")
      .addColumn("guest_token", "text")
      .addColumn("coupon_code", "text")
      .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
      .addColumn("locale", "text", (c) => c.notNull().defaultTo("th"))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addColumn("expires_at", "text")
      .addColumn("abandoned_notified_at", "text")
      .execute();

    await s
      .createTable("cart_items")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("cart_id", "text", (c) => c.notNull().references("carts.id").onDelete("cascade"))
      .addColumn("product_id", "text", (c) => c.notNull())
      .addColumn("variant_id", "text")
      .addColumn("addon_ids", "text", (c) => c.notNull().defaultTo("[]"))
      .addColumn("addon_signature", "text", (c) => c.notNull().defaultTo(""))
      .addColumn("quantity", "integer", (c) => c.notNull().defaultTo(1))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addUniqueConstraint("cart_items_unique", ["cart_id", "product_id", "variant_id", "addon_signature"])
      .execute();

    await s
      .createTable("wishlists")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text", (c) => c.notNull().unique().references("users.id").onDelete("cascade"))
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("wishlist_items")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("wishlist_id", "text", (c) => c.notNull().references("wishlists.id").onDelete("cascade"))
      .addColumn("product_id", "text", (c) => c.notNull())
      .addColumn("created_at", "text", (c) => c.notNull())
      .addUniqueConstraint("wishlist_items_unique", ["wishlist_id", "product_id"])
      .execute();

    // ---- Orders -------------------------------------------------------------
    await s
      .createTable("orders")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("order_number", "text", (c) => c.notNull().unique())
      .addColumn("user_id", "text", (c) => c.references("users.id").onDelete("set null"))
      .addColumn("locale", "text", (c) => c.notNull().defaultTo("th"))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("pending_payment"))
      .addColumn("payment_status", "text", (c) => c.notNull().defaultTo("pending"))
      .addColumn("email", "text", (c) => c.notNull())
      .addColumn("customer_name", "text", (c) => c.notNull())
      .addColumn("customer_phone", "text", (c) => c.notNull())
      .addColumn("recipient_name", "text", (c) => c.notNull())
      .addColumn("recipient_phone", "text", (c) => c.notNull())
      .addColumn("address_line", "text", (c) => c.notNull())
      .addColumn("subdistrict", "text", (c) => c.notNull())
      .addColumn("district", "text", (c) => c.notNull())
      .addColumn("province", "text", (c) => c.notNull())
      .addColumn("postal_code", "text", (c) => c.notNull())
      .addColumn("delivery_notes", "text")
      .addColumn("delivery_date", "text")
      .addColumn("delivery_slot_id", "text")
      .addColumn("delivery_slot_label", "text")
      .addColumn("gift_message", "text")
      .addColumn("sender_name", "text")
      .addColumn("anonymous", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("card_design", "text")
      .addColumn("subtotal", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("addons_total", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("discount_total", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("shipping_total", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("tax_total", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("grand_total", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("currency", "text", (c) => c.notNull().defaultTo("THB"))
      .addColumn("coupon_code", "text")
      .addColumn("coupon_id", "text")
      .addColumn("customer_note", "text")
      .addColumn("internal_note", "text")
      .addColumn("idempotency_key", "text", (c) => c.unique())
      .addColumn("ip", "text")
      .addColumn("user_agent", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addColumn("paid_at", "text")
      .addColumn("confirmed_at", "text")
      .addColumn("preparing_at", "text")
      .addColumn("ready_at", "text")
      .addColumn("out_for_delivery_at", "text")
      .addColumn("delivered_at", "text")
      .addColumn("cancelled_at", "text")
      .addColumn("cancel_reason", "text")
      .addColumn("refunded_total", "integer", (c) => c.notNull().defaultTo(0))
      .execute();

    await s
      .createTable("order_items")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
      .addColumn("product_id", "text")
      .addColumn("variant_id", "text")
      .addColumn("sku", "text", (c) => c.notNull())
      .addColumn("name_th", "text", (c) => c.notNull())
      .addColumn("name_en", "text", (c) => c.notNull())
      .addColumn("variant_name_th", "text")
      .addColumn("variant_name_en", "text")
      .addColumn("unit_price", "integer", (c) => c.notNull())
      .addColumn("quantity", "integer", (c) => c.notNull())
      .addColumn("addons_json", "text", (c) => c.notNull().defaultTo("[]"))
      .addColumn("addons_total", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("line_total", "integer", (c) => c.notNull())
      .addColumn("image_url", "text")
      .addColumn("snapshot_json", "text", (c) => c.notNull().defaultTo("{}"))
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("order_events")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
      .addColumn("type", "text", (c) => c.notNull())
      .addColumn("message", "text", (c) => c.notNull())
      .addColumn("from_status", "text")
      .addColumn("to_status", "text")
      .addColumn("actor_type", "text", (c) => c.notNull().defaultTo("system"))
      .addColumn("actor_id", "text")
      .addColumn("visible_to_customer", "integer", (c) => c.notNull().defaultTo(1))
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("payments")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
      .addColumn("provider", "text", (c) => c.notNull())
      .addColumn("method", "text", (c) => c.notNull())
      .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
      .addColumn("amount", "integer", (c) => c.notNull())
      .addColumn("currency", "text", (c) => c.notNull().defaultTo("THB"))
      .addColumn("provider_reference", "text")
      .addColumn("checkout_url", "text")
      .addColumn("qr_payload", "text")
      .addColumn("expires_at", "text")
      .addColumn("paid_at", "text")
      .addColumn("failure_reason", "text")
      .addColumn("metadata_json", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("payment_transactions")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("payment_id", "text", (c) => c.notNull().references("payments.id").onDelete("cascade"))
      .addColumn("type", "text", (c) => c.notNull())
      .addColumn("provider_event_id", "text", (c) => c.unique())
      .addColumn("amount", "integer")
      .addColumn("currency", "text")
      .addColumn("status", "text", (c) => c.notNull())
      .addColumn("payload_json", "text")
      .addColumn("note", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("refunds")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("payment_id", "text", (c) => c.notNull().references("payments.id").onDelete("cascade"))
      .addColumn("order_id", "text", (c) => c.notNull().references("orders.id").onDelete("cascade"))
      .addColumn("amount", "integer", (c) => c.notNull())
      .addColumn("reason", "text")
      .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
      .addColumn("provider_refund_id", "text")
      .addColumn("note", "text")
      .addColumn("created_by", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("processed_at", "text")
      .execute();

    await s
      .createTable("shipping")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("order_id", "text", (c) => c.notNull().unique().references("orders.id").onDelete("cascade"))
      .addColumn("carrier", "text")
      .addColumn("tracking_number", "text")
      .addColumn("status", "text", (c) => c.notNull().defaultTo("preparing"))
      .addColumn("note", "text")
      .addColumn("shipped_at", "text")
      .addColumn("delivered_at", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("delivery_slots")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("date", "text", (c) => c.notNull())
      .addColumn("start_time", "text", (c) => c.notNull())
      .addColumn("end_time", "text", (c) => c.notNull())
      .addColumn("capacity", "integer", (c) => c.notNull().defaultTo(10))
      .addColumn("booked_count", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("open"))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addUniqueConstraint("delivery_slots_unique", ["date", "start_time"])
      .execute();

    await s
      .createTable("delivery_blocked_dates")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("date", "text", (c) => c.notNull().unique())
      .addColumn("reason", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("coupons")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("code", "text", (c) => c.notNull().unique())
      .addColumn("description_th", "text")
      .addColumn("description_en", "text")
      .addColumn("type", "text", (c) => c.notNull())
      .addColumn("value", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("min_spend", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("max_discount", "integer")
      .addColumn("usage_limit", "integer")
      .addColumn("per_customer_limit", "integer", (c) => c.notNull().defaultTo(1))
      .addColumn("starts_at", "text", (c) => c.notNull())
      .addColumn("ends_at", "text")
      .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
      .addColumn("applies_to", "text", (c) => c.notNull().defaultTo("all"))
      .addColumn("product_ids", "text")
      .addColumn("category_ids", "text")
      .addColumn("free_shipping", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("coupon_usages")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("coupon_id", "text", (c) => c.notNull().references("coupons.id").onDelete("cascade"))
      .addColumn("user_id", "text")
      .addColumn("order_id", "text", (c) => c.notNull().unique())
      .addColumn("email", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    // ---- Content & engagement ----------------------------------------------
    await s
      .createTable("reviews")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("product_id", "text", (c) => c.notNull())
      .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
      .addColumn("order_item_id", "text", (c) => c.notNull().unique())
      .addColumn("order_id", "text", (c) => c.notNull())
      .addColumn("rating", "integer", (c) => c.notNull())
      .addColumn("title", "text")
      .addColumn("body", "text")
      .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
      .addColumn("admin_reply", "text")
      .addColumn("replied_at", "text")
      .addColumn("verified", "integer", (c) => c.notNull().defaultTo(1))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("review_images")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("review_id", "text", (c) => c.notNull().references("reviews.id").onDelete("cascade"))
      .addColumn("url", "text", (c) => c.notNull())
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("banners")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("placement", "text", (c) => c.notNull())
      .addColumn("title_th", "text", (c) => c.notNull())
      .addColumn("title_en", "text", (c) => c.notNull())
      .addColumn("subtitle_th", "text")
      .addColumn("subtitle_en", "text")
      .addColumn("image_url", "text")
      .addColumn("link_url", "text")
      .addColumn("cta_th", "text")
      .addColumn("cta_en", "text")
      .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
      .addColumn("starts_at", "text")
      .addColumn("ends_at", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("content_pages")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("slug", "text", (c) => c.notNull().unique())
      .addColumn("template", "text", (c) => c.notNull().defaultTo("page"))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("published"))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("content_page_translations")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("page_id", "text", (c) => c.notNull().references("content_pages.id").onDelete("cascade"))
      .addColumn("locale", "text", (c) => c.notNull())
      .addColumn("title", "text", (c) => c.notNull())
      .addColumn("body", "text", (c) => c.notNull())
      .addColumn("meta_title", "text")
      .addColumn("meta_description", "text")
      .addUniqueConstraint("content_page_translations_unique", ["page_id", "locale"])
      .execute();

    await s
      .createTable("faqs")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("category", "text")
      .addColumn("question_th", "text", (c) => c.notNull())
      .addColumn("question_en", "text", (c) => c.notNull())
      .addColumn("answer_th", "text", (c) => c.notNull())
      .addColumn("answer_en", "text", (c) => c.notNull())
      .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("blog_posts")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("slug", "text", (c) => c.notNull().unique())
      .addColumn("cover_image", "text")
      .addColumn("author_id", "text")
      .addColumn("category", "text")
      .addColumn("status", "text", (c) => c.notNull().defaultTo("draft"))
      .addColumn("published_at", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("blog_post_translations")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("post_id", "text", (c) => c.notNull().references("blog_posts.id").onDelete("cascade"))
      .addColumn("locale", "text", (c) => c.notNull())
      .addColumn("title", "text", (c) => c.notNull())
      .addColumn("excerpt", "text")
      .addColumn("content", "text", (c) => c.notNull())
      .addColumn("meta_title", "text")
      .addColumn("meta_description", "text")
      .addUniqueConstraint("blog_post_translations_unique", ["post_id", "locale"])
      .execute();

    await s
      .createTable("care_guides")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("slug", "text", (c) => c.notNull().unique())
      .addColumn("image_url", "text")
      .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("published"))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("care_guide_translations")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("guide_id", "text", (c) => c.notNull().references("care_guides.id").onDelete("cascade"))
      .addColumn("locale", "text", (c) => c.notNull())
      .addColumn("title", "text", (c) => c.notNull())
      .addColumn("body", "text", (c) => c.notNull())
      .addUniqueConstraint("care_guide_translations_unique", ["guide_id", "locale"])
      .execute();

    await s
      .createTable("site_gallery")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("image_url", "text", (c) => c.notNull())
      .addColumn("link_url", "text")
      .addColumn("caption", "text")
      .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("active"))
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("notifications")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text")
      .addColumn("audience", "text", (c) => c.notNull().defaultTo("customer"))
      .addColumn("type", "text", (c) => c.notNull())
      .addColumn("title_th", "text", (c) => c.notNull())
      .addColumn("title_en", "text", (c) => c.notNull())
      .addColumn("body_th", "text")
      .addColumn("body_en", "text")
      .addColumn("link_url", "text")
      .addColumn("read_at", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("newsletter_subscribers")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("email", "text", (c) => c.notNull().unique())
      .addColumn("locale", "text", (c) => c.notNull().defaultTo("th"))
      .addColumn("consent", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
      .addColumn("token", "text")
      .addColumn("confirmed_at", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("store_settings")
      .ifNotExists()
      .addColumn("key", "text", (c) => c.primaryKey())
      .addColumn("value", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("activity_logs")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("actor_id", "text")
      .addColumn("actor_email", "text")
      .addColumn("action", "text", (c) => c.notNull())
      .addColumn("entity_type", "text", (c) => c.notNull())
      .addColumn("entity_id", "text")
      .addColumn("meta_json", "text")
      .addColumn("ip", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("occasion_reminders")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
      .addColumn("recipient_name", "text", (c) => c.notNull())
      .addColumn("occasion", "text", (c) => c.notNull())
      .addColumn("event_date", "text", (c) => c.notNull())
      .addColumn("remind_days_before", "integer", (c) => c.notNull().defaultTo(7))
      .addColumn("notify_email", "integer", (c) => c.notNull().defaultTo(1))
      .addColumn("notify_line", "integer", (c) => c.notNull().defaultTo(0))
      .addColumn("note", "text")
      .addColumn("active", "integer", (c) => c.notNull().defaultTo(1))
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("recipients")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("phone", "text", (c) => c.notNull())
      .addColumn("address_line", "text", (c) => c.notNull())
      .addColumn("subdistrict", "text", (c) => c.notNull())
      .addColumn("district", "text", (c) => c.notNull())
      .addColumn("province", "text", (c) => c.notNull())
      .addColumn("postal_code", "text", (c) => c.notNull())
      .addColumn("note", "text")
      .addColumn("birthday", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("updated_at", "text", (c) => c.notNull())
      .addColumn("deleted_at", "text")
      .execute();

    await s
      .createTable("recently_viewed")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("user_id", "text")
      .addColumn("guest_token", "text")
      .addColumn("product_id", "text", (c) => c.notNull())
      .addColumn("viewed_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("webhook_events")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("provider", "text", (c) => c.notNull())
      .addColumn("event_id", "text", (c) => c.notNull())
      .addColumn("event_type", "text", (c) => c.notNull())
      .addColumn("payload_json", "text", (c) => c.notNull())
      .addColumn("status", "text", (c) => c.notNull().defaultTo("received"))
      .addColumn("error", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .addColumn("processed_at", "text")
      .addUniqueConstraint("webhook_events_unique", ["provider", "event_id"])
      .execute();

    await s
      .createTable("rate_limits")
      .ifNotExists()
      .addColumn("key", "text", (c) => c.primaryKey())
      .addColumn("window_start", "text", (c) => c.notNull())
      .addColumn("count", "integer", (c) => c.notNull().defaultTo(0))
      .execute();

    await s
      .createTable("sequences")
      .ifNotExists()
      .addColumn("name", "text", (c) => c.primaryKey())
      .addColumn("value", "integer", (c) => c.notNull().defaultTo(0))
      .execute();

    await s
      .createTable("email_log")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("to_email", "text", (c) => c.notNull())
      .addColumn("template", "text", (c) => c.notNull())
      .addColumn("subject", "text", (c) => c.notNull())
      .addColumn("status", "text", (c) => c.notNull())
      .addColumn("error", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    await s
      .createTable("uploads")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("storage_key", "text", (c) => c.notNull())
      .addColumn("url", "text", (c) => c.notNull())
      .addColumn("mime_type", "text", (c) => c.notNull())
      .addColumn("size_bytes", "integer", (c) => c.notNull())
      .addColumn("width", "integer")
      .addColumn("height", "integer")
      .addColumn("uploaded_by", "text")
      .addColumn("created_at", "text", (c) => c.notNull())
      .execute();

    // ---- Indexes ------------------------------------------------------------
    const index = (name: string, table: string, columns: string[], unique = false) =>
      s
        .createIndex(name)
        .ifNotExists()
        .on(table)
        .columns(columns)
        .$call((b) => (unique ? b.unique() : b))
        .execute();

    await index("idx_users_role", "users", ["role_id"]);
    await index("idx_users_status", "users", ["status"]);
    await index("idx_accounts_user", "accounts", ["user_id"]);
    await index("idx_sessions_user", "sessions", ["user_id"]);
    await index("idx_sessions_expires", "sessions", ["expires_at"]);
    await index("idx_addresses_user", "addresses", ["user_id"]);
    await index("idx_categories_kind", "categories", ["kind", "status"]);
    await index("idx_product_translations_locale", "product_translations", ["locale"]);
    await index("idx_products_status", "products", ["status", "deleted_at"]);
    await index("idx_products_category", "products", ["category_id", "status"]);
    await index("idx_products_price", "products", ["price"]);
    await index("idx_products_created", "products", ["created_at"]);
    await index("idx_products_sold", "products", ["sold_count"]);
    await index("idx_product_images_product", "product_images", ["product_id", "sort_order"]);
    await index("idx_variants_product", "product_variants", ["product_id"]);
    await index("idx_inventory_movements_product", "inventory_movements", ["product_id", "created_at"]);
    await index("idx_carts_user", "carts", ["user_id", "status"]);
    await index("idx_carts_guest", "carts", ["guest_token", "status"]);
    await index("idx_carts_status_updated", "carts", ["status", "updated_at"]);
    await index("idx_cart_items_cart", "cart_items", ["cart_id"]);
    await index("idx_wishlist_items_wishlist", "wishlist_items", ["wishlist_id"]);
    await index("idx_orders_user", "orders", ["user_id", "created_at"]);
    await index("idx_orders_status", "orders", ["status", "created_at"]);
    await index("idx_orders_payment_status", "orders", ["payment_status"]);
    await index("idx_orders_email", "orders", ["email"]);
    await index("idx_orders_created", "orders", ["created_at"]);
    await index("idx_orders_delivery_date", "orders", ["delivery_date"]);
    await index("idx_order_items_order", "order_items", ["order_id"]);
    await index("idx_order_items_product", "order_items", ["product_id"]);
    await index("idx_order_events_order", "order_events", ["order_id", "created_at"]);
    await index("idx_payments_order", "payments", ["order_id"]);
    await index("idx_payments_reference", "payments", ["provider_reference"]);
    await index("idx_payments_status", "payments", ["status"]);
    await index("idx_transactions_payment", "payment_transactions", ["payment_id"]);
    await index("idx_refunds_order", "refunds", ["order_id"]);
    await index("idx_delivery_slots_date", "delivery_slots", ["date", "status"]);
    await index("idx_coupons_code", "coupons", ["code", "status"]);
    await index("idx_coupon_usages_coupon", "coupon_usages", ["coupon_id"]);
    await index("idx_coupon_usages_user", "coupon_usages", ["user_id"]);
    await index("idx_reviews_product", "reviews", ["product_id", "status"]);
    await index("idx_reviews_user", "reviews", ["user_id"]);
    await index("idx_banners_placement", "banners", ["placement", "status"]);
    await index("idx_notifications_user", "notifications", ["user_id", "read_at"]);
    await index("idx_notifications_audience", "notifications", ["audience", "created_at"]);
    await index("idx_activity_logs_created", "activity_logs", ["created_at"]);
    await index("idx_activity_logs_actor", "activity_logs", ["actor_id"]);
    await index("idx_recently_viewed_user", "recently_viewed", ["user_id", "viewed_at"]);
    await index("idx_recently_viewed_guest", "recently_viewed", ["guest_token", "viewed_at"]);
    await index("idx_blog_posts_status", "blog_posts", ["status", "published_at"]);
    await index("idx_reminders_user", "occasion_reminders", ["user_id", "active"]);
  },
};

const migration002: Migration = {
  name: "002_cart_price_snapshot",
  async up(db) {
    await db.schema
      .alterTable("cart_items")
      .addColumn("unit_price_snapshot", "integer", (c) => c.notNull().defaultTo(0))
      .execute();
  },
};

const migration003: Migration = {
  name: "003_product_occasions",
  async up(db) {
    await db.schema
      .createTable("product_occasions")
      .ifNotExists()
      .addColumn("product_id", "text", (c) => c.notNull().references("products.id").onDelete("cascade"))
      .addColumn("occasion_id", "text", (c) => c.notNull().references("categories.id").onDelete("cascade"))
      .addColumn("sort_order", "integer", (c) => c.notNull().defaultTo(0))
      .addPrimaryKeyConstraint("product_occasions_pk", ["product_id", "occasion_id"])
      .execute();

    await db.schema
      .createIndex("idx_product_occasions_occasion")
      .ifNotExists()
      .on("product_occasions")
      .columns(["occasion_id"])
      .execute();
  },
};

export const migrations: Migration[] = [migration001, migration002, migration003];

export async function runMigrations(db: Kysely<Database>): Promise<string[]> {
  await db.schema
    .createTable("_migrations")
    .ifNotExists()
    .addColumn("name", "text", (c) => c.primaryKey())
    .addColumn("applied_at", "text", (c) => c.notNull())
    .execute();

  const applied = await db.selectFrom("_migrations").select("name").execute();
  const done = new Set(applied.map((row) => row.name));
  const executed: string[] = [];

  for (const migration of migrations) {
    if (done.has(migration.name)) continue;
    await db.transaction().execute(async (trx) => {
      await migration.up(trx);
      await trx
        .insertInto("_migrations")
        .values({ name: migration.name, applied_at: nowIso() })
        .execute();
    });
    executed.push(migration.name);
  }
  return executed;
}

export async function currentSchemaVersion(db: Kysely<Database>): Promise<string | null> {
  try {
    const row = await db
      .selectFrom("_migrations")
      .select("name")
      .orderBy("name", "desc")
      .limit(1)
      .executeTakeFirst();
    return row?.name ?? null;
  } catch {
    return null;
  }
}

export const schemaSql = sql;
