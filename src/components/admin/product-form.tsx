"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveProductAction } from "@/app/actions/admin-products";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "../i18n-provider";
import { ImageUploader, type UploadItem } from "./image-uploader";

const initial: FormState = { ok: false };

export type ProductFormValues = {
  id?: string;
  sku: string;
  slug: string;
  categoryId: string;
  type: string;
  status: string;
  publishedAt: string;
  featured: boolean;
  newArrival: boolean;
  price: number;
  salePrice: number | null;
  costPrice: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  weightGrams: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  flowerType: string;
  flowerColor: string;
  bouquetSize: string;
  flowerCount: number | null;
  nameTh: string;
  nameEn: string;
  shortDescriptionTh: string;
  shortDescriptionEn: string;
  descriptionTh: string;
  descriptionEn: string;
  careInstructionsTh: string;
  careInstructionsEn: string;
  deliveryInformationTh: string;
  deliveryInformationEn: string;
  metaTitleTh: string;
  metaTitleEn: string;
  metaDescriptionTh: string;
  metaDescriptionEn: string;
};

const TABS = [
  "general",
  "images",
  "pricing",
  "inventory",
  "shipping",
  "seo",
  "publishing",
] as const;

export function ProductForm({
  locale,
  categories,
  occasions,
  selectedOccasions,
  product,
  images: initialImages,
  showCost,
}: {
  locale: string;
  categories: Array<{ id: string; name: string }>;
  occasions: Array<{ id: string; name: string }>;
  selectedOccasions: string[];
  product: ProductFormValues;
  images: UploadItem[];
  showCost: boolean;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveProductAction, initial);
  const [tab, setTab] = useState<(typeof TABS)[number]>("general");
  const [images, setImages] = useState<UploadItem[]>(initialImages);
  const [nameEn, setNameEn] = useState(product.nameEn);
  const [slug, setSlug] = useState(product.slug);

  const err = (key: string) => state.fieldErrors?.[key];

  const tabLabel: Record<(typeof TABS)[number], string> = {
    general: t("admin.tabs.general"),
    images: t("admin.tabs.images"),
    pricing: t("admin.tabs.pricing"),
    inventory: t("admin.tabs.inventory"),
    shipping: t("admin.tabs.shipping"),
    seo: t("admin.tabs.seo"),
    publishing: t("admin.tabs.publishing"),
  };

  const generateSlug = () => {
    const generated = nameEn
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setSlug(generated);
  };

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {product.id ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="flex flex-wrap gap-1 border border-line bg-white p-1">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`px-3 py-1.5 text-[11px] ${tab === item ? "bg-[#24261f] text-white" : "text-muted hover:bg-cream"}`}
          >
            {tabLabel[item]}
          </button>
        ))}
      </div>

      {state.error ? (
        <p role="alert" className="border border-[#f0d6d0] bg-[#fdf0ed] px-4 py-2.5 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="border border-[#d7e6da] bg-[#eef5f0] px-4 py-2.5 text-xs text-success">
          {state.message}
        </p>
      ) : null}

      <div className={tab === "general" ? "space-y-5" : "hidden"}>
        <section className="border border-line bg-white p-5">
          <h2 className="text-sm font-medium">{t("admin.tabs.general")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="nameTh">
                {locale === "th" ? "ชื่อสินค้า (ไทย)" : "Product name (TH)"} *
              </label>
              <input id="nameTh" name="nameTh" defaultValue={product.nameTh} required className="input" />
              {err("nameTh") ? <p className="field-error">{err("nameTh")}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="nameEn">
                {locale === "th" ? "ชื่อสินค้า (อังกฤษ)" : "Product name (EN)"} *
              </label>
              <input
                id="nameEn"
                name="nameEn"
                defaultValue={product.nameEn}
                required
                className="input"
                onChange={(event) => setNameEn(event.target.value)}
              />
              {err("nameEn") ? <p className="field-error">{err("nameEn")}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="sku">
                {t("product.sku")} *
              </label>
              <input id="sku" name="sku" defaultValue={product.sku} required className="input font-mono" />
              {err("sku") ? <p className="field-error">{err("sku")}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="slug">URL slug *</label>
              <div className="flex gap-2">
                <input id="slug" name="slug" value={slug} onChange={(event) => setSlug(event.target.value)} required className="input font-mono text-xs" />
                <button type="button" onClick={generateSlug} className="btn btn-ghost btn-sm shrink-0">
                  Auto
                </button>
              </div>
              {err("slug") ? <p className="field-error">{err("slug")}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="categoryId">
                {t("admin.categories")} *
              </label>
              <select id="categoryId" name="categoryId" defaultValue={product.categoryId} required className="select">
                <option value="">—</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {err("categoryId") ? <p className="field-error">{err("categoryId")}</p> : null}
            </div>
            <div>
              <label className="label" htmlFor="type">Type</label>
              <select id="type" name="type" defaultValue={product.type} className="select">
                {["bouquet", "box", "preserved", "plant", "gift", "wedding"].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="shortTh">{locale === "th" ? "คำอธิบายสั้น (ไทย)" : "Short description (TH)"}</label>
              <input id="shortTh" name="shortDescriptionTh" defaultValue={product.shortDescriptionTh} maxLength={400} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="shortEn">{locale === "th" ? "คำอธิบายสั้น (อังกฤษ)" : "Short description (EN)"}</label>
              <input id="shortEn" name="shortDescriptionEn" defaultValue={product.shortDescriptionEn} maxLength={400} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="descTh">รายละเอียด (ไทย)</label>
              <textarea id="descTh" name="descriptionTh" defaultValue={product.descriptionTh} rows={8} className="textarea" />
            </div>
            <div>
              <label className="label" htmlFor="descEn">Description (EN)</label>
              <textarea id="descEn" name="descriptionEn" defaultValue={product.descriptionEn} rows={8} className="textarea" />
            </div>
            <div>
              <label className="label" htmlFor="careTh">การดูแล (ไทย)</label>
              <textarea id="careTh" name="careInstructionsTh" defaultValue={product.careInstructionsTh} rows={4} className="textarea" />
            </div>
            <div>
              <label className="label" htmlFor="careEn">Care instructions (EN)</label>
              <textarea id="careEn" name="careInstructionsEn" defaultValue={product.careInstructionsEn} rows={4} className="textarea" />
            </div>
            <div>
              <label className="label" htmlFor="deliveryTh">ข้อมูลการจัดส่ง (ไทย)</label>
              <textarea id="deliveryTh" name="deliveryInformationTh" defaultValue={product.deliveryInformationTh} rows={3} className="textarea" />
            </div>
            <div>
              <label className="label" htmlFor="deliveryEn">Delivery information (EN)</label>
              <textarea id="deliveryEn" name="deliveryInformationEn" defaultValue={product.deliveryInformationEn} rows={3} className="textarea" />
            </div>
            <div>
              <label className="label" htmlFor="flowerType">{t("product.flowers")}</label>
              <input id="flowerType" name="flowerType" defaultValue={product.flowerType} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="flowerColor">{t("product.color")}</label>
              <input id="flowerColor" name="flowerColor" defaultValue={product.flowerColor} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="bouquetSize">{t("product.size")}</label>
              <input id="bouquetSize" name="bouquetSize" defaultValue={product.bouquetSize} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="flowerCount">{t("product.count")}</label>
              <input id="flowerCount" name="flowerCount" type="number" min={0} defaultValue={product.flowerCount ?? ""} className="input" />
            </div>
            <div className="sm:col-span-2">
              <p className="label">{locale === "th" ? "เหมาะกับโอกาส" : "Suitable occasions"}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                {occasions.map((occasion) => (
                  <label key={occasion.id} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      name="occasionIds"
                      value={occasion.id}
                      defaultChecked={selectedOccasions.includes(occasion.id)}
                      className="accent-[#81917B]"
                    />
                    {occasion.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">
                {locale === "th"
                  ? "เลือกได้หลายโอกาส สินค้าจะแสดงทั้งในหมวดหมู่และหน้าของแต่ละโอกาส"
                  : "Select any number — the product shows under its category and each selected occasion."}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className={tab === "images" ? "border border-line bg-white p-5" : "hidden"}>
        <h2 className="text-sm font-medium">{t("admin.tabs.images")}</h2>
        <p className="mt-1 text-[11px] text-muted">{t("admin.uploadHint")}</p>
        <div className="mt-4">
          <ImageUploader value={images} onChange={setImages} />
        </div>
      </section>

      <section className={tab === "pricing" ? "border border-line bg-white p-5" : "hidden"}>
        <h2 className="text-sm font-medium">{t("admin.tabs.pricing")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="price">{t("common.price")} (THB) *</label>
            <input id="price" name="price" type="number" step="0.01" min={0} defaultValue={(product.price / 100).toFixed(2)} required className="input" />
            {err("price") ? <p className="field-error">{err("price")}</p> : null}
          </div>
          <div>
            <label className="label" htmlFor="salePrice">{locale === "th" ? "ราคาโปรโมชัน" : "Sale price"} (THB)</label>
            <input
              id="salePrice"
              name="salePrice"
              type="number"
              step="0.01"
              min={0}
              defaultValue={product.salePrice !== null ? (product.salePrice / 100).toFixed(2) : ""}
              className="input"
            />
            {err("salePrice") ? <p className="field-error">{err("salePrice")}</p> : null}
          </div>
          {showCost ? (
            <div>
              <label className="label" htmlFor="costPrice">{locale === "th" ? "ราคาทุน" : "Cost price"} (THB)</label>
              <input
                id="costPrice"
                name="costPrice"
                type="number"
                step="0.01"
                min={0}
                defaultValue={product.costPrice !== null ? (product.costPrice / 100).toFixed(2) : ""}
                className="input"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className={tab === "inventory" ? "border border-line bg-white p-5" : "hidden"}>
        <h2 className="text-sm font-medium">{t("admin.tabs.inventory")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="stockQuantity">{t("common.quantity")}</label>
            <input id="stockQuantity" name="stockQuantity" type="number" min={0} defaultValue={product.stockQuantity} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="lowStockThreshold">{t("admin.lowStock")}</label>
            <input id="lowStockThreshold" name="lowStockThreshold" type="number" min={0} defaultValue={product.lowStockThreshold} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="weightGrams">{locale === "th" ? "น้ำหนัก (กรัม)" : "Weight (g)"}</label>
            <input id="weightGrams" name="weightGrams" type="number" min={0} defaultValue={product.weightGrams} className="input" />
          </div>
        </div>
      </section>

      <section className={tab === "shipping" ? "border border-line bg-white p-5" : "hidden"}>
        <h2 className="text-sm font-medium">{t("admin.tabs.shipping")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { name: "lengthCm", label: "Length (cm)", value: product.lengthCm },
            { name: "widthCm", label: "Width (cm)", value: product.widthCm },
            { name: "heightCm", label: "Height (cm)", value: product.heightCm },
          ].map((field) => (
            <div key={field.name}>
              <label className="label" htmlFor={field.name}>{field.label}</label>
              <input id={field.name} name={field.name} type="number" min={0} defaultValue={field.value ?? ""} className="input" />
            </div>
          ))}
        </div>
      </section>

      <section className={tab === "seo" ? "border border-line bg-white p-5" : "hidden"}>
        <h2 className="text-sm font-medium">{t("admin.tabs.seo")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="metaTitleTh">Meta title (TH)</label>
            <input id="metaTitleTh" name="metaTitleTh" maxLength={70} defaultValue={product.metaTitleTh} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="metaTitleEn">Meta title (EN)</label>
            <input id="metaTitleEn" name="metaTitleEn" maxLength={70} defaultValue={product.metaTitleEn} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="metaDescriptionTh">Meta description (TH)</label>
            <textarea id="metaDescriptionTh" name="metaDescriptionTh" maxLength={160} defaultValue={product.metaDescriptionTh} rows={3} className="textarea" />
          </div>
          <div>
            <label className="label" htmlFor="metaDescriptionEn">Meta description (EN)</label>
            <textarea id="metaDescriptionEn" name="metaDescriptionEn" maxLength={160} defaultValue={product.metaDescriptionEn} rows={3} className="textarea" />
          </div>
        </div>
      </section>

      <section className={tab === "publishing" ? "border border-line bg-white p-5" : "hidden"}>
        <h2 className="text-sm font-medium">{t("admin.tabs.publishing")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="status">{t("common.status")}</label>
            <select id="status" name="status" defaultValue={product.status} className="select">
              <option value="draft">{t("status.draft")}</option>
              <option value="published">{t("status.published")}</option>
              <option value="scheduled">{t("status.scheduled")}</option>
              <option value="archived">{t("status.archived")}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="publishedAt">{locale === "th" ? "เผยแพร่เมื่อ" : "Publish at"}</label>
            <input
              id="publishedAt"
              name="publishedAt"
              type="datetime-local"
              defaultValue={product.publishedAt ? product.publishedAt.slice(0, 16) : ""}
              className="input"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="newArrival" value="true" defaultChecked={product.newArrival} className="accent-[#81917B]" />
            {locale === "th" ? "สินค้ามาใหม่" : "New arrival"}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="featured" value="true" defaultChecked={product.featured} className="accent-[#81917B]" />
            {locale === "th" ? "สินค้าแนะนำ" : "Featured"}
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-white p-4">
        <p className="text-[11px] text-muted">
          {t("common.required")} · {locale === "th" ? "ทุกช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก" : "Fields marked * are required"}
        </p>
        <div className="flex gap-2">
          <Link href={`/${locale}/admin/products`} className="btn btn-ghost btn-sm">
            {t("common.cancel")}
          </Link>
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? t("common.saving") : product.id ? t("common.update") : t("common.create")}
          </button>
        </div>
      </div>
    </form>
  );
}
