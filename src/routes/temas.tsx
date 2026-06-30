import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/temas")({
  beforeLoad: () => {
    throw redirect({ to: "/temas-redacao" });
  },
});
