import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "alert" | "amber" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "border-tan/60 bg-tan/10 text-bronze",
  accent: "border-terracotta/30 bg-terracotta/10 text-terracotta",
  alert: "border-oxblood/30 bg-oxblood/10 text-oxblood",
  amber: "border-bronze/30 bg-bronze/10 text-bronze",
  muted: "border-tan/50 bg-cream text-bronze",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
