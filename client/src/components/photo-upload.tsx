import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  currentUrl: string;
  onUploaded: (url: string) => void;
  shape?: "square" | "circle";
}

export function PhotoUpload({ currentUrl, onUploaded, shape = "square" }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/admin/upload-photo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPreview(data.url);
      onUploaded(data.url);
      toast({ title: "Photo uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-md";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {preview ? (
          <div className="relative group">
            <img src={preview} alt="" className={`h-16 w-16 object-cover ${shapeClass} border`} />
            <button
              type="button"
              onClick={() => { setPreview(""); onUploaded(""); }}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid="button-remove-photo"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className={`h-16 w-16 border-2 border-dashed flex items-center justify-center ${shapeClass} text-muted-foreground`}>
            <Camera className="h-5 w-5" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            data-testid="button-upload-photo"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? "Uploading..." : "Upload Photo"}
          </Button>
          <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP up to 10MB</span>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
        data-testid="input-photo-file"
      />
    </div>
  );
}
