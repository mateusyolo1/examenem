export type EssayCategory =
  | "Educação"
  | "Saúde"
  | "Tecnologia"
  | "Meio ambiente"
  | "Segurança pública"
  | "Cidadania"
  | "Desigualdade social"
  | "Cultura"
  | "Trabalho"
  | "Direitos humanos";

export interface MotivatorText {
  fonte: string;
  trecho: string;
}

export interface EssayTheme {
  id: string;
  categoria: EssayCategory;
  titulo: string;
  eixo: string;
  textosMotivadores: MotivatorText[];
  repertorios: string[];
  ideiasIntroducao: string[];
  argumentos: string[];
  propostasIntervencao: string[];
}

export const CATEGORIAS: EssayCategory[] = [
  "Educação",
  "Saúde",
  "Tecnologia",
  "Meio ambiente",
  "Segurança pública",
  "Cidadania",
  "Desigualdade social",
  "Cultura",
  "Trabalho",
  "Direitos humanos",
];

export const ESSAY_THEMES: EssayTheme[] = [
  {
    id: "edu-evasao",
    categoria: "Educação",
    titulo: "Desafios da evasão escolar no ensino médio brasileiro",
    eixo: "Educação básica, equidade e permanência estudantil",
    textosMotivadores: [
      {
        fonte: "Texto I — IBGE/PNAD",
        trecho:
          "Cerca de 11% dos jovens entre 15 e 17 anos estavam fora da escola em 2023, com maior incidência em regiões Norte e Nordeste.",
      },
      {
        fonte: "Texto II — Lei de Diretrizes e Bases (LDB, art. 4º)",
        trecho:
          "O dever do Estado com educação escolar pública será efetivado mediante a garantia de educação básica obrigatória e gratuita dos 4 aos 17 anos de idade.",
      },
      {
        fonte: "Texto III — UNICEF",
        trecho:
          "Trabalho infantil, gravidez na adolescência e desinteresse pelo currículo estão entre as principais causas do abandono escolar.",
      },
    ],
    repertorios: [
      "Paulo Freire — educação como prática da liberdade",
      "Lei 9.394/96 (LDB)",
      "Plano Nacional de Educação (PNE)",
      "Dados do INEP/Censo Escolar",
      'Filme "Pro Dia Nascer Feliz" (João Jardim)',
    ],
    ideiasIntroducao: [
      "Contextualizar a Constituição de 1988 que prevê educação como direito de todos.",
      "Citar dado do IBGE sobre jovens fora da escola e contrastar com o ideal da LDB.",
      "Partir do conceito freiriano de educação libertadora para denunciar a evasão.",
    ],
    argumentos: [
      "Vulnerabilidade socioeconômica obriga adolescentes a abandonar os estudos pelo trabalho informal.",
      "Currículo distante da realidade do aluno reduz o engajamento e o sentido da escola.",
      "Falta de infraestrutura e formação docente compromete a qualidade e a permanência.",
    ],
    propostasIntervencao: [
      "MEC, em parceria com municípios, deve ampliar a Bolsa Permanência no ensino médio, garantindo auxílio financeiro a famílias em vulnerabilidade.",
      "Escolas devem implementar projetos integradores ligados ao território, por meio de eletivas e estágios.",
      "Mídia e ONGs podem promover campanhas sobre o impacto da educação na mobilidade social.",
    ],
  },
  {
    id: "saude-mental",
    categoria: "Saúde",
    titulo: "A saúde mental dos jovens na sociedade brasileira contemporânea",
    eixo: "Saúde pública, juventude e sofrimento psíquico",
    textosMotivadores: [
      {
        fonte: "Texto I — OMS",
        trecho:
          "A depressão é hoje uma das principais causas de incapacidade entre jovens de 15 a 29 anos em todo o mundo.",
      },
      {
        fonte: "Texto II — Constituição Federal, art. 196",
        trecho: "A saúde é direito de todos e dever do Estado.",
      },
      {
        fonte: "Texto III — Fiocruz",
        trecho:
          "Após a pandemia, cresceu em 47% a busca por atendimento psicológico entre adolescentes no SUS.",
      },
    ],
    repertorios: [
      "Zygmunt Bauman — Modernidade Líquida",
      "Byung-Chul Han — Sociedade do Cansaço",
      "Lei 10.216/2001 (Reforma Psiquiátrica)",
      "CAPS — Centros de Atenção Psicossocial",
      'Documentário "O Dilema das Redes" (Netflix)',
    ],
    ideiasIntroducao: [
      "Citar Byung-Chul Han e a noção de esgotamento psíquico para introduzir o problema.",
      "Apresentar dado da OMS sobre depressão entre jovens.",
      "Partir do art. 196 da CF para denunciar a omissão estatal.",
    ],
    argumentos: [
      "Excesso de cobranças escolares e produtivismo geram ansiedade crônica.",
      "Uso intensivo de redes sociais amplifica comparações e baixa autoestima.",
      "Rede pública de CAPS é insuficiente para a demanda de jovens.",
    ],
    propostasIntervencao: [
      "Ministério da Saúde deve ampliar o número de CAPS-i (infantojuvenil) por meio de repasse federal.",
      "MEC deve implementar nas escolas o programa Saúde na Escola, com psicólogos permanentes.",
      "Mídia deve promover campanhas de letramento emocional desestigmatizando o cuidado psíquico.",
    ],
  },
  {
    id: "tec-ia",
    categoria: "Tecnologia",
    titulo: "Os impactos da inteligência artificial no mercado de trabalho brasileiro",
    eixo: "Tecnologia, automação e empregabilidade",
    textosMotivadores: [
      {
        fonte: "Texto I — Fórum Econômico Mundial",
        trecho:
          "Estima-se que até 2030, 23% das ocupações no mundo serão profundamente alteradas pela automação e pela IA.",
      },
      {
        fonte: "Texto II — IPEA",
        trecho:
          "No Brasil, cerca de 60% dos trabalhadores atuam em funções com alto risco de substituição parcial por sistemas inteligentes.",
      },
    ],
    repertorios: [
      "4ª Revolução Industrial — Klaus Schwab",
      "Filme \"Tempos Modernos\" (Chaplin)",
      "Lei Geral de Proteção de Dados (LGPD)",
      "Marco Civil da Internet",
    ],
    ideiasIntroducao: [
      "Comparar a Revolução Industrial do século XIX com a atual revolução da IA.",
      "Citar Klaus Schwab e a 4ª Revolução Industrial.",
      "Partir do dado do IPEA para problematizar a vulnerabilidade do trabalhador.",
    ],
    argumentos: [
      "Falta de qualificação digital amplia a exclusão de trabalhadores menos escolarizados.",
      "Concentração tecnológica em grandes empresas aprofunda desigualdade.",
      "Ausência de regulação trabalhista para uso de IA precariza vínculos.",
    ],
    propostasIntervencao: [
      "Governo Federal deve criar programa nacional de requalificação digital via Sistema S e IFs.",
      "Congresso deve aprovar marco regulatório da IA com foco em proteção trabalhista.",
      "Empresas devem assumir compromisso de reskilling interno antes de demissões em massa.",
    ],
  },
  {
    id: "meio-ambiente-residuos",
    categoria: "Meio ambiente",
    titulo: "Caminhos para o consumo consciente e a gestão de resíduos no Brasil",
    eixo: "Sustentabilidade, consumo e responsabilidade ambiental",
    textosMotivadores: [
      {
        fonte: "Texto I — ABRELPE",
        trecho:
          "O Brasil gera mais de 80 milhões de toneladas de resíduos sólidos por ano, mas apenas 4% são reciclados.",
      },
      {
        fonte: "Texto II — Política Nacional de Resíduos Sólidos (Lei 12.305/2010)",
        trecho:
          "A logística reversa é instrumento de responsabilidade compartilhada pelo ciclo de vida dos produtos.",
      },
    ],
    repertorios: [
      "ODS 12 — Consumo e produção responsáveis (ONU)",
      "Zygmunt Bauman — Vida para Consumo",
      "Acordo de Paris",
      "Movimento dos Catadores (MNCR)",
    ],
    ideiasIntroducao: [
      "Citar Bauman e a lógica do descartável na modernidade líquida.",
      "Partir do dado da ABRELPE sobre baixa reciclagem.",
      "Contextualizar ODS 12 da Agenda 2030.",
    ],
    argumentos: [
      "Cultura do descarte estimulada pela obsolescência programada.",
      "Falta de coleta seletiva universal nos municípios brasileiros.",
      "Invisibilidade social do trabalho dos catadores reduz eficiência da reciclagem.",
    ],
    propostasIntervencao: [
      "Ministério do Meio Ambiente deve ampliar consórcios municipais para coleta seletiva.",
      "Escolas devem implementar educação ambiental transversal já nos anos iniciais.",
      "Empresas devem cumprir efetivamente a logística reversa, com fiscalização do IBAMA.",
    ],
  },
  {
    id: "seg-publica-violencia",
    categoria: "Segurança pública",
    titulo: "Desafios no enfrentamento à violência urbana no Brasil",
    eixo: "Segurança pública, juventude e desigualdade",
    textosMotivadores: [
      {
        fonte: "Texto I — Atlas da Violência (IPEA/FBSP)",
        trecho:
          "O Brasil registra cerca de 40 mil homicídios por ano, sendo os jovens negros de periferia as principais vítimas.",
      },
      {
        fonte: "Texto II — Constituição Federal, art. 144",
        trecho:
          "A segurança pública é dever do Estado, direito e responsabilidade de todos.",
      },
    ],
    repertorios: [
      'Documentário "Notícias de uma Guerra Particular" (João Moreira Salles)',
      'Livro "Cidade de Deus" (Paulo Lins)',
      "Conceito de necropolítica — Achille Mbembe",
      "Sistema Único de Segurança Pública (SUSP)",
    ],
    ideiasIntroducao: [
      "Citar Mbembe e a necropolítica para discutir quem morre nas periferias.",
      "Partir do Atlas da Violência para contextualizar dados.",
      "Mencionar o art. 144 da CF e o ideal não cumprido.",
    ],
    argumentos: [
      "Desigualdade social e ausência do Estado favorecem o crime organizado.",
      "Modelo de policiamento bélico aprofunda violência policial em periferias.",
      "Falta de oportunidades para a juventude alimenta o ciclo da violência.",
    ],
    propostasIntervencao: [
      "Ministério da Justiça deve ampliar polícias comunitárias e mediação de conflitos.",
      "Governos estaduais devem investir em escolas integrais e esporte em áreas vulneráveis.",
      "Congresso deve fortalecer o SUSP e a integração de bancos de dados criminais.",
    ],
  },
  {
    id: "cidadania-participacao",
    categoria: "Cidadania",
    titulo: "A importância da participação política juvenil para a democracia brasileira",
    eixo: "Cidadania, democracia e protagonismo juvenil",
    textosMotivadores: [
      {
        fonte: "Texto I — TSE",
        trecho:
          "Em 2022, mais de 2 milhões de adolescentes de 16 e 17 anos tiraram título de eleitor, recorde histórico.",
      },
      {
        fonte: "Texto II — Constituição Federal, art. 1º",
        trecho:
          "Todo o poder emana do povo, que o exerce por meio de representantes eleitos ou diretamente.",
      },
    ],
    repertorios: [
      "Aristóteles — o homem é um animal político",
      "Hannah Arendt — a esfera pública",
      "Movimento Diretas Já (1984)",
      "Estatuto da Juventude (Lei 12.852/2013)",
    ],
    ideiasIntroducao: [
      "Citar Aristóteles sobre o homem como ser político.",
      "Partir do dado do TSE para valorizar o engajamento juvenil.",
      "Resgatar o movimento Diretas Já como inspiração histórica.",
    ],
    argumentos: [
      "Educação política deficiente afasta jovens da vida pública.",
      "Desinformação em redes sociais compromete a cidadania ativa.",
      "Espaços de escuta institucional para jovens ainda são raros.",
    ],
    propostasIntervencao: [
      "MEC deve incluir Educação para a Cidadania como componente curricular obrigatório.",
      "Câmaras municipais devem criar conselhos juvenis com poder consultivo.",
      "Mídia e plataformas devem promover checagem de fatos e letramento midiático.",
    ],
  },
  {
    id: "desig-renda",
    categoria: "Desigualdade social",
    titulo: "Caminhos para reduzir a desigualdade de renda no Brasil",
    eixo: "Desigualdade socioeconômica e justiça distributiva",
    textosMotivadores: [
      {
        fonte: "Texto I — Oxfam Brasil",
        trecho:
          "Os 10% mais ricos do Brasil concentram cerca de 58% da renda nacional, uma das maiores concentrações do mundo.",
      },
      {
        fonte: "Texto II — IBGE",
        trecho:
          "A renda média do trabalhador branco é quase o dobro da renda do trabalhador negro no país.",
      },
    ],
    repertorios: [
      "Thomas Piketty — O Capital no Século XXI",
      'Livro "Casa-Grande e Senzala" (Gilberto Freyre)',
      "Lei Áurea e ausência de políticas de reparação",
      "Programa Bolsa Família / Auxílio Brasil",
    ],
    ideiasIntroducao: [
      "Citar Piketty sobre concentração de capital.",
      "Partir do dado da Oxfam sobre concentração de renda.",
      "Resgatar a herança escravista como raiz da desigualdade.",
    ],
    argumentos: [
      "Sistema tributário regressivo penaliza pobres e protege grandes fortunas.",
      "Desigualdade racial estrutural limita acesso a empregos qualificados.",
      "Baixa escolaridade perpetua ciclos intergeracionais de pobreza.",
    ],
    propostasIntervencao: [
      "Congresso deve aprovar reforma tributária progressiva, taxando grandes fortunas.",
      "Governo Federal deve manter e ampliar programas de transferência de renda condicionados à educação.",
      "MEC deve fortalecer cotas raciais e sociais no ensino superior e técnico.",
    ],
  },
  {
    id: "cultura-leitura",
    categoria: "Cultura",
    titulo: "A democratização do acesso à leitura e à produção cultural no Brasil",
    eixo: "Cultura, identidade e acesso ao patrimônio simbólico",
    textosMotivadores: [
      {
        fonte: "Texto I — Instituto Pró-Livro (Retratos da Leitura)",
        trecho:
          "Metade dos brasileiros declara não ter lido nenhum livro nos últimos três meses.",
      },
      {
        fonte: "Texto II — Constituição Federal, art. 215",
        trecho:
          "O Estado garantirá a todos o pleno exercício dos direitos culturais e acesso às fontes da cultura nacional.",
      },
    ],
    repertorios: [
      "Antonio Candido — \"O direito à literatura\"",
      "Lei Rouanet e Lei Aldir Blanc",
      "Sistema Nacional de Bibliotecas Públicas",
      'Livro "Quarto de Despejo" (Carolina Maria de Jesus)',
    ],
    ideiasIntroducao: [
      "Citar Antonio Candido e o direito à literatura como direito humano.",
      "Partir do dado do Pró-Livro sobre baixa leitura.",
      "Mencionar o art. 215 da CF para evidenciar a omissão estatal.",
    ],
    argumentos: [
      "Concentração de equipamentos culturais nas grandes capitais exclui interior e periferias.",
      "Falta de mediação de leitura na escola reduz o gosto pelo livro.",
      "Preço elevado de livros torna o consumo cultural privilégio de classe.",
    ],
    propostasIntervencao: [
      "Ministério da Cultura deve ampliar bibliotecas comunitárias por meio da Lei Aldir Blanc.",
      "MEC deve fortalecer programas como o PNLD Literário com mediadores capacitados.",
      "Governos municipais devem criar feiras literárias gratuitas em periferias.",
    ],
  },
  {
    id: "trabalho-precarizacao",
    categoria: "Trabalho",
    titulo: "Desafios da uberização e da precarização do trabalho no Brasil",
    eixo: "Mundo do trabalho, plataformas digitais e direitos sociais",
    textosMotivadores: [
      {
        fonte: "Texto I — IBGE/PNAD Contínua",
        trecho:
          "Cerca de 40% dos trabalhadores brasileiros estão em ocupações informais, sem garantias trabalhistas.",
      },
      {
        fonte: "Texto II — OIT",
        trecho:
          "O trabalho em plataformas digitais cresceu cinco vezes na última década e carece de regulação global.",
      },
    ],
    repertorios: [
      "Ricardo Antunes — \"O Privilégio da Servidão\"",
      "CLT — Decreto-Lei 5.452/1943",
      'Filme "Você Não Estava Aqui" (Ken Loach)',
      "Conceito de \"infoproletariado\"",
    ],
    ideiasIntroducao: [
      "Citar Ricardo Antunes sobre a nova morfologia do trabalho.",
      "Partir do dado do IBGE sobre informalidade.",
      "Comparar conquistas da CLT com a realidade dos entregadores de aplicativo.",
    ],
    argumentos: [
      "Trabalhadores de plataformas perdem direitos básicos como férias e previdência.",
      "Algoritmos opacos controlam a jornada e penalizam sem aviso.",
      "Crise econômica empurra jovens para a informalidade como única alternativa.",
    ],
    propostasIntervencao: [
      "Congresso deve aprovar marco regulatório das plataformas digitais com piso e previdência.",
      "Ministério do Trabalho deve fiscalizar relações disfarçadas de autonomia.",
      "Sindicatos devem se reorganizar para representar trabalhadores de aplicativo.",
    ],
  },
  {
    id: "direitos-humanos-refugio",
    categoria: "Direitos humanos",
    titulo: "A acolhida de refugiados e migrantes como desafio humanitário no Brasil",
    eixo: "Direitos humanos, migração e xenofobia",
    textosMotivadores: [
      {
        fonte: "Texto I — ACNUR",
        trecho:
          "Mais de 110 milhões de pessoas estão em situação de deslocamento forçado no mundo, número recorde.",
      },
      {
        fonte: "Texto II — Lei de Migração (Lei 13.445/2017)",
        trecho:
          "É garantido ao migrante, em condição de igualdade com os nacionais, o exercício dos direitos e liberdades civis, sociais, culturais e econômicas.",
      },
    ],
    repertorios: [
      "Declaração Universal dos Direitos Humanos (1948)",
      "Hannah Arendt — \"O direito a ter direitos\"",
      "Operação Acolhida (venezuelanos em Roraima)",
      'Filme "Que Horas Ela Volta?" (Anna Muylaert) — sobre alteridade',
    ],
    ideiasIntroducao: [
      "Citar Hannah Arendt e o direito a ter direitos.",
      "Partir do dado do ACNUR sobre deslocamentos.",
      "Resgatar a Lei de Migração de 2017 como avanço histórico.",
    ],
    argumentos: [
      "Xenofobia limita o acesso de migrantes a emprego e moradia digna.",
      "Burocracia estatal dificulta regularização e atendimento humanitário.",
      "Falta de políticas de integração linguística e cultural perpetua a exclusão.",
    ],
    propostasIntervencao: [
      "Governo Federal deve ampliar a Operação Acolhida com interiorização planejada.",
      "Municípios devem oferecer cursos gratuitos de português e mediação cultural.",
      "Mídia deve combater estereótipos e promover narrativas humanizadoras sobre migração.",
    ],
  },
];

export function themesByCategory(cat: EssayCategory): EssayTheme[] {
  return ESSAY_THEMES.filter((t) => t.categoria === cat);
}

export function findTheme(id: string): EssayTheme | undefined {
  return ESSAY_THEMES.find((t) => t.id === id);
}
