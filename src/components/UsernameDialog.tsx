import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";

interface UsernameDialogProps {
  open: boolean;
  onSubmit: (username: string) => void;
}

export const UsernameDialog = ({ open, onSubmit }: UsernameDialogProps) => {
  const [username, setUsername] = useState("");
  const { theme, setTheme } = useTheme();
  const currentTheme = theme ?? "system";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSubmit(username.trim());
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white text-2xl">
                🔥
              </div>
              <div>
                <DialogTitle className="text-lg">
                  Welcome to flamechat
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Pick a display name to start chatting
                </DialogDescription>
              </div>
            </div>
            <div>
              <select
                value={currentTheme}
                onChange={(e) => setTheme(e.target.value as "system" | "light" | "dark")}
                className="bg-muted/5 rounded-md px-2 py-1 text-sm"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alex, sara123"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground"
            disabled={!username.trim()}
          >
            Join the chat
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
