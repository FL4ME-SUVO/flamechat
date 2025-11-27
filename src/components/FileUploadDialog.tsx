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
import { ImagePlus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileUploadDialogProps {
  username: string;
  type: "image" | "document";
  onFileUploaded: () => void;
  roomId?: string | null;
}

export const FileUploadDialog = ({ username, type, onFileUploaded, roomId }: FileUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const bucket = type === "image" ? "chat-images" : "chat-documents";
  const acceptTypes = type === "image" ? "image/*" : ".pdf,.doc,.docx,.txt,.csv,.xlsx";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

    const { error: messageError } = await supabase.from("messages").insert({
      username,
      content: `Shared a ${type}`,
      message_type: type,
      file_url: urlData.publicUrl,
      file_name: file.name,
      room_id: roomId ?? null,
    });

    if (messageError) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success!",
        description: `${type === "image" ? "Image" : "Document"} shared in chat`,
      });
      setOpen(false);
      setFile(null);
      onFileUploaded();
    }

    setUploading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          {type === "image" ? (
            <ImagePlus className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {type === "image" ? "an Image" : "a Document"}</DialogTitle>
          <DialogDescription>
            Upload {type === "image" ? "an image" : "a document"} to share in the chat
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Choose file</Label>
            <Input
              id="file"
              type="file"
              accept={acceptTypes}
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>
          {file && (
            <div className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
          <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
            {uploading ? "Uploading..." : "Upload & Share"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
