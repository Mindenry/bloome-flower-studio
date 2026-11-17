"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { useI18n } from "./i18n-provider";
import { IconClose, IconSearch } from "./icons";

type SuggestProduct = {
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

type SuggestResponse = {
  products: SuggestProduct[];
  categories: Array<{ slug: string; name: string; kind: string }>;
  popular: string[];
};

const RECENT_KEY = "bloome_recent_searches";

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SuggestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`${RECENT_KEY}_${locale}`);
      if (stored) setRecent(JSON.parse(stored).slice(0, 5));
    } catch {
      /* ignore */
    }
  }, [locale]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(trimmed)}&locale=${locale}`,
          { signal: controller.signal },
        );
        if (response.ok) setResults((await response.json()) as SuggestResponse);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, locale]);

  const persist = (term: string) => {
    try {
      const next = [term, ...recent.filter((item) => item !== term)].slice(0, 5);
      window.localStorage.setItem(`${RECENT_KEY}_${locale}`, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const go = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    persist(trimmed);
    onClose();
    router.push(`/${locale}/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-cream/98 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t("nav.search")}>
      <div className="container-page pt-6">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{t("nav.search")}</span>
          <button type="button" onClick={onClose} className="p-2 hover:text-primary-dark" aria-label={t("nav.close")}>
            <IconClose size={22} />
          </button>
        </div>
        <form
          className="mt-8 flex items-center gap-3 border-b border-charcoal/30 pb-3"
          onSubmit={(event) => {
            event.preventDefault();
            go(query);
          }}
        >
          <IconSearch size={22} className="text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={locale === "th" ? "ค้นหาดอกไม้ ช่อ หรือโอกาส…" : "Search flowers, bouquets or occasions…"}
            className="w-full bg-transparent font-serif text-xl outline-none placeholder:text-muted/70 sm:text-2xl"
            aria-label={t("nav.search")}
          />
          <button type="submit" className="btn btn-primary btn-sm shrink-0">
            {t("common.search")}
          </button>
        </form>

        <div className="mt-8 grid gap-10 pb-16 md:grid-cols-[1.4fr_1fr]">
          <div>
            {query.trim().length >= 2 ? (
              <div>
                <p className="eyebrow mb-4">{loading ? t("common.loading") : t("common.results")}</p>
                <div className="space-y-1">
                  {results?.products.map((product) => (
                    <Link
                      key={product.slug}
                      href={`/${locale}/product/${product.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-4 border-b border-line py-3 hover:bg-white"
                    >
                      <span className="relative h-14 w-12 shrink-0 overflow-hidden bg-white">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt={product.name} fill sizes="48px" className="object-cover" />
                        ) : null}
                      </span>
                      <span className="flex-1 text-sm">{product.name}</span>
                      <span className="text-sm text-muted">{formatMoney(product.price, { locale })}</span>
                    </Link>
                  ))}
                  {!loading && results && results.products.length === 0 ? (
                    <p className="text-sm text-muted">{t("shop.empty")}</p>
                  ) : null}
                </div>
                {results?.categories.length ? (
                  <div className="mt-6">
                    <p className="eyebrow mb-3">{t("nav.occasions")}</p>
                    <div className="flex flex-wrap gap-2">
                      {results.categories.map((category) => (
                        <Link
                          key={category.slug}
                          href={`/${locale}/${category.kind === "occasion" ? "occasion" : "category"}/${category.slug}`}
                          onClick={onClose}
                          className="border border-line bg-white px-3 py-1.5 text-xs hover:border-primary"
                        >
                          {category.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-8">
                {recent.length > 0 ? (
                  <div>
                    <p className="eyebrow mb-3">{locale === "th" ? "ค้นหาล่าสุด" : "Recent searches"}</p>
                    <div className="flex flex-wrap gap-2">
                      {recent.map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => setQuery(term)}
                          className="border border-line bg-white px-3 py-1.5 text-xs hover:border-primary"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div>
                  <p className="eyebrow mb-3">{locale === "th" ? "ยอดนิยม" : "Popular"}</p>
                  <div className="flex flex-wrap gap-2">
                    {(results?.popular ?? []).map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="border border-line bg-white px-3 py-1.5 text-xs hover:border-primary"
                      >
                        {term}
                      </button>
                    ))}
                    {!results
                      ? ["กุหลาบ", "วันเกิด", "ช่อเจ้าสาว", "ทานตะวัน", "ดอกไม้แห้ง"].map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => setQuery(term)}
                            className="border border-line bg-white px-3 py-1.5 text-xs hover:border-primary"
                          >
                            {term}
                          </button>
                        ))
                      : null}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="border-l border-line pl-8">
            <p className="eyebrow mb-3">{t("nav.flowerFinder")}</p>
            <p className="text-sm leading-relaxed text-muted">{t("finder.subtitle")}</p>
            <Link href={`/${locale}/flower-finder`} onClick={onClose} className="btn btn-outline btn-sm mt-4">
              {t("finder.title")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
