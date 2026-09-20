import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({ id: z.coerce.string().optional() });

/**
 * MASTER адрес за реда „Детайли на имот“.
 * Реалната страница е /properties/<id>.
 */
export const Route = createFileRoute("/property-details")({
  validateSearch: (s) => schema.parse(s),
  beforeLoad: ({ search }) => {
    if (search.id) {
      throw redirect({
        to: "/properties/$propertyId",
        params: { propertyId: search.id },
        replace: true,
      });
    }
    throw redirect({ to: "/search", replace: true });
  },
  component: () => null,
});
