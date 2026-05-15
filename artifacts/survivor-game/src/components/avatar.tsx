import { User } from "lucide-react";

interface AvatarProps {
  avatarPath?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

/**
 * Circular avatar. Shows the uploaded image if `avatarPath` is set,
 * otherwise the player's initials, otherwise a generic icon.
 */
export function Avatar({ avatarPath, name, size = 36, className = "" }: AvatarProps) {
  const url = avatarPath ? `/api/storage${avatarPath}` : null;
  const initial = (name ?? "").trim().charAt(0).toUpperCase();
  const dimensions = { width: size, height: size };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden bg-muted text-muted-foreground border border-border shrink-0 ${className}`}
      style={dimensions}
    >
      {url ? (
        <img
          src={url}
          alt={name ?? "Profile picture"}
          className="w-full h-full object-cover"
        />
      ) : initial ? (
        <span
          className="font-bold leading-none"
          style={{ fontFamily: "'Oswald', sans-serif", fontSize: Math.round(size * 0.45) }}
        >
          {initial}
        </span>
      ) : (
        <User style={{ width: size * 0.55, height: size * 0.55 }} />
      )}
    </span>
  );
}
