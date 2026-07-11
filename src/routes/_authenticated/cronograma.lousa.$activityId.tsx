import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Send, Clock, Sparkles } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { getLousa, submitLousaAnswers, generateLousa } from "@/lib/cronograma.functions";

export const Route = createFileRoute("/_authenticated/cronograma/lousa/$activityId")({
  head: () => ({
    meta: [{ title: "Lousa — Lição de casa" }],
  }),
  component: LousaHomework,
});

function LousaHomework() {
  const { activityId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getLousa);
  const submitFn = useServerFn(submitLousaAnswers);
  const genFn = useServerFn(generateLousa);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["lousa", activityId],
    queryFn: () => getFn({ data: { activityId } }),
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const remainingMs = useMemo(() => {
    if (!data?.unlocksAt) return 0;
    return Math.max(0, data.unlocksAt - nowMs);
  }, [data?.unlocksAt, nowMs]);

  const locked = remainingMs > 0;
  const alreadyDone = data?.activity.status === "done";
  const alreadyFailed = data?.activity.status === "failed";

  const [reviewSlugs, setReviewSlugs] = useState<string[]>([]);

  const submitMut = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          activityId,
          answers: (data?.questions ?? []).map((q) => ({
            questionId: q.id,
            answer: answers[q.id] ?? "",
          })),
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["lousa", activityId] });
      qc.invalidateQueries({ queryKey: ["cron-today"] });
      qc.invalidateQueries({ queryKey: ["today-agenda"] });

      if (r.passed) {
        toast.success(`Você passou! ${r.correctCount}/${r.total} (${r.pct}%)`);
      } else {
        toast.error(`Reprovou: ${r.correctCount}/${r.total} (${r.pct}%). Geramos uma Lousa de reforço.`);
        setReviewSlugs(r.reviewTopicSlugs ?? []);
        if (r.reforcoActivityId) {
          setTimeout(() => {
            genFn({ data: { activityId: r.reforcoActivityId!, reforco: true } }).then(() => {
              navigate({
                to: "/cronograma/lousa/$activityId",
                params: { activityId: r.reforcoActivityId! },
              });
            });
          }, 800);
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });


  function fmt(ms: number) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Nav />
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
        <Link
          to="/cronograma"
          className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft size={14} /> Cronograma
        </Link>

        <header className="mb-6 border-b border-border pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Lousa — Lição de casa {data?.isReforco && "· Reforço"}
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter mt-2">
            {data?.isReforco
              ? "Refaça com os pontos que você errou."
              : "Copie no caderno, resolva e volte amanhã."}
          </h1>
          {!data?.isReforco && (
            <p className="text-sm text-muted-foreground mt-2">
              A regra é: você escreve tudo no caderno físico, e as respostas só podem ser enviadas 24h depois de gerar
              a Lousa.
            </p>
          )}
        </header>

        {isLoading || !data ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin" size={16} /> Carregando…
          </div>
        ) : (
          <>
            {locked && (
              <div className="mb-6 border border-primary/40 bg-primary/5 rounded-xl p-5 flex items-center gap-4">
                <Clock className="text-primary" size={28} />
                <div>
                  <div className="font-bold">Envio libera em {fmt(remainingMs)}</div>
                  <div className="text-xs text-muted-foreground">
                    Use esse tempo para resolver com calma no caderno. Não abra o gabarito.
                  </div>
                </div>
              </div>
            )}

            {alreadyDone && (
              <div className="mb-6 border border-emerald-500/40 bg-emerald-500/5 rounded-xl p-5">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 size={20} /> Concluída — {Math.round(Number(data.activity.score ?? 0))}%
                </div>
              </div>
            )}

            <div className="space-y-4">
              {data.questions.map((q, i) => (
                <div key={q.id} className="border border-border rounded-xl p-5 bg-card">
                  <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Questão {i + 1}
                    {q.topico && ` · ${q.topico}`}
                  </div>
                  <div className="mt-2 text-base leading-relaxed whitespace-pre-wrap">{q.enunciado}</div>

                  {alreadyDone || alreadyFailed ? (
                    <>
                      <div className="mt-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Sua resposta
                      </div>
                      <div className="mt-1 p-3 rounded border border-border bg-background text-sm whitespace-pre-wrap">
                        {q.user_answer || "(em branco)"}
                      </div>
                      <div className="mt-3 flex items-start gap-2">
                        {q.correct ? (
                          <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                        ) : (
                          <XCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                        )}
                        <div className="text-sm">
                          <div className="font-bold">{q.correct ? "Correta" : "Incorreta"}</div>
                          {q.feedback && (
                            <div className="text-muted-foreground mt-0.5">{q.feedback}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-2">
                            <span className="font-bold">Gabarito:</span> {q.gabarito}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <textarea
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      rows={3}
                      placeholder="Digite aqui sua resposta do caderno…"
                      disabled={locked || submitMut.isPending}
                      className="mt-3 w-full resize-none px-3 py-2 text-sm border border-border bg-background rounded outline-none focus:border-foreground disabled:opacity-40"
                    />
                  )}
                </div>
              ))}
            </div>

            {!alreadyDone && !alreadyFailed && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => submitMut.mutate()}
                  disabled={locked || submitMut.isPending}
                  className="px-6 py-3 rounded-lg bg-foreground text-background font-bold text-xs uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-30 inline-flex items-center gap-2"
                >
                  {submitMut.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : locked ? (
                    <Clock size={14} />
                  ) : (
                    <Send size={14} />
                  )}
                  {locked ? "Aguardando 24h" : "Enviar respostas"}
                </button>
              </div>
            )}

            {alreadyFailed && (
              <div className="mt-6 border border-amber-500/40 bg-amber-500/5 rounded-xl p-5 flex items-center gap-3">
                <Sparkles className="text-amber-500" size={20} />
                <div className="text-sm">
                  Uma Lousa de reforço foi adicionada ao seu dia. Volte ao Cronograma para acessá-la.
                </div>
              </div>
            )}

            <button
              onClick={() => refetch()}
              className="mt-8 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Atualizar
            </button>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
