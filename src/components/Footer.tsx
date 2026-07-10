import { Link } from "@tanstack/react-router";
import { DonateButton } from "./DonateButton";
import { TutorialTrigger } from "./Tutorial";

export function Footer() {
  return (
    <footer className="border-t border-border mt-20 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-4 text-xs font-mono uppercase text-muted-foreground">
          <span>© {new Date().getFullYear()} yolodesign · Exame ENEM</span>
          <span className="opacity-30">/</span>
          <span>Progresso Salvo na Nuvem</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[10px] font-bold uppercase tracking-widest">
          <Link to="/precos" className="text-muted-foreground hover:text-foreground transition-colors">
            Preços
          </Link>
          <Link to="/termos" className="text-muted-foreground hover:text-foreground transition-colors">
            Termos
          </Link>
          <Link to="/privacidade" className="text-muted-foreground hover:text-foreground transition-colors">
            Privacidade
          </Link>
          <Link to="/reembolso" className="text-muted-foreground hover:text-foreground transition-colors">
            Reembolso
          </Link>
          <TutorialTrigger />
          <DonateButton />
        </div>
      </div>
    </footer>
  );
}
