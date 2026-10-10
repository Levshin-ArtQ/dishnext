import type { ReactNode } from "react";

export type IconName =
  | "clock"
  | "leaf"
  | "flame"
  | "chicken"
  | "pork"
  | "fish"
  | "veg"
  | "heart"
  | "close"
  | "skip"
  | "check"
  | "link"
  | "chef"
  | "bookmark"
  | "sliders"
  | "spark"
  | "cart"
  | "home"
  | "back"
  | "search"
  | "skillet"
  | "pot"
  | "oven";

const PATHS: Record<IconName, ReactNode> = {
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4l2.5 1.5" />
    </>
  ),
  leaf: <path d="M5 19c8-1 13-7 14-14-7 1-13 6-14 14zM8 16c2-2 5-4 8-5" />,
  flame: <path d="M12 21c4 0 6-3 6-6 0-4-3-6-3-9 0 0-2 2-3 4-1-3-3-5-3-5 0 4-3 6-3 10 0 3 2 6 6 6z" />,
  chicken: (
    <>
      <path d="M14.8 4.8a2.4 2.4 0 0 1 3.4 3.4L11 15.4 8.2 18H6v-2.2l2.6-2.8 7.2-8.2z" />
      <path d="M8.4 15.6h3.1" />
      <circle cx="17.2" cy="6.4" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  pork: (
    <>
      <path d="M7.5 13.2c.2-3 2.6-5.6 5.6-5.6 2.8 0 4.6 2.2 5.4 4.8 1.7.1 2.8 1.5 2 3-.9 1.6-2.6 2.2-5.2 2.2H10.2c-2.1 0-3.4-.8-3.4-2.4 0-.6.2-1.3.7-2z" />
      <path d="M9.4 8.4C8 6.4 6.2 6 5 7.2" />
      <path d="M11 11.2h.1M13.6 10.6h.1" />
    </>
  ),
  fish: (
    <>
      <path d="M4 12s4-5 10-5c4 0 6 2 6 5s-2 5-6 5c-6 0-10-5-10-5z" />
      <path d="M4 12l-2 3v-6l2 3z" />
      <circle cx="15.5" cy="11.2" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  veg: <path d="M12 21V11m0 0c-4-6-8-6-8-6 4 0 8 2 8 6 0-4 4-6 8-6 0 0-4 0-8 6z" />,
  heart: <path d="M12 19s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />,
  close: <path d="M7 7l10 10M17 7 7 17" />,
  skip: <path d="M8 7l7 5-7 5V7zM16.5 7v10" />,
  check: <path d="M5 12.5 9.5 17 19 7.5" />,
  link: (
    <>
      <path d="M10 14l4-4" />
      <path d="M8 16a4 4 0 0 1 0-5.5l2-2a4 4 0 0 1 5.5 5.5" />
      <path d="M16 8a4 4 0 0 1 0 5.5l-2 2A4 4 0 0 1 8.5 10" />
    </>
  ),
  chef: (
    <>
      <path d="M8 10a4 4 0 1 1 8 0v1H8v-1z" />
      <path d="M7 11h10v2H7zM8 13h8v6H8z" />
    </>
  ),
  bookmark: <path d="M7 4h10v16l-5-3-5 3V4z" />,
  sliders: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="11" cy="17" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  spark: (
    <>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4M7 7l2.2 2.2M14.8 14.8 17 17M17 7l-2.2 2.2M7 17l2.2-2.2" />
    </>
  ),
  cart: (
    <>
      <path d="M5 6h2l1.5 9h9l2-6H8" />
      <circle cx="10" cy="18.5" r="1.2" />
      <circle cx="16.5" cy="18.5" r="1.2" />
    </>
  ),
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-7.5z" />,
  back: <path d="M14 6l-6 6 6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </>
  ),
  skillet: (
    <>
      <path d="M4 14h13c.6 2.2-.2 4-3 4H8c-2.8 0-3.8-1.8-4-4z" />
      <path d="M17 13.5h4" />
      <path d="M8 14V9.5M12 14V8.5M15.5 14v-4" />
    </>
  ),
  pot: (
    <>
      <path d="M6 10h12v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-7z" />
      <path d="M9 10V8.2c0-1.6 1.3-2.7 3-2.7s3 1.1 3 2.7V10" />
      <path d="M4 12h2M18 12h2" />
    </>
  ),
  oven: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M8 8h8M8 12h8v5H8z" />
    </>
  )
};

export function Icon({
  name,
  size = 20,
  className
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
