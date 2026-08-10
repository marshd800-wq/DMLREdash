import { Header } from "@/components/brand/Header";
import { Footer } from "@/components/brand/Footer";
import { Band1 } from "@/components/dashboard/Band1";
import { UpcomingBands } from "@/components/dashboard/UpcomingBands";
import { getDashboardData } from "@/lib/data";

// Metrics are time-relative; never cache the page.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { metrics, source } = await getDashboardData();

  return (
    <div className="min-h-screen bg-cream">
      <Header source={source} />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="space-y-10">
          <Band1 metrics={metrics} />

          <hr className="border-tan/40" />

          <UpcomingBands />
        </div>
      </main>

      <Footer />
    </div>
  );
}
