import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getSettings } from "@/lib/settings";
import type { Locale } from "@/lib/i18n/config";

const AUTH_IMAGES = [
  "/uploads/seed/pexels/florist-08.webp",
  "/uploads/seed/pexels/peonies-03.webp",
  "/uploads/seed/pexels/box-07.webp",
  "/uploads/seed/pexels/dried-01.webp",
  "/uploads/seed/pexels/bridal-10.webp",
];

export async function AuthShell({
  locale,
  title,
  subtitle,
  children,
  imageIndex = 0,
}: {
  locale: Locale;
  title: string;
  subtitle?: string;
  children: ReactNode;
  imageIndex?: number;
}) {
  const settings = await getSettings();
  const image = AUTH_IMAGES[imageIndex % AUTH_IMAGES.length];

  return (
    <div className="container-page py-10 md:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden border border-line bg-white lg:grid-cols-2">
        <div className="relative hidden min-h-[560px] lg:block">
          <Image src={image} alt={settings.store.tagline} fill sizes="50vw" className="object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-8 text-white">
            <p className="font-serif text-xl tracking-wide">{settings.store.nameEn.replace(" FLOWER STUDIO", "")}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.34em] text-white/70">{settings.store.tagline}</p>
          </div>
        </div>
        <div className="px-6 py-10 sm:px-10 lg:py-14">
          <Link href={`/${locale}`} className="eyebrow hover:text-primary-dark">
            ← {locale === "th" ? "กลับหน้าร้าน" : "Back to store"}
          </Link>
          <h1 className="mt-4 text-[26px] leading-tight sm:text-[30px]">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
