import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreateRoomDialog } from "@/components/CreateRoomDialog";
import { JoinRoomDialog } from "@/components/JoinRoomDialog";
import { useNavigate } from "react-router-dom";

const Lobby = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadRooms = async () => {
      const { data, error } = await supabase.from("rooms").select("id, name, created_by, created_at").limit(50);
      if (!error && data) setRooms(data || []);
    };
    loadRooms();

    const chan = supabase.channel("rooms").on("postgres_changes", { event: "INSERT", schema: "public", table: "rooms" }, (payload) => {
      setRooms((r) => [...r, payload.new]);
    }).subscribe();

    return () => supabase.removeChannel(chan);
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">flamechat — Rooms</h1>
        <div className="flex gap-2">
          <CreateRoomDialog onCreated={(roomId: string) => navigate(`/r/${roomId}`)} />
          <JoinRoomDialog onJoined={(roomId: string) => navigate(`/r/${roomId}`)} />
        </div>
      </div>

      <div className="grid gap-3">
        {rooms.map((r) => (
          <Card key={r.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">by {r.created_by} • {new Date(r.created_at).toLocaleString()}</div>
            </div>
            <Button onClick={() => navigate(`/r/${r.id}`)} size="sm">Join</Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Lobby;
