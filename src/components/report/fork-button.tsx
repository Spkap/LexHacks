"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ForkButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function fork() {
    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: "ccpa-2018" }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/a/${data.slug}`);
    else setLoading(false);
  }

  return (
    <Button variant="outline" onClick={fork} disabled={loading}>
      {loading ? "Forking…" : "Fork this benchmark"}
    </Button>
  );
}
