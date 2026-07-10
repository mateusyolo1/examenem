import { DonateButton } from "./DonateButton";
import { TutorialTrigger } from "./Tutorial";

export function Footer() {
  return (
    <footer className="border-t border-border mt-20 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-4 text-xs font-mono uppercase text-muted-foreground">
          <span>© {new Date().getFullYear()} Exame Estudo</span>
          <span className="opacity-30">/</span>
          <span>Dados Salvos Localmente</span>
        </div>
        <div className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest">
          <span className="text-muted-foreground">Sem cadastro</span>
          <span className="text-muted-foreground">100% offline-first</span>
          <TutorialTrigger />
          <DonateButton />
        </div>
      </div>
    </footer>
  );
}

