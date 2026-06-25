"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import type { ReactNode } from "react";

// Mount the CopilotKit provider once near the root. Self-hosted runtime lives
// at /api/copilotkit; `credentials: "include"` forwards the OAuth session cookie
// so the runtime can identify the user. publicLicenseKey is the CopilotKit
// public key (ck_pub_…) — safe on the client — passed down from the server layout.
export function Providers({
  children,
  publicLicenseKey,
}: {
  children: ReactNode;
  publicLicenseKey?: string;
}) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      credentials="include"
      useSingleEndpoint={false}
      publicLicenseKey={publicLicenseKey}
      a2ui={{ theme: { colors: { primary: "#3b82f6" } } }}
      onError={(event) => {
        // Surfaces runtime/CORS/config errors instead of a stuck "connecting…".
        console.error("[copilotkit]", event);
      }}
    >
      {children}
    </CopilotKit>
  );
}
