import { Layout } from "@/components/layout/Layout";

export default function Settings() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your dashboard preferences</p>
        </div>
        <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed text-muted-foreground">
          Settings module coming soon.
        </div>
      </div>
    </Layout>
  );
}
