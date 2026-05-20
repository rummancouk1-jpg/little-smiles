// First-visit orientation strip for the editorial queue. Dismissible per
// browser via localStorage. Renders nothing once dismissed.
//
// Uses useSyncExternalStore because we're synchronizing React with an
// external state source (localStorage). A naive useEffect + setState
// approach would either cascade-render or hydration-mismatch; this hook
// is the canonical fix.
//
// Same-tab dismissals don't fire the 'storage' event, so we maintain an
// in-tab listener set and notify it manually when dismiss() is called.

"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "ls-contentops-welcome-dismissed-v1";
const inTabListeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  inTabListeners.add(callback);
  const storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    inTabListeners.delete(callback);
    window.removeEventListener("storage", storageHandler);
  };
}

function notifyInTab(): void {
  inTabListeners.forEach((listener) => listener());
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private mode / disabled storage: don't persist, but don't crash.
    // Treat as dismissed so the strip doesn't keep reappearing every
    // reload for a visitor who explicitly disabled storage.
    return true;
  }
}

function getServerSnapshot(): boolean {
  // SSR: treat as dismissed. First-time visitors see the strip pop in
  // after hydration; returning visitors never see it. Avoids both
  // hydration mismatches and SSR HTML that gets immediately removed.
  return true;
}

function dismiss(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Persistence failed; still notify so this tab hides the strip
    // for the rest of the session.
  }
  notifyInTab();
}

type Step = {
  number: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    number: "1",
    title: "Review",
    body: "Open an article from the queue and read it the way a reader would.",
  },
  {
    number: "2",
    title: "Approve or decline",
    body: "Approving sends it to the publishing queue. Declining sends it back for the AI to learn from.",
  },
  {
    number: "3",
    title: "Done",
    body: "You're finished. The publishing step is handled separately — you don't need to do anything else.",
  },
];

export function EditorialWelcome() {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (dismissed) return null;

  return (
    <article className="rounded-3xl border border-[#3B2F2F]/10 bg-[#FBF7F3] p-5 shadow-[0_20px_44px_-30px_rgba(59,47,47,0.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#3B2F2F]/55">
            Welcome
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#1F1918]">
            How this works
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-[#3B2F2F]/14 bg-white px-3.5 py-1.5 text-xs font-medium text-[#2E2323] hover:bg-[#F2EAE4]"
        >
          Got it
        </button>
      </div>

      <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.number}
            className="rounded-2xl border border-[#3B2F2F]/8 bg-white/85 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#3B2F2F]/55">
              Step {step.number}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#1F1918]">{step.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-[#3B2F2F]/72">{step.body}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}
