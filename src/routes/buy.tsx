import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/buy")({
  head: () => ({
    meta: [
      { title: "Купи имот — Имоти Надежда" },
      { name: "description", content: "Разгледайте всички имоти за продажба на Имоти Надежда." },
    ],
  }),
  component: () => <Navigate to="/search" search={{ status: "sale" } as never} replace />,
});