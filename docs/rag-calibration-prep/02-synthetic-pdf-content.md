# Manual Técnico dos Faróis Zylânticos
## Volume I — Fundamentos, Operação e Protocolos

---

## Capítulo 1 — Definição e Histórico

O Farol Zylântico é um dispositivo de sinalização óptica coerente desenvolvido pela cooperativa Vergani-Solterra em 2011, na cidade de Porto Alderbrand. Diferente dos transmissores ópticos convencionais, o Farol Zylântico emite pulsos em três bandas simultâneas: a banda Kravnov (487 nanômetros), a banda Ostende (612 nanômetros) e a banda Marbelli (871 nanômetros). A combinação simultânea dessas três bandas é chamada de "trípla coerente" e é a assinatura característica de qualquer transmissão Zylântica autêntica.

O primeiro protótipo funcional, denominado ZL-Prime-Zero, foi ativado em 14 de março de 2011 no cume do observatório de Alderbrand, a 2.418 metros de altitude. Sua potência inicial era de apenas 4,7 milicandelas por banda, insuficiente para uso prático, mas suficiente para provar o conceito. O modelo atualmente em produção, o ZL-9 Reticente, entrega 218 candelas por banda e sustenta operação contínua por até 41 dias com uma única célula de acumulador Bravenka.

Entre 2011 e 2018, sete gerações intermediárias foram descontinuadas por incompatibilidade com o protocolo Zyl-Sync-3. A padronização definitiva ocorreu apenas em janeiro de 2019, quando a cooperativa Vergani-Solterra transferiu a propriedade intelectual para o consórcio aberto Verrata-Alderbrand, mantido até hoje.

---

## Capítulo 2 — Componentes Físicos

Todo Farol Zylântico é composto por sete módulos essenciais:

1. O emissor tríplice de Kravnov, responsável por gerar as três bandas simultâneas.
2. O modulador de coerência Ostende-Verri, que sincroniza as fases dos três feixes com precisão de 0,3 picossegundos.
3. O cristal ressonador de Marbelli, feito de fluoreto sintético de ítrio-lantânio (fórmula fictícia YLaF7).
4. A câmara de amortecimento Sperling, com 47 milímetros de diâmetro interno.
5. O acumulador Bravenka, com capacidade nominal de 5.870 miliampères-hora.
6. O núcleo de sincronização Terzo-Vent, que executa o protocolo Zyl-Sync-3 descrito no capítulo 4.
7. A carcaça externa em liga Marbelli-11, resistente a temperaturas entre menos 63 graus Celsius e mais 214 graus Celsius.

A massa total de um Farol Zylântico ZL-9 Reticente é de 3,842 quilogramas, distribuídos assimetricamente para que o centro de massa se encontre a 71 milímetros da base — um requisito para instalação em suportes-padrão Verrata. O volume ocupado pela carcaça externa é de aproximadamente 1,74 litros, e o índice de proteção declarado é IP67.

---

## Capítulo 3 — Constantes Operacionais

As constantes a seguir são fixas para todos os modelos da série ZL-9 e não devem ser recalibradas em campo:

- Frequência de repetição de pulso: 1.043 Hertz.
- Largura de pulso na banda Kravnov: 217 microssegundos.
- Largura de pulso na banda Ostende: 189 microssegundos.
- Largura de pulso na banda Marbelli: 254 microssegundos.
- Tempo mínimo entre disparos consecutivos: 683 microssegundos.
- Temperatura ideal de operação: entre 4 graus Celsius e 37 graus Celsius.
- Consumo médio em regime nominal: 12,7 watts.
- Consumo em regime de vigília: 0,84 watts.
- Perda óptica típica por cada 100 metros em atmosfera limpa: 3,2 decibéis.
- Distância máxima operacional em condições ideais: 41,6 quilômetros.

O parâmetro mais crítico é a estabilidade da frequência de repetição: qualquer desvio superior a mais ou menos 0,7 Hertz invalida o protocolo Zyl-Sync-3 e força o receptor a rejeitar todos os pulsos subsequentes até uma resincronização completa. Em ambientes com vibração mecânica sustentada, recomenda-se o uso do amortecedor auxiliar Verri-B, capaz de manter o desvio abaixo de 0,2 Hertz.

---

## Capítulo 4 — Protocolo de Sincronização Zyl-Sync-3

O protocolo Zyl-Sync-3 organiza a comunicação entre um Farol Zylântico transmissor e qualquer número de receptores compatíveis em uma sequência de quatro fases discretas.

