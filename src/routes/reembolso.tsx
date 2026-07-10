import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./termos";

export const Route = createFileRoute("/reembolso")({
  head: () => ({
    meta: [
      { title: "Política de Reembolso — Exame ENEM" },
      {
        name: "description",
        content:
          "Política de reembolso do Exame ENEM: garantia de 30 dias para assinaturas, como solicitar via Paddle e regras para doações.",
      },
      { property: "og:title", content: "Política de Reembolso — Exame ENEM" },
      {
        property: "og:description",
        content:
          "Garantia de 30 dias para assinaturas do Exame ENEM, processada pela Paddle.",
      },
      { property: "og:url", content: "https://examenem.today/reembolso" },
    ],
    links: [{ rel: "canonical", href: "https://examenem.today/reembolso" }],
  }),
  component: ReembolsoPage,
});

function ReembolsoPage() {
  return (
    <LegalShell
      title="Política de Reembolso"
      updated="Atualizado em 10 de julho de 2026"
    >
      <p>
        Queremos que você experimente o Exame ENEM com tranquilidade. Por isso,
        oferecemos uma <strong>garantia de reembolso de 30 dias</strong> em
        assinaturas: se dentro de 30 dias da sua compra você não estiver
        satisfeito, pode solicitar o reembolso integral.
      </p>

      <h2>Como solicitar</h2>
      <p>
        Nossos pagamentos são processados pela Paddle.com, que atua como
        Merchant of Record. Para pedir reembolso:
      </p>
      <ol>
        <li>
          Acesse{" "}
          <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">
            paddle.net
          </a>{" "}
          e informe o e-mail usado na compra para localizar seus pedidos.
        </li>
        <li>
          Selecione a transação e siga o fluxo de reembolso, ou responda a
          fatura recebida por e-mail com sua solicitação.
        </li>
        <li>
          Se preferir, entre em contato conosco pelos canais de suporte do
          Serviço e encaminharemos seu pedido à Paddle.
        </li>
      </ol>
      <p>
        Reembolsos aprovados são estornados no mesmo meio de pagamento usado
        na compra. O prazo de compensação depende do emissor do cartão ou do
        método utilizado.
      </p>

      <h2>Assinaturas recorrentes</h2>
      <p>
        Você pode cancelar sua assinatura a qualquer momento pela sua conta ou
        por paddle.net. O cancelamento interrompe cobranças futuras; o acesso
        permanece ativo até o fim do ciclo já pago. Fora da janela de 30 dias,
        cobranças de renovação normalmente não são reembolsadas, salvo
        exigência legal ou avaliação caso a caso.
      </p>

      <h2>Doações</h2>
      <p>
        Doações são contribuições voluntárias para apoiar o projeto. Elas{" "}
        <strong>
          não desbloqueiam recursos de inteligência artificial nem ampliam
          limites de uso
        </strong>{" "}
        e, por natureza, não são reembolsáveis exceto em caso de cobrança
        indevida comprovada.
      </p>

      <h2>Dúvidas</h2>
      <p>
        Se algo não ficou claro, fale conosco pelos canais de suporte do
        Serviço. Também vale conferir a{" "}
        <a
          href="https://www.paddle.com/legal/refund-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          política de reembolso da Paddle
        </a>
        , aplicável a todas as compras processadas por ela.
      </p>
    </LegalShell>
  );
}
