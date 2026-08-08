import type { ReactNode } from "react";
import { AppShell } from "@/core/ui/shell";

export const metadata = {
  title: "Kwong",
  description: "Personal site",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
