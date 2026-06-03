/**
 * Public renderer: drop on a page to render the published design (if any) for that slug.
 * Returns null if no published design exists — caller should render the default page.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicPageDesign } from "@/lib/page-builder/page-builder.functions";
import { renderBlock } from "@/lib/page-builder/render";
import type { ReactNode } from "react";

export function RenderDesign({
  slug,
  fallback,
}: {
  slug: "home" | "about" | "cities" | "properties" | "brokers" | "contact";
  fallback: ReactNode;
}) {
  const fn = useServerFn(getPublicPageDesign);
  const { data, isLoading } = useQuery({
    queryKey: ["public-page-design", slug],
    queryFn: () => fn({ data: { page_slug: slug } }),
    staleTime: 60_000,
  });
  if (isLoading) return <>{fallback}</>;
  if (!data || data.layout.blocks.length === 0) return <>{fallback}</>;
  return (
    <div className="builder-rendered">
      {data.layout.blocks.map((b) => (
        <div key={b.id}>{renderBlock(b)}</div>
      ))}
    </div>
  );
}
