import Link from "next/link";

export default function LocaleNotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-cream px-6 py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 font-serif text-[32px] sm:text-[38px]">ไม่พบหน้าที่คุณกำลังมองหา</h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        This page could not be found. It may have moved, or the link may be incorrect.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/th" className="btn btn-primary">
          กลับหน้าแรก
        </Link>
        <Link href="/en" className="btn btn-ghost">
          English home
        </Link>
        <Link href="/th/shop" className="btn btn-ghost">
          Shop
        </Link>
      </div>
    </div>
  );
}
