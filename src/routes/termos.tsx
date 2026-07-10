import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Exame ENEM" },
      {
        name: "description",
        content:
          "Termos de uso do Exame ENEM: aceitação, uso permitido, propriedade intelectual, pagamentos processados pela Paddle e suspensão de conta.",
      },
      { property: "og:title", content: "Termos de Uso — Exame ENEM" },
      {
        property: "og:description",
        content:
          "Termos que regem o uso da plataforma Exame ENEM, operada por yolodesign.",
      },
      { property: "og:url", content: "https://examenem.today/termos" },
    ],
    links: [{ rel: "canonical", href: "https://examenem.today/termos" }],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <LegalShell title="Termos de Uso" updated="Atualizado em 10 de julho de 2026">
      <p>
        Estes Termos de Uso ("Termos") regem o acesso e o uso da plataforma
        Exame ENEM ("Serviço"), oferecida por <strong>yolodesign</strong> ("nós",
        "yolodesign"). Ao usar o Serviço, você concorda com estes Termos. Se
        não concordar, não utilize o Serviço.
      </p>

      <h2>1. Sobre o Serviço</h2>
      <p>
        O Exame ENEM é uma plataforma de estudos para o Exame Nacional do Ensino
        Médio (ENEM) e vestibulares similares, com banco de questões, simulados,
        cronograma, correção de redação, tutor de inteligência artificial e
        outros recursos educacionais.
      </p>

      <h2>2. Aceitação e capacidade</h2>
      <p>
        Ao criar conta ou continuar navegando no Serviço, você declara que tem
        capacidade legal para aceitar estes Termos. Menores devem ter
        consentimento de responsáveis. Se você aceita em nome de uma
        organização, declara ter autoridade para vinculá-la a estes Termos.
      </p>

      <h2>3. Conta e credenciais</h2>
      <p>
        Você é responsável por manter a confidencialidade das credenciais de
        acesso e por toda atividade realizada em sua conta. Informe-nos
        imediatamente sobre qualquer uso não autorizado.
      </p>

      <h2>4. Uso permitido</h2>
      <p>Você concorda em não:</p>
      <ul>
        <li>Utilizar o Serviço para fins ilegais, fraudulentos ou abusivos;</li>
        <li>Violar direitos de propriedade intelectual de terceiros;</li>
        <li>
          Interferir na segurança do Serviço (uploads maliciosos, engenharia
          reversa, tentativas de invasão, scraping automatizado);
        </li>
        <li>Enviar spam, conteúdo ofensivo, difamatório ou discriminatório;</li>
        <li>
          Revender, redistribuir ou sublicenciar o Serviço sem autorização
          escrita.
        </li>
      </ul>

      <h2>5. Uso de Inteligência Artificial</h2>
      <p>
        Alguns recursos usam modelos de linguagem para gerar explicações,
        correções, resumos e questões. Ao usá-los, você concorda que:
      </p>
      <ul>
        <li>
          É responsável pelos prompts enviados, pelo uso das respostas e por
          verificar sua exatidão antes de aplicá-las em contextos importantes;
        </li>
        <li>
          Não usará os recursos para gerar conteúdo ilegal, discurso de ódio,
          desinformação, material que viole direitos de terceiros ou que tente
          burlar as proteções do modelo (jailbreaking);
        </li>
        <li>
          As saídas da IA podem conter erros e não substituem orientação
          profissional (médica, jurídica, financeira ou psicológica);
        </li>
        <li>
          Detém os direitos sobre o conteúdo que envia como entrada e nos
          concede licença limitada para processá-lo apenas para fornecer o
          Serviço;
        </li>
        <li>
          Podemos moderar, filtrar, remover ou recusar respostas e suspender
          contas que descumpram estas regras. Titulares de direitos podem
          solicitar remoção de conteúdo pelo canal de suporte, e reincidência
          resulta em encerramento de conta.
        </li>
      </ul>

      <h2>6. Propriedade intelectual</h2>
      <p>
        O Serviço, incluindo software, textos, marcas, imagens e organização de
        conteúdo, é de propriedade de yolodesign ou de seus licenciantes. Você
        recebe uma licença limitada, não exclusiva e intransferível para uso
        pessoal do Serviço conforme o plano contratado. Conteúdo enviado por
        você continua sendo seu; você nos concede licença limitada para
        armazená-lo e processá-lo com o único objetivo de operar o Serviço.
      </p>

      <h2>7. Nível de serviço</h2>
      <p>
        Empenhamo-nos para manter o Serviço disponível, mas não garantimos
        funcionamento ininterrupto ou livre de erros. Podemos realizar
        manutenções, atualizações e mudanças a qualquer momento.
      </p>

      <h2>8. Pagamentos e assinaturas</h2>
      <p>
        Nosso processo de pedido é conduzido pelo nosso revendedor online
        Paddle.com. Paddle.com é o Merchant of Record (MoR) de todos os nossos
        pedidos. A Paddle atende todas as solicitações de suporte relacionadas
        a pagamentos e cuida de reembolsos. Ao concluir uma compra, você
        concorda com os{" "}
        <a
          href="https://www.paddle.com/legal/checkout-buyer-terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          Termos do Comprador da Paddle
        </a>
        , que regem cobrança, impostos, renovação, cancelamento e reembolso.
      </p>
      <p>
        Assinaturas são renovadas automaticamente no fim de cada ciclo até
        cancelamento. Você pode cancelar a qualquer momento pela sua página de
        conta ou por{" "}
        <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">
          paddle.net
        </a>
        . Doações são voluntárias, não recorrentes e{" "}
        <strong>
          não desbloqueiam recursos de inteligência artificial nem ampliam
          limites de uso
        </strong>{" "}
        — o acesso à IA é vendido separadamente como assinatura.
      </p>

      <h2>9. Suspensão e encerramento</h2>
      <p>
        Podemos suspender ou encerrar seu acesso, com ou sem aviso prévio, em
        caso de: violação material destes Termos, inadimplência, risco à
        segurança ou fraude, ou violações graves ou reincidentes de nossas
        políticas. Após o encerramento, você poderá solicitar exportação de
        seus dados por um período razoável, findo o qual poderemos excluí-los.
      </p>

      <h2>10. Garantias e responsabilidade</h2>
      <p>
        O Serviço é fornecido "no estado em que se encontra". Na máxima
        extensão permitida por lei, excluímos garantias implícitas de
        comercialização, adequação a uma finalidade específica e não violação.
        A responsabilidade agregada de yolodesign fica limitada aos valores
        pagos por você nos 12 meses anteriores ao evento que originou a
        reclamação. Não respondemos por danos indiretos, incidentais ou lucros
        cessantes, ressalvadas as hipóteses em que a lei não admite exclusão.
      </p>

      <h2>11. Alterações</h2>
      <p>
        Podemos atualizar estes Termos periodicamente. Mudanças relevantes
        serão comunicadas pelo Serviço ou por e-mail. O uso continuado após a
        vigência representa aceitação da nova versão.
      </p>

      <h2>12. Legislação e foro</h2>
      <p>
        Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro do
        domicílio do usuário consumidor para dirimir controvérsias, ressalvadas
        hipóteses de foro competente por lei.
      </p>

      <h2>13. Contato</h2>
      <p>
        Dúvidas sobre estes Termos podem ser enviadas ao responsável pelo
        Serviço, yolodesign, pelos canais de suporte disponíveis dentro da
        plataforma.
      </p>
    </LegalShell>
  );
}

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <Link to="/inicio" className="font-extrabold text-lg tracking-tighter uppercase">
            Exame.
          </Link>
          <nav className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <Link to="/precos" className="hover:text-foreground">Preços</Link>
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/reembolso" className="hover:text-foreground">Reembolso</Link>
          </nav>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
          {updated}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
          {title}
        </h1>
        <div className="max-w-none text-[15px] leading-relaxed text-muted-foreground space-y-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground">
          {children}
        </div>
      </article>
      <footer className="border-t border-border mt-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} yolodesign · Exame ENEM</span>
          <Link to="/inicio" className="hover:text-foreground">Voltar ao início</Link>
        </div>
      </footer>
    </main>
  );
}
