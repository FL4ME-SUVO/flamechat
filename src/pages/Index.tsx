import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { UsernameDialog } from "@/components/UsernameDialog";
import { OnlineUsers } from "@/components/OnlineUsers";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle } from "lucide-react";

interface Message {
  id: string;
  username: string;
  content: string;
  created_at: string;
  message_type?: string;
  file_url?: string;
  file_name?: string;
  poll_id?: string;
}

interface PresenceState {
  [key: string]: Array<{ username: string; online_at: string }>;
}

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Array<{ username: string; online_at: string }>>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load existing messages
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) {
        console.error("Error loading messages:", error);
        toast({
          title: "Error",
          description: "Failed to load messages",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setMessages(data);
      }
    };

    loadMessages();

    // Subscribe to new messages
    const messageChannel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [toast]);

  useEffect(() => {
    if (!username) return;

    // Set up presence tracking
    const presenceChannel = supabase.channel("room-presence");

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState() as PresenceState;
        const users = Object.values(state).flat();
        setOnlineUsers(users);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        console.log("User joined:", newPresences);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        console.log("User left:", leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            username,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = presenceChannel;

    return () => {
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [username]);

  const handleUsernameSubmit = (newUsername: string) => {
    setUsername(newUsername);
    localStorage.setItem("chat-username", newUsername);
    toast({
      title: "Welcome!",
      description: `You're chatting as ${newUsername}`,
    });
  };

  const handleSendMessage = async (content: string, extra?: { replyToId?: string }) => {
    if (!username) return;

    setLoading(true);
    const insertData: any = {
      username,
      content,
      message_type: "text",
    };

    // If replying, embed minimal metadata in content (simple quote) so it's renderable without schema change
    if (extra?.replyToId) {
      insertData.content = `> reply:${extra.replyToId}\n${content}`;
    }

    const { error } = await supabase.from("messages").insert(insertData);

    if (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }

    setLoading(false);
    setReplyTo(null);
  };

  useEffect(() => {
    const savedUsername = localStorage.getItem("chat-username");
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleReply = (message: Message) => {
    setReplyTo(message);
    // focus input handled via prop in ChatInput
  };

  const handleMentionInsert = (mention: string) => {
    // Pass through to ChatInput by setting a temp state — ChatInput will receive this prop and insert
    // Simpler approach: setReplyTo null and emit a synthetic reply content via a ref. We'll pass a `mentionToInsert` prop.
    // Implemented as state below.
    setMentionToInsert(mention);
  };

  const [mentionToInsert, setMentionToInsert] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-gradient-to-br from-chat-bg-start to-chat-bg-end">
      <UsernameDialog open={!username} onSubmit={handleUsernameSubmit} />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center text-white">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">flamechat</h1>
                <p className="text-sm text-muted-foreground">Real-time chat — be kind and have fun</p>
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8 max-w-4xl">
            <div className="bg-transparent">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center py-12">
                  <MessageCircle className="h-20 w-20 text-muted-foreground mb-4" />
                  <h2 className="text-2xl font-semibold text-foreground mb-2">No messages yet</h2>
                  <p className="text-muted-foreground">Be the first to say hello!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    username={message.username}
                    content={message.content}
                    createdAt={message.created_at}
                    isOwn={message.username === username}
                    messageType={message.message_type}
                    fileUrl={message.file_url}
                    fileName={message.file_name}
                    pollId={message.poll_id}
                    currentUsername={username}
                    onReply={() => handleReply(message)}
                    onMention={() => handleMentionInsert(message.username)}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="container mx-auto max-w-4xl">
          <ChatInput
            onSend={(content, extra) => handleSendMessage(content, { ...extra })}
            disabled={loading || !username}
            username={username}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            mentionToInsert={mentionToInsert}
            onMentionInserted={() => setMentionToInsert(null)}
            users={onlineUsers.map(u => u.username)}
          />
        </div>
      </div>

      {/* Online Users Sidebar */}
      <div className="w-64 border-l border-border bg-card hidden lg:block">
        <OnlineUsers users={onlineUsers} />
      </div>
    </div>
  );
};

export default Index;
