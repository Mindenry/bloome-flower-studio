"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "./i18n-provider";

const STORAGE_KEY = "bloome_cookie_choice";

export function CookieConsent() {
  const { locale, t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const choose = (choice: "all" | "essential") => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur">
      <div className="container-page flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-relaxed text-muted">
          {t("cookie.message")}{" "}
          <Link href={`/${locale}/policies/cookie-policy`} className="text-primary-dark underline underline-offset-2">
            {t("cookie.policy")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose("essential")}>
            {t("cookie.essential")}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => choose("all")}>
            {t("cookie.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
