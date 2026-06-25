"use client";

import { AssistantChat } from "@/components/AssistantChat";

// The chat now lives on the home page ("/"); this route renders the same
// experience for direct /chat links.
export default function ChatPage() {
  return (
    <main className="chat-page">
      <header>
        <h1>YNAB Assistant</h1>
        <a className="button" href="/">
          Home
        </a>
      </header>
      <AssistantChat />
    </main>
  );
}
