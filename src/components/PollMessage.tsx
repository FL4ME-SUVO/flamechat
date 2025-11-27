import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { BarChart3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PollOption {
  id: string;
  text: string;
  votes?: number;
}

interface PollMessageProps {
  pollId: string;
  username: string;
}

export const PollMessage = ({ pollId, username }: PollMessageProps) => {
  const [poll, setPoll] = useState<any>(null);
  const [votes, setVotes] = useState<any[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVoteId, setUserVoteId] = useState<string | null>(null);
  const [userSelectedOption, setUserSelectedOption] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPoll();
    loadVotes();

    const pollChannel = supabase
      .channel(`poll-${pollId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poll_votes",
          filter: `poll_id=eq.${pollId}`,
        },
        () => {
          loadVotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pollChannel);
    };
  }, [pollId]);

  const loadPoll = async () => {
    const { data, error } = await supabase
      .from("polls")
      .select("*")
      .eq("id", pollId)
      .single();

    if (!error && data) {
      setPoll(data);
    }
  };

  const loadVotes = async () => {
    const { data, error } = await supabase
      .from("poll_votes")
      .select("*")
      .eq("poll_id", pollId);

    if (!error && data) {
      setVotes(data);
      const userVote = data.find((v: any) => v.username === username);
      setHasVoted(!!userVote);
      setUserVoteId(userVote ? userVote.id : null);
      setUserSelectedOption(userVote ? userVote.option_id : null);
    }
  };

  const handleVote = async (optionId: string) => {
    try {
      // Optimistically set selected option for UI
      setUserSelectedOption(optionId);

      // use upsert with onConflict to insert or switch vote atomically
      const { data, error } = await supabase
        .from("poll_votes")
        .upsert({ poll_id: pollId, username, option_id: optionId }, { onConflict: "poll_id,username" })
        .select()
        .single();

      if (error) throw error;
      setUserVoteId(data?.id ?? null);
      setHasVoted(true);

      toast({ title: "Vote recorded!", description: "Your vote has been submitted" });
      await loadVotes();
    } catch (e) {
      // revert optimistic selection on error
      setUserSelectedOption(null);
      toast({ title: "Error", description: "Failed to submit vote", variant: "destructive" });
    }
  };

  const revokeVote = async () => {
    try {
      // delete by username+poll_id for reliability
      const { error } = await supabase
        .from("poll_votes")
        .delete()
        .eq("poll_id", pollId)
        .eq("username", username);

      if (error) throw error;

      // update local state
      setUserVoteId(null);
      setUserSelectedOption(null);
      setHasVoted(false);
      toast({ title: "Vote removed" });
      await loadVotes();
    } catch (e) {
      toast({ title: "Error", description: "Failed to remove vote", variant: "destructive" });
    }
  };

  if (!poll) return null;

  const options = poll.options as PollOption[];
  const totalVotes = votes.length;

  const getVoteCount = (optionId: string) => {
    return votes.filter((v) => v.option_id === optionId).length;
  };

  return (
    <>
      <Card className="p-3 w-full max-w-2xl bg-card">
        <div className="flex items-start gap-3">
          <div className="p-1 rounded-md bg-muted/5">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm truncate">{poll.question}</h3>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}</div>
                <Button size="sm" variant="ghost" onClick={() => setDetailsOpen(true)}>Details</Button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {options.map((option) => {
                const voteCount = getVoteCount(option.id);
                const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

                return (
                  <div key={option.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-foreground truncate">{option.text}</div>
                      <div className="text-xs text-muted-foreground ml-2">{voteCount} • {Math.round(percentage)}%</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-1 flex-1 bg-muted/10 rounded overflow-hidden">
                        <div
                          className="h-1 bg-primary transition-all duration-600 ease-out"
                          style={{ width: `${percentage}%` }}
                          aria-hidden
                        />
                      </div>

                      {!hasVoted ? (
                        <Button size="sm" variant="outline" onClick={() => handleVote(option.id)} disabled={poll.closed}>
                          Vote
                        </Button>
                      ) : (
                        // after voting, show which option user selected and allow switching from other options
                        userSelectedOption === option.id ? (
                          <div className="text-xs text-primary font-medium">Your vote</div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleVote(option.id)}>
                            Switch
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              {totalVotes} {totalVotes === 1 ? "vote" : "votes"} • created by {poll.created_by}
            </div>

            {hasVoted && (
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="link" onClick={revokeVote}>Remove my vote</Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Poll details</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="text-sm font-medium">{poll.question}</div>

            {options.map((option) => {
              const voteCount = getVoteCount(option.id);
              const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
              const voters = votes.filter((v) => v.option_id === option.id).map((v) => v.username);

              return (
                <div key={option.id} className="p-3 rounded-md bg-muted/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">{option.text}</div>
                    <div className="text-xs text-muted-foreground">{voteCount} • {Math.round(percentage)}%</div>
                  </div>

                  <div className="h-2 bg-muted/10 rounded overflow-hidden mb-2">
                    <div className="h-2 bg-primary transition-all duration-600 ease-out" style={{ width: `${percentage}%` }} />
                  </div>

                  <div className="text-xs text-muted-foreground">Voters: {voters.length ? voters.join(", ") : "—"}</div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
