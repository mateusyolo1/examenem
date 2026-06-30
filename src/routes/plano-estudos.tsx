import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/plano-estudos")({
  beforeLoad: () => {
    throw redirect({ to: "/plano" });
  },
});
