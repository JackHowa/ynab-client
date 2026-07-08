"use client";

import { useState, type ReactNode } from "react";
import { addPin } from "@/lib/pins";

// Wraps a rendered generative component with a "pin to dashboard" button.
export function Pinnable({
  name,
  args,
  children,
}: {
  name: string;
  args: Record<string, unknown>;
  children: ReactNode;
}) {
  const [pinned, setPinned] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        className="button"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          padding: "0.15rem 0.5rem",
          fontSize: "0.8em",
          zIndex: 1,
        }}
        title="Pin to dashboard"
        onClick={() => {
          addPin(name, args);
          setPinned(true);
        }}
      >
        {pinned ? "📌 Pinned" : "📌 Pin"}
      </button>
      {children}
    </div>
  );
}
