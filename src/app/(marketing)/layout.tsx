import Link from "next/link";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border/60">
        <nav className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
            Loophole
          </Link>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/r/ccpa-2018-benchmark" className="hover:text-ink">
              Watch demo
            </Link>
            <a href="https://github.com/Spkap/LexHacks" target="_blank" rel="noreferrer" className="hover:text-ink">
              GitHub
            </a>
          </div>
        </nav>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <FooterDisclaimer />
    </div>
  );
}
