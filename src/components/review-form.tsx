"use client";

import { useActionState, useState } from "react";
import { submitReviewAction } from "@/app/actions/account";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "./i18n-provider";
import { IconStar } from "./icons";

const initial: FormState = { ok: false };

export function ReviewForm({ orderItemId, productName }: { orderItemId: string; productName: string }) {
  const { locale, t } = useI18n();
  const [state, action, pending] = useActionState(submitReviewAction, initial);
  const [rating, setRating] = useState(5);

  if (state.ok) {
    return (
      <div role="status" className="border border-[#d7e6da] bg-[#eef5f0] px-4 py-3 text-xs text-success">
        {state.message ?? t("review.pending")}
      </div>
    );
  }

  return (
    <form action={action} className="border border-line bg-cream p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <input type="hidden" name="rating" value={rating} />
      <p className="text-xs text-muted">{productName}</p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            aria-label={`${star} / 5`}
            aria-pressed={rating === star}
            className={star <= rating ? "text-primary" : "text-line"}
          >
            <IconStar size={20} />
          </button>
        ))}
        <span className="ml-2 text-xs text-muted">{rating}/5</span>
      </div>
      <input type="text" name="title" maxLength={120} placeholder={t("review.title")} className="input mt-3 text-sm" />
      <textarea
        name="body"
        required
        minLength={5}
        maxLength={2000}
        rows={3}
        placeholder={t("review.body")}
        className="textarea mt-2 text-sm"
      />
      {state.error ? <p className="mt-2 text-xs text-danger">{state.error}</p> : null}
      <button type="submit" className="btn btn-primary btn-sm mt-3" disabled={pending}>
        {pending ? t("common.loading") : t("review.submit")}
      </button>
    </form>
  );
}
