import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div>
      <header>
        <Link href="/">Kwong</Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
