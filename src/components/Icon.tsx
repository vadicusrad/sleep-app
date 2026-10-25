import type { CSSProperties } from "react";
export type IconName =
  | "sun"
  | "moon"
  | "history"
  | "settings"
  | "book"
  | "arrow"
  | "chevron"
  | "plus"
  | "check"
  | "clock"
  | "message"
  | "copy"
  | "close"
  | "edit"
  | "leaf"
  | "trash"
  | "download"
  | "heart";
const paths: Record<IconName, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20.7 13.3A9 9 0 0 1 10.7 3.3 9 9 0 1 0 20.7 13.3Z" />,
  history: (
    <>
      <path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-.5 2-2 .9-1.8-.6-2 3.4L4.2 10v2L3 13.3l1.8 3.5 2-.5 1.7 1 .6 2.2h4l.6-2.1 1.8-1 2 .5 1.9-3.5L18 12v-2l1.3-1.4-2-3.4-1.9.6-1.8-.9L13 3Z" />
      <circle cx="11" cy="11" r="3" />
    </>
  ),
  book: (
    <>
      <path d="M12 5C8 2 3 3 3 3v15s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v15" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  message: (
    <path d="M21 11a8 8 0 0 1-8 8H6l-4 3V9a7 7 0 0 1 7-7h4a8 8 0 0 1 8 9Z" />
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  edit: (
    <>
      <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3S7 0 4 9s8 14 12 6 4-12 4-12Z" />
      <path d="M3 21 15 9" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
    </>
  ),
  heart: <path d="m12 21-8-8C-3 5 7-1 12 6c5-7 15-1 8 7Z" />,
};
export function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
