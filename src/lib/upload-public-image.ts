import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads an image to the public `property-images` bucket under the given
 * prefix and returns the publicly accessible URL.
 */
export async function uploadPublicImage(
  file: File,
  pathPrefix: string,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
  const key = `${pathPrefix.replace(/\/+$/, "")}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${safeExt}`;

  const { error } = await supabase.storage
    .from("property-images")
    .upload(key, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("property-images").getPublicUrl(key);
  return data.publicUrl;
}
