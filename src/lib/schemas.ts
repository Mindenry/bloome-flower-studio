import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "validation.required")
  .max(254)
  .email("validation.email")
  .transform((value) => value.toLowerCase());

const phoneRegex = /^(?:\+66|0)\d{8,9}$/;

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "validation.required")
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => phoneRegex.test(value), "validation.phone");

export const passwordSchema = z
  .string()
  .min(8, "validation.passwordMin")
  .max(72, "validation.max")
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), "validation.passwordWeak");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "validation.min").max(100, "validation.max"),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "validation.consent" }) }),
  marketingConsent: z.boolean().optional().default(false),
  locale: z.enum(["th", "en"]).default("th"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "validation.passwordMismatch",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.required").max(200),
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export const checkoutSchema = z.object({
  contactName: z.string().trim().min(2, "validation.min").max(120),
  email: emailSchema,
  phone: phoneSchema,
  recipientName: z.string().trim().min(2, "validation.min").max(120),
  recipientPhone: phoneSchema,
  addressLine: z.string().trim().min(5, "validation.min").max(300),
  subdistrict: z.string().trim().min(1, "validation.required").max(120),
  district: z.string().trim().min(1, "validation.required").max(120),
  province: z.string().trim().min(1, "validation.required").max(120),
  postalCode: z.string().trim().regex(/^\d{5}$/, "validation.postal"),
  deliveryNotes: z.string().trim().max(500).optional().or(z.literal("")),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.dateFuture"),
  slotStart: z.string().regex(/^\d{2}:\d{2}$/),
  slotEnd: z.string().regex(/^\d{2}:\d{2}$/),
  giftMessage: z.string().trim().max(300, "validation.max").optional().or(z.literal("")),
  senderName: z.string().trim().max(120).optional().or(z.literal("")),
  anonymous: z.boolean().optional().default(false),
  cardDesign: z.enum(["classic", "botanical", "minimal", "none"]).optional().default("classic"),
  customerNote: z.string().trim().max(500).optional().or(z.literal("")),
  paymentMethod: z.enum(["promptpay", "card", "bank_transfer", "cod"]),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "validation.consent" }) }),
  idempotencyKey: z.string().min(8).max(100),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(40).optional().default("home"),
  recipientName: z.string().trim().min(2, "validation.min").max(120),
  phone: phoneSchema,
  addressLine: z.string().trim().min(5, "validation.min").max(300),
  subdistrict: z.string().trim().min(1, "validation.required").max(120),
  district: z.string().trim().min(1, "validation.required").max(120),
  province: z.string().trim().min(1, "validation.required").max(120),
  postalCode: z.string().trim().regex(/^\d{5}$/, "validation.postal"),
  isDefault: z.boolean().optional().default(false),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "validation.min").max(100),
  phone: phoneSchema.optional().or(z.literal("")),
  locale: z.enum(["th", "en"]),
  marketingConsent: z.boolean().optional().default(false),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export const recipientSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "validation.min").max(120),
  phone: phoneSchema,
  addressLine: z.string().trim().min(5, "validation.min").max(300),
  subdistrict: z.string().trim().min(1, "validation.required").max(120),
  district: z.string().trim().min(1, "validation.required").max(120),
  province: z.string().trim().min(1, "validation.required").max(120),
  postalCode: z.string().trim().regex(/^\d{5}$/, "validation.postal"),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export const reminderSchema = z.object({
  id: z.string().optional(),
  recipientName: z.string().trim().min(2, "validation.min").max(120),
  occasion: z.enum(["birthday", "anniversary", "wedding_anniversary", "other"]),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.dateFuture"),
  remindDaysBefore: z.coerce.number().int().min(1).max(60).default(7),
  notifyEmail: z.boolean().optional().default(true),
  notifyLine: z.boolean().optional().default(false),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  active: z.boolean().optional().default(true),
});

export const newsletterSchema = z.object({
  email: emailSchema,
  consent: z.literal(true, { errorMap: () => ({ message: "validation.consent" }) }),
  locale: z.enum(["th", "en"]).default("th"),
});

const moneyInput = z.coerce.number().int().min(0, "validation.positive").max(100_000_000);

