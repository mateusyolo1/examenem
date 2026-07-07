import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

type UserInfo = {
  email: string;
  name: string;
  avatar: string | null;
};

export function UserMenu() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const read = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setUser(null);
        return;
      }
      const meta = data.user.user_metadata ?? {};
      setUser({
        email: data.user.email ?? "",
        name: (meta.full_name as string) ?? (meta.name as string) ?? data.user.email ?? "Aluno",
        avatar: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
      });
    };
    read();
    const { data: sub } = supabase.auth.onAuthStateChange(() => read());
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!user) return null;

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md border border-border bg-background/50">
      {user.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar}
          alt=""
          className="w-8 h-8 rounded-full object-cover shrink-0"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold shrink-0">
          {initials || "?"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">{user.name}</div>
        <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
      </div>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        aria-label="Sair"
        title="Sair"
        className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
