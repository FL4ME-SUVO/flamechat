import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PollMessage } from "./PollMessage";
import { FileText, Download, CornerUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessageProps {
  username: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
  messageType?: string;
  fileUrl?: string;
  fileName?: string;
  pollId?: string;
  currentUsername: string;
  onReply?: () => void;
}

export const ChatMessage = ({
  username,
  content,
  createdAt,
  isOwn,
  messageType = "text",
  fileUrl,
  fileName,
  pollId,
  currentUsername,
  onReply,
}: ChatMessageProps) => {
  // Compact initials avatar (1-2 chars)
  const initials = username ? username.split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase() : "?";

  const [replyMeta, setReplyMeta] = useState<{ id: string } | null>(null);
  const [repliedMessage, setRepliedMessage] = useState<{ username: string; content: string } | null>(null);
  const [displayContent, setDisplayContent] = useState<string>(content);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // detect reply metadata written as: "> reply:<id>\n"
    const match = content.match(/^> reply:([^\n]+)\n/);
    if (match) {
      const id = match[1];
      setReplyMeta({ id });
      setDisplayContent(content.replace(/^> reply:[^\n]+\n/, ""));

      // fetch the original message (best-effort)
      (async () => {
        try {
          const { data, error } = await supabase.from("messages").select("username, content").eq("id", id).single();
          if (!error && data) {
            setRepliedMessage({ username: data.username, content: data.content });
          }
        } catch (e) {
          // ignore
        }
      })();
    } else {
      setReplyMeta(null);
      setRepliedMessage(null);
      setDisplayContent(content);
    }
  }, [content]);

  const renderMessageContent = () => {
    if (messageType === "poll" && pollId) {
      return (
        <div className="relative">
          <PollMessage pollId={pollId} username={currentUsername} />
        </div>
      );
    }

    if (messageType === "image" && fileUrl) {
      return (
        <div className="relative inline-block">
          <img
            src={fileUrl}
            alt={fileName || "Shared image"}
            className="rounded-md max-w-full h-auto max-h-96 object-cover"
          />
          <a
            href={fileUrl}
            download={fileName || "image.jpg"}
            className="absolute top-1 right-1 p-1 rounded-md bg-muted/10 text-muted-foreground hover:bg-muted/20"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      );
    }

    if (messageType === "document" && fileUrl) {
      return (
        <div className="flex items-center gap-3 p-2 bg-muted/5 rounded-md">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{fileName || "Document"}</p>
            <p className="text-xs text-muted-foreground">Download</p>
          </div>
          <Button size="sm" variant="ghost" asChild>
            <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      );
    }

    // text (possibly with reply preview)
    return (
      <div>
        {repliedMessage && (
          <div className="mb-2 p-2 rounded-md bg-muted/3 border border-muted/8 text-sm">
            <div className="text-xs font-medium text-muted-foreground">Replying to {repliedMessage.username}</div>
            <div className="text-sm text-foreground/90 truncate">{repliedMessage.content}</div>
          </div>
        )}
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{displayContent}</div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 mb-2",
        isOwn ? "justify-end" : "justify-start"
      )}
      tabIndex={0}
      role="article"
      aria-label={`${username} message`} 
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(e) => {
        // keyboard shortcuts when a message is focused
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          onReply?.();
        }
      }}
    >
      {/* Avatar (small) */}
      {!isOwn && (
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground/90">
            {initials}
          </div>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[86%] relative",
          isOwn
            ? "ml-auto text-white"
            : "mr-auto text-foreground",
          "group"
        )}
      >
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2",
            isOwn
              ? "bg-primary text-primary-foreground"
              : "bg-muted/5 text-foreground border border-transparent",
            "transition-transform duration-150 group-hover:translate-y-[-2px] shadow-sm"
          )}
        >
          {/* action buttons (reply, mention) shown on hover */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 transition-all duration-150 flex gap-1 items-center",
              // position the controls slightly outside the bubble to the left or right
              isOwn ? "-left-12" : "-right-12",
              // visible on hover or when focused for keyboard users
              isFocused ? "opacity-100" : "opacity-0",
              "group-hover:opacity-100"
            )}
            aria-hidden={!isFocused}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onReply?.(); }}
              className={cn(
                "p-1 rounded-md shadow-sm transform transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1",
                isOwn ? "bg-white/5 hover:bg-white/10 text-white/90" : "bg-muted/5 hover:bg-muted/10 text-muted-foreground"
              )}
              tabIndex={0}
              aria-label="Reply"
            >
              <CornerUpLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Show sender name only for other users and when needed */}
          {!isOwn && (
            <div className="mb-1 text-xs font-medium text-muted-foreground">{username}</div>
          )}

          {renderMessageContent()}

          {/* Inline small timestamp */}
          <div className="mt-1 text-[11px] text-muted-foreground text-right">{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}</div>
        </div>
      </div>

      {/* Avatar for own messages (small) */}
      {isOwn && (
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-primary/80 flex items-center justify-center text-xs font-semibold text-white">
            {initials}
          </div>
        </div>
      )}
    </div>
  );
};
