import Image from "next/image";

const LOGO_URL =
  "https://content.mediastg.net/dyna_images/ImageLibrary/2/E/B/0/2EB0913A-5EE1-4770-9E4B-3FA27B55558D.png";

export function Header({ source }: { source: "supabase" | "sample" }) {
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
