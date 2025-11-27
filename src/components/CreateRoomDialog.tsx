import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onCreated?: (roomId: string) => void;
}

const generateCode = () => {
  // simple 6-char alpha-numeric code
  return Math.random().toString(36).slice(2, 8).toUpperCase();
};

export const CreateRoomDialog = ({ onCreated }: Props) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdRoom, setCreatedRoom] = useState<any | null>(null);
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const code = generateCode();
    const { data, error } = await supabase.from("rooms").insert({ name: name.trim(), code, created_by: localStorage.getItem("chat-username") || "Anonymous" }).select().single();
    if (error || !data) {
      toast({ title: "Error", description: "Failed to create room", variant: "destructive" });
      return;
    }

    // keep dialog open and show code with copy option
    setCreatedRoom(data);
    toast({ title: "Room created", description: `Invite code copied to clipboard` });
    try {
      await navigator.clipboard.writeText(data.code);
    } catch (e) {
      // ignore
    }
  };

  const handleCopy = async () => {
    if (!createdRoom) return;
    try {
      await navigator.clipboard.writeText(createdRoom.code);
      toast({ title: "Copied", description: "Invite code copied to clipboard" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to copy code", variant: "destructive" });
    }
  };

  const handleGoToRoom = () => {
    if (!createdRoom) return;
    // mark as joined so user can access room without re-entering code
    try {
      localStorage.setItem(`room-joined-${createdRoom.id}`, "true");
    } catch (e) {
      // ignore
    }
    onCreated?.(createdRoom.id);
    setOpen(false);
    setCreatedRoom(null);
    setName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Room</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Room</DialogTitle>
        </DialogHeader>

        {!createdRoom ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Room name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Friends" />
            </div>
            <Button type="submit">Create</Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-muted/5">
              <div className="text-sm font-medium">Room created</div>
              <div className="text-xs text-muted-foreground mt-1">Share this invite code with friends to let them join:</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="rounded-md bg-card px-3 py-2 font-mono text-sm">{createdRoom.code}</div>
                <Button size="sm" variant="outline" onClick={handleCopy}>Copy</Button>
                <Button size="sm" onClick={handleGoToRoom}>Go to room</Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">You can also find the code in the room header after creating.</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoomDialog;
