import { Header } from "@/components/brand/Header";
import { Footer } from "@/components/brand/Footer";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getDashboardData } from "@/lib/data";
import { buildBrief } from "@/lib/data/brief";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const data = await getDashboardData();
  const brief = buildBrief(data);

  return (
    <div className="min-h-screen bg-cream">
      <Header source={data.source} active="/brief" />

      <main className="mx-auto max-w-2xl px-6 py-8">
        <Card>
          <CardHeader>
            <h2 className="font-display text-2xl text-espresso">{brief.title}</h2>
            <p className="mt-1 text-sm text-bronze">{brief.subtitle}</p>
          </CardHeader>
          <CardBody className="space-y-5">
            {brief.sections.map((s) => (
              <div key={s.heading}>
                <p className="brand-eyebrow mb-1.5">{s.heading}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-espresso">
                  {s.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-xs text-bronze">
          Delivered at 7:30 AM by email once{" "}
          <code className="rounded bg-white px-1 py-0.5">RESEND_API_KEY</code> is
          set (PRD §8). This is a live preview of today&rsquo;s brief.
        </p>
      </main>

      <Footer />
    </div>
  );
}
