import { setLogLevel } from "firebase/firestore";

try {
  setLogLevel("silent");
} catch {}

if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const fullMsg = args
      .map((a) =>
        typeof a === "string"
          ? a
          : a?.message || (typeof a === "object" ? JSON.stringify(a) : String(a))
      )
      .join(" ");

    if (
      fullMsg.includes("resource-exhausted") ||
      fullMsg.includes("Quota limit exceeded") ||
      fullMsg.includes("Quota exceeded") ||
      fullMsg.includes("Using maximum backoff delay")
    ) {
      try {
        sessionStorage.setItem("ucc_firestore_quota_exceeded", "true");
        localStorage.setItem("ucc_firestore_quota_exceeded", "true");
        window.dispatchEvent(new CustomEvent("ucc-quota-exceeded"));
      } catch {}
      console.warn("Firestore daily write quota reached. Local offline storage mode active.");
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

export {};
