import type { SVGProps } from "react";

export type IconName =
  | "dashboard"
  | "product"
  | "release"
  | "feature"
  | "task"
  | "meeting"
  | "decision"
  | "artifact"
  | "validation"
  | "activity"
  | "settings"
  | "user"
  | "chevronRight"
  | "check"
  | "alert"
  | "clock"
  | "plus"
  | "link"
  | "arrowRight";

const paths: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
      <rect x="3.5" y="13" width="7" height="7.5" rx="1.5" />
    </>
  ),
  product: (
    <>
      <path d="M12 3.5 4 7.5v9L12 20.5l8-4v-9L12 3.5Z" />
      <path d="M4 7.5 12 11.5 20 7.5" />
      <path d="M12 11.5V20.5" />
    </>
  ),
  release: (
    <>
      <path d="M12 3.5 20.5 8v8L12 20.5 3.5 16V8L12 3.5Z" />
      <path d="M12 12v8.5" />
      <path d="m3.9 7.8 8.1 4.2 8.1-4.2" />
    </>
  ),
  feature: (
    <>
      <path d="M12 3.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L12 3.5Z" />
    </>
  ),
  task: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />
      <path d="m8.5 12.5 2.3 2.3 4.7-4.8" />
    </>
  ),
  meeting: (
    <>
      <rect x="3.5" y="5.5" width="17" height="14" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3.5v3.2M16 3.5v3.2" />
    </>
  ),
  decision: (
    <>
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
      <circle cx="12" cy="12" r="5" />
    </>
  ),
  artifact: (
    <>
      <path d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M9 13h6M9 16.5h6" />
    </>
  ),
  validation: (
    <>
      <path d="M12 3.5 4.5 6.8v5.4c0 4.6 3.1 7.6 7.5 8.8 4.4-1.2 7.5-4.2 7.5-8.8V6.8L12 3.5Z" />
      <path d="m8.7 12.3 2.3 2.3 4.4-4.6" />
    </>
  ),
  activity: (
    <>
      <path d="M3.5 12.5h4l2-6 4 11 2-8h5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.8v2.3M12 17.9v2.3M20.2 12h-2.3M6.1 12H3.8M17.5 6.5l-1.6 1.6M8.1 15.9l-1.6 1.6M17.5 17.5l-1.6-1.6M8.1 8.1 6.5 6.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.5" />
      <path d="M4.8 20.2c1.2-3.6 4-5.4 7.2-5.4s6 1.8 7.2 5.4" />
    </>
  ),
  chevronRight: <path d="m9 5.5 7 6.5-7 6.5" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  alert: (
    <>
      <path d="M12 3.8 2.5 20.2h19L12 3.8Z" />
      <path d="M12 10v4.2M12 17.2v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M12 7.5V12l3.2 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  link: (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 13.2 4.3a3.5 3.5 0 1 1 5 5L15.9 11.5" />
      <path d="M13 17.5 10.8 19.7a3.5 3.5 0 1 1-5-5L8 12.5" />
    </>
  ),
  arrowRight: <path d="M4.5 12h14.5M13.5 6.5l6 5.5-6 5.5" />,
};

export function Icon({
  name,
  className,
  ...rest
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
