"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "./i18n-provider";
import { formatMoney } from "@/lib/money";
import { IconArrowLeft, IconArrowRight, IconSparkle } from "./icons";

type FinderProduct = {
  slug: string;
  name: string;
  price: number;
  compareAt: number | null;
  imageUrl: string | null;
  soldOut: boolean;
};

export function FlowerFinder({
  occasions,
  colors,
  flowerTypes,
}: {
  occasions: Array<{ slug: string; name: string }>;
  colors: string[];
  flowerTypes: string[];
}) {
  const { locale, t } = useI18n();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({ occasion: "", recipient: "", budget: "", color: "", type: "" });
  const [results, setResults] = useState<FinderProduct[] | null>(null);
  const [exact, setExact] = useState(true);
  const [loading, setLoading] = useState(false);

  const budgets = ["0-1500", "1500-2500", "2500-4000", "4000-100000"];
  const recipients = locale === "th" ? ["คนรัก", "ครอบครัว", "เพื่อน", "ลูกค้า / องค์กร"] : ["Partner", "Family", "Friend", "Client / corporate"];

  const search = async () => {
    setLoading(true);
    const params = new URLSearchParams({ locale, ...answers });
    try {
      const response = await fetch(`/api/finder?${params.toString()}`);
      const data = (await response.json()) as { items: FinderProduct[]; exact: boolean };
      setResults(data.items);
      setExact(data.exact);
      setStep(6);
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (step === 5) {
      void search();
      return;
    }
    setStep((current) => Math.min(6, current + 1));
  };

  const stepTitle = [
    t("finder.occasion"),
    t("finder.recipient"),
    t("finder.budget"),
    t("finder.color"),
    t("finder.flower"),
  ][step - 1];

  return (
    <div className="mx-auto max-w-4xl">
      {step <= 5 ? (
        <>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted">
            <span>{t("finder.step", { current: step, total: 5 })}</span>
            <span>{Math.round((step / 5) * 100)}%</span>
          </div>
          <div className="mt-3 h-px bg-line">
            <div className="h-px bg-primary transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }} />
          </div>

          <h2 className="mt-10 text-center font-serif text-[26px] sm:text-[32px]">{stepTitle}</h2>

          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {step === 1
              ? occasions.map((occasion) => (
                  <button
                    key={occasion.slug}
                    type="button"
                    onClick={() => setAnswers({ ...answers, occasion: occasion.slug })}
                    className={`border px-5 py-3 text-sm transition-colors ${
                      answers.occasion === occasion.slug ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white hover:border-primary/60"
                    }`}
                  >
                    {occasion.name}
                  </button>
                ))
              : null}
            {step === 2
              ? recipients.map((recipient) => (
                  <button
                    key={recipient}
                    type="button"
                    onClick={() => setAnswers({ ...answers, recipient })}
                    className={`border px-5 py-3 text-sm transition-colors ${
                      answers.recipient === recipient ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white hover:border-primary/60"
                    }`}
                  >
                    {recipient}
                  </button>
                ))
              : null}
            {step === 3
              ? budgets.map((budget) => (
                  <button
                    key={budget}
                    type="button"
                    onClick={() => setAnswers({ ...answers, budget })}
                    className={`border px-5 py-3 text-sm transition-colors ${
                      answers.budget === budget ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white hover:border-primary/60"
                    }`}
                  >
                    {budget.endsWith("100000")
                      ? `${formatMoney(400000, { locale })} +`
                      : `${formatMoney(Number(budget.split("-")[0]) * 100, { locale })} – ${formatMoney(Number(budget.split("-")[1]) * 100, { locale })}`}
                  </button>
                ))
              : null}
            {step === 4
              ? [...colors, "Mixed"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAnswers({ ...answers, color })}
                    className={`border px-5 py-3 text-sm transition-colors ${
                      answers.color === color ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white hover:border-primary/60"
                    }`}
                  >
                    {color}
                  </button>
                ))
              : null}
            {step === 5
              ? [...flowerTypes, "Mixed"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAnswers({ ...answers, type })}
                    className={`border px-5 py-3 text-sm transition-colors ${
                      answers.type === type ? "border-primary bg-primary-soft text-primary-dark" : "border-line bg-white hover:border-primary/60"
                    }`}
                  >
                    {type}
                  </button>
                ))
              : null}
          </div>

          <div className="mt-10 flex items-center justify-between">
            <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} className={`btn btn-ghost ${step === 1 ? "invisible" : ""}`}>
              <IconArrowLeft size={16} />
              {t("common.back")}
            </button>
            <button type="button" onClick={next} className="btn btn-primary" disabled={loading}>
              {loading ? t("common.loading") : step === 5 ? <>{t("finder.result")} <IconSparkle size={16} /></> : <>{t("common.continue")} <IconArrowRight size={16} /></>}
            </button>
          </div>
        </>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-[26px]">{t("finder.result")}</h2>
            <button type="button" onClick={() => { setStep(1); setResults(null); }} className="text-xs uppercase tracking-[0.14em] text-primary-dark">
              {t("finder.restart")}
            </button>
          </div>
          {!exact ? <p className="mt-2 text-xs text-warning">{t("finder.noResult")}</p> : null}
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {(results ?? []).map((item) => (
              <Link key={item.slug} href={`/${locale}/product/${item.slug}`} className="group">
                <div className="relative aspect-[4/5] overflow-hidden bg-[#f1efe8]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <h3 className="mt-3 font-serif text-base group-hover:text-primary-dark">{item.name}</h3>
                <p className="mt-1 text-sm text-muted">{formatMoney(item.price, { locale })}</p>
              </Link>
            ))}
          </div>
          {results && results.length === 0 ? <p className="mt-8 text-sm text-muted">{t("shop.empty")}</p> : null}
        </div>
      )}
    </div>
  );
}
