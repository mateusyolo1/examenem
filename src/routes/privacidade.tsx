import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./termos";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Aviso de Privacidade — Exame ENEM" },
      {
        name: "description",
        content:
          "Aviso de Privacidade do Exame ENEM: dados coletados, finalidades, compartilhamento com a Paddle como Merchant of Record, retenção e direitos do titular.",
      },
      { property: "og:title", content: "Aviso de Privacidade — Exame ENEM" },
      {
        property: "og:description",
        content:
          "Como yolodesign trata dados pessoais dos usuários do Exame ENEM.",
      },
      { property: "og:url", content: "https://examenem.today/privacidade" },
    ],
    links: [{ rel: "canonical", href: "https://examenem.today/privacidade" }],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <LegalShell
      title="Aviso de Privacidade"
      updated="Atualizado em 10 de julho de 2026"
    >
      <p>
        Este Aviso de Privacidade descreve como <strong>yolodesign</strong>
        {" "}("nós"), responsável pela plataforma Exame ENEM, trata os dados
        pessoais dos usuários do Serviço. Atuamos como <strong>controlador</strong>
        {" "}dos dados pessoais tratados para operar o Serviço.
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>
          <strong>Identificação e conta:</strong> nome, e-mail e identificador
          fornecidos pelo login com Google.
        </li>
        <li>
          <strong>Perfil de estudo:</strong> objetivo, prova selecionada, data
          da prova, horários disponíveis, áreas de foco e preferências.
        </li>
        <li>
          <strong>Uso do Serviço:</strong> respostas a questões, redações,
          histórico de simulados, progresso em aulas, interações com o tutor de
          IA e conquistas.
        </li>
        <li>
          <strong>Dispositivo e telemetria:</strong> endereço IP, tipo de
          navegador, sistema operacional, páginas visitadas, identificadores
          de sessão e registros de erro.
        </li>
        <li>
          <strong>Suporte:</strong> mensagens enviadas por canais de suporte e
          seus anexos.
        </li>
      </ul>
      <p>
        Dados de pagamento (número de cartão, endereço de cobrança, documento
        fiscal) são coletados e tratados diretamente pela Paddle e não são
        armazenados por nós.
      </p>

      <h2>2. Finalidades e bases legais</h2>
      <ul>
        <li>
          <strong>Prestar o Serviço</strong> (execução de contrato): criação de
          conta, personalização do plano de estudos, salvamento de progresso,
          correção de redação, resposta do tutor de IA.
        </li>
        <li>
          <strong>Segurança e prevenção a fraude</strong> (legítimo interesse
          e cumprimento de obrigação legal): detectar abusos, proteger a
          integridade do Serviço e responder a incidentes.
        </li>
        <li>
          <strong>Melhoria do produto</strong> (legítimo interesse): analisar
          métricas agregadas de uso para aprimorar recursos.
        </li>
        <li>
          <strong>Suporte ao usuário</strong> (execução de contrato):
          responder dúvidas e resolver problemas.
        </li>
        <li>
          <strong>Comunicações essenciais</strong> (execução de contrato):
          avisos sobre a conta, cobrança e mudanças no Serviço.
        </li>
        <li>
          <strong>Cumprimento de obrigações legais</strong>: guarda de
          registros exigidos por lei e atendimento a autoridades.
        </li>
      </ul>

      <h2>3. Compartilhamento de dados</h2>
      <p>Compartilhamos dados apenas com:</p>
      <ul>
        <li>
          <strong>Fornecedores e operadores</strong> que sustentam o Serviço,
          incluindo provedores de hospedagem, banco de dados, autenticação,
          modelos de IA, e-mail transacional e monitoramento.
        </li>
        <li>
          <strong>Paddle</strong>, nosso Merchant of Record, para
          processamento de pagamentos, gestão de assinaturas, faturamento,
          impostos e conformidade fiscal.
        </li>
        <li>
          <strong>Consultores profissionais</strong> (jurídico, contábil)
          quando necessário para proteger nossos direitos.
        </li>
        <li>
          <strong>Autoridades competentes</strong> quando exigido por lei,
          ordem judicial ou para prevenir fraude e proteger direitos.
        </li>
      </ul>

      <h2>4. Transferências internacionais</h2>
      <p>
        Alguns provedores tratam dados fora do Brasil, incluindo em países da
        União Europeia e nos Estados Unidos. Nesses casos, adotamos
        salvaguardas contratuais compatíveis com a LGPD, como cláusulas
        contratuais padrão e verificação do nível de proteção do destino.
      </p>

      <h2>5. Retenção</h2>
      <p>
        Mantemos dados pessoais pelo tempo necessário para cumprir as
        finalidades descritas ou obrigações legais. Dados de conta ativa são
        mantidos enquanto a conta existir. Após o encerramento, dados são
        excluídos ou anonimizados em prazo razoável, ressalvados aqueles
        exigidos por lei (por exemplo, registros fiscais).
      </p>

      <h2>6. Segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais adequadas para proteger os
        dados, incluindo criptografia em trânsito, controle de acesso baseado
        em funções, políticas de senhas fortes, monitoramento e revisão
        periódica. Nenhum sistema é 100% seguro; comunique-nos imediatamente
        qualquer incidente identificado.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Usamos cookies e tecnologias similares para manter a sessão logada,
        lembrar preferências e medir o uso. Você pode gerenciar cookies pelas
        configurações do navegador; a desativação de cookies essenciais pode
        impedir o uso do Serviço.
      </p>

      <h2>8. Direitos do titular</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li>Confirmar o tratamento e acessar seus dados;</li>
        <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
        <li>Solicitar anonimização, bloqueio ou exclusão de dados desnecessários;</li>
        <li>Solicitar portabilidade dos dados;</li>
        <li>Revogar consentimento, quando aplicável;</li>
        <li>Se opor a tratamentos baseados em legítimo interesse;</li>
        <li>Apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>
      <p>
        Para exercer seus direitos, entre em contato pelos canais de suporte
        do Serviço. Podemos solicitar informações para confirmar sua identidade.
      </p>

      <h2>9. Alterações neste aviso</h2>
      <p>
        Podemos atualizar este Aviso periodicamente. Mudanças relevantes serão
        comunicadas dentro do Serviço ou por e-mail. A data no topo desta
        página indica a última atualização.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas sobre este Aviso ou sobre o tratamento de dados pessoais podem
        ser encaminhadas a yolodesign pelos canais de suporte disponíveis na
        plataforma.
      </p>
    </LegalShell>
  );
}
