import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onJoined?: (roomId: string) => void;
}

export const JoinRoomDialog = ({ onJoined }: Props) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const { toast } = useToast();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    const { data, error } = await supabase.from("rooms").select("id").eq("code", code.trim()).single();
    if (error || !data) {
      toast({ title: "Not found", description: "Invalid room code", variant: "destructive" });
      return;
    }

    try {
      localStorage.setItem(`room-joined-${data.id}`, "true");
    } catch (e) {
      // ignore
    }

    setOpen(false);
    setCode("");
    onJoined?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Join Room</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <Label>Room code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter invite code" />
          </div>
          <Button type="submit">Join</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default JoinRoomDialog;
