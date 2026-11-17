/** Pure defaults usable by the app, seed scripts and tests (no server-only imports). */
import { CURRENCY } from "./money";

export type StoreSettings = {
  store: {
    name: string;
    nameEn: string;
    tagline: string;
    email: string;
    phone: string;
    lineId: string;
    instagram: string;
    facebook: string;
    addressTh: string;
    addressEn: string;
    hoursTh: string;
    hoursEn: string;
    logoUrl: string;
    faviconUrl: string;
    mapUrl: string;
    taxId: string;
  };
  commerce: {
    currency: string;
    taxRateBp: number;
    pricesIncludeTax: boolean;
    minOrderTotal: number;
    lowStockDefault: number;
  };
  shipping: {
    fee: number;
    freeThreshold: number;
    sameDayEnabled: boolean;
    cutoffHour: number;
    leadDays: number;
    maxDaysAhead: number;
    closedWeekdays: number[];
    defaultCapacity: number;
    deliveryNoteTh: string;
    deliveryNoteEn: string;
  };
  payment: {
    methods: string[];
    promptpayExpiryMinutes: number;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    codEnabled: boolean;
  };
  seo: {
    titleTh: string;
    titleEn: string;
    descriptionTh: string;
    descriptionEn: string;
    ogImage: string;
    keywords: string;
  };
  notifications: {
    emailOnOrder: boolean;
    lineOnOrder: boolean;
  };
};

export type SlotTemplate = { start: string; end: string; capacity: number };

export const DEFAULT_SLOT_TEMPLATES: SlotTemplate[] = [
  { start: "09:00", end: "12:00", capacity: 10 },
  { start: "12:00", end: "15:00", capacity: 10 },
  { start: "15:00", end: "18:00", capacity: 10 },
  { start: "18:00", end: "21:00", capacity: 8 },
];

export const SETTING_DEFAULTS: StoreSettings = {
  store: {
    name: "BLOOMÉ FLOWER STUDIO",
    nameEn: "BLOOMÉ FLOWER STUDIO",
    tagline: "Flowers that speak what words cannot.",
    email: "hello@bloome.studio",
    phone: "02-000-0000",
    lineId: "@bloome",
    instagram: "bloome.studio",
    facebook: "bloome.studio",
    addressTh: "88 ซอยสุขุมวิท 31 เขตวัฒนา กรุงเทพฯ 10110",
    addressEn: "88 Sukhumvit Soi 31, Watthana, Bangkok 10110",
    hoursTh: "ทุกวัน 09:00 – 19:00 น.",
    hoursEn: "Daily 09:00 – 19:00",
    logoUrl: "",
    faviconUrl: "",
    mapUrl: "",
    taxId: "",
  },
  commerce: {
    currency: CURRENCY,
    taxRateBp: 700,
    pricesIncludeTax: true,
    minOrderTotal: 0,
    lowStockDefault: 5,
  },
  shipping: {
    fee: 15000,
    freeThreshold: 150000,
    sameDayEnabled: true,
    cutoffHour: 14,
    leadDays: 1,
    maxDaysAhead: 30,
    closedWeekdays: [],
    defaultCapacity: 12,
    deliveryNoteTh: "จัดส่งภายในกรุงเทพฯ และปริมณฑล",
    deliveryNoteEn: "Delivery across Bangkok and surrounding provinces.",
  },
  payment: {
    methods: ["promptpay", "card", "bank_transfer"],
    promptpayExpiryMinutes: 30,
    bankName: "Kasikorn Bank",
    bankAccountName: "BLOOMÉ FLOWER STUDIO CO., LTD.",
    bankAccountNumber: "000-0-00000-0",
    codEnabled: false,
  },
  seo: {
    titleTh: "BLOOMÉ FLOWER STUDIO — ดอกไม้พรีเมียม จัดส่งกรุงเทพฯ",
    titleEn: "BLOOMÉ FLOWER STUDIO — Premium flowers delivered in Bangkok",
    descriptionTh: "ร้านดอกไม้ออนไลน์ระดับพรีเมียม จัดช่อดอกไม้สดโดยนักออกแบบมืออาชีพ",
    descriptionEn: "A modern flower boutique arranging seasonal stems daily in Bangkok.",
    ogImage: "/images/og-default.jpg",
    keywords: "ดอกไม้, ช่อดอกไม้, ส่งดอกไม้, flower delivery bangkok",
  },
  notifications: { emailOnOrder: true, lineOnOrder: false },
};
