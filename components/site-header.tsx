import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-primary px-4 py-3 text-primary-foreground">
      <div className="flex items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-accent" aria-hidden />
        <div>
          <h1 className="text-xl leading-none font-bold tracking-wide uppercase">Alpenpässe</h1>
          <p className="mt-1 text-xs text-primary-foreground/70">
            Rennradkarte: Pässe, Auffahrten, Rundtouren und Rad-Orte
          </p>
        </div>
      </div>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
