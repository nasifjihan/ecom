/**
 * How a video link from a page block is shown: an embedded player (YouTube, Vimeo, Facebook) or a
 * plain <video> for a direct .mp4 / .webm file. null for anything else. The API accepts only links
 * this understands, so the storefront never gets one it can't show.
 */
export type VideoEmbed = { kind: "iframe"; src: string } | { kind: "file"; src: string };

export function videoEmbed(url: string): VideoEmbed | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  const yt = (id: string | null | undefined) => (id && /^[\w-]{6,20}$/.test(id) ? { kind: "iframe" as const, src: `https://www.youtube-nocookie.com/embed/${id}` } : null);
  if (host === "youtu.be") return yt(u.pathname.slice(1));
  if (host === "youtube.com") {
    if (u.pathname === "/watch") return yt(u.searchParams.get("v"));
    const m = /^\/(embed|shorts|live)\/([\w-]+)/.exec(u.pathname);
    return yt(m?.[2]);
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = /\/(\d{5,12})(?:$|\/|\?)/.exec(u.pathname + "/")?.[1];
    return id ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (host === "facebook.com" || host === "fb.watch") {
    return { kind: "iframe", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false` };
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { kind: "file", src: u.href };
  return null;
}
