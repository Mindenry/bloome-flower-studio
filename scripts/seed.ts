import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { db, nowIso, json } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrations";
import { env } from "../src/lib/env";
import { ids } from "../src/lib/ids";
import { hashPassword } from "../src/lib/auth/password";
import { ROLE_PRESETS } from "../src/lib/auth/rbac";
import { SETTING_DEFAULTS, DEFAULT_SLOT_TEMPLATES } from "../src/lib/defaults";
import { addDaysToDateString, bangkokDateString } from "../src/lib/time";


const now = nowIso();

async function seedRoles() {
  for (const preset of ROLE_PRESETS) {
    const existing = await db.selectFrom("roles").select("id").where("slug", "=", preset.slug).executeTakeFirst();
    if (existing) continue;
    await db
      .insertInto("roles")
      .values({
        id: ids.role(),
        slug: preset.slug,
        name: preset.name,
        description: preset.description,
        permissions: json(preset.permissions),
        is_system: preset.isSystem ? 1 : 0,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
}


async function getRoleId(slug: string): Promise<string> {
  const row = await db.selectFrom("roles").select("id").where("slug", "=", slug).executeTakeFirstOrThrow();
  return row.id;
}

async function seedSettings() {
  const entries: Array<[string, unknown]> = [];
  for (const [group, fields] of Object.entries(SETTING_DEFAULTS)) {
    for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
      entries.push([`${group}.${field}`, value]);
    }
  }
  entries.push(["shipping.slotTemplates", DEFAULT_SLOT_TEMPLATES]);

  for (const [key, value] of entries) {
    const existing = await db.selectFrom("store_settings").select("key").where("key", "=", key).executeTakeFirst();
    if (existing) continue;
    await db
      .insertInto("store_settings")
      .values({ key, value: JSON.stringify(value), updated_at: now })
      .execute();
  }
}

async function seedStaff() {
  const superAdminRole = await getRoleId("super_admin");
  const adminRole = await getRoleId("admin");
  const customerRole = await getRoleId("customer");

  const adminEmail = env.seedAdminEmail.toLowerCase();
  const existingAdmin = await db.selectFrom("users").select("id").where("email", "=", adminEmail).executeTakeFirst();
  if (!existingAdmin) {
    await db
      .insertInto("users")
      .values({
        id: ids.user(),
        email: adminEmail,
        email_verified_at: now,
        password_hash: await hashPassword(env.seedAdminPassword),
        name: "Studio Owner",
        phone: null,
        avatar_url: null,
        role_id: superAdminRole,
        status: "active",
        locale: "th",
        marketing_consent: 0,
        last_login_at: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute();
  }

  const managerEmail = "manager@bloome.local";
  const existingManager = await db.selectFrom("users").select("id").where("email", "=", managerEmail).executeTakeFirst();
  if (!existingManager) {
    await db
      .insertInto("users")
      .values({
        id: ids.user(),
        email: managerEmail,
        email_verified_at: now,
        password_hash: await hashPassword("Manager!2026"),
        name: "Operations Manager",
        phone: null,
        avatar_url: null,
        role_id: adminRole,
        status: "active",
        locale: "th",
        marketing_consent: 0,
        last_login_at: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute();
  }

  const customerEmail = "customer@bloome.local";
  let customerId: string | null = null;
  const existingCustomer = await db
    .selectFrom("users")
    .select("id")
    .where("email", "=", customerEmail)
    .executeTakeFirst();
  if (existingCustomer) customerId = existingCustomer.id;
  else {
    customerId = ids.user();
    await db
      .insertInto("users")
      .values({
        id: customerId,
        email: customerEmail,
        email_verified_at: now,
        password_hash: await hashPassword("Customer!2026"),
        name: "คุณลูกค้าตัวอย่าง",
        phone: "0812345678",
        avatar_url: null,
        role_id: customerRole,
        status: "active",
        locale: "th",
        marketing_consent: 1,
        last_login_at: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute();
  }

  // A delivered demo order so the admin dashboard and review flow are testable.
  if (env.seedDemoData && customerId) {
    const existingOrder = await db
      .selectFrom("orders")
      .select("id")
      .where("user_id", "=", customerId)
      .executeTakeFirst();
    if (!existingOrder) {
      await seedDemoOrder(customerId);
    }
  }
}

type CategorySeed = {
  slug: string;
  kind: "category" | "occasion" | "collection";
  nameTh: string;
  nameEn: string;
  descTh: string;
  descEn: string;
  image: string;
};

const categories: CategorySeed[] = [
  { slug: "roses", kind: "category", nameTh: "กุหลาบ", nameEn: "Roses", descTh: "กุหลาบคัดเกรดจากสวนที่ไว้ใจ", descEn: "Graded roses from growers we trust.", image: "" },
  { slug: "tulips", kind: "category", nameTh: "ทิวลิป", nameEn: "Tulips", descTh: "ทิวลิปนำเข้าสดใหม่ทุกสัปดาห์", descEn: "Fresh imported tulips, weekly.", image: "" },
  { slug: "sunflowers", kind: "category", nameTh: "ทานตะวัน", nameEn: "Sunflowers", descTh: "ทานตะวันสีทองอบอุ่น", descEn: "Warm golden sunflowers.", image: "" },
  { slug: "mixed-bouquets", kind: "category", nameTh: "ช่อดอกไม้รวม", nameEn: "Mixed Bouquets", descTh: "งานจัดรวมดอกไม้หลากชนิด", descEn: "Layered arrangements of seasonal stems.", image: "" },
  { slug: "flower-boxes", kind: "category", nameTh: "กล่องดอกไม้", nameEn: "Flower Boxes", descTh: "กล่องดอกไม้สุดหรูพร้อมส่ง", descEn: "Hand-tied boxes, ready to deliver.", image: "" },
  { slug: "preserved-flowers", kind: "category", nameTh: "ดอกไม้แห้งและดอกไม้คงทน", nameEn: "Preserved Flowers", descTh: "ความงามที่อยู่ได้นานเป็นปี", descEn: "Beauty that lasts for seasons.", image: "" },
  { slug: "wedding-flowers", kind: "category", nameTh: "ดอกไม้งานแต่งงาน", nameEn: "Wedding Flowers", descTh: "ช่อเจ้าสาวและงานตกแต่งพิธี", descEn: "Bridal bouquets and ceremony styling.", image: "" },
  { slug: "gift-sets", kind: "category", nameTh: "ชุดของขวัญ", nameEn: "Gift Sets", descTh: "ช่อดอกไม้พร้อมของขวัญเล็ก ๆ", descEn: "Flowers paired with a small gift.", image: "" },
  { slug: "birthday", kind: "occasion", nameTh: "วันเกิด", nameEn: "Birthday", descTh: "ของขวัญวันเกิดที่พูดแทนใจ", descEn: "Birthday flowers that say it all.", image: "" },
  { slug: "anniversary", kind: "occasion", nameTh: "วันครบรอบ", nameEn: "Anniversary", descTh: "ฉลองทุกปีที่ผ่านมาด้วยกัน", descEn: "Celebrate every year together.", image: "" },
  { slug: "valentines-day", kind: "occasion", nameTh: "วาเลนไทน์", nameEn: "Valentine's Day", descTh: "บอกรักในแบบที่ใช่", descEn: "Say it with flowers, your way.", image: "" },
  { slug: "mothers-day", kind: "occasion", nameTh: "วันแม่", nameEn: "Mother's Day", descTh: "ขอบคุณแม่ด้วยดอกไม้", descEn: "Thank mum with something living.", image: "" },
  { slug: "graduation", kind: "occasion", nameTh: "วันสำเร็จการศึกษา", nameEn: "Graduation", descTh: "ฉลองความสำเร็จ", descEn: "Celebrate the milestone.", image: "" },
  { slug: "wedding", kind: "occasion", nameTh: "งานแต่งงาน", nameEn: "Wedding", descTh: "ดอกไม้สำหรับวันสำคัญที่สุด", descEn: "Flowers for the biggest day.", image: "" },
  { slug: "congratulations", kind: "occasion", nameTh: "แสดงความยินดี", nameEn: "Congratulations", descTh: "ยินดีด้วยจากใจ", descEn: "Congratulations, beautifully said.", image: "" },
  { slug: "get-well-soon", kind: "occasion", nameTh: "หายป่วยไว ๆ", nameEn: "Get Well Soon", descTh: "กำลังใจเล็ก ๆ ที่ทำให้วันดีขึ้น", descEn: "A little light for a hard week.", image: "" },
  { slug: "thank-you", kind: "occasion", nameTh: "ขอบคุณ", nameEn: "Thank You", descTh: "คำขอบคุณที่จดจำ", descEn: "Gratitude, hand-tied.", image: "" },
  { slug: "just-because", kind: "occasion", nameTh: "แค่เพราะคิดถึง", nameEn: "Just Because", descTh: "ไม่ต้องรอโอกาสพิเศษ", descEn: "No occasion required.", image: "" },
  { slug: "seasonal-serenity", kind: "collection", nameTh: "คอลเลกชันซีซันนัล ซีรีนิตี้", nameEn: "Seasonal Serenity", descTh: "คอลเลกชันฤดูกาลจำกัดจำนวน", descEn: "Limited seasonal collection.", image: "" },
  { slug: "everlasting", kind: "collection", nameTh: "คอลเลกชันเอเวอร์ลาสติง", nameEn: "Everlasting", descTh: "ดอกไม้คงทนสำหรับคนสำคัญ", descEn: "Preserved pieces for someone lasting.", image: "" },
];

type ProductSeed = {
  slug: string;
  sku: string;
  category: string;
  price: number;
  salePrice?: number;
  flowerType: string;
  flowerColor: string;
  bouquetSize: "S" | "M" | "L";
  flowerCount: number;
  nameTh: string;
  nameEn: string;
  shortTh: string;
  shortEn: string;
  descTh: string;
  descEn: string;
  featured?: boolean;
  stock: number;
  occasion?: string;
};

const products: ProductSeed[] = [
  {
    slug: "blush-romance-bouquet", sku: "BLM-RS-001", category: "roses", price: 289000, salePrice: 259000,
    flowerType: "Rose", flowerColor: "Pink", bouquetSize: "M", flowerCount: 20, stock: 18, featured: true,
    nameTh: "ช่อกุหลาบบลัช โรแมนซ์", nameEn: "Blush Romance Bouquet",
    shortTh: "กุหลาบสีชมพูนุ่ม 20 ดอก ห่อด้วยกระดาษฝ้ายสีงาช้าง",
    shortEn: "Twenty soft pink roses wrapped in ivory cotton paper.",
    descTh: "กุหลาบเอกวาดอร์สีชมพูบลัช 20 ดอก จัดเป็นรูปทรงกลมแบบอังกฤษ ตัดแต่งก้านและใบอย่างประณีต ห่อด้วยกระดาษฝ้ายสีงาช้างและริบบิ้นผ้าไหม เหมาะสำหรับวันครบรอบและคำบอกรักที่เรียบง่าย",
    descEn: "Twenty Ecuadorian blush roses arranged in a rounded English style, finished with ivory cotton paper and a silk ribbon. Designed for anniversaries and quiet declarations.",
  },
  {
    slug: "garden-whisper", sku: "BLM-MX-002", category: "mixed-bouquets", price: 345000,
    flowerType: "Mixed", flowerColor: "Green", bouquetSize: "L", flowerCount: 25, stock: 12, featured: true,
    nameTh: "ช่อสวนกระซิบ", nameEn: "Garden Whisper",
    shortTh: "ช่อรวมดอกไม้สไตล์สวนอังกฤษ โทนเขียวและครีม", shortEn: "A garden-style mix in greens and creams.",
    descTh: "ดอกไม้ตามฤดูกาลหลากชนิด ทั้งสต็อกสีขาว ลิซิแอนทัส และยูคาลิปตัส จัดแบบหลวม ๆ ให้ความรู้สึกเหมือนเพิ่งเก็บจากสวน เหมาะกับโอกาสแสดงความยินดี",
    descEn: "Seasonal stems — white stock, lisianthus and eucalyptus — arranged loosely as though just gathered. Made for congratulations and new beginnings.",
  },
  {
    slug: "golden-hour-sunflowers", sku: "BLM-SF-003", category: "sunflowers", price: 189000,
    flowerType: "Sunflower", flowerColor: "Yellow", bouquetSize: "M", flowerCount: 12, stock: 25,
    nameTh: "ช่อทานตะวันโกลเดนอาวร์", nameEn: "Golden Hour Sunflowers",
    shortTh: "ทานตะวัน 12 ดอก พร้อมใบยูคาลิปตัสหอมอ่อน", shortEn: "Twelve sunflowers with soft eucalyptus.",
    descTh: "ทานตะวันพันธุ์ก้านยาว 12 ดอก คัดดอกที่บานเต็มที่ จัดร่วมกับยูคาลิปตัสและหญ้าตกแต่ง เติมความอบอุ่นให้ทุกห้อง",
    descEn: "Twelve long-stemmed sunflowers at full bloom, paired with eucalyptus and ornamental grass. Instant warmth for any room.",
  },
  {
    slug: "ivory-tulip-poetry", sku: "BLM-TL-004", category: "tulips", price: 245000, salePrice: 225000,
    flowerType: "Tulip", flowerColor: "White", bouquetSize: "M", flowerCount: 15, stock: 14,
    nameTh: "ช่อทิวลิปงาช้าง", nameEn: "Ivory Tulip Poetry",
    shortTh: "ทิวลิปขาว 15 ดอก ห่อกระดาษไข", shortEn: "Fifteen white tulips in waxed paper.",
    descTh: "ทิวลิปขาวนำเข้าจากฮอลแลนด์ 15 ดอก จัดช่อแบบมินิมอล ห่อด้วยกระดาษไขสีขาวและเชือกฝ้ายธรรมชาติ",
    descEn: "Fifteen Dutch white tulips, arranged minimally in white waxed paper with natural cotton twine.",
  },
  {
    slug: "velvet-noir-rose-box", sku: "BLM-BX-005", category: "flower-boxes", price: 420000,
    flowerType: "Rose", flowerColor: "Red", bouquetSize: "L", flowerCount: 24, stock: 8, featured: true,
    nameTh: "กล่องกุหลาบกำมะหยี่", nameEn: "Velvet Noir Rose Box",
    shortTh: "กุหลาบแดงเข้ม 24 ดอก ในกล่องกำมะหยี่", shortEn: "Twenty-four deep red roses in a velvet box.",
    descTh: "กุหลาบแดงเข้ม 24 ดอก จัดแน่นในกล่องกำมะหยี่สีดำ โดดเด่นด้วยริบบิ้นซาติน เก็บความชื้นด้วยฟองน้ำพิเศษ",
    descEn: "Twenty-four deep red roses set densely in a black velvet box, finished with satin ribbon and a hidden water source.",
  },
  {
    slug: "whispering-petals-preserved", sku: "BLM-PR-006", category: "preserved-flowers", price: 320000,
    flowerType: "Preserved", flowerColor: "Beige", bouquetSize: "M", flowerCount: 18, stock: 20,
    nameTh: "ดอกไม้แห้งกระซิบรัก", nameEn: "Whispering Petals",
    shortTh: "ดอกไม้คงทนโทนเบจ อยู่ได้นานกว่า 1 ปี", shortEn: "Preserved stems in beige, lasting over a year.",
    descTh: "ดอกไม้ผ่านกรรมวิธีคงทนตามธรรมชาติ 18 ช่อเล็ก โทนเบจและชมพูอ่อน จัดในแจกันเซรามิก ไม่ต้องรดน้ำ",
    descEn: "Eighteen naturally preserved stems in beige and pale pink, presented in a ceramic vessel. No water required.",
  },
  {
    slug: "bridal-ivory-cascade", sku: "BLM-WD-007", category: "wedding-flowers", price: 750000,
    flowerType: "Rose", flowerColor: "White", bouquetSize: "L", flowerCount: 30, stock: 6,
    nameTh: "ช่อเจ้าสาวงาช้าง", nameEn: "Bridal Ivory Cascade",
    shortTh: "ช่อเจ้าสาวแบบ cascade สีงาช้าง", shortEn: "An ivory cascade bridal bouquet.",
    descTh: "ช่อเจ้าสาวแบบ cascade ด้วยกุหลาบงาช้างและออกแบบร่วมกับดอกไม้เล็ก ๆ สีขาว พร้อมบริการให้คำปรึกษากับนักจัดดอกไม้ของเรา",
    descEn: "A cascade bridal bouquet of ivory roses with delicate white filler, including a consultation with our studio florists.",
  },
  {
    slug: "petite-bloom-gift-set", sku: "BLM-GF-008", category: "gift-sets", price: 159000,
    flowerType: "Mixed", flowerColor: "Pink", bouquetSize: "S", flowerCount: 8, stock: 30,
    nameTh: "ชุดของขวัญพีทีบลูม", nameEn: "Petite Bloom Gift Set",
    shortTh: "ช่อเล็กพร้อมช็อกโกแลตและการ์ดเขียนมือ", shortEn: "A petite bouquet with chocolate and a handwritten card.",
    descTh: "ช่อดอกไม้ขนาดกะทัดรัด 8 ดอก พร้อมช็อกโกแลตเบลเยียมและการ์ดเขียนมือ เหมาะสำหรับของขวัญเร่งด่วน",
    descEn: "An eight-stem petite bouquet with Belgian chocolate and a handwritten card. Our favourite last-minute gift.",
  },
  {
    slug: "meadow-morning", sku: "BLM-MX-009", category: "mixed-bouquets", price: 275000,
    flowerType: "Mixed", flowerColor: "White", bouquetSize: "M", flowerCount: 20, stock: 16,
    nameTh: "ช่อทุ่งหญ้าเช้าวันใหม่", nameEn: "Meadow Morning",
    shortTh: "โทนขาวเขียวสดชื่นสำหรับวันใหม่", shortEn: "A fresh white-and-green start.",
    descTh: "ดอกไม้สีขาวและเขียวตามฤดูกาล จัดแบบธรรมชาติ เน้นความเบาสบาย เหมาะกับการแสดงความยินดีและเยี่ยมผู้ป่วย",
    descEn: "Seasonal whites and greens arranged naturally, light and airy. Made for congratulations and hospital visits.",
  },
  {
    slug: "rose-quartz-duo", sku: "BLM-RS-010", category: "roses", price: 389000,
    flowerType: "Rose", flowerColor: "Pink", bouquetSize: "L", flowerCount: 30, stock: 10, featured: true,
    nameTh: "ช่อกุหลาบควอตซ์คู่ใจ", nameEn: "Rose Quartz Duo",
    shortTh: "กุหลาบชมพูควอตซ์ 30 ดอก สองโทน", shortEn: "Thirty roses in two shades of quartz pink.",
    descTh: "กุหลาบ 30 ดอกในสองเฉดชมพู จัดไล่ระดับตามธรรมชาติ พร้อมใบยูคาลิปตัสและริบบิ้นผ้าลินิน",
    descEn: "Thirty roses in two quartz shades, graded naturally with eucalyptus and a linen ribbon.",
  },
  {
    slug: "sunlit-amber-box", sku: "BLM-BX-011", category: "flower-boxes", price: 365000,
    flowerType: "Mixed", flowerColor: "Orange", bouquetSize: "L", flowerCount: 20, stock: 9,
    nameTh: "กล่องอำพันตะวัน", nameEn: "Sunlit Amber Box",
    shortTh: "กล่องดอกไม้โทนอำพัน warmed tones", shortEn: "A warm amber flower box.",
    descTh: "กล่องดอกไม้ทรงสี่เหลี่ยมผืนผ้า โทนส้มอำพันและครีม ประกอบด้วยกุหลาบ ทานตะวันเล็ก และสแตติส",
    descEn: "A rectangular flower box in amber and cream: roses, petite sunflowers and statice.",
  },
  {
    slug: "everlasting-blush", sku: "BLM-PR-012", category: "preserved-flowers", price: 295000,
    flowerType: "Preserved", flowerColor: "Pink", bouquetSize: "S", flowerCount: 12, stock: 22,
    nameTh: "ช่อบลัชนิรันดร์", nameEn: "Everlasting Blush",
    shortTh: "ดอกไม้คงทนชมพูอ่อนในกล่องใส่อคริลิก", shortEn: "Preserved blush stems in an acrylic case.",
    descTh: "ดอกไม้คงทน 12 ดอก จัดในกล่องอะคริลิกใส พร้อมไฟประดับขนาดเล็ก เหมาะเป็นของขวัญที่อยู่ได้นาน",
    descEn: "Twelve preserved stems in a clear acrylic case with a subtle light. A gift that keeps its shape.",
  },
  {
    slug: "ivory-garden-rose-box", sku: "BLM-BX-013", category: "flower-boxes", price: 475000,
    flowerType: "Rose", flowerColor: "White", bouquetSize: "L", flowerCount: 30, stock: 7, featured: true,
    nameTh: "กล่องกุหลาบสวนงาช้าง", nameEn: "Ivory Garden Rose Box",
    shortTh: "กุหลาบงาช้าง 30 ดอก ในกล่องไม้สีขาว", shortEn: "Thirty ivory garden roses in a white wooden box.",
    descTh: "กุหลาบสวนงาช้าง 30 ดอก จัดแน่นในกล่องไม้สีขาว พร้อมยูคาลิปตัสแทรกเล็กน้อย เหมาะกับงานหมั้นและวันครบรอบ",
    descEn: "Thirty ivory garden roses densely set in a white wooden box with a little eucalyptus. Made for engagements and anniversaries.",
  },
  {
    slug: "peach-sunrise-bouquet", sku: "BLM-MX-014", category: "mixed-bouquets", price: 265000, salePrice: 239000,
    flowerType: "Mixed", flowerColor: "Peach", bouquetSize: "M", flowerCount: 18, stock: 19,
    nameTh: "ช่อพีชซันไรส์", nameEn: "Peach Sunrise Bouquet",
    shortTh: "โทนพีชและครีมสำหรับคำอวยพรที่อบอุ่น", shortEn: "Peach and cream for a warm congratulations.",
    descTh: "ช่อรวมดอกไม้โทนพีช ครีม และชมพูอ่อน 18 ดอก จัดแบบสวนอังกฤษ ห่อด้วยกระดาษคราฟต์นุ่ม",
    descEn: "Eighteen stems in peach, cream and soft pink, arranged in a loose garden style with soft kraft paper.",
  },
  {
    slug: "lavender-dream-tulips", sku: "BLM-TL-015", category: "tulips", price: 229000,
    flowerType: "Tulip", flowerColor: "Purple", bouquetSize: "M", flowerCount: 15, stock: 16,
    nameTh: "ช่อทิวลิปฝันลาเวนเดอร์", nameEn: "Lavender Dream Tulips",
    shortTh: "ทิวลิปม่วงละมุน 15 ดอก", shortEn: "Fifteen soft lavender tulips.",
    descTh: "ทิวลิปนำเข้า 15 ดอกในโทนม่วงอ่อน จัดแบบมินิมอล ห่อด้วยกระดาษไขสีขาว เหมาะกับการเยี่ยมผู้ป่วยและของขวัญขอบคุณ",
    descEn: "Fifteen imported tulips in soft lavender, wrapped minimally in white waxed paper. A gentle gift for hospital visits and thank-yous.",
  },
  {
    slug: "sunflower-serenity-box", sku: "BLM-SF-016", category: "sunflowers", price: 315000,
    flowerType: "Sunflower", flowerColor: "Yellow", bouquetSize: "M", flowerCount: 10, stock: 12,
    nameTh: "กล่องทานตะวันซีรีนิตี้", nameEn: "Sunflower Serenity Box",
    shortTh: "ทานตะวันในกล่องไม้พร้อมหญ้าตกแต่ง", shortEn: "Sunflowers in a wooden box with dried grasses.",
    descTh: "ทานตะวัน 10 ดอก จัดในกล่องไม้สีธรรมชาติ ตัดกับหญ้าแห้งและสแตติส เหมาะเป็นกำลังใจ",
    descEn: "Ten sunflowers in a natural wooden box, contrasted with dried grasses and statice. Made to lift a day.",
  },
  {
    slug: "midnight-rose-noir", sku: "BLM-RS-017", category: "roses", price: 359000,
    flowerType: "Rose", flowerColor: "Red", bouquetSize: "M", flowerCount: 24, stock: 14, featured: true,
    nameTh: "ช่อกุหลาบมิดไนท์นัวร์", nameEn: "Midnight Rose Noir",
    shortTh: "กุหลาบแดงเข้ม 24 ดอก ห่อดำด้าน", shortEn: "Twenty-four deep red roses in matte black wrap.",
    descTh: "กุหลาบแดงเข้ม 24 ดอก ห่อด้วยกระดาษดำด้านและริบบิ้นซาติน โดดเด่นด้วยคอนทราสต์ที่เรียบหรู",
    descEn: "Twenty-four deep red roses in matte black paper with a satin ribbon. Quiet, dramatic, unmistakable.",
  },
  {
    slug: "porcelain-peony-cloud", sku: "BLM-MX-018", category: "mixed-bouquets", price: 398000,
    flowerType: "Peony", flowerColor: "White", bouquetSize: "L", flowerCount: 20, stock: 9,
    nameTh: "ช่อพีโอนีงาช้าง", nameEn: "Porcelain Peony Cloud",
    shortTh: "พีโอนีขาวครีม 20 ดอก กลิ่นหอมอ่อน", shortEn: "Twenty cream peonies with a soft scent.",
    descTh: "พีโอนีนำเข้า 20 ดอก โทนขาวงาช้าง จัดเป็นช่อกลมหลวม ๆ พร้อมใบสไตล์ธรรมชาติ เหมาะกับงานแต่งและวันแม่",
    descEn: "Twenty imported peonies in ivory cream, gathered loosely with natural foliage. For weddings and mothers.",
  },
  {
    slug: "terracotta-sunset-box", sku: "BLM-BX-019", category: "flower-boxes", price: 385000,
    flowerType: "Mixed", flowerColor: "Orange", bouquetSize: "L", flowerCount: 22, stock: 10,
    nameTh: "กล่องเทอร์ราคอตตาซันเซ็ต", nameEn: "Terracotta Sunset Box",
    shortTh: "กล่องดอกไม้โทนส้มอิฐและครีม", shortEn: "A terracotta and cream flower box.",
    descTh: "ดอกไม้โทนส้มอิฐ ครีม และน้ำตาลอ่อน 22 ดอก จัดในกล่องไม้กลม อบอุ่นและร่วมสมัย",
    descEn: "Twenty-two stems in terracotta, cream and soft tan, set in a round wooden box. Warm and contemporary.",
  },
  {
    slug: "eucalyptus-calm", sku: "BLM-PR-020", category: "preserved-flowers", price: 245000,
    flowerType: "Preserved", flowerColor: "Green", bouquetSize: "S", flowerCount: 14, stock: 25,
    nameTh: "ช่อยูคาลิปตัสสงบ", nameEn: "Eucalyptus Calm",
    shortTh: "ยูคาลิปตัสคงทนและหญ้าแห้งโทนเขียว", shortEn: "Preserved eucalyptus and dried grasses.",
    descTh: "ยูคาลิปตัสคงทน 14 ก้าน จัดร่วมกับหญ้าแห้งโทนเขียวเทา ให้ความสงบและอยู่ได้นานกว่าหนึ่งปี",
    descEn: "Fourteen preserved eucalyptus stems with grey-green dried grasses. Calm, sculptural, lasting over a year.",
  },
  {
    slug: "bridal-blush-veil", sku: "BLM-WD-021", category: "wedding-flowers", price: 890000,
    flowerType: "Rose", flowerColor: "Blush", bouquetSize: "L", flowerCount: 36, stock: 5,
    nameTh: "ช่อเจ้าสาวบลัชเวล", nameEn: "Bridal Blush Veil",
    shortTh: "ช่อเจ้าสาวกุหลาบบลัชและพีโอนี", shortEn: "A bridal bouquet of blush roses and peonies.",
    descTh: "ช่อเจ้าสาวแบบถือมือ ด้วยกุหลาบบลัชและพีโอนีขาว 36 ดอก พร้อมริบบิ้นผ้าไหมและบริการให้คำปรึกษา",
    descEn: "A hand-tied bridal bouquet of blush roses and white peonies, finished with silk ribbon, including a studio consultation.",
  },
  {
    slug: "golden-graduation-bouquet", sku: "BLM-MX-022", category: "mixed-bouquets", price: 235000,
    flowerType: "Mixed", flowerColor: "Yellow", bouquetSize: "M", flowerCount: 16, stock: 21,
    nameTh: "ช่อรับปริญญาโกลเดน", nameEn: "Golden Graduation Bouquet",
    shortTh: "ช่อรับปริญญาโทนทองพร้อมริบบิ้น", shortEn: "A gold-toned graduation bouquet with ribbon.",
    descTh: "ช่อสำหรับวันรับปริญญา 16 ดอก โทนเหลืองทองและครีม พร้อมริบบิ้นสีทองสำหรับหิ้วถ่ายรูป",
    descEn: "Sixteen stems in gold and cream with a gold carrying ribbon — made for photos on graduation day.",
  },
  {
    slug: "sweet-pea-petite", sku: "BLM-GF-023", category: "gift-sets", price: 169000, salePrice: 149000,
    flowerType: "Mixed", flowerColor: "Pink", bouquetSize: "S", flowerCount: 7, stock: 28,
    nameTh: "ช่อเล็กสวีทพี", nameEn: "Sweet Pea Petite",
    shortTh: "ช่อเล็ก 7 ดอกพร้อมช็อกโกแลต", shortEn: "Seven stems with chocolate.",
    descTh: "ช่อเล็ก 7 ดอกโทนชมพูอ่อน พร้อมช็อกโกแลตเบลเยียมและการ์ดเขียนมือ เหมาะกับของขวัญวันเกิดและคำขอบคุณ",
    descEn: "Seven soft pink stems with Belgian chocolate and a handwritten card. For birthdays and thank-yous.",
  },
  {
    slug: "garden-rose-basket", sku: "BLM-RS-024", category: "roses", price: 329000,
    flowerType: "Rose", flowerColor: "Cream", bouquetSize: "M", flowerCount: 22, stock: 13,
    nameTh: "ตะกร้ากุหลาบสวน", nameEn: "Garden Rose Basket",
    shortTh: "กุหลาบสวน 22 ดอกในตะกร้าหวาย", shortEn: "Twenty-two garden roses in a woven basket.",
    descTh: "กุหลาบสวนโทนครีม 22 ดอก จัดในตะกร้าหวายพร้อมใบไม้ เหมาะกับวันแม่และการขอบคุณ",
    descEn: "Twenty-two cream garden roses in a woven basket with foliage. A Mother's Day and thank-you favourite.",
  },
  {
    slug: "dried-lavender-bundle", sku: "BLM-PR-025", category: "preserved-flowers", price: 189000,
    flowerType: "Preserved", flowerColor: "Purple", bouquetSize: "S", flowerCount: 10, stock: 26,
    nameTh: "ช่อลาเวนเดอร์อบแห้ง", nameEn: "Dried Lavender Bundle",
    shortTh: "ลาเวนเดอร์อบแห้ง 10 ก้าน กลิ่นอ่อน", shortEn: "Ten dried lavender stems with a soft scent.",
    descTh: "ลาเวนเดอร์อบแห้ง 10 ก้าน มัดด้วยเชือกฝ้ายธรรมชาติ กลิ่นอ่อนHelpให้รู้สึกผ่อนคลาย ใช้ตกแต่งห้องหรือเป็นของขวัญเล็ก ๆ",
    descEn: "Ten dried lavender stems tied with natural cotton twine. A calm, subtle gift for a bedside or desk.",
  },
  {
    slug: "celebration-confetti-box", sku: "BLM-BX-026", category: "flower-boxes", price: 415000,
    flowerType: "Mixed", flowerColor: "Mixed", bouquetSize: "L", flowerCount: 24, stock: 8,
    nameTh: "กล่องฉลองคอนเฟตติ", nameEn: "Celebration Confetti Box",
    shortTh: "กล่องดอกไม้หลากสีสำหรับวันฉลอง", shortEn: "A multicolour box for a celebration.",
    descTh: "กล่องดอกไม้ 24 ดอก หลากสีสัน ประกอบด้วยกุหลาบ ดอกการ์ดิ้น และสแตติส เหมาะกับวันรับปริญญาและการแสดงความยินดี",
    descEn: "Twenty-four stems in mixed colour — roses, geraldton wax and statice — for graduations and congratulations.",
  },
  {
    slug: "sunday-market-tulips", sku: "BLM-TL-027", category: "tulips", price: 215000,
    flowerType: "Tulip", flowerColor: "Mixed", bouquetSize: "M", flowerCount: 14, stock: 18,
    nameTh: "ช่อทิวลิปซันเดย์มาร์เก็ต", nameEn: "Sunday Market Tulips",
    shortTh: "ทิวลิปหลากสี 14 ดอก สดใส", shortEn: "Fourteen mixed tulips, bright and easy.",
    descTh: "ทิวลิป 14 ดอกคละสีสัน จัดแบบสบาย ๆ เหมือนเพิ่งเลือกจากตลาดเช้า เหมาะกับของขวัญแค่เพราะคิดถึง",
    descEn: "Fourteen mixed tulips arranged loosely, as though just carried home from the morning market.",
  },
];

/** Occasion categories each product should appear under (by product slug). */
const productOccasions: Record<string, string[]> = {
  "blush-romance-bouquet": ["valentines-day", "anniversary", "birthday"],
  "garden-whisper": ["birthday", "congratulations", "thank-you"],
  "golden-hour-sunflowers": ["birthday", "get-well-soon", "thank-you"],
  "ivory-tulip-poetry": ["just-because", "mothers-day", "anniversary"],
  "velvet-noir-rose-box": ["valentines-day", "anniversary", "wedding"],
  "whispering-petals-preserved": ["just-because", "get-well-soon"],
  "bridal-ivory-cascade": ["wedding", "anniversary"],
  "petite-bloom-gift-set": ["birthday", "thank-you", "graduation"],
  "meadow-morning": ["get-well-soon", "congratulations", "thank-you"],
  "rose-quartz-duo": ["anniversary", "valentines-day", "birthday"],
  "sunlit-amber-box": ["birthday", "congratulations"],
  "everlasting-blush": ["just-because", "mothers-day"],
  "ivory-garden-rose-box": ["anniversary", "valentines-day", "wedding"],
  "peach-sunrise-bouquet": ["birthday", "congratulations", "thank-you"],
  "lavender-dream-tulips": ["just-because", "mothers-day", "get-well-soon"],
  "sunflower-serenity-box": ["get-well-soon", "thank-you", "congratulations"],
  "midnight-rose-noir": ["valentines-day", "anniversary", "wedding"],
  "porcelain-peony-cloud": ["mothers-day", "wedding", "anniversary"],
  "terracotta-sunset-box": ["birthday", "congratulations"],
  "eucalyptus-calm": ["get-well-soon", "just-because"],
  "bridal-blush-veil": ["wedding", "anniversary"],
  "golden-graduation-bouquet": ["graduation", "congratulations"],
  "sweet-pea-petite": ["birthday", "thank-you", "just-because"],
  "garden-rose-basket": ["mothers-day", "birthday", "thank-you"],
  "dried-lavender-bundle": ["just-because", "get-well-soon"],
  "celebration-confetti-box": ["graduation", "congratulations", "birthday"],
  "sunday-market-tulips": ["just-because", "birthday", "thank-you"],
};

async function seedCategories(images: string[]) {
  for (let index = 0; index < categories.length; index += 1) {
    const category = categories[index];
    const existing = await db.selectFrom("categories").select("id").where("slug", "=", category.slug).executeTakeFirst();
    if (existing) continue;
    const id = ids.category();
    const image = images.length > 0 ? images[index % images.length] : null;
    await db
      .insertInto("categories")
      .values({
        id,
        slug: category.slug,
        parent_id: null,
        image_url: image,
        sort_order: index,
        status: "active",
        kind: category.kind,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute();
    for (const locale of ["th", "en"] as const) {
      await db
        .insertInto("category_translations")
        .values({
          id: ids.role(),
          category_id: id,
          locale,
          name: locale === "th" ? category.nameTh : category.nameEn,
          description: locale === "th" ? category.descTh : category.descEn,
          meta_title: locale === "th" ? category.nameTh : category.nameEn,
          meta_description: locale === "th" ? category.descTh : category.descEn,
          created_at: now,
          updated_at: now,
        })
        .execute();
    }
  }
}

async function seedProducts(images: string[]) {
  const admin = await db.selectFrom("users").select("id").where("email", "=", env.seedAdminEmail.toLowerCase()).executeTakeFirst();

  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const existing = await db.selectFrom("products").select("id").where("slug", "=", product.slug).executeTakeFirst();
    if (existing) continue;
    const category = await db.selectFrom("categories").select("id").where("slug", "=", product.category).executeTakeFirst();
    const id = ids.product();
    const heroImage = images.length > 0 ? images[(index * 2) % images.length] : null;
    const secondImage = images.length > 0 ? images[(index * 2 + 1) % images.length] : null;

    await db
      .insertInto("products")
      .values({
        id,
        sku: product.sku,
        slug: product.slug,
        category_id: category?.id ?? null,
        type: product.category === "flower-boxes" ? "box" : product.category === "preserved-flowers" ? "preserved" : product.category === "gift-sets" ? "gift" : "bouquet",
        status: "published",
        published_at: new Date(Date.now() - index * 86_400_000).toISOString(),
        featured: product.featured ? 1 : 0,
        new_arrival: index < 6 ? 1 : 0,
        price: product.price,
        sale_price: product.salePrice ?? null,
        cost_price: Math.round(product.price * 0.55),
        stock_quantity: product.stock,
        low_stock_threshold: 5,
        weight_grams: 1200,
        length_cm: 60,
        width_cm: 40,
        height_cm: 30,
        flower_type: product.flowerType,
        flower_color: product.flowerColor,
        bouquet_size: product.bouquetSize,
        flower_count: product.flowerCount,
        sold_count: 0,
        view_count: 40 + index * 7,
        created_by: admin?.id ?? null,
        created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
        updated_at: now,
        deleted_at: null,
        archived_at: null,
      })
      .execute();

    await db
      .insertInto("product_translations")
      .values({
        id: ids.product(),
        product_id: id,
        locale: "th",
        name: product.nameTh,
        short_description: product.shortTh,
        description: product.descTh,
        care_instructions:
          "ตัดก้านเฉียง 2 ซม. เปลี่ยนน้ำทุก 2 วัน และวางให้ห่างจากแสงแดดโดยตรง",
        delivery_information: "จัดส่งภายในกรุงเทพฯ และปริมณฑล สั่งก่อน 14:00 น. ส่งได้ภายในวันเดียวกัน",
        meta_title: `${product.nameTh} | BLOOMÉ`,
        meta_description: product.shortTh,
        created_at: now,
        updated_at: now,
      })
      .execute();

    await db
      .insertInto("product_translations")
      .values({
        id: ids.product(),
        product_id: id,
        locale: "en",
        name: product.nameEn,
        short_description: product.shortEn,
        description: product.descEn,
        care_instructions:
          "Trim stems at an angle, refresh the water every two days and keep away from direct sunlight.",
        delivery_information: "Delivered across Bangkok and surrounding provinces. Order before 14:00 for same-day delivery.",
        meta_title: `${product.nameEn} | BLOOMÉ`,
        meta_description: product.shortEn,
        created_at: now,
        updated_at: now,
      })
      .execute();

    if (heroImage && secondImage) {
    await db
      .insertInto("product_images")
      .values([
        {
          id: ids.productImage(),
          product_id: id,
          url: heroImage,
          alt_th: `${product.nameTh} — BLOOMÉ FLOWER STUDIO`,
          alt_en: `${product.nameEn} — BLOOMÉ FLOWER STUDIO`,
          sort_order: 0,
          width: 900,
          height: 1180,
          created_at: now,
        },
        {
          id: ids.productImage(),
          product_id: id,
          url: secondImage,
          alt_th: `${product.nameTh} รายละเอียด`,
          alt_en: `${product.nameEn} detail`,
          sort_order: 1,
          width: 900,
          height: 1180,
          created_at: now,
        },
      ])
      .execute();
    }

    if (["roses", "mixed-bouquets", "flower-boxes"].includes(product.category)) {
      const variants = [
        { labelTh: "เล็ก", labelEn: "Small", delta: -20000, stock: Math.max(2, Math.floor(product.stock / 3)) },
        { labelTh: "กลาง", labelEn: "Medium", delta: 0, stock: Math.max(2, Math.floor(product.stock / 3)) },
        { labelTh: "ใหญ่", labelEn: "Large", delta: 45000, stock: Math.max(1, Math.floor(product.stock / 3)) },
      ];
      for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
        const variant = variants[variantIndex];
        await db
          .insertInto("product_variants")
          .values({
            id: ids.variant(),
            product_id: id,
            sku: `${product.sku}-${variant.labelEn.slice(0, 1)}`,
            name_th: variant.labelTh,
            name_en: variant.labelEn,
            price_delta: variant.delta,
            stock_quantity: variant.stock,
            image_url: null,
            status: "active",
            sort_order: variantIndex,
            created_at: now,
            updated_at: now,
          })
          .execute();
      }
    }
  }
}

async function seedProductOccasions() {
  const occasions = await db
    .selectFrom("categories")
    .select(["id", "slug"])
    .where("kind", "=", "occasion")
    .execute();
  const occasionBySlug = new Map(occasions.map((row) => [row.slug, row.id]));
  const products = await db.selectFrom("products").select(["id", "slug"]).execute();

  for (const product of products) {
    const slugs = productOccasions[product.slug];
    if (!slugs) continue;
    await db.deleteFrom("product_occasions").where("product_id", "=", product.id).execute();
    let order = 0;
    for (const slug of slugs) {
      const occasionId = occasionBySlug.get(slug);
      if (!occasionId) continue;
      await db
        .insertInto("product_occasions")
        .values({ product_id: product.id, occasion_id: occasionId, sort_order: order })
        .execute();
      order += 1;
    }
  }
}

async function seedRealImages() {
  const px = (key: string, index: number) => `/images/demo/${key}-${String(index).padStart(2, "0")}.webp`;

  const productImages: Record<string, [string, string]> = {
    "blush-romance-bouquet": [px("pinkroses", 7), px("pinkroses", 10)],
    "garden-whisper": [px("mixed", 2), px("florist", 5)],
    "golden-hour-sunflowers": [px("sunflowers", 10), px("sunflowers", 1)],
    "ivory-tulip-poetry": [px("whitetulips", 5), px("whitetulips", 6)],
    "velvet-noir-rose-box": [px("box", 8), px("box", 7)],
    "whispering-petals-preserved": [px("dried", 1), px("dried", 9)],
    "bridal-ivory-cascade": [px("bridal", 1), px("bridal", 10)],
    "petite-bloom-gift-set": [px("whitebox", 1), px("birthday", 4)],
    "meadow-morning": [px("getwell", 10), px("getwell", 7)],
    "rose-quartz-duo": [px("pinkroses", 1), px("pinkroses", 8)],
    "sunlit-amber-box": [px("peonies", 8), px("peonies", 9)],
    "everlasting-blush": [px("dried", 3), px("dried", 5)],
    "ivory-garden-rose-box": [px("whiteroses", 3), px("whitebox", 1)],
    "peach-sunrise-bouquet": [px("roses", 5), px("roses", 4)],
    "lavender-dream-tulips": [px("purpletulips", 1), px("tulips", 3)],
    "sunflower-serenity-box": [px("sunflowers", 2), px("sunflowers", 1)],
    "midnight-rose-noir": [px("roses", 3), px("roses", 6)],
    "porcelain-peony-cloud": [px("peonies", 7), px("peonies", 3)],
    "terracotta-sunset-box": [px("box", 10), px("box", 9)],
    "eucalyptus-calm": [px("eucalyptus2", 1), px("eucalyptus2", 3)],
    "bridal-blush-veil": [px("bridal", 5), px("bridal", 9)],
    "golden-graduation-bouquet": [px("colorful2", 1), px("graduation2", 1)],
    "sweet-pea-petite": [px("birthday", 7), px("birthday", 4)],
    "garden-rose-basket": [px("box", 1), px("roses", 2)],
    "dried-lavender-bundle": [px("lavender", 6), px("lavender", 1)],
    "celebration-confetti-box": [px("box", 10), px("colorful2", 2)],
    "sunday-market-tulips": [px("tulips", 6), px("tulips", 1)],
  };

  const categoryImages: Record<string, string> = {
    roses: px("roses", 4),
    tulips: px("tulips", 4),
    sunflowers: px("sunflowers", 10),
    "mixed-bouquets": px("mixed", 2),
    "flower-boxes": px("box", 8),
    "preserved-flowers": px("dried", 3),
    "wedding-flowers": px("bridal", 5),
    "gift-sets": px("whitebox", 1),
    "seasonal-serenity": px("mixed", 5),
    everlasting: px("dried", 1),
    birthday: px("birthday", 7),
    anniversary: px("peonies", 9),
    "valentines-day": px("box", 2),
    "mothers-day": px("peonies", 3),
    graduation: px("colorful2", 1),
    wedding: px("wedding", 8),
    congratulations: px("florist", 3),
    "get-well-soon": px("getwell", 9),
    "thank-you": px("whiteroses", 3),
    "just-because": px("roses", 10),
  };

  const products = await db
    .selectFrom("products")
    .innerJoin("product_translations as th", (join) =>
      join.onRef("th.product_id", "=", "products.id").on("th.locale", "=", "th"),
    )
    .innerJoin("product_translations as en", (join) =>
      join.onRef("en.product_id", "=", "products.id").on("en.locale", "=", "en"),
    )
    .select(["products.id", "products.slug", "th.name as name_th", "en.name as name_en"])
    .execute();

  for (const product of products) {
    const images = productImages[product.slug];
    if (!images) continue;
    const now = nowIso();
    await db.deleteFrom("product_images").where("product_id", "=", product.id).execute();
    for (let index = 0; index < images.length; index += 1) {
      await db
        .insertInto("product_images")
        .values({
          id: ids.productImage(),
          product_id: product.id,
          url: images[index],
          alt_th: `${product.name_th} — ดอกไม้จริงจาก BLOOMÉ`,
          alt_en: `${product.name_en} — real flowers from BLOOMÉ`,
          sort_order: index,
          width: 1500,
          height: 2000,
          created_at: now,
        })
        .execute();
    }
  }

  for (const [slug, url] of Object.entries(categoryImages)) {
    await db.updateTable("categories").set({ image_url: url, updated_at: nowIso() }).where("slug", "=", slug).execute();
  }

  await db.updateTable("banners").set({ image_url: px("florist", 8) }).where("placement", "=", "home_hero").execute();
  await db.updateTable("banners").set({ image_url: px("peonies", 8) }).where("placement", "=", "home_special").execute();

  const blogCovers: Record<string, string> = {
    "how-to-choose-flowers": px("mixed", 6),
    "flower-care-basics": px("florist", 5),
    "wedding-flower-timeline": px("wedding", 7),
  };
  for (const [slug, url] of Object.entries(blogCovers)) {
    await db.updateTable("blog_posts").set({ cover_image: url }).where("slug", "=", slug).execute();
  }

  const careImages: Record<string, string> = {
    roses: px("roses", 6),
    tulips: px("tulips", 3),
    boxes: px("box", 9),
    preserved: px("dried", 3),
  };
  for (const [slug, url] of Object.entries(careImages)) {
    await db.updateTable("care_guides").set({ image_url: url }).where("slug", "=", slug).execute();
  }

  const gallery = [px("florist", 8), px("shop", 8), px("peonies", 1), px("colorful2", 1), px("dried", 1), px("bridal", 10)];
  await db.deleteFrom("site_gallery").execute();
  for (let index = 0; index < gallery.length; index += 1) {
    await db
      .insertInto("site_gallery")
      .values({
        id: ids.gallery(),
        image_url: gallery[index],
        link_url: "https://www.pexels.com",
        caption: "BLOOMÉ studio",
        sort_order: index,
        status: "active",
        created_at: nowIso(),
      })
      .execute();
  }
}

function ensureRealPhotos() {
  const manifestPath = path.join(process.cwd(), "public", "photo-credits.json");
  const readManifest = (): Array<{ file: string }> => {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, Array<{ file: string }>>;
      return Object.values(parsed).flat();
    } catch {
      return [];
    }
  };
  const files = readManifest();
  const missing = files.filter((entry) => !entry?.file || !existsSync(path.join(process.cwd(), "public", entry.file)));
  if (files.length === 0 || missing.length > 0) {
    throw new Error(
      `Demo photography missing (${missing.length} files). Restore public/images/demo or run npm run photos, then re-run the seed.`,
    );
  }
}

async function seedAddons() {
  const addons = [
    { sku: "ADD-CARD", th: "การ์ดอวยพรเขียนมือ", en: "Handwritten greeting card", price: 0 },
    { sku: "ADD-BOX", th: "กล่องของขวัญพรีเมียม", en: "Premium gift box", price: 15000 },
    { sku: "ADD-TEDDY", th: "ตุ๊กตาหมี", en: "Teddy bear", price: 45000 },
    { sku: "ADD-CHOC", th: "ช็อกโกแลตเบลเยียม", en: "Belgian chocolate", price: 25000 },
    { sku: "ADD-WRAP", th: "ห่อของขวัญพิเศษ", en: "Premium wrapping", price: 10000 },
    { sku: "ADD-EXTRA", th: "ดอกไม้เพิ่ม 5 ดอก", en: "Five extra stems", price: 35000 },
  ];
  for (let index = 0; index < addons.length; index += 1) {
    const addon = addons[index];
    const existing = await db.selectFrom("addons").select("id").where("sku", "=", addon.sku).executeTakeFirst();
    if (existing) continue;
    await db
      .insertInto("addons")
      .values({
        id: ids.addon(),
        sku: addon.sku,
        name_th: addon.th,
        name_en: addon.en,
        price: addon.price,
        stock_quantity: null,
        image_url: null,
        status: "active",
        sort_order: index,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
}

async function seedContent(images: string[]) {
  const banners = [
    {
      placement: "home_hero",
      titleTh: "ส่งต่อความรู้สึก ผ่านดอกไม้ที่ตั้งใจจัด",
      titleEn: "Thoughtfully arranged, beautifully delivered.",
      subtitleTh: "ดอกไม้คัดสรร จัดโดยนักออกแบบดอกไม้มืออาชีพ ส่งตรงถึงมือผู้รับในวันที่สำคัญที่สุด",
      subtitleEn: "Seasonal stems selected each morning and arranged by our studio florists.",
      imageUrl: images[0] ?? null,
      linkUrl: "/shop",
      ctaTh: "เลือกช่อดอกไม้",
      ctaEn: "Shop bouquets",
      sortOrder: 0,
    },
    {
      placement: "announcement",
      titleTh: "ส่งฟรีเมื่อซื้อครบ 1,500 บาท",
      titleEn: "Free delivery on orders over THB 1,500",
      subtitleTh: null,
      subtitleEn: null,
      imageUrl: null,
      linkUrl: "/shop",
      ctaTh: null,
      ctaEn: null,
      sortOrder: 0,
    },
    {
      placement: "announcement",
      titleTh: "สั่งก่อน 14:00 น. รับดอกไม้ภายในวันนี้",
      titleEn: "Order before 14:00 for same-day delivery",
      subtitleTh: null,
      subtitleEn: null,
      imageUrl: null,
      linkUrl: "/faq",
      ctaTh: null,
      ctaEn: null,
      sortOrder: 1,
    },
    {
      placement: "home_special",
      titleTh: "คอลเลกชันซีซันนัล ซีรีนิตี้",
      titleEn: "Seasonal Serenity",
      subtitleTh: "ออกแบบจำกัดจำนวนในแต่ละฤดูกาล",
      subtitleEn: "Limited seasonal designs, made in small batches.",
      imageUrl: images[1] ?? null,
      linkUrl: "/category/seasonal-serenity",
      ctaTh: "ดูคอลเลกชัน",
      ctaEn: "View collection",
      sortOrder: 0,
    },
  ];
  for (const banner of banners) {
    const existing = await db
      .selectFrom("banners")
      .select("id")
      .where("placement", "=", banner.placement)
      .where("title_th", "=", banner.titleTh)
      .executeTakeFirst();
    if (existing) continue;
    await db
      .insertInto("banners")
      .values({
        id: ids.banner(),
        placement: banner.placement,
        title_th: banner.titleTh,
        title_en: banner.titleEn,
        subtitle_th: banner.subtitleTh,
        subtitle_en: banner.subtitleEn,
        image_url: banner.imageUrl,
        link_url: banner.linkUrl,
        cta_th: banner.ctaTh,
        cta_en: banner.ctaEn,
        sort_order: banner.sortOrder,
        status: "active",
        starts_at: null,
        ends_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }

  const pages = [
    {
      slug: "about",
      template: "about",
      th: ["เรื่องราวของ BLOOMÉ", "BLOOMÉ เริ่มต้นจากโต๊ะเล็ก ๆ ในย่านสุขุมวิท ปี 2560 ด้วยความเชื่อว่าดอกไม้คือภาษาที่ตรงที่สุด\n\nวันนี้เราทำงานร่วมกับสวนในเชียงใหม่ ปทุมธานี และราชบุรี เลือกดอกไม้ในเช้าของวันส่งมอบ จัดโดยนักออกแบบของสตูดิโอ และส่งตรงถึงมือผู้รับด้วยทีมของเราเอง\n\nเราใส่ใจทั้งความสวยงามและความยั่งยืน ลดการใช้พลาสติก ใช้กระดาษรีไซเคิล และคืนวัสดุเหลือใช้ให้สวนเพื่อทำปุ๋ย"],
      en: ["Our story", "BLOOMÉ began at a small table in Sukhumvit in 2017, with the belief that flowers are the most direct language we have.\n\nToday we work with growers in Chiang Mai, Pathum Thani and Ratchaburi, select stems on the morning of delivery, arrange them in our studio and deliver with our own team.\n\nWe care about beauty and about waste: recycled paper, minimal plastic, and green waste returned to the farms as compost."],
    },
    {
      slug: "contact",
      template: "contact",
      th: ["ติดต่อสตูดิโอ", "เรายินดีให้คำปรึกษาเรื่องดอกไม้สำหรับงานแต่งงาน องค์กร และของขวัญพิเศษ\n\nโทร 02-000-0000 · อีเมล hello@bloome.studio\nLine: @bloome\n\nเปิดทุกวัน 09:00 – 19:00 น."],
      en: ["Visit the studio", "We are happy to advise on wedding, corporate and gifting flowers.\n\nCall 02-000-0000 · Email hello@bloome.studio\nLINE: @bloome\n\nOpen daily 09:00 – 19:00."],
    },
    {
      slug: "privacy-policy",
      template: "policy",
      th: ["นโยบายความเป็นส่วนตัว", "เราเก็บรวบรวมข้อมูลที่จำเป็นต่อการให้บริการ ได้แก่ ชื่อ ที่อยู่ เบอร์โทรศัพท์ และอีเมล เพื่อการจัดส่งและการติดต่อเกี่ยวกับคำสั่งซื้อ\n\nเราไม่ขายข้อมูลส่วนบุคคลของท่านให้บุคคลที่สาม ข้อมูลบัตรชำระเงินไม่ถูกจัดเก็บในระบบของเรา\n\nท่านสามารถขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลได้โดยติดต่อ hello@bloome.studio ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562"],
      en: ["Privacy policy", "We collect only the data required to fulfil your order: name, address, phone and email for delivery and order communication.\n\nWe never sell personal data. Card details are never stored on our servers.\n\nUnder Thailand's PDPA you may request access, correction or deletion by writing to hello@bloome.studio."],
    },
    {
      slug: "terms",
      template: "policy",
      th: ["ข้อกำหนดการใช้งาน", "การสั่งซื้อถือเป็นสัญญาระหว่างท่านกับ BLOOMÉ FLOWER STUDIO ราคาสินค้าคำนวณและยืนยันโดยระบบของเรา ณ เวลาที่สั่งซื้อ\n\nรูปภาพสินค้าเป็นตัวอย่าง ดอกไม้ตามฤดูกาลอาจมีความแตกต่างเล็กน้อยในด้านชนิดและเฉดสี โดยคงไว้ซึ่งบรรยากาศและมูลค่าโดยรวม\n\nห้ามใช้เว็บไซต์ในทางที่ผิดกฎหมายหรือละเมิดสิทธิ์ผู้อื่น"],
      en: ["Terms of service", "Placing an order forms a contract between you and BLOOMÉ FLOWER STUDIO. Prices are calculated and confirmed by our system at the time of ordering.\n\nPhotographs are indicative: seasonal flowers may vary slightly in variety and shade while preserving the overall look and value.\n\nYou may not use this site for unlawful purposes or to infringe the rights of others."],
    },
    {
      slug: "shipping-policy",
      template: "policy",
      th: ["นโยบายการจัดส่ง", "เราจัดส่งทั่วกรุงเทพฯ และปริมณฑล สั่งก่อน 14:00 น. เพื่อรับภายในวันเดียวกัน (ขึ้นอยู่กับพื้นที่และช่วงเวลาที่ว่าง)\n\nค่าจัดส่ง 150 บาท ฟรีเมื่อซื้อครบ 1,500 บาท\n\nผู้รับจะได้รับแจ้งเตือนก่อนถึงเวลาจัดส่ง หากไม่สามารถติดต่อผู้รับได้ ทีมงานจะติดต่อผู้สั่งซื้อทันที"],
      en: ["Shipping policy", "We deliver across Bangkok and surrounding provinces. Order before 14:00 for same-day delivery, subject to area and slot availability.\n\nDelivery is THB 150, free on orders over THB 1,500.\n\nThe recipient receives a notification before arrival. If we cannot reach them, we contact the sender immediately."],
    },
    {
      slug: "returns",
      template: "policy",
      th: ["นโยบายการคืนและคืนเงิน", "หากดอกไม้เสียหายหรือไม่ตรงตามที่สั่ง กรุณาแจ้งพร้อมภาพถ่ายภายใน 24 ชั่วโมงหลังได้รับสินค้า\n\nเราจะจัดส่งใหม่หรือคืนเงินตามความเหมาะสม การคืนเงินจะดำเนินการผ่านช่องทางเดิมภายใน 7–14 วันทำการ\n\nดอกไม้เป็นสินค้าที่เสื่อมสภาพเร็ว จึงไม่สามารถรับคืนได้หากแจ้งหลัง 24 ชั่วโมง"],
      en: ["Returns and refunds", "If your flowers arrive damaged or incorrect, contact us with photographs within 24 hours of delivery.\n\nWe will arrange a replacement or refund as appropriate. Refunds are issued to the original payment method within 7–14 business days.\n\nBecause flowers are perishable, we cannot accept claims after 24 hours."],
    },
    {
      slug: "cookie-policy",
      template: "policy",
      th: ["นโยบายคุกกี้", "เราใช้คุกกี้ที่จำเป็นต่อการทำงานของเว็บไซต์ เช่น การเข้าสู่ระบบและตะกร้าสินค้า และคุกกี้เพื่อการวิเคราะห์การใช้งาน\n\nท่านสามารถเลือกยอมรับเฉพาะคุกกี้ที่จำเป็นได้จากแถบแจ้งเตือนด้านล่าง"],
      en: ["Cookie policy", "We use essential cookies for sign-in and cart functionality, plus analytics cookies to understand how the site is used.\n\nYou can choose essential-only cookies from the notice at the bottom of the page."],
    },
  ];

  for (const page of pages) {
    const existing = await db.selectFrom("content_pages").select("id").where("slug", "=", page.slug).executeTakeFirst();
    if (existing) continue;
    const id = ids.page();
    await db
      .insertInto("content_pages")
      .values({ id, slug: page.slug, template: page.template, status: "published", created_at: now, updated_at: now })
      .execute();
    await db
      .insertInto("content_page_translations")
      .values([
        { id: ids.page(), page_id: id, locale: "th", title: page.th[0], body: page.th[1], meta_title: page.th[0], meta_description: page.th[1].slice(0, 150) },
        { id: ids.page(), page_id: id, locale: "en", title: page.en[0], body: page.en[1], meta_title: page.en[0], meta_description: page.en[1].slice(0, 150) },
      ])
      .execute();
  }

  const faqs = [
    ["การสั่งซื้อและการจัดส่ง", "ต้องสั่งล่วงหน้ากี่วัน?", "How far in advance should I order?", "สำหรับช่อมาตรฐานสามารถสั่งภายในวันเดียวกันได้ก่อน 14:00 น. ส่วนงานแต่งงานแนะนำล่วงหน้า 2–4 สัปดาห์", "Standard bouquets can be ordered same-day before 14:00. For weddings we recommend 2–4 weeks."],
    ["การสั่งซื้อและการจัดส่ง", "จัดส่งพื้นที่ไหนบ้าง?", "Where do you deliver?", "กรุงเทพฯ ปริมณฑล และต่างจังหวัดผ่านพันธมิตรขนส่ง (ดอกไม้บางชนิดอาจไม่สามารถส่งต่างจังหวัดได้)", "Bangkok, surrounding provinces and upcountry via partners. Some delicate varieties cannot travel overnight."],
    ["การชำระเงิน", "ชำระเงินได้ช่องทางไหน?", "Which payment methods are accepted?", "PromptPay QR บัตรเครดิต/เดบิต และการโอนเงินผ่านธนาคาร โดยยืนยันการโอนโดยทีมงาน", "PromptPay QR, credit/debit cards and bank transfer with manual verification by our team."],
    ["การชำระเงิน", "ได้รับใบเสร็จหรือไม่?", "Do I receive a receipt?", "ท่านสามารถดาวน์โหลดใบเสร็จได้จากหน้าคำสั่งซื้อหลังชำระเงินสำเร็จ", "You can download a receipt from the order page once payment is confirmed."],
    ["สินค้า", "ดอกไม้จะเหมือนในรูปหรือไม่?", "Will my flowers look exactly like the photo?", "เราเลือกดอกไม้ตามฤดูกาลที่ดีที่สุดในวันนั้น รูปร่างโดยรวมและมูลค่าจะเหมือนเดิม แต่ชนิดหรือเฉดสีอาจต่างเล็กน้อย", "We choose the best seasonal stems available. The overall shape and value stay the same; varieties or shades may vary slightly."],
    ["การดูแล", "ดูแลดอกไม้ให้อยู่ได้นานอย่างไร?", "How do I keep my flowers fresh?", "ตัดก้านเฉียง เปลี่ยนน้ำทุก 2 วัน และหลีกเลี่ยงแสงแดดโดยตรง ดูคู่มือการดูแลของเราได้ในหน้า Flower Care Guide", "Trim the stems at an angle, change water every two days and avoid direct sun. See our flower care guide for details."],
  ];
  for (let index = 0; index < faqs.length; index += 1) {
    const [category, questionTh, questionEn, answerTh, answerEn] = faqs[index];
    const existing = await db
      .selectFrom("faqs")
      .select("id")
      .where("question_th", "=", questionTh)
      .executeTakeFirst();
    if (existing) continue;
    await db
      .insertInto("faqs")
      .values({
        id: ids.faq(),
        category,
        question_th: questionTh,
        question_en: questionEn,
        answer_th: answerTh,
        answer_en: answerEn,
        sort_order: index,
        status: "active",
        created_at: now,
        updated_at: now,
      })
      .execute();
  }

  const careGuides = [
    ["roses", "การดูแลกุหลาบ", "Caring for roses", "ตัดก้านเฉียง 2 เซนติเมตรใต้ข้อ เปลี่ยนน้ำทุกวัน ใส่สารอาหารดอกไม้ และวางในที่เย็น\n\nหลีกเลี่ยงการวางใกล้ผลไม้ เพราะเอทิลีนทำให้ดอกไม้บานเร็วเกินไป", "Trim 2 cm at an angle below a node, change water daily, add flower food and keep in a cool spot.\n\nKeep away from fruit; ethylene makes roses open too quickly."],
    ["tulips", "การดูแลทิวลิป", "Caring for tulips", "ทิวลิปชอบน้ำเย็นและแสงน้อย เปลี่ยนน้ำทุกวัน และใช้แจกันที่สะอาด\n\nทิวลิปจะค่อย ๆ ยืดตัวขึ้นเป็นธรรมชาติ", "Tulips love cold water and low light. Refresh water daily and use a clean vase.\n\nTulips will continue to grow and bend, which is part of their charm."],
    ["boxes", "การดูแลกล่องดอกไม้", "Caring for flower boxes", "เติมน้ำในฟองน้ำเล็กน้อยทุก 2 วัน วางในที่อากาศถ่ายเท หลีกเลี่ยงแดดโดยตรง\n\nกล่องดอกไม้อยู่ได้ 3–5 วัน", "Top up the floral foam with a little water every two days. Keep in a ventilated spot away from sun.\n\nFlower boxes last 3–5 days."],
    ["preserved", "การดูแลดอกไม้คงทน", "Caring for preserved flowers", "ไม่ต้องรดน้ำ หลีกเลี่ยงความชื้นสูงและแสงแดดโดยตรง ใช้ไดร์เป่าผมเบา ๆ ทำความสะอาดฝุ่น\n\nดอกไม้คงทนอยู่ได้มากกว่า 1 ปี", "No water needed. Keep away from humidity and direct sun; dust gently with a hairdryer on cool.\n\nPreserved stems last more than a year."],
  ];
  for (let index = 0; index < careGuides.length; index += 1) {
    const [slug, titleTh, titleEn, bodyTh, bodyEn] = careGuides[index];
    const existing = await db.selectFrom("care_guides").select("id").where("slug", "=", slug).executeTakeFirst();
    if (existing) continue;
    const id = ids.careGuide();
    await db
      .insertInto("care_guides")
      .values({
        id,
        slug,
        image_url: images.length > 0 ? images[index % images.length] : null,
        sort_order: index,
        status: "published",
        created_at: now,
        updated_at: now,
      })
      .execute();
    await db
      .insertInto("care_guide_translations")
      .values([
        { id: ids.careGuide(), guide_id: id, locale: "th", title: titleTh, body: bodyTh },
        { id: ids.careGuide(), guide_id: id, locale: "en", title: titleEn, body: bodyEn },
      ])
      .execute();
  }

  const posts = [
    {
      slug: "how-to-choose-flowers",
      category: "guide",
      th: ["วิธีเลือกดอกไม้ให้ตรงกับคนที่คุณรัก", "เลือกดอกไม้ให้สื่อความหมายได้ตรงใจ"],
      en: ["How to choose flowers for someone you love", "A short guide to gifting flowers with intention."],
      bodyTh: "การเลือกดอกไม้ไม่ใช่แค่เรื่องของสี แต่คือการเลือกภาษาที่จะพูดแทนคุณ\n\nเริ่มจากโอกาส หากเป็นการขอโทษ ดอกไม้โทนขาวและเขียวให้ความรู้สึกจริงใจมากกว่าสีแดงจัด หากเป็นวันครบรอบ กุหลาบยังเป็นตัวเลือกที่ชัดเจนที่สุด\n\nจากนั้นดูนิสัยของผู้รับ คนที่ชอบความเรียบง่ายมักชอบช่อขนาดกลางที่จัดแบบหลวม ๆ ส่วนคนที่ชอบความหรูหราจะชอบกล่องดอกไม้ที่จัดแน่น",
      bodyEn: "Choosing flowers is less about colour and more about the language you want to speak.\n\nStart with the occasion. For an apology, whites and greens feel more sincere than bright red. For anniversaries, roses still say it most clearly.\n\nThen consider the person. Minimalists tend to prefer loose, medium arrangements; maximalists love dense flower boxes.",
    },
    {
      slug: "flower-care-basics",
      category: "care",
      th: ["5 เคล็ดลับให้ดอกไม้อยู่ได้นานขึ้น", "สิ่งที่นักจัดดอกไม้ทำทุกวัน"],
      en: ["Five ways to make cut flowers last longer", "The habits florists use every day."],
      bodyTh: "1. ตัดก้านเฉียงด้วยมีดคม ไม่ใช่กรรไกรทื่อ\n2. เปลี่ยนน้ำทุกวันหรือทุกสองวัน\n3. ล้างแจกันทุกครั้งที่เปลี่ยนน้ำ\n4. ใช้สารอาหารดอกไม้\n5. วางให้ห่างจากแสงแดด ความร้อน และผลไม้\n\nเพียงเท่านี้ดอกไม้ส่วนใหญ่จะอยู่ได้ยาวขึ้น 2–3 วัน",
      bodyEn: "1. Cut stems at an angle with a sharp knife, not dull scissors.\n2. Change the water every day or two.\n3. Wash the vase each time.\n4. Use flower food.\n5. Keep away from sun, heat and fruit.\n\nMost bouquets will last two to three days longer.",
    },
    {
      slug: "wedding-flower-timeline",
      category: "wedding",
      th: ["ไทม์ไลน์การสั่งดอกไม้งานแต่งงาน", "เริ่มวางแผนเมื่อไหร่ดี"],
      en: ["A wedding flower timeline", "When to start planning."],
      bodyTh: "3–4 เดือนก่อนวันงาน: กำหนดธีมและพบนักจัดดอกไม้\n2 เดือนก่อน: ยืนยันช่อเจ้าสาวและงานตกแต่งหลัก\n1 เดือนก่อน: ยืนยันจำนวนโต๊ะและดอกไม้ตกแต่งเพิ่มเติม\n1 สัปดาห์ก่อน: ยืนยันเวลาส่งมอบและผู้ประสานงานหน้างาน\n\nการวางแผนล่วงหน้าช่วยให้เราเลือกดอกไม้ตามฤดูกาลได้ดีที่สุด",
      bodyEn: "3–4 months out: set the theme and meet your florist.\n2 months out: confirm the bridal bouquet and main installations.\n1 month out: confirm tables and additional arrangements.\nOne week out: confirm delivery times and on-site contact.\n\nPlanning ahead lets us use the best of the season.",
    },
  ];
  const admin = await db.selectFrom("users").select("id").where("email", "=", env.seedAdminEmail.toLowerCase()).executeTakeFirst();
  for (let index = 0; index < posts.length; index += 1) {
    const post = posts[index];
    const existing = await db.selectFrom("blog_posts").select("id").where("slug", "=", post.slug).executeTakeFirst();
    if (existing) continue;
    const id = ids.blogPost();
    await db
      .insertInto("blog_posts")
      .values({
        id,
        slug: post.slug,
        cover_image: images.length > 0 ? images[(index + 3) % images.length] : null,
        author_id: admin?.id ?? null,
        category: post.category,
        status: "published",
        published_at: new Date(Date.now() - index * 5 * 86_400_000).toISOString(),
        created_at: now,
        updated_at: now,
      })
      .execute();
    await db
      .insertInto("blog_post_translations")
      .values([
        {
          id: ids.blogPost(),
          post_id: id,
          locale: "th",
          title: post.th[0],
          excerpt: post.th[1],
          content: post.bodyTh,
          meta_title: post.th[0],
          meta_description: post.th[1],
        },
        {
          id: ids.blogPost(),
          post_id: id,
          locale: "en",
          title: post.en[0],
          excerpt: post.en[1],
          content: post.bodyEn,
          meta_title: post.en[0],
          meta_description: post.en[1],
        },
      ])
      .execute();
  }

  for (let index = 0; index < 6 && images.length > 0; index += 1) {
    const url = images[(index + 6) % images.length];
    const existing = await db.selectFrom("site_gallery").select("id").where("image_url", "=", url).executeTakeFirst();
    if (existing) continue;
    await db
      .insertInto("site_gallery")
      .values({
        id: ids.gallery(),
        image_url: url,
        link_url: "https://instagram.com",
        caption: "BLOOMÉ studio",
        sort_order: index,
        status: "active",
        created_at: now,
      })
      .execute();
  }
}

async function seedCoupons() {
  const coupons = [
    {
      code: "WELCOME10",
      type: "percent",
      value: 1000,
      minSpend: 150000,
      maxDiscount: 50000,
      usageLimit: null,
      perCustomer: 1,
      descriptionTh: "ส่วนลด 10% สำหรับลูกค้าใหม่",
      descriptionEn: "10% off for new customers",
    },
    {
      code: "FREESHIP",
      type: "free_shipping",
      value: 0,
      minSpend: 100000,
      maxDiscount: null,
      usageLimit: null,
      perCustomer: 3,
      descriptionTh: "ส่งฟรีเมื่อซื้อครบ 1,000 บาท",
      descriptionEn: "Free delivery over THB 1,000",
    },
    {
      code: "BLOOME200",
      type: "fixed",
      value: 20000,
      minSpend: 200000,
      maxDiscount: null,
      usageLimit: 200,
      perCustomer: 1,
      descriptionTh: "ลด 200 บาทเมื่อซื้อครบ 2,000 บาท",
      descriptionEn: "THB 200 off orders over THB 2,000",
    },
  ];
  for (const coupon of coupons) {
    const existing = await db.selectFrom("coupons").select("id").where("code", "=", coupon.code).executeTakeFirst();
    if (existing) continue;
    await db
      .insertInto("coupons")
      .values({
        id: ids.coupon(),
        code: coupon.code,
        description_th: coupon.descriptionTh,
        description_en: coupon.descriptionEn,
        type: coupon.type,
        value: coupon.value,
        min_spend: coupon.minSpend,
        max_discount: coupon.maxDiscount,
        usage_limit: coupon.usageLimit,
        per_customer_limit: coupon.perCustomer,
        starts_at: new Date(Date.now() - 86_400_000).toISOString(),
        ends_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        status: "active",
        applies_to: "all",
        product_ids: null,
        category_ids: null,
        free_shipping: coupon.type === "free_shipping" ? 1 : 0,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
}

async function seedDemoOrder(customerId: string) {
  const items = await db
    .selectFrom("products")
    .innerJoin("product_translations", (join) =>
      join.onRef("product_translations.product_id", "=", "products.id").on("product_translations.locale", "=", "th"),
    )
    .selectAll("products")
    .select(["product_translations.name as name_th"])
    .where("products.slug", "in", ["blush-romance-bouquet", "golden-hour-sunflowers", "petite-bloom-gift-set"])
    .execute();
  if (items.length === 0) return;

  const latest = await db.selectFrom("products").select(["id"]).where("slug", "=", "blush-romance-bouquet").executeTakeFirst();
  if (!latest) return;

  const orderId = ids.order();
  const date = addDaysToDateString(bangkokDateString(), -7);
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const orderNumber = `FLW-${date.replace(/-/g, "")}-9001`;
  const existing = await db.selectFrom("orders").select("id").where("order_number", "=", orderNumber).executeTakeFirst();
  if (existing) return;

  await db
    .insertInto("orders")
    .values({
      id: orderId,
      order_number: orderNumber,
      user_id: customerId,
      locale: "th",
      status: "delivered",
      payment_status: "succeeded",
      email: "customer@bloome.local",
      customer_name: "คุณลูกค้าตัวอย่าง",
      customer_phone: "0812345678",
      recipient_name: "คุณลูกค้าตัวอย่าง",
      recipient_phone: "0812345678",
      address_line: "88 ซอยสุขุมวิท 31",
      subdistrict: "คลองตันเหนือ",
      district: "วัฒนา",
      province: "กรุงเทพมหานคร",
      postal_code: "10110",
      delivery_notes: null,
      delivery_date: date,
      delivery_slot_id: null,
      delivery_slot_label: "12:00 – 15:00",
      gift_message: "ขอบคุณสำหรับทุกอย่างนะคะ",
      sender_name: "คุณลูกค้าตัวอย่าง",
      anonymous: 0,
      card_design: "classic",
      subtotal,
      addons_total: 0,
      discount_total: 0,
      shipping_total: 0,
      tax_total: Math.round(subtotal * (700 / 10700)),
      grand_total: subtotal,
      currency: "THB",
      coupon_code: null,
      coupon_id: null,
      customer_note: null,
      internal_note: "Seed demo order for development only",
      idempotency_key: `seed-${orderNumber}`,
      ip: "127.0.0.1",
      user_agent: "seed-script",
      created_at: new Date(`${date}T05:00:00.000Z`).toISOString(),
      updated_at: now,
      paid_at: new Date(`${date}T05:10:00.000Z`).toISOString(),
      confirmed_at: new Date(`${date}T05:20:00.000Z`).toISOString(),
      preparing_at: new Date(`${date}T06:00:00.000Z`).toISOString(),
      ready_at: new Date(`${date}T07:00:00.000Z`).toISOString(),
      out_for_delivery_at: new Date(`${date}T07:30:00.000Z`).toISOString(),
      delivered_at: new Date(`${date}T09:00:00.000Z`).toISOString(),
      cancelled_at: null,
      cancel_reason: null,
      refunded_total: 0,
    })
    .execute();

  const orderItemIds: string[] = [];
  for (const item of items) {
    const itemId = ids.orderItem();
    orderItemIds.push(itemId);
    await db
      .insertInto("order_items")
      .values({
        id: itemId,
        order_id: orderId,
        product_id: item.id,
        variant_id: null,
        sku: item.sku,
        name_th: item.name_th,
        name_en: item.slug,
        variant_name_th: null,
        variant_name_en: null,
        unit_price: item.price,
        quantity: 1,
        addons_json: "[]",
        addons_total: 0,
        line_total: item.price,
        image_url: null,
        snapshot_json: JSON.stringify({ seeded: true }),
        created_at: new Date(`${date}T05:00:00.000Z`).toISOString(),
      })
      .execute();
    await db
      .updateTable("products")
      .set((eb) => ({ sold_count: eb("sold_count", "+", 1) }))
      .where("id", "=", item.id)
      .execute();
  }

  await db
    .insertInto("payments")
    .values({
      id: ids.payment(),
      order_id: orderId,
      provider: "manual_bank_transfer",
      method: "bank_transfer",
      status: "succeeded",
      amount: subtotal,
      currency: "THB",
      provider_reference: `SEED-${orderNumber}`,
      checkout_url: null,
      qr_payload: null,
      expires_at: null,
      paid_at: new Date(`${date}T05:10:00.000Z`).toISOString(),
      failure_reason: null,
      metadata_json: null,
      created_at: now,
      updated_at: now,
    })
    .execute();

  await db
    .insertInto("order_events")
    .values([
      { id: ids.orderEvent(), order_id: orderId, type: "created", message: "Order created", from_status: null, to_status: "pending_payment", actor_type: "customer" as const, actor_id: customerId, visible_to_customer: 1, created_at: new Date(`${date}T05:00:00.000Z`).toISOString() },
      { id: ids.orderEvent(), order_id: orderId, type: "paid", message: "Payment confirmed", from_status: "pending_payment", to_status: "paid", actor_type: "system" as const, actor_id: null, visible_to_customer: 1, created_at: new Date(`${date}T05:10:00.000Z`).toISOString() },
      { id: ids.orderEvent(), order_id: orderId, type: "delivered", message: "Delivered", from_status: "out_for_delivery", to_status: "delivered", actor_type: "admin" as const, actor_id: null, visible_to_customer: 1, created_at: new Date(`${date}T09:00:00.000Z`).toISOString() },
    ])
    .execute();

  await db
    .insertInto("shipping")
    .values({
      id: ids.shipping(),
      order_id: orderId,
      carrier: "BLOOMÉ courier",
      tracking_number: "BLM-DEMO-001",
      status: "delivered",
      note: null,
      shipped_at: new Date(`${date}T07:30:00.000Z`).toISOString(),
      delivered_at: new Date(`${date}T09:00:00.000Z`).toISOString(),
      created_at: now,
      updated_at: now,
    })
    .execute();

  // Demo reviews tied to a real delivered order (development seed only).
  const reviews = [
    { itemId: orderItemIds[0], productId: items[0].id, rating: 5, bodyTh: "ดอกไม้สวยมาก สดใหม่ smells lovely ค่ะ", bodyEn: "The roses arrived fresh and beautifully arranged." },
    { itemId: orderItemIds[1], productId: items[1].id, rating: 5, bodyTh: "ประทับใจการจัดส่งตรงเวลา", bodyEn: "Delivered right on time — the sunflowers were stunning." },
  ];
  for (const review of reviews) {
    if (!review.itemId) continue;
    await db
      .insertInto("reviews")
      .values({
        id: ids.review(),
        product_id: review.productId,
        user_id: customerId,
        order_item_id: review.itemId,
        order_id: orderId,
        rating: review.rating,
        title: null,
        body: review.bodyTh,
        status: "approved",
        admin_reply: null,
        replied_at: null,
        verified: 1,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
}

async function main() {
  console.log("[seed] running migrations");
  await runMigrations(db);
  console.log("[seed] roles");
  await seedRoles();
  console.log("[seed] settings");
  await seedSettings();
  console.log("[seed] images");
  ensureRealPhotos();
  const images: string[] = [];
  console.log("[seed] categories");
  await seedCategories(images);
  console.log("[seed] products");
  await seedProducts(images);
  console.log("[seed] occasions");
  await seedProductOccasions();
  console.log("[seed] addons");
  await seedAddons();
  console.log("[seed] content");
  await seedContent(images);
  console.log("[seed] real photography");
  await seedRealImages();
  console.log("[seed] coupons");
  await seedCoupons();
  console.log("[seed] staff & demo customers");
  await seedStaff();

  console.log("");
  console.log("──────────────────────────────────────────────");
  console.log(" Seed complete");
  console.log(` Admin:        ${env.seedAdminEmail} / ${env.seedAdminPassword}`);
  console.log(" Manager:      manager@bloome.local / Manager!2026");
  console.log(" Customer:     customer@bloome.local / Customer!2026");
  if (env.seedDemoData) {
    console.log(" Demo orders and reviews were created (SEED_DEMO_DATA=true).");
    console.log(" Set SEED_DEMO_DATA=false before a production seed.");
  }
  console.log("──────────────────────────────────────────────");
  await db.destroy();
}

main().catch(async (error) => {
  console.error("[seed] failed", error);
  await db.destroy().catch(() => undefined);
  process.exit(1);
});
