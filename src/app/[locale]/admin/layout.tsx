import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AdminSidebar, type AdminNavSection } from "@/components/admin/admin-sidebar";
import { getCurrentUser, isStaff, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { isLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { logoutAction } from "@/app/actions/auth";
import { IconExternal } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  if (!isStaff(user)) redirect(`/${locale}`);

  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const pendingOrders = await db
    .selectFrom("orders")
    .select(({ fn }) => fn.countAll<string>().as("count"))
    .where("status", "in", ["pending_payment", "awaiting_verification", "paid"])
    .executeTakeFirst();
  const pendingReviews = await db
    .selectFrom("reviews")
    .select(({ fn }) => fn.countAll<string>().as("count"))
    .where("status", "=", "pending")
    .executeTakeFirst();

  const sections: AdminNavSection[] = [];
  if (can(user, PERMISSIONS.DASHBOARD_VIEW) || can(user, PERMISSIONS.REPORT_VIEW)) {
    sections.push({
      label: "Overview",
      items: [
        ...(can(user, PERMISSIONS.DASHBOARD_VIEW)
          ? [{ href: `/${locale}/admin`, label: t("admin.dashboard"), icon: "dashboard" as const }]
          : []),
        ...(can(user, PERMISSIONS.REPORT_VIEW)
          ? [{ href: `/${locale}/admin/reports`, label: t("admin.reports"), icon: "reports" as const }]
          : []),
      ],
    });
  }
  if (
    can(user, PERMISSIONS.PRODUCT_VIEW) ||
    can(user, PERMISSIONS.CATEGORY_MANAGE) ||
    can(user, PERMISSIONS.INVENTORY_VIEW)
  ) {
    sections.push({
      label: "Commerce",
      items: [
        ...(can(user, PERMISSIONS.PRODUCT_VIEW)
          ? [{ href: `/${locale}/admin/products`, label: t("admin.products"), icon: "products" as const }]
          : []),
        ...(can(user, PERMISSIONS.CATEGORY_MANAGE)
          ? [{ href: `/${locale}/admin/categories`, label: t("admin.categories"), icon: "categories" as const }]
          : []),
        ...(can(user, PERMISSIONS.INVENTORY_VIEW)
          ? [{ href: `/${locale}/admin/inventory`, label: t("admin.inventory"), icon: "inventory" as const }]
          : []),
        ...(can(user, PERMISSIONS.ORDER_VIEW)
          ? [
              {
                href: `/${locale}/admin/orders`,
                label: t("admin.orders"),
                icon: "orders" as const,
                badge: Number(pendingOrders?.count ?? 0),
              },
            ]
          : []),
        ...(can(user, PERMISSIONS.CUSTOMER_VIEW)
          ? [{ href: `/${locale}/admin/customers`, label: t("admin.customers"), icon: "customers" as const }]
          : []),
      ],
    });
  }
  if (can(user, PERMISSIONS.COUPON_MANAGE) || can(user, PERMISSIONS.REVIEW_MODERATE)) {
    sections.push({
      label: "Marketing",
      items: [
        ...(can(user, PERMISSIONS.COUPON_MANAGE)
          ? [{ href: `/${locale}/admin/coupons`, label: t("admin.coupons"), icon: "coupons" as const }]
          : []),
        ...(can(user, PERMISSIONS.REVIEW_MODERATE)
          ? [
              {
                href: `/${locale}/admin/reviews`,
                label: t("admin.reviews"),
                icon: "reviews" as const,
                badge: Number(pendingReviews?.count ?? 0),
              },
            ]
          : []),
        ...(can(user, PERMISSIONS.NOTIFICATION_MANAGE)
          ? [{ href: `/${locale}/admin/notifications`, label: t("admin.notifications"), icon: "notifications" as const }]
          : []),
      ],
    });
  }
  if (can(user, PERMISSIONS.CONTENT_MANAGE) || can(user, PERMISSIONS.BLOG_MANAGE)) {
    sections.push({
      label: "Content",
      items: [
        ...(can(user, PERMISSIONS.CONTENT_MANAGE)
          ? [{ href: `/${locale}/admin/content`, label: t("admin.content"), icon: "content" as const }]
          : []),
        ...(can(user, PERMISSIONS.BLOG_MANAGE)
          ? [{ href: `/${locale}/admin/blog`, label: t("admin.blog"), icon: "blog" as const }]
          : []),
      ],
    });
  }
  if (
    can(user, PERMISSIONS.STAFF_MANAGE) ||
    can(user, PERMISSIONS.SETTINGS_MANAGE) ||
    can(user, PERMISSIONS.ACTIVITY_VIEW)
  ) {
    sections.push({
      label: "System",
      items: [
        ...(can(user, PERMISSIONS.STAFF_MANAGE)
          ? [
              { href: `/${locale}/admin/staff`, label: t("admin.staff"), icon: "staff" as const },
              { href: `/${locale}/admin/roles`, label: t("admin.roles"), icon: "roles" as const },
            ]
          : []),
        ...(can(user, PERMISSIONS.SETTINGS_MANAGE)
          ? [{ href: `/${locale}/admin/settings`, label: t("admin.settings"), icon: "settings" as const }]
          : []),
        ...(can(user, PERMISSIONS.ACTIVITY_VIEW)
          ? [{ href: `/${locale}/admin/activity`, label: t("admin.activity"), icon: "activity" as const }]
          : []),
      ],
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f3ee] lg:flex-row">
      <AdminSidebar sections={sections} storeHref={`/${locale}`} />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <p className="text-sm">
              <span className="text-muted">{t("admin.signedInAs")}</span>{" "}
              <span className="font-medium">{user.name}</span>
            </p>
            <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted sm:inline">{user.role.name}</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link href={`/${locale}`} className="flex items-center gap-1.5 text-muted hover:text-primary-dark">
              <IconExternal size={14} />
              {t("admin.viewStore")}
            </Link>
            <form action={logoutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="text-muted hover:text-danger">
                {t("nav.logout")}
              </button>
            </form>
          </div>
        </header>
        <div className="admin-shell min-w-0 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
