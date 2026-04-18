import { useEffect } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings as SettingsIcon, Save, Shield, Percent, BellDot, PiggyBank } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from "@/components/ui/form";

const settingsSchema = z.object({
  defaultInterestRate: z.coerce.number().min(0).max(100),
  maxLoanLimit: z.coerce.number().min(0),
  minContribution: z.coerce.number().min(0),
  maxContribution: z.coerce.number().min(0),
  loanToSavingsRatio: z.coerce.number().min(1),
  sessionTimeoutMinutes: z.coerce.number().min(5),
  mfaEnabled: z.boolean(),
  emailNotificationsEnabled: z.boolean(),
  smsNotificationsEnabled: z.boolean(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      defaultInterestRate: 0,
      maxLoanLimit: 0,
      minContribution: 0,
      maxContribution: 0,
      loanToSavingsRatio: 1,
      sessionTimeoutMinutes: 30,
      mfaEnabled: false,
      emailNotificationsEnabled: false,
      smsNotificationsEnabled: false,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        defaultInterestRate: settings.defaultInterestRate,
        maxLoanLimit: settings.maxLoanLimit,
        minContribution: settings.minContribution,
        maxContribution: settings.maxContribution,
        loanToSavingsRatio: settings.loanToSavingsRatio,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
        mfaEnabled: settings.mfaEnabled,
        emailNotificationsEnabled: settings.emailNotificationsEnabled,
        smsNotificationsEnabled: settings.smsNotificationsEnabled,
      });
    }
  }, [settings, form]);

  function onSubmit(data: SettingsValues) {
    updateMutation.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Settings updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to update settings", description: error.message, variant: "destructive" });
      }
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">Configure platform-wide rules and parameters.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-6 md:grid-cols-2">
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Percent className="w-5 h-5 text-primary" /> Financial Parameters</CardTitle>
                  <CardDescription>Default rates and limits for loans.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="defaultInterestRate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Interest Rate (%)</FormLabel>
                      <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="maxLoanLimit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Loan Limit ($)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="loanToSavingsRatio" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan to Savings Ratio Multiple</FormLabel>
                      <FormDescription>How many times a member's savings they can borrow.</FormDescription>
                      <FormControl><Input type="number" step="0.5" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><PiggyBank className="w-5 h-5 text-primary" /> Contribution Rules</CardTitle>
                  <CardDescription>Limits on member savings contributions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="minContribution" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum ($)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="maxContribution" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum ($)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Security Settings</CardTitle>
                  <CardDescription>Protect access to the admin dashboard.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={form.control} name="mfaEnabled" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Require MFA</FormLabel>
                        <FormDescription>Force all admins to use Multi-Factor Authentication.</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="sessionTimeoutMinutes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Timeout (Minutes)</FormLabel>
                      <FormDescription>Auto-logout idle administrators after this duration.</FormDescription>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BellDot className="w-5 h-5 text-primary" /> System Notifications</CardTitle>
                  <CardDescription>Global notification delivery channels.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="emailNotificationsEnabled" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Email Delivery</FormLabel>
                        <FormDescription>Enable sending system emails.</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="smsNotificationsEnabled" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">SMS Delivery</FormLabel>
                        <FormDescription>Enable sending system text messages.</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </div>
            
            <div className="md:col-span-2 flex justify-end pt-4">
              <Button type="submit" size="lg" disabled={updateMutation.isPending || !form.formState.isDirty}>
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}