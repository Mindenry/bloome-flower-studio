import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Base>
);

export const IconUser = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c.8-3.6 3.8-5.6 7.5-5.6s6.7 2 7.5 5.6" />
  </Base>
);

export const IconHeart = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3C19.5 15.4 12 20 12 20Z" />
  </Base>
);

export const IconHeartFilled = (p: IconProps) => (
  <Base {...p} fill="currentColor" stroke="none">
    <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3C19.5 15.4 12 20 12 20Z" />
  </Base>
);

export const IconBag = (p: IconProps) => (
  <Base {...p}>
    <path d="M5.5 8h13l-1 12.5h-11L5.5 8Z" />
    <path d="M9 8V6.6a3 3 0 0 1 6 0V8" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="m15 5-7 7 7 7" />
  </Base>
);

export const IconChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="m9 5 7 7-7 7" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Base>
);

export const IconStar = (p: IconProps) => (
  <Base {...p} fill="currentColor" stroke="none">
    <path d="m12 3.6 2.5 5.3 5.8.8-4.2 4.1 1 5.8-5.1-2.8-5.1 2.8 1-5.8L3.7 9.7l5.8-.8L12 3.6Z" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconMinus = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </Base>
);

export const IconInstagram = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const IconFacebook = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 8h2.5V4.8H14c-2.2 0-3.6 1.5-3.6 3.8V11H8v3.2h2.4V21h3.3v-6.8h2.5l.4-3.2h-2.9V9c0-.6.3-1 1.3-1Z" />
  </Base>
);

export const IconLine = (p: IconProps) => (
  <Base {...p} fill="currentColor" stroke="none">
    <path d="M12 3C6.9 3 3 6.1 3 9.9c0 2.1 1.2 4 3.2 5.3-.2.7-.7 2.5-.8 2.9 0 .4.2.5.5.3.3-.1 2.5-1.6 3.4-2.2.9.2 1.8.3 2.7.3 5.1 0 9-3.1 9-6.9S17.1 3 12 3Zm-4.3 9.3H5.9V8h1.8v2.8h1.7v1.5H7.7Zm2.6 0V8h1.8v4.3H10.3Zm5.1 0h-1.8l-1.7-2.3v2.3h-1.7V8h1.7l1.7 2.3V8h1.8v4.3Zm3.7-2.8h-2.6v.5h2.5v1.4h-2.5v.5h2.6v1.4h-4.3V8h4.3v1.5Z" />
  </Base>
);

export const IconTruck = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </Base>
);

export const IconLeaf = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 4c-8.5.4-14 4-14 10a6 6 0 0 0 6 6c6 0 8-7.6 8-16Z" />
    <path d="M4 20c2.5-5 6-8 11-10" />
  </Base>
);

export const IconShield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 5 6v6c0 4.4 3 7.3 7 8.5 4-1.2 7-4.1 7-8.5V6l-7-2.5Z" />
    <path d="m9 12 2 2 4-4" />
  </Base>
);

export const IconPen = (p: IconProps) => (
  <Base {...p}>
    <path d="M15.5 4.5 19 8 9 18l-4.5 1 1-4.5 10-10Z" />
    <path d="m13 6.5 4 4" />
  </Base>
);

export const IconPhone = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.7 2 2 0 0 1 6 3.5Z" />
  </Base>
);

export const IconMail = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <path d="m4 7 8 6 8-6" />
  </Base>
);

export const IconPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.4-6.5-10a6.5 6.5 0 0 1 13 0C18.5 15.6 12 21 12 21Z" />
    <circle cx="12" cy="11" r="2.4" />
  </Base>
);

export const IconArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Base>
);

export const IconArrowLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </Base>
);

export const IconFilter = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v11m0 0 4-4m-4 4-4-4M4 19h16" />
  </Base>
);

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20V9m0 0 4 4m-4-4-4 4M4 5h16" />
  </Base>
);

export const IconPrinter = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <rect x="7" y="14" width="10" height="6" />
  </Base>
);

export const IconLock = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="10" width="14" height="10" rx="2" />
    <path d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4 3 20h18L12 4Z" />
    <path d="M12 10v4M12 17h.01" />
  </Base>
);

export const IconInfo = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Base>
);

export const IconPackage = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="M4 7.5 12 12l8-4.5M12 12v9" />
  </Base>
);

export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const IconCard = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3 10h18M6.5 14.5h4" />
  </Base>
);

export const IconQR = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="6" height="6" />
    <rect x="14" y="4" width="6" height="6" />
    <rect x="4" y="14" width="6" height="6" />
    <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 20h2M20 14h.01" />
  </Base>
);

export const IconBank = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
  </Base>
);

export const IconSparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
    <path d="M18.5 16.5 19 18l1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" />
  </Base>
);

export const IconGift = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="8.5" width="17" height="4" />
    <path d="M5 12.5V20h14v-7.5M12 8.5V20" />
    <path d="M12 8.5S10.5 4 8.5 4a2 2 0 0 0 0 4.5H12ZM12 8.5S13.5 4 15.5 4a2 2 0 0 1 0 4.5H12Z" />
  </Base>
);

export const IconPinMap = IconPin;
export const IconHome = (p: IconProps) => (
  <Base {...p}>
    <path d="m4 10 8-6 8 6v10H4V10Z" />
    <path d="M10 20v-6h4v6" />
  </Base>
);

export const IconGrid = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="7" height="7" />
    <rect x="13" y="4" width="7" height="7" />
    <rect x="4" y="13" width="7" height="7" />
    <rect x="13" y="13" width="7" height="7" />
  </Base>
);

export const IconChart = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20V4M4 20h16M8 16v-4M12.5 16V8M17 16v-6" />
  </Base>
);

export const IconTag = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 4h7l9 9-7 7-9-9V4Z" />
    <circle cx="8" cy="8" r="1.3" />
  </Base>
);

export const IconStarOutline = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 3.6 2.5 5.3 5.8.8-4.2 4.1 1 5.8-5.1-2.8-5.1 2.8 1-5.8L3.7 9.7l5.8-.8L12 3.6Z" />
  </Base>
);

export const IconExternal = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Base>
);
