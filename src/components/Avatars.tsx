/* eslint-disable @next/next/no-img-element */
import type { Hub, Profile } from "@/lib/types";

/** A hub's picture, or its first letter on its colour (a rounded square, like the app). */
export function HubIcon({ hub, size }: { hub: Pick<Hub, "name" | "color" | "icon_url">; size: number }) {
  return (
    <span className="hub-icon" style={{ width: size, height: size, borderRadius: size / 4, background: hub.color || "#2563EB", fontSize: size * 0.42 }}>
      {hub.name.slice(0, 1).toUpperCase()}
      {hub.icon_url && <img src={hub.icon_url} alt="" loading="lazy" />}
    </span>
  );
}

export function Avatar({ user, size }: { user: Pick<Profile, "username" | "avatar_url"> | null; size: number }) {
  if (user?.avatar_url) return <img className="avatar" src={user.avatar_url} alt="" width={size} height={size} loading="lazy" />;
  return (
    <span className="avatar letter" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {(user?.username ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
