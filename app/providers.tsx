"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import type { ReactNode } from "react";
import { byokHeaders } from "@/lib/byok";
import { selectedBudgetHeaders } from "@/lib/budget";

// Merge the two independently-managed header sources (BYOK key/model +
// selected budget) into the single function CopilotKit re-reads on render.
function headers() {
  return { ...byokHeaders(), ...selectedBudgetHeaders() };
}

// Mount the CopilotKit provider once near the root. Self-hosted runtime lives
// at /api/copilotkit; `credentials: "include"` forwards the OAuth session cookie
// so the runtime can identify the user. publicLicenseKey is the CopilotKit
// public key (ck_pub_…) — safe on the client — passed down from the server layout.
//
// `headers` is the function form: it re-reads the bring-your-own-key config from
// sessionStorage on every provider render, so a stored key survives page
// reloads. Live updates (entering a key mid-session) go through the imperative
// `copilotkit.setHeaders(...)` in ByokSettings, since the provider doesn't
// re-render on a sessionStorage write.
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
      headers={headers}
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
