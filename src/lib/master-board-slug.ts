// Превръща route на ред от таблицата в безопасен URL slug и обратно.
import { MASTER_BOARD_ROWS, type MasterBoardRow } from "@/lib/master-board-data";

export function routeToSlug(route: string): string {
  const s = route
    .replace(/:/g, "p-")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return s || "home";
}

export function findRowBySlug(slug: string): MasterBoardRow | null {
  return MASTER_BOARD_ROWS.find((r) => routeToSlug(r.route) === slug) ?? null;
}
