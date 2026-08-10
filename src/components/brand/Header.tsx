import Image from "next/image";
import Link from "next/link";

const LOGO_URL =
  "https://content.mediastg.net/dyna_images/ImageLibrary/2/E/B/0/2EB0913A-5EE1-4770-9E4B-3FA27B55558D.png";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/deals", label: "Pipeline" },
  { href: "/brief", label: "Morning Brief" },
];

export function Header({
  source,
  active = "/",
}: {
  source: "supabase" | "sample";
  active?: string;
}) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="border-b border-tan/50 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-tan/60">
            <Image
              src={LOGO_URL}
              alt="Diana Marsh — Berkshire Hathaway HomeServices Georgia Properties"
              fill
              sizes="48px"
              className="object-contain p-1"
              priority
            />
          </div>
          <div>
            <h1 className="font-display text-2xl leading-tight text-espresso">
              Diana&rsquo;s OS
            </h1>
            <p className="brand-eyebrow mt-0.5">Luxury With a Pulse</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-right">
          <div>
            <p className="text-sm font-medium text-espresso">{today}</p>
            <p className="text-xs text-bronze">
              Diana Marsh, REALTOR® · FOREVER Agent®
            </p>
          </div>
          <DataSourceBadge source={source} />
        </div>
      </div>

      <nav className="mx-auto max-w-7xl px-6">
        <ul className="flex gap-1 pb-2">
          {NAV.map((item) => {
            const isActive = item.href === active;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    "inline-block rounded-md px-3 py-1.5 text-sm font-medium transition " +
                    (isActive
                      ? "bg-terracotta/10 text-terracotta"
                      : "text-bronze hover:bg-cream hover:text-espresso")
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

function DataSourceBadge({ source }: { source: "supabase" | "sample" }) {
  const isLive = source === "supabase";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium " +
        (isLive
          ? "border-terracotta/30 bg-terracotta/10 text-terracotta"
          : "border-tan/60 bg-tan/10 text-bronze")
      }
      title={
        isLive
          ? "Reading live data from Supabase."
          : "Showing sample data. Configure Supabase / Rechat to go live."
      }
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " +
          (isLive ? "bg-terracotta" : "bg-tan")
        }
      />
      {isLive ? "Live" : "Sample data"}
    </span>
  );
}
