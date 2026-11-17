"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="btn btn-primary btn-sm no-print"
    >
      {label}
    </button>
  );
}
