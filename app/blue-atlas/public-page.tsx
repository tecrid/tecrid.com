import type { HTMLAttributes, ReactNode } from "react";
import { Shell } from "./shared";

/** The shared public body, including forms and data-dependent public records. */
export function PublicPage({ children, className = "", minimal = false }: { children: ReactNode; className?: string; minimal?: boolean }) {
  return <Shell compact minimal={minimal}><div className={`atlas-page ${className}`} data-atlas-public-page>{children}</div></Shell>;
}

export function PageHero({ children, className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <header className={`atlas-page-hero ${className}`} {...props}>{children}</header>;
}
