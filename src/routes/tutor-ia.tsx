import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tutor-ia")({
  beforeLoad: () => {
    throw redirect({ to: "/tutor" });
  },
});
