import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Photo credits",
  description: "Photography credits and licences for BLOOMÉ FLOWER STUDIO.",
  alternates: { canonical: "/photo-credits" },
};

type CreditEntry = { id: string; file: string };
type Manifest = Record<string, CreditEntry[]>;

async function loadCredits(): Promise<Manifest> {
  try {
    const file = path.join(process.cwd(), "public", "photo-credits.json");
    return JSON.parse(await readFile(file, "utf8")) as Manifest;
  } catch {
    return {};
  }
}

export default async function PhotoCreditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const manifest = await loadCredits();
  const entries = Object.entries(manifest).flatMap(([group, list]) =>
    list.map((item) => ({ ...item, group })),
  );

  return (
    <div className="container-page py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">{locale === "th" ? "เครดิตภาพ" : "Photography"}</p>
        <h1 className="mt-3 text-[30px] sm:text-[38px]">
          {locale === "th" ? "เครดิตและลิขสิทธิ์ภาพถ่าย" : "Photo credits & licences"}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {locale === "th"
            ? "ภาพถ่ายดอกไม้บนเว็บไซต์นี้เป็นภาพจริงจากช่างภาพบน Pexels ซึ่งอนุญาตให้ใช้เชิงพาณิชย์ได้ฟรี โดยเราให้เครดิตและลิงก์ไปยังต้นฉบับทุกภาพด้านล่างนี้ ภาพสินค้าจริงของทางร้านจะถูกอัปโหลดแทนที่ผ่านระบบหลังบ้านเมื่อพร้อม"
            : "The flower photography on this site is real photography by Pexels contributors, used under the Pexels licence (free for commercial use). We credit and link every original below. Studio-owned product photography can replace these through the admin media library."}
        </p>

        <div className="mt-8 border border-line bg-white">
          <div className="border-b border-line px-5 py-4 text-[12px] text-muted">
            {entries.length} {locale === "th" ? "ภาพ" : "photographs"}
          </div>
          <ul className="divide-y divide-line">
            {entries.map((item, index) => (
              <li key={`${item.group}-${item.id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[12px]">
                <span className="font-mono text-[10px] text-muted">{item.file.split("/").pop()}</span>
                <a
                  href={`https://www.pexels.com/photo/${item.id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-dark underline underline-offset-2"
                >
                  Pexels #{item.id}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs text-muted">
          <Link href={`/${locale}`} className="underline underline-offset-2">
            {t("nav.home")}
          </Link>
          {" · "}
          <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Pexels license
          </a>
        </p>
      </div>
    </div>
  );
}
