import { describe, expect, it } from "vitest";
import { videoEmbed } from "./video";

describe("videoEmbed", () => {
  it("embeds YouTube links in their usual shapes, without tracking cookies", () => {
    const src = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ])
      expect(videoEmbed(url)).toEqual({ kind: "iframe", src });
    expect(videoEmbed("https://www.youtube.com/channel/abc")).toBeNull();
  });

  it("embeds Vimeo and Facebook, and plays direct files", () => {
    expect(videoEmbed("https://vimeo.com/76979871")).toEqual({ kind: "iframe", src: "https://player.vimeo.com/video/76979871" });
    expect(videoEmbed("https://www.facebook.com/fashionbd/videos/123456/")?.src).toBe(
      "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ffashionbd%2Fvideos%2F123456%2F&show_text=false",
    );
    expect(videoEmbed("https://cdn.example.com/eid-sale.MP4")).toEqual({ kind: "file", src: "https://cdn.example.com/eid-sale.MP4" });
  });

  it("refuses anything else", () => {
    expect(videoEmbed("http://youtu.be/dQw4w9WgXcQ")).toBeNull(); // not https
    expect(videoEmbed("https://example.com/page")).toBeNull();
    expect(videoEmbed("/videos/a.mp4")).toBeNull();
    expect(videoEmbed("javascript:alert(1)")).toBeNull();
  });
});
