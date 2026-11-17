"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconClose } from "./icons";

export type Announcement = { id: string; text: string; href: string | null };

export function AnnouncementBar({ items }: { items: Announcement[] }) {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % items.length), 6000);
    return () => clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("bloome_announcement_hidden") === "1") setDismissed(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (items.length === 0 || dismissed) return null;
  const current = items[index % items.length];

  return (
    <div className="relative bg-primary-dark text-white">
      <div className="container-page flex min-h-9 items-center justify-center gap-4 py-2 text-center text-[11px] tracking-[0.12em]">
        {current.href ? (
          <Link href={current.href} className="hover:underline underline-offset-4">
            {current.text}
          </Link>
        ) : (
          <span>{current.text}</span>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          setDismissed(true);
          try {
            window.sessionStorage.setItem("bloome_announcement_hidden", "1");
          } catch {
            /* ignore */
          }
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/70 hover:text-white"
      >
        <IconClose size={14} />
      </button>
    </div>
  );
}
