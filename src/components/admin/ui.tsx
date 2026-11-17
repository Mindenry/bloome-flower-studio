import Link from "next/link";
import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-serif text-[24px] leading-tight text-charcoal">{title}</h1>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "danger";
}) {
  const tones: Record<string, string> = {
    default: "bg-white border-line",
    primary: "bg-[#f2f6f1] border-[#dbe5d8]",
    warning: "bg-[#fdf8ef] border-[#f0e2c9]",
    danger: "bg-[#fdf3f1] border-[#f0d8d2]",
  };
  return (
    <div className={`border p-4 ${tones[tone]}`}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1.5 font-serif text-[22px] leading-tight text-charcoal">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function AdminTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto border border-line bg-white">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-[#faf9f5] text-left text-[10px] uppercase tracking-[0.12em] text-muted">
            {head.map((cell) => (
              <th key={cell} className="px-3 py-2.5 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function AdminPeriodTabs({
  current,
  basePath,
  labels,
}: {
  current: string;
  basePath: string;
  labels: Array<{ key: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-1 border border-line bg-white p-1">
      {labels.map((item) => (
        <Link
          key={item.key}
          href={`${basePath}?period=${item.key}`}
          className={`px-3 py-1.5 text-[11px] ${
            current === item.key ? "bg-primary text-white" : "text-muted hover:bg-cream"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "green" | "amber" | "red" | "grey" }) {
  const colors = { green: "bg-[#5b8a63]", amber: "bg-[#c08a45]", red: "bg-[#b4524a]", grey: "bg-[#9b9c95]" };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors[tone]}`} />;
}
