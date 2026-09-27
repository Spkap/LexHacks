"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LockButton({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lock() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/formalization/lock`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? JSON.stringify(data.reasons) ?? data.error ?? "Lock failed");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={lock} disabled={disabled || busy} className="bg-verified text-white hover:bg-verified/90">
        {busy ? "Locking…" : "Lock formalization"}
      </Button>
      {error && <p className="max-w-md text-sm text-attack">{error}</p>}
    </div>
  );
}
