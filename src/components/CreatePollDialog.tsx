import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreatePollDialogProps {
  username: string;
  onPollCreated: () => void;
  roomId?: string | null;
}

export const CreatePollDialog = ({ username, onPollCreated, roomId }: CreatePollDialogProps) => {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const { toast } = useToast();

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question",
        variant: "destructive",
      });
      return;
    }

    const validOptions = options.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      toast({
        title: "Error",
        description: "Please provide at least 2 options",
        variant: "destructive",
      });
      return;
    }

    const pollOptions = validOptions.map((text, i) => ({
      id: `option-${i}`,
      text,
      votes: 0,
    }));

    const { data: pollData, error: pollError } = await supabase
      .from("polls")
      .insert({
        question: question.trim(),
        options: pollOptions,
        created_by: username,
      })
      .select()
      .single();

    if (pollError) {
      toast({
        title: "Error",
        description: "Failed to create poll",
        variant: "destructive",
      });
      return;
    }

    const { error: messageError } = await supabase.from("messages").insert({
      username,
      content: question.trim(),
      message_type: "poll",
      poll_id: pollData.id,
      room_id: roomId ?? null,
    });

    if (messageError) {
      toast({
        title: "Error",
        description: "Failed to send poll message",
        variant: "destructive",
      });
      return;
    }

    setOpen(false);
    setQuestion("");
    setOptions(["", ""]);
    onPollCreated();
    toast({
      title: "Poll created!",
      description: "Your poll has been shared in the chat",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <BarChart3 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Poll</DialogTitle>
          <DialogDescription>Ask a question and add options for voting</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What's your question?"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 10 && (
              <Button type="button" variant="outline" size="sm" onClick={addOption} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            )}
          </div>
          <Button type="submit" className="w-full">
            Create Poll
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
