import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { FileUploadDialog } from "./FileUploadDialog";
import { CreatePollDialog } from "./CreatePollDialog";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string, extra?: { replyToId?: string }) => void;
  disabled?: boolean;
  username: string;
  replyTo?: { id: string; username: string } | null;
  onCancelReply?: () => void;
  users?: string[];
  roomId?: string | null;
  onResourceShared?: () => void;
}

export const ChatInput = ({
  onSend,
  disabled,
  username,
  replyTo,
  onCancelReply,
  users = [],
  roomId,
  onResourceShared,
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // compute suggestions when typing '@'
    const atIndex = message.lastIndexOf("@");
    if (atIndex >= 0) {
      const query = message.slice(atIndex + 1);
      // only suggest for short queries
      if (query.length <= 20) {
        const filtered = users.filter((u) => u.toLowerCase().startsWith(query.toLowerCase()));
        setSuggestions(filtered.slice(0, 6));
        setShowSuggestions(filtered.length > 0);
        // reset selection when suggestions change
        setSelectedIndex(filtered.length > 0 ? 0 : -1);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [message, users]);

  // keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // If suggestions are open and selection valid, pick it
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleSelectSuggestion = (user: string) => {
    const atIndex = message.lastIndexOf("@");
    if (atIndex >= 0) {
      const before = message.slice(0, atIndex + 1);
      const after = message.slice(atIndex + 1).replace(/^\S*/, "");
      const newVal = before + user + (after ? "" : " ") + after;
      setMessage(newVal);
      setShowSuggestions(false);
      // focus and place cursor after mention
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim(), { replyToId: replyTo?.id });
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Reply preview above the input (classic layout) */}
      {replyTo && (
        <div className="mb-2 rounded-md border border-border bg-muted/5 p-2 flex items-center justify-between">
          <div className="text-sm">
            Replying to <span className="font-medium">{replyTo.username}</span>
          </div>
          <div>
            <button type="button" onClick={onCancelReply} className="text-xs text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 p-3 bg-card border-t border-border shadow-inner rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-muted/10 p-1 rounded-full">
            <FileUploadDialog username={username} type="image" onFileUploaded={() => onResourceShared?.()} roomId={roomId} />
            <FileUploadDialog username={username} type="document" onFileUploaded={() => onResourceShared?.()} roomId={roomId} />
            <CreatePollDialog username={username} onPollCreated={() => onResourceShared?.()} roomId={roomId} />
          </div>
        </div>

        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Sign in to chat" : "Type a message"}
            disabled={disabled}
            className="w-full bg-background rounded-full py-3 px-4"
          />

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-3 top-full mt-2 z-20 w-60 rounded-md bg-card border border-border shadow-md overflow-hidden" role="listbox" aria-label="Mention suggestions">
              {suggestions.map((s, idx) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm",
                    selectedIndex === idx ? "bg-muted/10" : "hover:bg-muted/10"
                  )}
                  role="option"
                  aria-selected={selectedIndex === idx}
                >
                  @{s}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" disabled={disabled || !message.trim()} size="icon" className="shrink-0 rounded-full bg-gradient-to-r from-primary to-primary-600 text-white shadow-md hover:opacity-95">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};
