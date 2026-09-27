"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function GalleryActions() {
  const router = useRouter();
  const [loading, setLoading] = useState<"benchmark" | "paste" | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/workspace", { method: "POST" });
  }, []);

  async function runBenchmark() {
    setLoading("benchmark");
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "ccpa-2018" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed to create project");
      router.push(`/a/${data.slug}?demo=1`);
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  }

  async function pasteDraft() {
    setLoading("paste");
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paste: { title, text } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed to create project");
      router.push(`/a/${data.slug}`);
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Button size="lg" className="bg-verified text-white hover:bg-verified/90" onClick={runBenchmark} disabled={loading !== null}>
        {loading === "benchmark" ? "Preparing demo…" : "Open the CCPA demo"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          className={buttonVariants({ size: "lg", variant: "outline" })}
          disabled={loading !== null}
        >
          Paste a draft
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attack target, no known finding promised.</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <input
              className="rounded-md border border-border px-3 py-2 text-sm"
              placeholder="Title (e.g. SB-53)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Paste the bill or statute text (up to 60,000 characters)"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={pasteDraft} disabled={!title || !text || loading !== null}>
              {loading === "paste" ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && <p className="text-sm text-attack">{error}</p>}
    </div>
  );
}
