import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { Avatar } from "./avatar";
import { useUpload } from "@workspace/object-storage-web";
import { useToast } from "@/hooks/use-toast";

interface AvatarUploaderProps {
  avatarPath?: string | null;
  name?: string | null;
  size?: number;
  saving?: boolean;
  onChange: (avatarPath: string | null) => Promise<void> | void;
}

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Click the avatar to pick a new photo. Includes a small "remove" button
 * underneath when an avatar is already set.
 */
export function AvatarUploader({
  avatarPath,
  name,
  size = 96,
  saving = false,
  onChange,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const { uploadFile, isUploading } = useUpload({
    onError: (err) =>
      toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const busy = pending || isUploading || saving;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "Image too large", description: "Please pick a file under 8 MB.", variant: "destructive" });
      return;
    }
    setPending(true);
    try {
      const result = await uploadFile(file);
      if (result?.objectPath) {
        await onChange(result.objectPath);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    setPending(true);
    try {
      await onChange(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        data-testid="avatar-upload-button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="relative group rounded-full"
        title="Change profile photo"
      >
        <Avatar avatarPath={avatarPath} name={name} size={size} />
        <span
          className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ width: size, height: size }}
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
        </span>
        <span
          className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground p-1.5 border-2 border-background shadow-sm"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        data-testid="avatar-upload-input"
      />
      {avatarPath ? (
        <button
          type="button"
          data-testid="avatar-remove-button"
          disabled={busy}
          onClick={handleRemove}
          className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" /> Remove
        </button>
      ) : (
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Add photo</span>
      )}
    </div>
  );
}
