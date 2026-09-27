"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function VerifyAgainButton({ certificateId }: { certificateId: string }) {
  const [result, setResult] = useState<"idle" | "checking" | "verified" | "failed">("idle");

  async function verify() {
    setResult("checking");
    const res = await fetch(`/api/certificates/${certificateId}`);
    const data = await res.json();
    setResult(data.verified ? "verified" : "failed");
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={verify} disabled={result === "checking"}>
        {result === "checking" ? "Verifying…" : "Verify again"}
      </Button>
      {result === "verified" && <span className="text-sm text-verified">Verified ✓</span>}
      {result === "failed" && <span className="text-sm text-attack">Verification failed</span>}
    </div>
  );
}
