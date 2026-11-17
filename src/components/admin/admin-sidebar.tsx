"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  IconBag,
  IconChart,
  IconClose,
  IconGift,
  IconGrid,
  IconHeart,
  IconMenu,
  IconPackage,
  IconPen,
  IconShield,
  IconSparkle,
  IconTag,
  IconUser,
} from "../icons";

const ICONS = {
  dashboard: IconGrid,
  orders: IconPackage,
  products: IconBag,
  categories: IconTag,
  inventory: IconPackage,
  customers: IconUser,
  coupons: IconTag,
  reviews: IconSparkle,
  content: IconPen,
  blog: IconPen,
  notifications: IconHeart,
  reports: IconChart,
  staff: IconUser,
  roles: IconShield,
  activity: IconChart,
  settings: IconShield,
  payments: IconChart,
  shipping: IconPackage,
  gift: IconGift,
} as const;

export type AdminNavSection = {
  label: string;
  items: Array<{ href: string; label: string; icon: keyof typeof ICONS; badge?: number }>;
};

export function AdminSidebar({ sections, storeHref }: { sections: AdminNavSection[]; storeHref: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="space-y-6">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="px-3 text-[9px] uppercase tracking-[0.22em] text-white/40">{section.label}</p>
          <ul className="mt-2 space-y-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon] ?? IconGrid;
              const active = item.href === pathname || (item.href !== storeHref && pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors ${
                      active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={15} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="flex h-4 min-w-4 items-center justify-center bg-dusty px-1 text-[9px] text-charcoal">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm">
          <IconMenu size={20} />
          Admin
        </button>
        <Link href={storeHref} className="text-xs text-muted">
          View store
        </Link>
      </div>

      <aside className="hidden w-60 shrink-0 bg-[#24261f] lg:block">
        <div className="sticky top-0 flex h-screen flex-col overflow-y-auto p-4">
          <Link href={`${storeHref.split("/").slice(0, 4).join("/")}/admin`} className="mb-8 block">
            <p className="font-serif text-lg tracking-[0.2em] text-white">BLOOMÉ</p>
            <p className="mt-1 text-[8px] uppercase tracking-[0.36em] text-white/40">Studio admin</p>
          </Link>
          {nav}
          <div className="mt-auto pt-6">
            <Link href={storeHref} className="block border border-white/15 px-3 py-2 text-center text-[11px] uppercase tracking-[0.14em] text-white/70 hover:bg-white/5">
              View storefront
            </Link>
          </div>
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-charcoal/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[80%] max-w-xs overflow-y-auto bg-[#24261f] p-5">
            <div className="mb-6 flex items-center justify-between">
              <p className="font-serif text-lg tracking-[0.2em] text-white">BLOOMÉ</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1 text-white/70">
                <IconClose size={20} />
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}
    </>
  );
}
