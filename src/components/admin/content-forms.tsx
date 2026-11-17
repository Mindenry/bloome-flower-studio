"use client";

import { useActionState } from "react";
import {
  saveBannerAction,
  saveBlogPostAction,
  saveFaqAction,
  saveGalleryAction,
  savePageAction,
} from "@/app/actions/admin-content";
import { broadcastNotificationAction } from "@/app/actions/admin-marketing";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "../i18n-provider";

const initial: FormState = { ok: false };

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p className="mt-2 text-xs text-danger">{state.error}</p>;
  if (state.ok) return <p className="mt-2 text-xs text-success">{state.message ?? "Saved"}</p>;
  return null;
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  const { t } = useI18n();
  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
      {pending ? t("common.saving") : label}
    </button>
  );
}

export function BannerForm({
  locale,
  banner,
}: {
  locale: string;
  banner?: {
    id: string;
    placement: string;
    titleTh: string;
    titleEn: string;
    subtitleTh: string;
    subtitleEn: string;
    imageUrl: string;
    linkUrl: string;
    ctaTh: string;
    ctaEn: string;
    sortOrder: number;
    status: string;
    startsAt: string;
    endsAt: string;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveBannerAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {banner ? <input type="hidden" name="id" value={banner.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="banner-placement">Placement</label>
          <select id="banner-placement" name="placement" defaultValue={banner?.placement ?? "announcement"} className="input h-9 text-xs">
            <option value="announcement">announcement</option>
            <option value="home_hero">home_hero</option>
            <option value="home_special">home_special</option>
            <option value="social">social</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="banner-status">Status</label>
          <select id="banner-status" name="status" defaultValue={banner?.status ?? "active"} className="input h-9 text-xs">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="banner-titleTh">Title (TH) *</label>
          <input id="banner-titleTh" name="titleTh" defaultValue={banner?.titleTh} required className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-titleEn">Title (EN) *</label>
          <input id="banner-titleEn" name="titleEn" defaultValue={banner?.titleEn} required className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-subTh">Subtitle (TH)</label>
          <input id="banner-subTh" name="subtitleTh" defaultValue={banner?.subtitleTh} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-subEn">Subtitle (EN)</label>
          <input id="banner-subEn" name="subtitleEn" defaultValue={banner?.subtitleEn} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-image">Image URL</label>
          <input id="banner-image" name="imageUrl" defaultValue={banner?.imageUrl} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-link">Link URL</label>
          <input id="banner-link" name="linkUrl" defaultValue={banner?.linkUrl} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-ctaTh">CTA (TH)</label>
          <input id="banner-ctaTh" name="ctaTh" defaultValue={banner?.ctaTh} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-ctaEn">CTA (EN)</label>
          <input id="banner-ctaEn" name="ctaEn" defaultValue={banner?.ctaEn} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-start">Starts</label>
          <input id="banner-start" name="startsAt" type="datetime-local" defaultValue={banner?.startsAt?.slice(0, 16) ?? ""} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-end">Ends</label>
          <input id="banner-end" name="endsAt" type="datetime-local" defaultValue={banner?.endsAt?.slice(0, 16) ?? ""} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="banner-sort">Sort</label>
          <input id="banner-sort" name="sortOrder" type="number" defaultValue={banner?.sortOrder ?? 0} className="input h-9 text-xs" />
        </div>
      </div>
      <Feedback state={state} />
      <Submit pending={pending} label={t("common.save")} />
    </form>
  );
}

export function PageForm({
  locale,
  page,
}: {
  locale: string;
  page?: {
    id: string;
    slug: string;
    template: string;
    status: string;
    titleTh: string;
    titleEn: string;
    bodyTh: string;
    bodyEn: string;
    metaTitleTh: string;
    metaTitleEn: string;
    metaDescriptionTh: string;
    metaDescriptionEn: string;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(savePageAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {page ? <input type="hidden" name="id" value={page.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="page-slug">Slug *</label>
          <input id="page-slug" name="slug" defaultValue={page?.slug} required className="input h-9 text-xs font-mono" />
        </div>
        <div>
          <label className="label" htmlFor="page-template">Template</label>
          <select id="page-template" name="template" defaultValue={page?.template ?? "page"} className="input h-9 text-xs">
            {["page", "about", "contact", "faq", "policy"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="page-status">Status</label>
          <select id="page-status" name="status" defaultValue={page?.status ?? "published"} className="input h-9 text-xs">
            <option value="published">published</option>
            <option value="draft">draft</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="page-titleTh">Title (TH) *</label>
          <input id="page-titleTh" name="titleTh" defaultValue={page?.titleTh} required className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="page-titleEn">Title (EN) *</label>
          <input id="page-titleEn" name="titleEn" defaultValue={page?.titleEn} required className="input h-9 text-xs" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="page-bodyTh">Body (TH) *</label>
          <textarea id="page-bodyTh" name="bodyTh" defaultValue={page?.bodyTh} rows={8} required className="textarea text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="page-bodyEn">Body (EN) *</label>
          <textarea id="page-bodyEn" name="bodyEn" defaultValue={page?.bodyEn} rows={8} required className="textarea text-xs" />
        </div>
      </div>
      <Feedback state={state} />
      <Submit pending={pending} label={t("common.save")} />
    </form>
  );
}

export function FaqForm({
  locale,
  faq,
}: {
  locale: string;
  faq?: {
    id: string;
    category: string;
    questionTh: string;
    questionEn: string;
    answerTh: string;
    answerEn: string;
    sortOrder: number;
    status: string;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveFaqAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {faq ? <input type="hidden" name="id" value={faq.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="faq-qTh">Question (TH) *</label>
          <input id="faq-qTh" name="questionTh" defaultValue={faq?.questionTh} required className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="faq-qEn">Question (EN) *</label>
          <input id="faq-qEn" name="questionEn" defaultValue={faq?.questionEn} required className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="faq-aTh">Answer (TH)</label>
          <textarea id="faq-aTh" name="answerTh" defaultValue={faq?.answerTh} rows={3} required className="textarea text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="faq-aEn">Answer (EN)</label>
          <textarea id="faq-aEn" name="answerEn" defaultValue={faq?.answerEn} rows={3} required className="textarea text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="faq-category">Category</label>
          <input id="faq-category" name="category" defaultValue={faq?.category} className="input h-9 text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="faq-sort">Sort</label>
            <input id="faq-sort" name="sortOrder" type="number" defaultValue={faq?.sortOrder ?? 0} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="faq-status">Status</label>
            <select id="faq-status" name="status" defaultValue={faq?.status ?? "active"} className="input h-9 text-xs">
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
        </div>
      </div>
      <Feedback state={state} />
      <Submit pending={pending} label={t("common.save")} />
    </form>
  );
}

export function GalleryForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveGalleryAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input name="imageUrl" placeholder="Image URL" required className="input h-9 flex-1 text-xs" />
      <input name="linkUrl" placeholder="Link" className="input h-9 max-w-[160px] text-xs" />
      <input name="caption" placeholder="Caption" className="input h-9 max-w-[140px] text-xs" />
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {t("common.create")}
      </button>
      {state.error ? <p className="w-full text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}

export function BroadcastForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(broadcastNotificationAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="titleTh" placeholder="หัวข้อ (TH)" required className="input h-9 text-xs" />
        <input name="titleEn" placeholder="Title (EN)" required className="input h-9 text-xs" />
        <textarea name="bodyTh" placeholder="ข้อความ (TH)" rows={3} className="textarea text-xs" />
        <textarea name="bodyEn" placeholder="Message (EN)" rows={3} className="textarea text-xs" />
        <input name="linkUrl" placeholder="/th/shop" className="input h-9 text-xs" />
        <select name="audience" className="input h-9 text-xs">
          <option value="marketing">{locale === "th" ? "ลูกค้าที่ให้ความยินยอมรับข่าวสาร" : "Marketing-consented customers"}</option>
          <option value="customers">{locale === "th" ? "ลูกค้าทั้งหมด" : "All customers"}</option>
          <option value="staff">Staff only (in-app admin)</option>
        </select>
      </div>
      <p className="text-[11px] text-muted">
        {locale === "th"
          ? "ข้อความโฆษณาจะส่งเฉพาะผู้ที่ให้ความยินยอมตาม PDPA เท่านั้น"
          : "Promotional messages are only delivered to customers who opted in (PDPA)."}
      </p>
      <Feedback state={state} />
      <Submit pending={pending} label={t("common.create")} />
    </form>
  );
}

export function BlogForm({
  locale,
  post,
}: {
  locale: string;
  post?: {
    id: string;
    slug: string;
    category: string;
    coverImage: string;
    status: string;
    titleTh: string;
    titleEn: string;
    excerptTh: string;
    excerptEn: string;
    contentTh: string;
    contentEn: string;
    metaTitleTh: string;
    metaTitleEn: string;
    metaDescriptionTh: string;
    metaDescriptionEn: string;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveBlogPostAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="blog-slug">Slug *</label>
          <input id="blog-slug" name="slug" defaultValue={post?.slug} required className="input h-9 text-xs font-mono" />
        </div>
        <div>
          <label className="label" htmlFor="blog-category">Category</label>
          <input id="blog-category" name="category" defaultValue={post?.category} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="blog-status">Status</label>
          <select id="blog-status" name="status" defaultValue={post?.status ?? "draft"} className="input h-9 text-xs">
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="blog-cover">Cover image URL</label>
          <input id="blog-cover" name="coverImage" defaultValue={post?.coverImage} className="input h-9 text-xs" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="titleTh" defaultValue={post?.titleTh} placeholder="หัวข้อ (TH)" required className="input h-9 text-xs" />
        <input name="titleEn" defaultValue={post?.titleEn} placeholder="Title (EN)" required className="input h-9 text-xs" />
        <textarea name="excerptTh" defaultValue={post?.excerptTh} placeholder="เกริ่นนำ (TH)" rows={2} className="textarea text-xs" />
        <textarea name="excerptEn" defaultValue={post?.excerptEn} placeholder="Excerpt (EN)" rows={2} className="textarea text-xs" />
        <textarea name="contentTh" defaultValue={post?.contentTh} placeholder="เนื้อหา (TH)" rows={10} required className="textarea text-xs" />
        <textarea name="contentEn" defaultValue={post?.contentEn} placeholder="Content (EN)" rows={10} required className="textarea text-xs" />
      </div>
      <Feedback state={state} />
      <Submit pending={pending} label={t("common.save")} />
    </form>
  );
}
