import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "YNAB Client",
  description: "Access the YNAB API from a Next.js + React app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* COPILOT_KIT_SECRET is the CopilotKit public key (ck_pub_…); read it
            server-side and pass to the client provider as publicLicenseKey. */}
        <Providers publicLicenseKey={process.env.COPILOT_KIT_SECRET}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
