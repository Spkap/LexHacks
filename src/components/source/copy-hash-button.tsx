"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyHashButton({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label="Copy full SHA-256 hash"
      onClick={async () => {
        await navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-muted-foreground hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-verified" /> : <Copy className="size-3.5" />}
    </button>
  );
}
