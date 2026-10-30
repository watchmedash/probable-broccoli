"use client";
import { browserSupabase } from "./supabase/client";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Uploads a picture into the signed-in person's own folder of a public bucket (the buckets' rule),
 * and returns its public address. "avatars" holds profile pictures and covers; "post-images" the rest.
 */
export async function uploadImage(file: File, bucket: "post-images" | "avatars"): Promise<string> {
  if (file.size > MAX_BYTES) throw { message: "Pictures can be up to 10 MB each." };
  const sb = browserSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw { message: "Log in first." };
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  // The avatars bucket only takes JPEGs, PNGs and WebPs; GIFs go to posts.
  const path = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
