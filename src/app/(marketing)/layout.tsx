import Link from "next/link";
import { FooterDisclaimer } from "@/components/brand/footer-disclaimer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="shrink-0 border-b border-border/70 bg-paper">
        <nav className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2.5 font-heading text-xl font-semibold tracking-tight">
            <span aria-hidden="true" className="relative flex size-5 items-center justify-center rounded-sm bg-ink">
              <span className="size-2 rounded-full bg-attack" />
            </span>
            Loophole
          </Link>
          <div className="flex items-center gap-5 text-sm font-medium text-muted-foreground">
            <Link href="/r/ccpa-2018-benchmark" className="transition-colors hover:text-ink">
              Watch demo
            </Link>
            <a href="https://github.com/Spkap/LexHacks" target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">
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
