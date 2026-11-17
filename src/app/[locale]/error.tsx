"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app:error]", error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
      <p className="eyebrow">500</p>
      <h1 className="mt-4 font-serif text-[32px]">เกิดข้อผิดพลาด / Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        We have logged the issue. Please try again, or contact the studio if it keeps happening.
      </p>
      <button type="button" onClick={reset} className="btn btn-primary mt-8">
        Try again
      </button>
    </div>
  );
}
