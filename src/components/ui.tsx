import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import type { Locale } from "@/lib/i18n/config";
import { IconStar, IconStarOutline } from "./icons";

export function Price({
  value,
  compareAt,
  locale,
  className = "",
  size = "base",
}: {
  value: number;
  compareAt?: number | null;
  locale: Locale;
  className?: string;
  size?: "sm" | "base" | "lg" | "xl";
}) {
  const sizes = { sm: "text-sm", base: "text-[15px]", lg: "text-lg", xl: "text-2xl" };
  const hasDiscount = compareAt !== null && compareAt !== undefined && compareAt > value;
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className={`${sizes[size]} font-medium tracking-wide ${hasDiscount ? "text-primary-dark" : ""}`}>
        {formatMoney(value, { locale })}
      </span>
      {hasDiscount ? (
        <span className="text-xs text-muted line-through">{formatMoney(compareAt!, { locale })}</span>
      ) : null}
    </span>
  );
}

export function RatingStars({
  value,
  count,
  className = "",
  size = 14,
}: {
  value: number;
  count?: number;
  className?: string;
  size?: number;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-label={`${value} / 5`}>
      <span className="flex items-center gap-0.5 text-primary">
        {Array.from({ length: 5 }).map((_, index) =>
          index < Math.round(value) ? (
            <IconStar key={index} size={size} />
          ) : (
            <IconStarOutline key={index} size={size} />
          ),
        )}
      </span>
      {typeof count === "number" ? <span className="text-xs text-muted">({count})</span> : null}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "dusty" | "success" | "warning" | "danger";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[#f2f1ec] text-charcoal",
    primary: "bg-primary-soft text-primary-dark",
    dusty: "bg-dusty-soft text-[#8d635c]",
    success: "bg-[#eaf2ec] text-success",
    warning: "bg-[#fbf1e4] text-warning",
    danger: "bg-[#fbeae7] text-danger",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${align === "center" ? "sm:flex-col sm:items-center sm:text-center" : ""} ${className}`}
    >
      <div className={align === "center" ? "max-w-2xl" : "max-w-2xl"}>
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h2 className="text-[26px] leading-tight sm:text-[34px]">{title}</h2>
        {description ? <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-line bg-white px-6 py-16 text-center">
      {icon ? <div className="mb-4 text-primary">{icon}</div> : null}
      <p className="font-serif text-xl">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "border-[#dfe6dc] bg-primary-soft text-primary-dark",
    success: "border-[#d7e6da] bg-[#eef5f0] text-success",
    warning: "border-[#f0e0c9] bg-[#fdf6ec] text-warning",
    danger: "border-[#f0d6d0] bg-[#fdf0ed] text-danger",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`border px-4 py-3 text-sm ${tones[tone]}`}>
      {title ? <p className="mb-1 font-medium">{title}</p> : null}
      <div className="[&_p]:leading-relaxed">{children}</div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  buildHref,
  labels,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  labels: { previous: string; next: string; page: string; of: string };
}) {
  if (totalPages <= 1) return null;
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const list = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);

  return (
    <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={`btn btn-ghost btn-sm ${page === 1 ? "pointer-events-none opacity-40" : ""}`}
      >
        {labels.previous}
      </Link>
      {list.map((value, index) => (
        <span key={value} className="flex items-center gap-2">
          {index > 0 && value - list[index - 1] > 1 ? <span className="px-1 text-muted">…</span> : null}
          <Link
            href={buildHref(value)}
            aria-current={value === page ? "page" : undefined}
            className={`flex h-9 min-w-9 items-center justify-center border px-2 text-xs ${
              value === page ? "border-primary bg-primary text-white" : "border-line bg-white text-charcoal hover:border-primary"
            }`}
          >
            {value}
          </Link>
        </span>
      ))}
      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={`btn btn-ghost btn-sm ${page === totalPages ? "pointer-events-none opacity-40" : ""}`}
      >
        {labels.next}
      </Link>
    </nav>
  );
}

const ORDER_STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "dusty"> = {
  pending_payment: "warning",
  awaiting_verification: "warning",
  paid: "primary",
  confirmed: "primary",
  preparing: "primary",
  arranging: "primary",
  quality_check: "primary",
  ready_for_delivery: "primary",
  out_for_delivery: "dusty",
  delivered: "success",
  cancelled: "danger",
  refund_requested: "warning",
  refunded: "neutral",
};

export function OrderStatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={ORDER_STATUS_TONE[status] ?? "neutral"}>{label}</Badge>;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  required,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-primary-dark">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-charcoal">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
