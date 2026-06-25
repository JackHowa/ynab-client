"use client";

import { useEffect, useState } from "react";
import { getPins, removePin, type Pin } from "@/lib/pins";
import { renderGenerative } from "@/components/generative/registry";

export default function DashboardPage() {
  const [pins, setPins] = useState<Pin[]>([]);

  useEffect(() => {
    const load = () => setPins(getPins());
    load();
    window.addEventListener("ynab-pins-changed", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("ynab-pins-changed", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  return (
    <main className="chat-page">
      <header>
        <h1>Dashboard</h1>
        <a className="button" href="/">
          ← Chat
        </a>
      </header>

      {pins.length === 0 ? (
        <p className="chat-hint">
          No pinned charts yet. In the chat, generate a chart and click 📌 Pin.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {pins.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
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
                onClick={() => removePin(p.id)}
              >
                Remove
              </button>
              {renderGenerative(p.name, p.args)}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
