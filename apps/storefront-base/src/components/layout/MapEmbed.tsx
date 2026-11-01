/**
 * A Google map of a place (the address or place name as typed into Google Maps), with Google's
 * free embed: no API key. The browser loads it only when it scrolls near.
 */
export const mapEmbedSrc = (query: string) => `https://maps.google.com/maps?q=${encodeURIComponent(query.trim())}&z=15&output=embed`;

export function MapEmbed({ query, title, className }: { query: string; title: string; className?: string }) {
  if (!query.trim()) return null;
  return (
    <iframe
      src={mapEmbedSrc(query)}
      title={title}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className={className ?? "h-56 w-full rounded-lg border-0"}
    />
  );
}
