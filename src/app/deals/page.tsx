import { Header } from "@/components/brand/Header";
import { Footer } from "@/components/brand/Footer";
import { DealCard } from "@/components/deals/DealCard";
import { getDashboardData, propertyById } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { deals, properties, tasks, source } = await getDashboardData();

  const openDeals = deals.filter((d) => !d.is_closed);
  const closedDeals = deals.filter((d) => d.is_closed);

  return (
    <div className="min-h-screen bg-cream">
      <Header source={source} active="/deals" />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <p className="brand-eyebrow">Pipeline</p>
          <h2 className="font-display text-2xl text-espresso">
            Deals &amp; deadline tracker
          </h2>
          <p className="mt-1 text-sm text-bronze">
            Every under-contract deal with its milestone tracker and the anchored
            task checklist. Change any anchor date and downstream tasks cascade.
          </p>
        </div>

        <section className="space-y-5">
          {openDeals.length === 0 ? (
            <p className="text-sm text-bronze">No deals under contract right now.</p>
          ) : (
            openDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                property={propertyById(properties, deal.property_id)}
                tasks={tasks}
              />
            ))
          )}
        </section>

        {closedDeals.length > 0 && (
          <section className="mt-10">
            <p className="brand-eyebrow mb-3">Recently closed</p>
            <ul className="space-y-2">
              {closedDeals.map((d) => {
                const p = propertyById(properties, d.property_id);
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-card border border-tan/50 bg-white px-4 py-3 text-sm"
                  >
                    <span className="text-espresso">{p?.address ?? "—"}</span>
                    <span className="text-bronze">
                      Sold · closed {d.closing_date}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