export const productSchema = z
  .object({
    id: z.string().optional(),
    sku: z.string().trim().min(2, "validation.min").max(60),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "validation.required").max(160),
    categoryId: z.string().min(1, "validation.required"),
    type: z.enum(["bouquet", "box", "preserved", "plant", "gift", "wedding"]),
    status: z.enum(["draft", "published", "scheduled", "archived"]),
    publishedAt: z.string().optional().or(z.literal("")),
    featured: z.boolean().optional().default(false),
    newArrival: z.boolean().optional().default(true),
    price: moneyInput,
    salePrice: z.union([moneyInput, z.literal("")]).optional(),
    costPrice: z.union([moneyInput, z.literal("")]).optional(),
    stockQuantity: z.coerce.number().int().min(0).max(1_000_000),
    lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(5),
    weightGrams: z.coerce.number().int().min(0).max(100_000).default(0),
    lengthCm: z.coerce.number().int().min(0).max(500).optional(),
    widthCm: z.coerce.number().int().min(0).max(500).optional(),
    heightCm: z.coerce.number().int().min(0).max(500).optional(),
    flowerType: z.string().trim().max(80).optional().or(z.literal("")),
    flowerColor: z.string().trim().max(80).optional().or(z.literal("")),
    bouquetSize: z.string().trim().max(40).optional().or(z.literal("")),
    flowerCount: z.coerce.number().int().min(0).max(10_000).optional(),
    nameTh: z.string().trim().min(1, "validation.required").max(200),
    nameEn: z.string().trim().min(1, "validation.required").max(200),
    shortDescriptionTh: z.string().trim().max(400).optional().or(z.literal("")),
    shortDescriptionEn: z.string().trim().max(400).optional().or(z.literal("")),
    descriptionTh: z.string().trim().max(20_000).optional().or(z.literal("")),
    descriptionEn: z.string().trim().max(20_000).optional().or(z.literal("")),
    careInstructionsTh: z.string().trim().max(4000).optional().or(z.literal("")),
    careInstructionsEn: z.string().trim().max(4000).optional().or(z.literal("")),
    deliveryInformationTh: z.string().trim().max(2000).optional().or(z.literal("")),
    deliveryInformationEn: z.string().trim().max(2000).optional().or(z.literal("")),
    metaTitleTh: z.string().trim().max(70).optional().or(z.literal("")),
    metaTitleEn: z.string().trim().max(70).optional().or(z.literal("")),
    metaDescriptionTh: z.string().trim().max(160).optional().or(z.literal("")),
    metaDescriptionEn: z.string().trim().max(160).optional().or(z.literal("")),
  })
  .refine((data) => !data.salePrice || Number(data.salePrice) <= data.price, {
    message: "validation.priceRange",
    path: ["salePrice"],
  });

export const variantSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  sku: z.string().trim().min(1, "validation.required").max(60),
  nameTh: z.string().trim().min(1, "validation.required").max(80),
  nameEn: z.string().trim().min(1, "validation.required").max(80),
  priceDelta: z.coerce.number().int().min(0).max(10_000_000).default(0),
  stockQuantity: z.coerce.number().int().min(0).max(100_000).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "validation.required").max(160),
  kind: z.enum(["category", "collection", "occasion"]).default("category"),
  nameTh: z.string().trim().min(1, "validation.required").max(120),
  nameEn: z.string().trim().min(1, "validation.required").max(120),
  descriptionTh: z.string().trim().max(500).optional().or(z.literal("")),
  descriptionEn: z.string().trim().max(500).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  status: z.enum(["active", "hidden"]).default("active"),
});

export const couponSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(3, "validation.min").max(40).transform((v) => v.toUpperCase()),
  descriptionTh: z.string().trim().max(300).optional().or(z.literal("")),
  descriptionEn: z.string().trim().max(300).optional().or(z.literal("")),
  type: z.enum(["fixed", "percent", "free_shipping"]),
  value: z.coerce.number().int().min(0).max(1_000_000).default(0),
  minSpend: z.coerce.number().int().min(0).max(100_000_000).default(0),
  maxDiscount: z.union([z.coerce.number().int().min(0), z.literal("")]).optional(),
  usageLimit: z.union([z.coerce.number().int().min(1), z.literal("")]).optional(),
  perCustomerLimit: z.coerce.number().int().min(1).max(100).default(1),
  startsAt: z.string().min(1, "validation.required"),
  endsAt: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
  appliesTo: z.enum(["all", "products", "categories"]).default("all"),
  productIds: z.string().optional().or(z.literal("")),
  categoryIds: z.string().optional().or(z.literal("")),
});

export const reviewSchema = z.object({
  orderItemId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z.string().trim().min(5, "validation.min").max(2000),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "validation.min").max(120),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  subject: z.string().trim().min(3, "validation.min").max(160),
  message: z.string().trim().min(10, "validation.min").max(3000),
});

export const staffSchema = z.object({
  name: z.string().trim().min(2, "validation.min").max(120),
  email: emailSchema,
  roleId: z.string().min(1, "validation.required"),
  password: passwordSchema,
});

export const roleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "validation.min").max(80),
  slug: z.string().trim().regex(/^[a-z0-9_]+$/, "validation.required").max(60),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  permissions: z.array(z.string()).default([]),
});

export const blogPostSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "validation.required").max(160),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  coverImage: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
  titleTh: z.string().trim().min(1, "validation.required").max(200),
  titleEn: z.string().trim().min(1, "validation.required").max(200),
  excerptTh: z.string().trim().max(400).optional().or(z.literal("")),
  excerptEn: z.string().trim().max(400).optional().or(z.literal("")),
  contentTh: z.string().trim().min(20, "validation.min").max(60_000),
  contentEn: z.string().trim().min(20, "validation.min").max(60_000),
  metaTitleTh: z.string().trim().max(70).optional().or(z.literal("")),
  metaTitleEn: z.string().trim().max(70).optional().or(z.literal("")),
  metaDescriptionTh: z.string().trim().max(160).optional().or(z.literal("")),
  metaDescriptionEn: z.string().trim().max(160).optional().or(z.literal("")),
});

