import { notFound, redirect } from "next/navigation";
import { AccountNav } from "@/components/account-nav";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isLocale } from "@/lib/i18n/config";
import { nowIso } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`);

  const unread = await db
    .selectFrom("notifications")
    .select(({ fn }) => fn.countAll<string>().as("count"))
    .where("user_id", "=", user.id)
    .where("read_at", "is", null)
    .executeTakeFirst();
  void nowIso;

  return (
    <div className="container-page py-8 md:py-12">
      <h1 className="mb-6 font-serif text-[26px] md:text-[30px]">{user.name}</h1>
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <AccountNav locale={locale} unreadCount={Number(unread?.count ?? 0)} userName={user.name} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
