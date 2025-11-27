import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { OnlineUsers } from "@/components/OnlineUsers";
import { useToast } from "@/hooks/use-toast";

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  // reply/mention plumbing
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [mentionToInsert, setMentionToInsert] = useState<string | null>(null);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadRoom = async () => {
      const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (!error && data) setRoom(data);
    };
    if (roomId) loadRoom();
  }, [roomId]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .limit(500);

        if (error) {
          toast({ title: "Error", description: "Failed to load messages", variant: "destructive" });
          return;
        }

        setMessages(data || []);
      } catch (e) {
        toast({ title: "Error", description: "Failed to load messages", variant: "destructive" });
      }
    };

    if (roomId) fetchMessages();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, (payload) => {
        setMessages((m) => [...m, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, toast]);

  useEffect(() => {
    const saved = localStorage.getItem("chat-username");
    if (saved) setUsername(saved);

    // allow re-entry if user previously joined this room
    try {
      const joined = roomId ? localStorage.getItem(`room-joined-${roomId}`) : null;
      if (!joined) {
        // user must have entered code to join; prompt for code
        setShowJoinPrompt(true);
      } else {
        setShowJoinPrompt(false);
      }
    } catch (e) {
      // ignore
    }
  }, [roomId]);

  // presence tracking for room
  useEffect(() => {
    if (!roomId || !username) return;

    const presence = supabase.channel(`presence-room-${roomId}`);

    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState();
        const users = Object.values(state).flat();
        setOnlineUsers(users as any[]);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {})
      .on("presence", { event: "leave" }, ({ leftPresences }) => {} )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({ username, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = presence;

    return () => {
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [roomId, username]);

  const handleSendMessage = async (content: string) => {
    if (!username || !roomId) return;
    setLoading(true);
    // include reply metadata if replying
    const payloadContent = replyTo ? `> reply:${replyTo.id}\n${content}` : content;
    const { error } = await supabase.from("messages").insert({ username, content: payloadContent, message_type: "text", room_id: roomId });
    if (error) toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    setLoading(false);
    // clear reply after sending
    if (!error) setReplyTo(null);
  };

  const handleReply = (m: any) => {
    setReplyTo({ id: m.id, username: m.username });
    // open input focus is handled by ChatInput when props change
  };

  const handleMention = (usernameToMention: string) => {
    if (!usernameToMention) return;
    setMentionToInsert(usernameToMention);
  };

  const handleCopyCode = async () => {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      toast({ title: "Copied", description: "Invite code copied" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to copy", variant: "destructive" });
    }
  };

  const handleLeaveRoom = async () => {
    try {
      if (channelRef.current) {
        // stop tracking presence for this user
        try {
          await channelRef.current.untrack();
        } catch (e) {
          // ignore untrack errors
        }
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setOnlineUsers([]);
      // remove the client-side joined flag so user must re-enter the invite code next time
      try {
        if (roomId) localStorage.removeItem(`room-joined-${roomId}`);
      } catch (e) {
        // ignore
      }
      navigate('/');
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to leave room', variant: 'destructive' });
    }
  };

  const handleJoinWithCode = async () => {
    if (!joinCode || !roomId) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      const { data, error } = await supabase.from('rooms').select('id,code').eq('code', joinCode).single();
      if (error || !data) {
        setJoinError('Invalid code');
        toast({ title: 'Error', description: 'Invalid invite code', variant: 'destructive' });
        setJoinLoading(false);
        return;
      }

      if (data.id !== roomId) {
        setJoinError('This code does not match the room you are trying to access');
        toast({ title: 'Error', description: 'Code does not match this room', variant: 'destructive' });
        setJoinLoading(false);
        return;
      }

      // success — mark joined so user can access room
      try {
        localStorage.setItem(`room-joined-${roomId}`, 'true');
      } catch (e) {}
      setShowJoinPrompt(false);
      toast({ title: 'Joined', description: 'Invite code accepted' });
    } catch (e) {
      setJoinError('Failed to verify code');
      toast({ title: 'Error', description: 'Failed to verify code', variant: 'destructive' });
    } finally {
      setJoinLoading(false);
    }
  };

  // Derived counts for sidebar
  const pollsCount = messages.filter((m) => m.message_type === 'poll').length;
  const photosCount = messages.filter((m) => m.message_type === 'image').length;
  const docsCount = messages.filter((m) => m.message_type === 'document').length;
  const fileList = messages.filter((m) => m.message_type === 'image' || m.message_type === 'document');
  const myFiles = fileList.filter((m) => m.username === username);
  const [showFilesPanel, setShowFilesPanel] = useState(false);

  return (
    <div className="flex h-screen bg-gradient-to-br from-chat-bg-start to-chat-bg-end">
      {/* Left sidebar: room info + counts + my files */}
      <aside className="w-64 border-r border-border bg-card p-4 hidden md:block">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Current Room</h3>
          <div className="mt-2 text-sm text-muted-foreground">{room?.name || '—'}</div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="p-2 bg-muted/5 rounded text-center">
            <div className="text-sm font-bold">{pollsCount}</div>
            <div className="text-xs text-muted-foreground">Polls</div>
          </div>
          <div className="p-2 bg-muted/5 rounded text-center">
            <div className="text-sm font-bold">{photosCount}</div>
            <div className="text-xs text-muted-foreground">Photos</div>
          </div>
          <div className="p-2 bg-muted/5 rounded text-center">
            <div className="text-sm font-bold">{docsCount}</div>
            <div className="text-xs text-muted-foreground">Docs</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">My Files</h4>
            <button onClick={() => setShowFilesPanel((s) => !s)} className="text-xs text-muted-foreground">{showFilesPanel ? 'Hide' : 'Show'}</button>
          </div>

          {showFilesPanel ? (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {myFiles.length === 0 && <div className="text-xs text-muted-foreground">No files</div>}
              {myFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/5 transition-colors">
                  {f.message_type === 'image' ? (
                    <img src={f.file_url} alt={f.file_name} className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground"><FileText className="h-4 w-4" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{f.file_name || (f.message_type === 'image' ? 'Image' : 'Document')}</div>
                    <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}</div>
                  </div>
                  <a href={f.file_url} download={f.file_name} className="text-sm text-primary">Open</a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Access your uploaded images & documents here.</div>
          )}
        </div>
      </aside>

      {showJoinPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-2">Enter invite code</h2>
            <p className="text-sm text-muted-foreground mb-4">This room is private — enter the invite code to join.</p>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.trim())}
              placeholder="Enter code"
              className="w-full mb-3 px-3 py-2 border rounded-md bg-input text-sm"
            />
            {joinError && <div className="text-sm text-destructive mb-2">{joinError}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => navigate('/')} className="px-3 py-1 rounded bg-muted/5">Go to Lobby</button>
              <button onClick={handleJoinWithCode} disabled={joinLoading} className="px-3 py-1 rounded bg-primary text-primary-foreground">{joinLoading ? 'Joining...' : 'Join'}</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
          <div className="container mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">{room?.name || "Room"}</h1>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <button onClick={handleCopyCode} className="text-sm bg-muted/5 px-2 py-1 rounded-md">Copy code</button>
                <button onClick={handleLeaveRoom} className="text-sm bg-destructive/10 text-destructive px-2 py-1 rounded-md">Leave</button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-6 max-w-4xl">
            {messages.map((message) => (
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
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="container mx-auto max-w-4xl">
          <ChatInput
            onSend={(c, extra) => handleSendMessage(c)}
            disabled={loading || !username}
            username={username}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            users={Array.from(new Set(onlineUsers.map((u: any) => (typeof u === 'string' ? u : u.username)).filter(Boolean)))}
            roomId={roomId}
            onResourceShared={() => reloadMessages()}
          />
        </div>
      </div>

      <div className="w-64 border-l border-border bg-card hidden lg:block">
        <OnlineUsers users={onlineUsers} />
      </div>
    </div>
  );
};

export default Room;
