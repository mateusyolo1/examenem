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
  {
    id: "edu-analfabetismo-funcional",
    categoria: "Educação",
    titulo: "Combate ao analfabetismo funcional no Brasil",
    eixo: "Letramento, leitura e cidadania",
    textosMotivadores: [
      { fonte: "Texto I — INAF", trecho: "3 em cada 10 brasileiros adultos são analfabetos funcionais." },
      { fonte: "Texto II — UNESCO", trecho: "Ler é condição para exercer cidadania plena no século XXI." },
    ],
    repertorios: ["Paulo Freire — Pedagogia do Oprimido", "Rubem Alves", "Indicador de Alfabetismo Funcional (INAF)"],
    ideiasIntroducao: ["Citar Freire sobre leitura de mundo.", "Partir do dado do INAF."],
    argumentos: ["Formação docente frágil compromete letramento.", "Ausência de mediação de leitura em casa e escola."],
    propostasIntervencao: [
      "MEC deve ampliar formação continuada em alfabetização.",
      "Municípios devem criar salas de leitura em UBS e CRAS.",
    ],
  },
  {
    id: "saude-obesidade",
    categoria: "Saúde",
    titulo: "A epidemia de obesidade infantil no Brasil",
    eixo: "Saúde pública, alimentação e infância",
    textosMotivadores: [
      { fonte: "Texto I — Ministério da Saúde", trecho: "1 em cada 3 crianças brasileiras está acima do peso." },
      { fonte: "Texto II — OMS", trecho: "Obesidade infantil é um dos maiores desafios de saúde do século XXI." },
    ],
    repertorios: ["Guia Alimentar da População Brasileira", "Lei do PNAE (11.947/2009)", "Michael Pollan"],
    ideiasIntroducao: ["Partir do dado do MS.", "Citar o Guia Alimentar."],
    argumentos: ["Publicidade abusiva de ultraprocessados a crianças.", "Desertos alimentares em periferias urbanas."],
    propostasIntervencao: [
      "ANVISA deve endurecer rotulagem frontal e restringir publicidade infantil.",
      "MEC deve garantir merenda escolar 100% in natura via PNAE.",
    ],
  },
  {
    id: "tec-desinformacao",
    categoria: "Tecnologia",
    titulo: "O combate à desinformação nas redes sociais no Brasil",
    eixo: "Mídias digitais, democracia e checagem",
    textosMotivadores: [
      { fonte: "Texto I — Reuters Digital News Report", trecho: "62% dos brasileiros já foram expostos a fake news online." },
      { fonte: "Texto II — Marco Civil da Internet", trecho: "A liberdade de expressão deve conviver com a responsabilidade." },
    ],
    repertorios: ["Umberto Eco — sobre imbecis nas redes", "Agência Lupa e Aos Fatos", "Câmara dos Deputados — PL das Fake News"],
    ideiasIntroducao: ["Citar Eco sobre o excesso de opinião.", "Partir do dado do Reuters Report."],
    argumentos: ["Algoritmos priorizam engajamento e polarização.", "Baixo letramento midiático facilita a manipulação."],
    propostasIntervencao: [
      "Congresso deve aprovar marco regulatório de plataformas com transparência algorítmica.",
      "MEC deve incluir educação midiática no currículo do EF e EM.",
    ],
  },
  {
    id: "meio-ambiente-desmatamento",
    categoria: "Meio ambiente",
    titulo: "Desmatamento na Amazônia e responsabilidade socioambiental",
    eixo: "Bioma amazônico, clima e justiça ambiental",
    textosMotivadores: [
      { fonte: "Texto I — INPE", trecho: "A Amazônia perdeu mais de 13% de sua cobertura original nas últimas décadas." },
      { fonte: "Texto II — Acordo de Paris", trecho: "Signatários se comprometem a limitar o aquecimento global a 1,5 °C." },
    ],
    repertorios: ["Ailton Krenak — Ideias para Adiar o Fim do Mundo", "Chico Mendes", "ODS 13 e 15"],
    ideiasIntroducao: ["Citar Krenak sobre a queda do céu.", "Partir de dados do INPE."],
    argumentos: ["Grilagem e agropecuária ilegal aceleram desmate.", "Fragilização de órgãos ambientais reduz fiscalização."],
    propostasIntervencao: [
      "IBAMA e ICMBio devem ampliar operações via satélite (DETER) com força-tarefa.",
      "Congresso deve endurecer sanções à grilagem em terras públicas.",
    ],
  },
  {
    id: "seg-feminicidio",
    categoria: "Segurança pública",
    titulo: "O enfrentamento ao feminicídio na sociedade brasileira",
    eixo: "Violência de gênero e proteção à mulher",
    textosMotivadores: [
      { fonte: "Texto I — FBSP", trecho: "O Brasil registra uma mulher assassinada por razões de gênero a cada 6 horas." },
      { fonte: "Texto II — Lei do Feminicídio (13.104/2015)", trecho: "Feminicídio é qualificadora do crime de homicídio." },
    ],
    repertorios: ["Simone de Beauvoir — O Segundo Sexo", "Lei Maria da Penha (11.340/2006)", "Djamila Ribeiro"],
    ideiasIntroducao: ["Citar Beauvoir sobre a construção do gênero.", "Partir do dado do FBSP."],
    argumentos: ["Cultura patriarcal naturaliza violência doméstica.", "Rede de proteção fragmentada falha em acolher vítimas."],
    propostasIntervencao: [
      "Estados devem ampliar Delegacias da Mulher com atendimento 24h.",
      "MEC deve incluir educação de gênero no currículo básico.",
    ],
  },
  {
    id: "cidadania-acessibilidade",
    categoria: "Cidadania",
    titulo: "Acessibilidade urbana e inclusão de pessoas com deficiência no Brasil",
    eixo: "Cidade, direitos e desenho universal",
    textosMotivadores: [
      { fonte: "Texto I — IBGE", trecho: "Cerca de 18 milhões de brasileiros têm alguma deficiência." },
      { fonte: "Texto II — LBI (Lei 13.146/2015)", trecho: "É dever do Estado assegurar acessibilidade plena." },
    ],
    repertorios: ["Convenção da ONU sobre Direitos das PcD", "Conceito de desenho universal", "Jaime Lerner — urbanismo"],
    ideiasIntroducao: ["Citar a Convenção da ONU.", "Partir do dado do IBGE."],
    argumentos: ["Calçadas irregulares inviabilizam mobilidade.", "Transporte público sem acessibilidade exclui."],
    propostasIntervencao: [
      "Municípios devem criar plano diretor com desenho universal obrigatório.",
      "Ministério das Cidades deve destinar verba condicionada a acessibilidade.",
    ],
  },
  {
    id: "desig-fome",
    categoria: "Desigualdade social",
    titulo: "O retorno da fome ao mapa social brasileiro",
    eixo: "Segurança alimentar e pobreza estrutural",
    textosMotivadores: [
      { fonte: "Texto I — Rede PENSSAN", trecho: "Mais de 33 milhões de brasileiros convivem com a fome." },
      { fonte: "Texto II — DUDH, art. 25", trecho: "Toda pessoa tem direito à alimentação adequada." },
    ],
    repertorios: ["Josué de Castro — Geografia da Fome", "Programa Fome Zero", "ODS 2 — Fome Zero"],
    ideiasIntroducao: ["Citar Josué de Castro.", "Partir do dado da PENSSAN."],
    argumentos: ["Desemprego e inflação alimentar corroem renda.", "Desmonte de políticas de segurança alimentar."],
    propostasIntervencao: [
      "Governo Federal deve recompor o SISAN com orçamento próprio.",
      "Municípios devem ampliar restaurantes populares e cozinhas solidárias.",
    ],
  },
  {
    id: "cultura-museus",
    categoria: "Cultura",
    titulo: "Preservação da memória e do patrimônio cultural brasileiro",
    eixo: "Memória, museus e identidade nacional",
    textosMotivadores: [
      { fonte: "Texto I — IBRAM", trecho: "O Brasil tem mais de 3.700 museus, muitos em situação de abandono." },
      { fonte: "Texto II — Incêndio do Museu Nacional (2018)", trecho: "200 anos de acervo foram perdidos em uma noite." },
    ],
    repertorios: ["Mário de Andrade — SPHAN", "Lei Rouanet", "Aleida Assmann — memória cultural"],
    ideiasIntroducao: ["Citar Mário de Andrade e a criação do SPHAN.", "Partir do incêndio do Museu Nacional."],
    argumentos: ["Subfinanciamento crônico dos equipamentos culturais.", "Baixa educação patrimonial na escola."],
    propostasIntervencao: [
      "MinC deve criar fundo emergencial para preservação de acervos.",
      "Escolas devem promover visitas guiadas e projetos de memória local.",
    ],
  },
  {
    id: "trabalho-mulher",
    categoria: "Trabalho",
    titulo: "Desigualdade de gênero no mercado de trabalho brasileiro",
    eixo: "Gênero, trabalho e cuidado",
    textosMotivadores: [
      { fonte: "Texto I — IBGE", trecho: "Mulheres ganham em média 22% menos que homens em funções equivalentes." },
      { fonte: "Texto II — OIT", trecho: "Trabalho de cuidado não remunerado recai majoritariamente sobre mulheres." },
    ],
    repertorios: ["Silvia Federici — Calibã e a Bruxa", "Lei da Igualdade Salarial (14.611/2023)", "Heleieth Saffioti"],
    ideiasIntroducao: ["Citar Federici sobre trabalho reprodutivo.", "Partir do dado do IBGE."],
    argumentos: ["Divisão sexual do trabalho penaliza carreiras femininas.", "Escassez de creches limita retorno ao mercado."],
    propostasIntervencao: [
      "MTE deve fiscalizar a Lei da Igualdade Salarial com auditorias.",
      "Municípios devem ampliar creches públicas em tempo integral.",
    ],
  },
  {
    id: "dh-lgbtqia",
    categoria: "Direitos humanos",
    titulo: "Combate à LGBTfobia e garantia de direitos da população LGBTQIA+ no Brasil",
    eixo: "Diversidade, cidadania e direitos humanos",
    textosMotivadores: [
      { fonte: "Texto I — Grupo Gay da Bahia", trecho: "O Brasil lidera o ranking mundial de mortes violentas de pessoas LGBTQIA+." },
      { fonte: "Texto II — STF (ADO 26)", trecho: "Homofobia e transfobia foram equiparadas ao crime de racismo." },
    ],
    repertorios: ["Judith Butler — performatividade de gênero", "João Silvério Trevisan", "Princípios de Yogyakarta"],
    ideiasIntroducao: ["Citar Butler sobre gênero.", "Partir do dado do GGB."],
    argumentos: ["Preconceito estrutural em espaços públicos e privados.", "Falta de dados oficiais dificulta políticas."],
    propostasIntervencao: [
      "Congresso deve tipificar a LGBTfobia em lei específica.",
      "Ministério da Saúde deve ampliar ambulatórios trans no SUS.",
    ],
  },
  {
    id: "edu-ensino-superior",
    categoria: "Educação",
    titulo: "Democratização do acesso ao ensino superior no Brasil",
    eixo: "Ensino superior, cotas e mobilidade social",
    textosMotivadores: [
      { fonte: "Texto I — MEC/INEP", trecho: "Apenas 25% dos jovens brasileiros entre 18 e 24 anos frequentam o ensino superior." },
      { fonte: "Texto II — Lei de Cotas (12.711/2012)", trecho: "Reserva de vagas em universidades federais para escolas públicas, pretos, pardos e indígenas." },
    ],
    repertorios: ["Anísio Teixeira", "Kabengele Munanga", "Programas ProUni, FIES, SISU"],
    ideiasIntroducao: ["Citar Anísio Teixeira sobre educação pública.", "Partir do dado do INEP."],
    argumentos: ["Desigualdade na base compromete acesso ao topo.", "Custo indireto (moradia, transporte) inviabiliza permanência."],
    propostasIntervencao: [
      "MEC deve ampliar a Bolsa Permanência para cotistas.",
      "IES devem criar programas de nivelamento e tutoria."
    ],
  },
];