export const pageSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "validation.required").max(120),
  template: z.enum(["page", "about", "contact", "faq", "policy"]).default("page"),
  status: z.enum(["draft", "published"]).default("published"),
  titleTh: z.string().trim().min(1, "validation.required").max(200),
  titleEn: z.string().trim().min(1, "validation.required").max(200),
  bodyTh: z.string().trim().min(1, "validation.required").max(80_000),
  bodyEn: z.string().trim().min(1, "validation.required").max(80_000),
  metaTitleTh: z.string().trim().max(70).optional().or(z.literal("")),
  metaTitleEn: z.string().trim().max(70).optional().or(z.literal("")),
  metaDescriptionTh: z.string().trim().max(160).optional().or(z.literal("")),
  metaDescriptionEn: z.string().trim().max(160).optional().or(z.literal("")),
});

export const bannerSchema = z.object({
  id: z.string().optional(),
  placement: z.enum(["home_hero", "announcement", "home_special", "social"]),
  titleTh: z.string().trim().min(1, "validation.required").max(200),
  titleEn: z.string().trim().min(1, "validation.required").max(200),
  subtitleTh: z.string().trim().max(300).optional().or(z.literal("")),
  subtitleEn: z.string().trim().max(300).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  linkUrl: z.string().trim().max(500).optional().or(z.literal("")),
  ctaTh: z.string().trim().max(60).optional().or(z.literal("")),
  ctaEn: z.string().trim().max(60).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
});

export const faqSchema = z.object({
  id: z.string().optional(),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  questionTh: z.string().trim().min(3).max(300),
  questionEn: z.string().trim().min(3).max(300),
  answerTh: z.string().trim().min(3).max(4000),
  answerEn: z.string().trim().min(3).max(4000),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const stockAdjustSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().or(z.literal("")),
  type: z.enum(["in", "out", "adjust", "waste"]),
  quantity: z.coerce.number().int().min(1).max(100_000),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  batchCode: z.string().trim().max(60).optional().or(z.literal("")),
  expiryAt: z.string().optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1).max(120),
  storeTagline: z.string().trim().max(200),
  storeEmail: emailSchema,
  storePhone: z.string().trim().max(40),
  storeLineId: z.string().trim().max(60).optional().or(z.literal("")),
  storeInstagram: z.string().trim().max(80).optional().or(z.literal("")),
  storeFacebook: z.string().trim().max(120).optional().or(z.literal("")),
  addressTh: z.string().trim().max(400).optional().or(z.literal("")),
  addressEn: z.string().trim().max(400).optional().or(z.literal("")),
  hoursTh: z.string().trim().max(200).optional().or(z.literal("")),
  hoursEn: z.string().trim().max(200).optional().or(z.literal("")),
  logoUrl: z.string().trim().max(500).optional().or(z.literal("")),
  faviconUrl: z.string().trim().max(500).optional().or(z.literal("")),
  mapUrl: z.string().trim().max(500).optional().or(z.literal("")),
  taxId: z.string().trim().max(30).optional().or(z.literal("")),
  taxRateBp: z.coerce.number().int().min(0).max(3000),
  pricesIncludeTax: z.boolean(),
  minOrderTotal: z.coerce.number().int().min(0),
  shippingFee: z.coerce.number().int().min(0),
  freeThreshold: z.coerce.number().int().min(0),
  sameDayEnabled: z.boolean(),
  cutoffHour: z.coerce.number().int().min(0).max(23),
  leadDays: z.coerce.number().int().min(0).max(30),
  maxDaysAhead: z.coerce.number().int().min(1).max(90),
  defaultCapacity: z.coerce.number().int().min(1).max(500),
  closedWeekdays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  paymentMethods: z.array(z.string()).min(1),
  promptpayExpiryMinutes: z.coerce.number().int().min(5).max(180),
  codEnabled: z.boolean(),
  seoTitleTh: z.string().trim().max(200),
  seoTitleEn: z.string().trim().max(200),
  seoDescriptionTh: z.string().trim().max(400),
  seoDescriptionEn: z.string().trim().max(400),
  seoKeywords: z.string().trim().max(400).optional().or(z.literal("")),
  ogImage: z.string().trim().max(500).optional().or(z.literal("")),
  emailOnOrder: z.boolean(),
  lineOnOrder: z.boolean(),
});

export type FormState = {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
  data?: Record<string, unknown>;
};

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export function parseForm<T extends z.ZodTypeAny>(schema: T, data: unknown):
  | { success: true; data: z.infer<T> }
  | { success: false; fieldErrors: Record<string, string> } {
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { success: false, fieldErrors: zodFieldErrors(parsed.error) };
  return { success: true, data: parsed.data };
}
