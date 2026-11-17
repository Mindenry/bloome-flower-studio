import { randomBytes, randomInt } from "node:crypto";

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32 (lowercase)

/** Lexicographically sortable, non-guessable identifier with a typed prefix. */
export function newId(prefix: string): string {
  const time = Date.now().toString(32).padStart(9, "0");
  let rand = "";
  const bytes = randomBytes(10);
  for (const byte of bytes) rand += ALPHABET[byte % 32];
  return `${prefix}_${time}${rand}`;
}

export const ids = {
  user: () => newId("usr"),
  session: () => newId("ses"),
  account: () => newId("acc"),
  oauthState: () => newId("ost"),
  role: () => newId("rol"),
  address: () => newId("adr"),
  product: () => newId("prd"),
  productImage: () => newId("pim"),
  variant: () => newId("var"),
  addon: () => newId("adn"),
  category: () => newId("cat"),
  cart: () => newId("crt"),
  cartItem: () => newId("cit"),
  order: () => newId("ord"),
  orderItem: () => newId("oit"),
  orderEvent: () => newId("oev"),
  payment: () => newId("pay"),
  paymentTransaction: () => newId("ptx"),
  refund: () => newId("rfd"),
  review: () => newId("rev"),
  banner: () => newId("bnr"),
  page: () => newId("pg"),
  faq: () => newId("faq"),
  blogPost: () => newId("blg"),
  notification: () => newId("ntf"),
  newsletter: () => newId("nws"),
  setting: () => newId("set"),
  activity: () => newId("act"),
  reminder: () => newId("rmd"),
  recipient: () => newId("rcp"),
  inventoryMovement: () => newId("inv"),
  inventoryBatch: () => newId("bat"),
  deliverySlot: () => newId("dsl"),
  coupon: () => newId("cpn"),
  couponUsage: () => newId("cpu"),
  shipping: () => newId("shp"),
  gallery: () => newId("gal"),
  careGuide: () => newId("cgr"),
  upload: () => newId("upl"),
  webhook: () => newId("whk"),
  token: () => newId("tok"),
  wishlist: () => newId("wsh"),
  wishlistItem: () => newId("wit"),
  blockDate: () => newId("bdt"),
};

/** Human readable, unique order number: FLW-YYYYMMDD-0001. */
export function formatOrderNumber(date: Date, sequence: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `FLW-${y}${m}${d}-${String(sequence).padStart(4, "0")}`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomNumericCode(digits = 6): string {
  const max = 10 ** digits;
  return String(randomInt(0, max)).padStart(digits, "0");
}

/** Deterministic, non-reversible hash prefix for anything sensitive stored in the DB. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[\u0E00-\u0E7F]+/g, "") // strip Thai — slugs use latin part when present
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
