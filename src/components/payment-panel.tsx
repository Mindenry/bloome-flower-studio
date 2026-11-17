"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { submitTransferProofAction, simulateSandboxAction } from "@/app/actions/order";
import type { FormState } from "@/lib/schemas";
import { formatMoney } from "@/lib/money";
import { useI18n } from "./i18n-provider";
import { Alert } from "./ui";
import { IconBank, IconCheck, IconClock, IconQR } from "./icons";

const initial: FormState = { ok: false };

export function PaymentPanel({
  orderNumber,
  payment,
  bank,
  isSandbox,
}: {
  orderNumber: string;
  payment: {
    id: string;
    status: string;
    method: string;
    amount: number;
    qrPayload: string | null;
    checkoutUrl: string | null;
    expiresAt: string | null;
  } | null;
  bank: { name: string; accountName: string; accountNumber: string };
  isSandbox: boolean;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(submitTransferProofAction, initial);
  const [remaining, setRemaining] = useState<number>(() =>
    payment?.expiresAt ? Math.max(0, new Date(payment.expiresAt).getTime() - Date.now()) : 0,
  );

  const awaiting = payment && ["pending", "processing", "awaiting_verification"].includes(payment.status);

  useEffect(() => {
    if (!payment?.expiresAt) return;
    const timer = setInterval(() => {
      setRemaining(Math.max(0, new Date(payment.expiresAt!).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [payment?.expiresAt]);

  useEffect(() => {
    if (!awaiting) return;
    const interval = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(interval);
  }, [awaiting, router]);

  if (!payment) return null;

  if (payment.status === "succeeded") {
    return (
      <Alert tone="success" title={t("payment.paid")}>
        {formatMoney(payment.amount, { locale })}
      </Alert>
    );
  }

  const expired = payment.status === "expired" || (payment.status === "pending" && remaining <= 0 && Boolean(payment.expiresAt));
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="border border-line bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl">{t("payment.title")}</h2>
        <span className="text-xs text-muted">
          {t("payment.amount")}: <strong className="text-charcoal">{formatMoney(payment.amount, { locale })}</strong>
        </span>
      </div>

      {expired ? (
        <div className="mt-4">
          <Alert tone="warning" title={t("payment.expired")}>
            {locale === "th"
              ? "คำสั่งซื้อนี้ถูกยกเลิกและคืนสต็อกแล้ว กรุณาสั่งซื้อใหม่"
              : "This order has been cancelled and its stock returned. Please place a new order."}
          </Alert>
        </div>
      ) : (
        <>
          {payment.expiresAt ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted" aria-live="polite">
              <IconClock size={14} className="text-primary" />
              {t("payment.expires")}: {minutes}:{String(seconds).padStart(2, "0")}
            </p>
          ) : null}

          {payment.method === "promptpay" ? (
            <div className="mt-5 flex flex-col items-center gap-4 border border-line bg-cream p-6 sm:flex-row">
              {payment.qrPayload && payment.qrPayload.startsWith("http") ? (
                <div className="relative h-52 w-52 shrink-0 bg-white p-2">
                  <Image src={payment.qrPayload} alt="PromptPay QR" fill sizes="208px" className="object-contain" unoptimized />
                </div>
              ) : (
                <div className="flex h-52 w-52 shrink-0 flex-col items-center justify-center border border-dashed border-line bg-white text-center text-xs text-muted">
                  <IconQR size={40} className="mb-2 text-primary" />
                  {payment.qrPayload ? (
                    <span className="break-all px-3 font-mono text-[9px]">{payment.qrPayload}</span>
                  ) : (
                    <span>{t("admin.notConfigured")}</span>
                  )}
                </div>
              )}
              <div className="text-sm">
                <p className="font-medium">{t("payment.qr")}</p>
                <p className="mt-1 text-xs text-muted">
                  {locale === "th"
                    ? "เปิดแอปธนาคาร เลือก PromptPay แล้วสแกน QR นี้ ยอดเงินจะถูกตรวจสอบจากผู้ให้บริการโดยอัตโนมัติ"
                    : "Open your banking app, choose PromptPay and scan. Payment is confirmed by the provider automatically."}
                </p>
                {payment.checkoutUrl ? (
                  <a href={payment.checkoutUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm mt-4">
                    {t("payment.payNow")}
                  </a>
                ) : null}
                {isSandbox ? (
                  <form action={simulateSandboxAction} className="mt-4">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="orderNumber" value={orderNumber} />
                    <button type="submit" className="btn btn-ghost btn-sm">
                      {t("payment.simulate")}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : null}

          {payment.method === "card" ? (
            <div className="mt-5 border border-line bg-cream p-5 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <IconQR size={16} className="text-primary" />
                {t("checkout.payment.card")}
              </p>
              <p className="mt-2 text-xs text-muted">{t("checkout.payment.secureNote")}</p>
              {payment.checkoutUrl ? (
                <a href={payment.checkoutUrl} className="btn btn-primary btn-sm mt-4">
                  {t("payment.payNow")}
                </a>
              ) : (
                <p className="mt-3 text-xs text-danger">{t("error.paymentNotConfigured")}</p>
              )}
            </div>
          ) : null}

          {payment.method === "bank_transfer" ? (
            <div className="mt-5 space-y-4">
              <div className="border border-line bg-cream p-5 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <IconBank size={16} className="text-primary" />
                  {t("payment.bankDetails")}
                </p>
                <dl className="mt-3 space-y-1 text-xs text-muted">
                  <div className="flex gap-2">
                    <dt className="w-24">Bank</dt>
                    <dd className="text-charcoal">{bank.name}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24">Account</dt>
                    <dd className="text-charcoal">{bank.accountName}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24">Number</dt>
                    <dd className="font-mono text-sm tracking-wide text-charcoal">{bank.accountNumber}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24">{t("payment.orderNumber")}</dt>
                    <dd className="text-charcoal">{orderNumber}</dd>
                  </div>
                </dl>
              </div>
              <form action={action} className="space-y-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="orderNumber" value={orderNumber} />
                <label className="label" htmlFor="reference">
                  {t("payment.uploadSlip")}
                </label>
                <div className="flex gap-2">
                  <input
                    id="reference"
                    name="reference"
                    className="input flex-1"
                    placeholder={locale === "th" ? "เวลาหรือเลขอ้างอิงการโอน" : "Transfer time or reference"}
                    required
                  />
                  <button type="submit" className="btn btn-primary shrink-0" disabled={pending}>
                    {pending ? t("common.loading") : t("common.confirm")}
                  </button>
                </div>
                <p className="text-[11px] text-muted">{t("payment.slipNote")}</p>
                {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
                {state.ok ? <p className="text-xs text-success">{state.message}</p> : null}
              </form>
            </div>
          ) : null}

          {payment.method === "cod" ? (
            <div className="mt-5">
              <Alert tone="info">{t("checkout.payment.cod")}</Alert>
            </div>
          ) : null}

          {payment.status === "awaiting_verification" ? (
            <p className="mt-4 flex items-center gap-2 text-xs text-warning">
              <IconClock size={14} />
              {t("payment.awaitingVerification")}
            </p>
          ) : null}
          {payment.status === "failed" ? (
            <p className="mt-4 flex items-center gap-2 text-xs text-danger">
              <IconCheck size={14} />
              {t("payment.failed")}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
