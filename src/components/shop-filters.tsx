"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "./i18n-provider";
import { IconClose, IconFilter, IconSearch } from "./icons";

export type FacetData = {
  flowerTypes: string[];
  colors: string[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
};

export type CurrentFilters = {
  category?: string;
  type?: string;
  color?: string;
  size?: string;
  min?: string;
  max?: string;
  stock?: string;
  sale?: string;
};

function OptionRow({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="group flex min-h-9 cursor-pointer items-center gap-2.5 text-[13px] leading-6">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 shrink-0 accent-[#596B55]"
      />
      <span className="flex-1 group-hover:text-[#596B55]">{label}</span>
    </label>
  );
}

function useFilterNavigation(basePath: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (patch: Partial<CurrentFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    const query = params.toString();
    startTransition(() => {
      router.replace(`${basePath}${query ? `?${query}` : ""}`, { scroll: false });
    });
  };

  const clearAll = () => {
    startTransition(() => router.replace(basePath, { scroll: false }));
  };

  return { apply, clearAll, pending };
}

export function ActiveFilterChips({
  basePath,
  current,
  categories,
  total,
}: {
  basePath: string;
  current: CurrentFilters;
  categories: Array<{ slug: string; name: string }>;
  total: number;
}) {
  const { t, locale } = useI18n();
  const { apply, clearAll, pending } = useFilterNavigation(basePath);

  const chips: Array<{ key: keyof CurrentFilters; label: string }> = [];
  if (current.category) {
    const found = categories.find((category) => category.slug === current.category);
    chips.push({ key: "category", label: found?.name ?? current.category });
  }
  if (current.type) chips.push({ key: "type", label: current.type });
  if (current.color) chips.push({ key: "color", label: current.color });
  if (current.size) chips.push({ key: "size", label: current.size });
  if (current.min || current.max) {
    chips.push({
      key: "min",
      label: `฿${current.min ?? "0"} – ${current.max ? `฿${current.max}` : locale === "th" ? "ไม่จำกัด" : "any"}`,
    });
  }
  if (current.stock === "1") chips.push({ key: "stock", label: t("shop.inStock") });
  if (current.sale === "1") chips.push({ key: "sale", label: t("shop.onSale") });

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <span className="text-[11px] text-muted">{t("shop.results", { count: total })}</span>
      {chips.map((chip) => (
        <button
          key={`${chip.key}-${chip.label}`}
          type="button"
          onClick={() =>
            apply(
              chip.key === "min"
                ? { min: undefined, max: undefined }
                : ({ [chip.key]: undefined } as Partial<CurrentFilters>),
            )
          }
          className="inline-flex min-h-8 items-center gap-1.5 border border-[#d9d6cc] bg-white px-2.5 text-[11px] text-charcoal transition-colors hover:border-charcoal"
        >
          {chip.label}
          <IconClose size={12} />
        </button>
      ))}
      {chips.length > 0 ? (
        <button type="button" onClick={clearAll} className="min-h-8 text-[11px] text-primary-dark underline underline-offset-2">
          {t("common.clear")}
        </button>
      ) : null}
    </div>
  );
}

export function ShopFilters({
  basePath,
  facets,
  categories,
  current,
  total,
  showCategories = true,
}: {
  basePath: string;
  facets: FacetData;
  categories: Array<{ slug: string; name: string }>;
  current: CurrentFilters;
  total: number;
  showCategories?: boolean;
}) {
  const { t, locale } = useI18n();
  const { apply, clearAll, pending } = useFilterNavigation(basePath);
  const [open, setOpen] = useState(false);
  const [minValue, setMinValue] = useState(current.min ?? "");
  const [maxValue, setMaxValue] = useState(current.max ?? "");

  useEffect(() => {
    setMinValue(current.min ?? "");
    setMaxValue(current.max ?? "");
  }, [current.min, current.max]);

  const applyPrice = () => apply({ min: minValue || undefined, max: maxValue || undefined });

  const body = (
    <div className={`space-y-7 ${pending ? "pointer-events-none opacity-60" : ""}`} aria-busy={pending}>
      {showCategories ? (
        <fieldset>
          <legend className="label">{locale === "th" ? "หมวดหมู่" : "Category"}</legend>
          <div className="space-y-0.5">
            <OptionRow name="category" value="" label={t("common.all")} checked={!current.category} onChange={(value) => apply({ category: value })} />
            {categories.map((category) => (
              <OptionRow
                key={category.slug}
                name="category"
                value={category.slug}
                label={category.name}
                checked={current.category === category.slug}
                onChange={(value) => apply({ category: value })}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="label">{t("shop.priceRange")}</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={minValue}
            onChange={(event) => setMinValue(event.target.value)}
            onBlur={applyPrice}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyPrice();
              }
            }}
            placeholder={t("shop.priceMin")}
            className="input h-11 text-sm"
            aria-label={t("shop.priceMin")}
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={maxValue}
            onChange={(event) => setMaxValue(event.target.value)}
            onBlur={applyPrice}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyPrice();
              }
            }}
            placeholder={t("shop.priceMax")}
            className="input h-11 text-sm"
            aria-label={t("shop.priceMax")}
          />
        </div>
      </fieldset>

      {facets.flowerTypes.length > 0 ? (
        <fieldset>
          <legend className="label">{locale === "th" ? "ชนิดดอกไม้" : "Flower type"}</legend>
          <div className="space-y-0.5">
            {facets.flowerTypes.map((type) => (
              <OptionRow
                key={type}
                name="type"
                value={type}
                label={type}
                checked={current.type === type}
                onChange={(value) => apply({ type: value })}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      {facets.colors.length > 0 ? (
        <fieldset>
          <legend className="label">{locale === "th" ? "สี" : "Colour"}</legend>
          <div className="flex flex-wrap gap-2">
            {facets.colors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => apply({ color: current.color === color ? undefined : color })}
                aria-pressed={current.color === color}
                className={`min-h-9 border px-3 py-1.5 text-xs transition-colors ${
                  current.color === color ? "border-primary bg-primary text-white" : "border-line bg-white hover:border-primary"
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {facets.sizes.length > 0 ? (
        <fieldset>
          <legend className="label">{locale === "th" ? "ขนาด" : "Size"}</legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => apply({ size: current.size === size ? undefined : size })}
                aria-pressed={current.size === size}
                className={`min-h-9 min-w-11 border px-3 py-1.5 text-xs transition-colors ${
                  current.size === size ? "border-primary bg-primary text-white" : "border-line bg-white hover:border-primary"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="label">{t("shop.availability")}</legend>
        <div className="space-y-0.5">
          <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[13px]">
            <input
              type="checkbox"
              checked={current.stock === "1"}
              onChange={(event) => apply({ stock: event.target.checked ? "1" : undefined })}
              className="h-4 w-4 accent-[#596B55]"
            />
            {t("shop.inStock")}
          </label>
          <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[13px]">
            <input
              type="checkbox"
              checked={current.sale === "1"}
              onChange={(event) => apply({ sale: event.target.checked ? "1" : undefined })}
              className="h-4 w-4 accent-[#596B55]"
            />
            {t("shop.onSale")}
          </label>
        </div>
      </fieldset>

      <button
        type="button"
        onClick={clearAll}
        className="flex min-h-11 w-full items-center justify-center gap-2 border border-line bg-white text-xs uppercase tracking-[0.14em] text-muted transition-colors hover:border-charcoal hover:text-charcoal"
      >
        <IconClose size={14} />
        {t("shop.resetFilters")}
      </button>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost w-full lg:hidden" aria-expanded={open}>
        <IconFilter size={16} />
        {t("shop.filters")}
      </button>

      <aside className="sticky top-28 hidden self-start lg:block">{body}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("shop.filters")}>
          <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-charcoal/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-cream pb-0">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-cream px-6 py-4">
              <p className="text-base font-medium">{t("shop.filters")}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="p-2">
                <IconClose size={22} />
              </button>
            </div>
            <div className="px-6 py-5">{body}</div>
            <div className="sticky bottom-0 border-t border-line bg-cream px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-primary w-full">
                <IconSearch size={16} />
                {t("shop.results", { count: total })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SortSelect({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
      <span className="hidden sm:inline">{t("shop.sort")}</span>
      <select
        value={searchParams.get("sort") ?? "newest"}
        disabled={pending}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          if (event.target.value === "newest") params.delete("sort");
          else params.set("sort", event.target.value);
          params.delete("page");
          startTransition(() => {
            router.replace(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
          });
        }}
        className="input h-10 w-auto py-0 text-xs"
        aria-label={t("shop.sort")}
      >
        <option value="newest">{t("shop.sort.newest")}</option>
        <option value="price_asc">{t("shop.sort.priceAsc")}</option>
        <option value="price_desc">{t("shop.sort.priceDesc")}</option>
        <option value="bestselling">{t("shop.sort.bestselling")}</option>
        <option value="popular">{t("shop.sort.popular")}</option>
      </select>
    </label>
  );
}
