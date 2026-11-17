"use client";

import { useActionState } from "react";
import { saveCategoryAction } from "@/app/actions/admin-categories";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "../i18n-provider";

const initial: FormState = { ok: false };

export function CategoryForm({
  locale,
  category,
}: {
  locale: string;
  category?: {
    id: string;
    slug: string;
    kind: string;
    nameTh: string;
    nameEn: string;
    descriptionTh: string;
    descriptionEn: string;
    imageUrl: string;
    sortOrder: number;
    status: string;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveCategoryAction, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cat-nameTh">ชื่อ (TH) *</label>
          <input id="cat-nameTh" name="nameTh" defaultValue={category?.nameTh} required className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="cat-nameEn">Name (EN) *</label>
          <input id="cat-nameEn" name="nameEn" defaultValue={category?.nameEn} required className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="cat-slug">Slug *</label>
          <input id="cat-slug" name="slug" defaultValue={category?.slug} required className="input h-9 text-xs font-mono" />
        </div>
        <div>
          <label className="label" htmlFor="cat-kind">Kind</label>
          <select id="cat-kind" name="kind" defaultValue={category?.kind ?? "category"} className="input h-9 text-xs">
            <option value="category">category</option>
            <option value="collection">collection</option>
            <option value="occasion">occasion</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cat-image">Image URL</label>
          <input id="cat-image" name="imageUrl" defaultValue={category?.imageUrl} className="input h-9 text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="cat-sort">Sort</label>
            <input id="cat-sort" name="sortOrder" type="number" min={0} defaultValue={category?.sortOrder ?? 0} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="cat-status">Status</label>
            <select id="cat-status" name="status" defaultValue={category?.status ?? "active"} className="input h-9 text-xs">
              <option value="active">active</option>
              <option value="hidden">hidden</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="cat-descTh">คำอธิบาย (TH)</label>
          <input id="cat-descTh" name="descriptionTh" defaultValue={category?.descriptionTh} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="cat-descEn">Description (EN)</label>
          <input id="cat-descEn" name="descriptionEn" defaultValue={category?.descriptionEn} className="input h-9 text-xs" />
        </div>
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-success">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}
