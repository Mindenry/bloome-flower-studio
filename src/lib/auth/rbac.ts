export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  PRODUCT_VIEW: "products.view",
  PRODUCT_CREATE: "products.create",
  PRODUCT_UPDATE: "products.update",
  PRODUCT_DELETE: "products.delete",
  CATEGORY_MANAGE: "categories.manage",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_MANAGE: "inventory.manage",
  ORDER_VIEW: "orders.view",
  ORDER_UPDATE: "orders.update",
  ORDER_EXPORT: "orders.export",
  CUSTOMER_VIEW: "customers.view",
  CUSTOMER_UPDATE: "customers.update",
  COUPON_MANAGE: "coupons.manage",
  REVIEW_MODERATE: "reviews.moderate",
  CONTENT_MANAGE: "content.manage",
  BLOG_MANAGE: "blog.manage",
  NOTIFICATION_MANAGE: "notifications.manage",
  REPORT_VIEW: "reports.view",
  STAFF_MANAGE: "staff.manage",
  SETTINGS_MANAGE: "settings.manage",
  ACTIVITY_VIEW: "activity.view",
  PAYMENT_MANAGE: "payments.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const ROLE_PRESETS: Array<{
  slug: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}> = [
  {
    slug: "customer",
    name: "Customer",
    description: "Storefront customer account",
    permissions: [],
    isSystem: true,
  },
  {
    slug: "super_admin",
    name: "Super Admin",
    description: "Unrestricted access to every module",
    permissions: ["*"],
    isSystem: true,
  },
  {
    slug: "admin",
    name: "Admin",
    description: "Day-to-day store administration",
    permissions: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.STAFF_MANAGE && p !== PERMISSIONS.SETTINGS_MANAGE),
    isSystem: true,
  },
  {
    slug: "product_manager",
    name: "Product Manager",
    description: "Catalog, pricing and media",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.PRODUCT_DELETE,
      PERMISSIONS.CATEGORY_MANAGE,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.CONTENT_MANAGE,
    ],
    isSystem: true,
  },
  {
    slug: "order_manager",
    name: "Order Manager",
    description: "Order fulfilment and payments",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_UPDATE,
      PERMISSIONS.ORDER_EXPORT,
      PERMISSIONS.PAYMENT_MANAGE,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.REPORT_VIEW,
    ],
    isSystem: true,
  },
  {
    slug: "inventory_manager",
    name: "Inventory Manager",
    description: "Stock, batches and freshness",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.REPORT_VIEW,
    ],
    isSystem: true,
  },
  {
    slug: "customer_support",
    name: "Customer Support",
    description: "Customers, orders and reviews",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.REVIEW_MODERATE,
    ],
    isSystem: true,
  },
  {
    slug: "content_manager",
    name: "Content Manager",
    description: "CMS, blog and notifications",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.BLOG_MANAGE,
      PERMISSIONS.NOTIFICATION_MANAGE,
    ],
    isSystem: true,
  },
];

export function hasPermission(permissions: string[] | undefined, permission: Permission): boolean {
  if (!permissions) return false;
  return permissions.includes("*") || permissions.includes(permission);
}

export function hasAnyPermission(permissions: string[] | undefined, required: Permission[]): boolean {
  return required.some((p) => hasPermission(permissions, p));
}

/** Human readable groups for the staff management UI. */
export const PERMISSION_GROUPS: Array<{ group: string; permissions: Permission[] }> = [
  { group: "Dashboard", permissions: [PERMISSIONS.DASHBOARD_VIEW] },
  {
    group: "Catalog",
    permissions: [
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.PRODUCT_DELETE,
      PERMISSIONS.CATEGORY_MANAGE,
    ],
  },
  { group: "Inventory", permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE] },
  {
    group: "Orders",
    permissions: [
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_UPDATE,
      PERMISSIONS.ORDER_EXPORT,
      PERMISSIONS.PAYMENT_MANAGE,
    ],
  },
  { group: "Customers", permissions: [PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_UPDATE] },
  { group: "Marketing", permissions: [PERMISSIONS.COUPON_MANAGE, PERMISSIONS.REVIEW_MODERATE] },
  {
    group: "Content",
    permissions: [PERMISSIONS.CONTENT_MANAGE, PERMISSIONS.BLOG_MANAGE, PERMISSIONS.NOTIFICATION_MANAGE],
  },
  { group: "System", permissions: [PERMISSIONS.REPORT_VIEW, PERMISSIONS.ACTIVITY_VIEW] },
  { group: "Administration", permissions: [PERMISSIONS.STAFF_MANAGE, PERMISSIONS.SETTINGS_MANAGE] },
];
