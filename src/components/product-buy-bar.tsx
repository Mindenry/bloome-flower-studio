"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n-provider";

export function ProductBuyBar({ priceLabel, productName }: { priceLabel: string; productName: string }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById("buy-form");
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(!entries[0]?.isIntersecting),
      { rootMargin: "-80px 0px -20% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} />
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 px-4 py-3 backdrop-blur transition-transform duration-300 lg:hidden ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!visible}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted">{productName}</p>
            <p className="text-[15px] font-medium">{priceLabel}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary shrink-0"
            tabIndex={visible ? 0 : -1}
            onClick={() => {
              document.getElementById("buy-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            {t("product.addToCart")}
          </button>
        </div>
      </div>
    </>
  );
}
