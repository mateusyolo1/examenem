import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/revisar-erros")({
  beforeLoad: () => {
    throw redirect({ to: "/revisar" });
  },
});
