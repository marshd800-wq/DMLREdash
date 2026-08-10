import { Header } from "@/components/brand/Header";
import { Footer } from "@/components/brand/Footer";
import { Band1 } from "@/components/dashboard/Band1";
import { Band2 } from "@/components/dashboard/Band2";
import { Band3 } from "@/components/dashboard/Band3";
import { getDashboardData } from "@/lib/data";

// Metrics are time-relative; never cache the page.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { metrics, band2, band3, source } = await getDashboardData();

  return (
    <div className="min-h-screen bg-cream">
      <Header source={source} active="/" />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="space-y-10">
          <Band1 metrics={metrics} />
          <hr className="border-tan/40" />
          <Band2 data={band2} />
          <hr className="border-tan/40" />
          <Band3 data={band3} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
