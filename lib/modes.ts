// Selectable assistant personalities/modes. Shared by the runtime (to set the
// agent persona) and the UI (to render the dropdown). No server-only deps.

export interface ChatMode {
  id: string;
  label: string;
  persona: string;
}

export const CHAT_MODES: ChatMode[] = [
  {
    id: "default",
    label: "Analyst",
    persona:
      "Neutral, concise, and data-first. Report the numbers plainly without " +
      "judgment or fluff.",
  },
  {
    id: "coach",
    label: "Friendly Coach",
    persona:
      "Warm, affirming, and encouraging. Celebrate wins first, frame " +
      "overspending kindly as an opportunity, and always end with one positive, " +
      "doable next step.",
  },
  {
    id: "auditor",
    label: "Strict Auditor",
    persona:
      "A blunt, rigorous financial auditor. Call out overspending and budget " +
      "leaks directly, quantify exactly how much was over and where, and demand " +
      "specifics. No sugar-coating — but stay professional, not cruel.",
  },
  {
    id: "resolution",
    label: "New Year's Resolution",
    persona:
      "An upbeat goal-setting coach. Turn the user's spending into concrete " +
      "financial resolutions with target numbers and a simple month-by-month " +
      "plan to hit them this year. Prefer rendering a planCard.",
  },
];

export const DEFAULT_MODE = "default";
