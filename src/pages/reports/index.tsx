import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, CalendarClock } from "lucide-react";
import { ReportCatalog } from "./report-catalog";
import { ScheduledReports } from "./scheduled-reports";

/**
 * Reports hub.
 *
 * Two distinct jobs live here and were previously conflated (the page only
 * managed *scheduled* reports, with no way to actually produce one). The page
 * is now tabbed so each is explicit:
 *   - Report Library: run a report now over a chosen period and export it.
 *   - Scheduled Reports: recurring reports (existing behaviour, unchanged).
 */
export default function Reports() {
  const [tab, setTab] = useState("library");

  return (
    <Layout>
      <PageBody>
        <PageHeader
          title="Reports"
          description="Generate, filter and export reports across the platform."
          breadcrumbs={[{ label: "Operations" }, { label: "Reports" }]}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="library" data-testid="tab-report-library">
              <BarChart3 className="h-4 w-4 mr-2" />Report Library
            </TabsTrigger>
            <TabsTrigger value="scheduled" data-testid="tab-scheduled-reports">
              <CalendarClock className="h-4 w-4 mr-2" />Scheduled Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="library">
            <ReportCatalog />
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledReports />
          </TabsContent>
        </Tabs>
      </PageBody>
    </Layout>
  );
}