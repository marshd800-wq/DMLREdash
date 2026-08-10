export function BandHeading({
  question,
  title,
  note,
}: {
  question: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <div>
        <p className="brand-eyebrow">{question}</p>
        <h2 className="font-display text-xl text-espresso">{title}</h2>
      </div>
      {note && <p className="hidden text-xs text-bronze sm:block">{note}</p>}
    </div>
  );
}
