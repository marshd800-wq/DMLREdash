import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BandHeading } from "@/components/dashboard/BandHeading";
import { OutreachRow } from "@/components/dashboard/OutreachRow";
import type { Band2Data, OutreachItem } from "@/lib/types";

/**
 * BAND 2 — "Who do I reach out to?" (PRD §4, the money band).
 * "Call these 10 today" leads; the four source panels follow.
 */
export function Band2({ data }: { data: Band2Data }) {
  return (
    <section>
      <BandHeading
        question="Question 2"
        title="Who do I reach out to?"
        note="cold leads · past clients · reviews · referral asks"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Call these 10 today — the blended, prioritized list */}
        <Card className="lg:row-span-2">
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-display text-lg text-espresso">
              Call these 10 today
            </h3>
            <Badge tone="accent">{data.callTheseTen.length}</Badge>
          </CardHeader>
          <CardBody>
            <OutreachList
              items={data.callTheseTen}
              empty="Nobody's overdue — enjoy the breathing room."
            />
          </CardBody>
        </Card>

        <Panel
          title="Leads going cold"
          tone="alert"
          items={data.coldLeads}
          empty="No leads going cold."
          showReason={false}
        />
        <Panel
          title="Past clients due"
          tone="amber"
          items={data.pastClientsDue}
          empty="All past clients recently touched."
          showReason={false}
        />
        <Panel
          title="Birthdays"
          tone="accent"
          items={data.birthdays}
          empty="No birthdays in the next two weeks."
          showReason={false}
        />
        <Panel
          title="Reviews I owe"
          tone="accent"
          items={data.reviewsOwed}
          empty="No review asks owed."
          showReason={false}
        />
        <Panel
          title="Referral asks I owe"
          tone="amber"
          items={data.referralsOwed}
          empty="No referral asks owed."
          showReason={false}
        />
      </div>
    </section>
  );
}

function Panel({
  title,
  tone,
  items,
  empty,
  showReason,
}: {
  title: string;
  tone: "accent" | "alert" | "amber" | "neutral";
  items: OutreachItem[];
  empty: string;
  showReason?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-espresso">{title}</h3>
        <Badge tone={items.length ? tone : "muted"}>{items.length}</Badge>
      </CardHeader>
      <CardBody>
        <OutreachList items={items.slice(0, 4)} empty={empty} showReason={showReason} />
      </CardBody>
    </Card>
  );
}

function OutreachList({
  items,
  empty,
  showReason = true,
}: {
  items: OutreachItem[];
  empty: string;
  showReason?: boolean;
}) {
  if (!items.length) {
    return <p className="py-3 text-xs text-bronze">{empty}</p>;
  }
  return (
    <ul>
      {items.map((item) => (
        <OutreachRow
          key={`${item.contact.id}:${item.reason}`}
          item={item}
          showReason={showReason}
        />
      ))}
    </ul>
  );
}
