"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import type { ReactNode } from "react";

// Mount the CopilotKit provider once near the root. Self-hosted runtime lives
// at /api/copilotkit; `credentials: "include"` forwards the OAuth session cookie
// so the runtime can identify the user.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      credentials="include"
      useSingleEndpoint={false}
      onError={(event) => {
        // Surfaces runtime/CORS/config errors instead of a stuck "connecting…".
        console.error("[copilotkit]", event);
      }}
    >
      {children}
    </CopilotKit>
  );
}
