import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface OnlineUsersProps {
  users: Array<{ username: string; online_at: string }>;
}

export const OnlineUsers = ({ users }: OnlineUsersProps) => {
  return (
    <Card className="h-full p-0">
      <div className="p-4 border-b border-border flex items-center">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-foreground ml-2">Online</h2>
        <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="p-3 space-y-2">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No users online</p>
          ) : (
            users.map((user, index) => (
              <div key={index} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/5 transition-colors">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground/90">{user.username.slice(0,2).toUpperCase()}</div>
                <div>
                  <div className="text-sm font-medium">{user.username}</div>
                  <div className="text-xs text-muted-foreground">{new Date(user.online_at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};
