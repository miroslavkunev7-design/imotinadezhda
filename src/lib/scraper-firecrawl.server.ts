import Firecrawl from "@mendable/firecrawl-js";

export function createFirecrawlClient() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY не е конфигуриран. Свържете Firecrawl в Connectors.");
  return new Firecrawl({ apiKey: key });
}