export const CATEGORY_COLORS: Record<EssayCategory, { bg: string; border: string; text: string; soft: string }> = {
  "Educação":          { bg: "#3B82F6", border: "#3B82F6", text: "#1D4ED8", soft: "#DBEAFE" },
  "Saúde":             { bg: "#10B981", border: "#10B981", text: "#047857", soft: "#D1FAE5" },
  "Tecnologia":        { bg: "#8B5CF6", border: "#8B5CF6", text: "#6D28D9", soft: "#EDE9FE" },
  "Meio ambiente":     { bg: "#22C55E", border: "#22C55E", text: "#15803D", soft: "#DCFCE7" },
  "Segurança pública": { bg: "#EF4444", border: "#EF4444", text: "#B91C1C", soft: "#FEE2E2" },
  "Cidadania":         { bg: "#F59E0B", border: "#F59E0B", text: "#B45309", soft: "#FEF3C7" },
  "Desigualdade social":{ bg: "#EC4899", border: "#EC4899", text: "#BE185D", soft: "#FCE7F3" },
  "Cultura":           { bg: "#F97316", border: "#F97316", text: "#C2410C", soft: "#FFEDD5" },
  "Trabalho":          { bg: "#06B6D4", border: "#06B6D4", text: "#0E7490", soft: "#CFFAFE" },
  "Direitos humanos":  { bg: "#A855F7", border: "#A855F7", text: "#7E22CE", soft: "#F3E8FF" },
};

export function themesByCategory(cat: EssayCategory): EssayTheme[] {
  return ESSAY_THEMES.filter((t) => t.categoria === cat);
}

export function findTheme(id: string): EssayTheme | undefined {
  return ESSAY_THEMES.find((t) => t.id === id);
}