Fase Alfa — Anúncio. O transmissor emite uma cascata de 17 pulsos na banda Kravnov apenas, separados por exatamente 683 microssegundos. Qualquer receptor que detecte esta cascata entra em estado de escuta ativa.

Fase Beta — Chaveamento. O transmissor emite três pulsos simultâneos nas três bandas, formando a primeira trípla coerente da sessão. O receptor mede o defasamento entre as bandas e, se este defasamento for inferior a 0,3 picossegundos, aceita a sessão. Caso contrário, rejeita e retorna ao estado de escuta.

Fase Gama — Carga Útil. A informação é codificada em blocos de 41 tríplas coerentes, sendo cada trípla um símbolo. O alfabeto Zyl-Sync-3 possui 256 símbolos distintos, distinguidos pela razão entre as intensidades das três bandas Kravnov, Ostende e Marbelli.

Fase Delta — Encerramento. O transmissor emite uma cascata final de 9 pulsos na banda Marbelli, sinalizando o fim da sessão. Após esta cascata, o receptor descarta qualquer trípla adicional recebida nos próximos 4 segundos, período conhecido como "silêncio Delta".

Uma sessão completa típica dura entre 71 milissegundos e 4,3 segundos, dependendo do volume de carga útil transmitido. Sessões que ultrapassam 4,3 segundos são consideradas anômalas e devem ser abortadas manualmente pelo operador.

---

## Capítulo 5 — Aplicações Práticas

Os Faróis Zylânticos foram originalmente concebidos para sinalização de emergência em zonas de baixa cobertura de radiofrequência. Suas três aplicações principais atuais são as seguintes.

Primeiro, sinalização marítima nas Ilhas Verrata. A rede oficial de sinalização das Ilhas Verrata opera 218 unidades ZL-9 Reticente distribuídas em 41 pontos costeiros. Cada unidade emite um identificador único codificado em 14 tríplas coerentes, permitindo que qualquer embarcação equipada com receptor Zylântico determine sua posição com precisão de aproximadamente 180 metros.

Segundo, comunicação vertical em minas Sperling. Nas minas profundas de Sperling, os Faróis Zylânticos são instalados a cada 217 metros ao longo dos poços verticais. Como a atmosfera rica em partículas invalida rádios convencionais, o feixe óptico coerente atravessa o poço com atenuação previsível de aproximadamente 3,2 decibéis por 100 metros, mantendo comunicação confiável entre a superfície e frentes de lavra situadas a até 1.400 metros de profundidade.

Terceiro, balizamento astronômico no observatório de Alderbrand. O próprio observatório de Alderbrand, onde o primeiro protótipo foi ativado, hoje utiliza 7 unidades ZL-9 Reticente para balizar as trilhas de acesso durante campanhas noturnas de observação. A banda Marbelli, na faixa dos 871 nanômetros, é invisível ao olho humano e não interfere na sensibilidade dos telescópios instalados no observatório.

---

## Capítulo 6 — Limitações Conhecidas

Apesar de sua confiabilidade em campo, o Farol Zylântico apresenta três limitações que devem ser consideradas em qualquer projeto de implantação.

Limitação Uno — Sensibilidade à névoa densa. Qualquer névoa com visibilidade horizontal inferior a 1,4 quilômetros reduz a distância operacional em pelo menos 71 por cento. Em condições de névoa extremamente densa, o alcance efetivo cai para menos de 900 metros, independentemente do modelo utilizado.

Limitação Duo — Interferência solar direta. Se a linha de visada entre transmissor e receptor for atravessada pelo disco solar, mesmo brevemente, o receptor perde a capacidade de discriminar tríplas coerentes por até 41 minutos após o evento, devido à saturação prolongada dos detectores.

Limitação Trê — Ciclo de recarga do acumulador Bravenka. Uma célula Bravenka totalmente descarregada requer no mínimo 218 minutos de recarga em regime nominal de 12,7 watts para atingir 90 por cento de sua capacidade. Recargas mais rápidas comprometem irreversivelmente a durabilidade da célula, reduzindo sua vida útil de aproximadamente 1.200 ciclos para menos de 400.

Nenhuma dessas limitações é considerada crítica para os casos de uso originalmente previstos, mas todas devem ser explicitamente reconhecidas em qualquer contrato de fornecimento da série ZL-9 Reticente.

---

*Fim do Volume I. Volumes subsequentes cobrirão manutenção preventiva, integração com o protocolo Verrata-Marítimo e procedimentos de descomissionamento seguro.*
