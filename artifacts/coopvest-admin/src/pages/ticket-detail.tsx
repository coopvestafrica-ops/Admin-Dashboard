import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetSupportTicketMessages, useSendTicketMessage, getGetSupportTicketMessagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LifeBuoy, Send, ShieldCheck, User } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function TicketDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messagesData, isLoading } = useGetSupportTicketMessages(id, { query: { enabled: !!id, queryKey: getGetSupportTicketMessagesQueryKey(id) } });
  const sendMutation = useSendTicketMessage();

  function handleSendMessage() {
    if (!message.trim()) return;

    sendMutation.mutate({ id, data: { message: message.trim() } }, {
      onSuccess: () => {
        setMessage("");
        queryClient.invalidateQueries({ queryKey: getGetSupportTicketMessagesQueryKey(id) });
      },
      onError: (error: any) => {
        toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
      }
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-3/4 ml-auto" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const messages = messagesData ?? [];

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-4 shrink-0">
        <Button variant="outline" size="icon" asChild>
          <Link href="/support">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ticket #{id}</h1>
          <p className="text-muted-foreground">Conversation history</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="shrink-0 border-b">
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <LifeBuoy className="h-10 w-10 mb-2 opacity-50" />
              <p>No messages yet.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.senderRole === "admin";
              return (
                <div key={msg.id} className={`flex gap-4 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${isAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className={`flex flex-col gap-1 max-w-[80%] ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{msg.senderName}</span>
                      <span>{format(new Date(msg.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                    <div className={`px-4 py-3 rounded-2xl ${isAdmin ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'}`}>
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
        <CardFooter className="shrink-0 border-t p-4 bg-muted/30">
          <div className="flex gap-2 w-full">
            <Textarea 
              placeholder="Type your reply here..." 
              className="min-h-[60px] resize-none flex-1"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button 
              className="h-auto shrink-0" 
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <span className="animate-pulse">...</span>
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}