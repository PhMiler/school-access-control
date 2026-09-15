import { supabase } from "@/integrations/supabase/client";
import { loadAccessLogs, getUltimoDiagnosticoAfd } from "./controlid";

export interface ImportResult {
  importadas: number;
  ignoradas: number;
  invalidas: number;
  /** Batidas reconhecidas no arquivo do relógio. */
  lidas: number;
  /** Linhas recebidas do relógio (ajuda a distinguir arquivo vazio de formato não reconhecido). */
  linhasRecebidas: number;
}

const semZeros = (v: string) => v.replace(/^0+/, "");

/**
 * Lê as batidas do relógio (arquivo AFD) e grava no sistema as que ainda não
 * existem. O aluno é identificado pelo PIS gravado na própria ficha, sem
 * depender da lista de usuários do relógio.
 * De-duplicação por matrícula tentada + horário da batida.
 */
export async function importarBatidas(registradoPor: string, limit = 500): Promise<ImportResult> {
  const logs = await loadAccessLogs(limit);
  const diag = getUltimoDiagnosticoAfd();
  const base = { lidas: logs.length, linhasRecebidas: diag.linhasRecebidas };
  console.log("Resposta do relógio na importação:", { batidas: logs.slice(0, 20), total: logs.length, diagnostico: diag });
  if (logs.length === 0) return { importadas: 0, ignoradas: 0, invalidas: 0, ...base };

  const batidas = logs
    .map((l) => {
      const pis = l.pis ? String(l.pis).replace(/\D/g, "") : "";
      const ts = l.time ? new Date(l.time * 1000) : null;
      if (!ts || !pis) return null;
      return { pis, ts };
    })
    .filter((v): v is { pis: string; ts: Date } => !!v);

  if (batidas.length === 0) return { importadas: 0, ignoradas: logs.length, invalidas: 0, ...base };

  const pisLista = Array.from(new Set(batidas.flatMap((b) => [b.pis, semZeros(b.pis)]).filter(Boolean)));

  const { data: alunos } = await supabase
    .from("alunos")
    .select("id, matricula, status, pis")
    .in("pis", pisLista)
    .is("deleted_at", null);

  const alunoPorPis = new Map<string, any>();
  for (const a of alunos ?? []) {
    const p = (a as any).pis ? String((a as any).pis).replace(/\D/g, "") : "";
    if (!p) continue;
    alunoPorPis.set(p, a);
    alunoPorPis.set(semZeros(p), a);
  }

  const candidatos = batidas.map((b) => {
    const aluno = alunoPorPis.get(b.pis) ?? alunoPorPis.get(semZeros(b.pis));
    return {
      ts: b.ts,
      aluno,
      matricula: aluno?.matricula ? String(aluno.matricula) : `PIS ${b.pis}`,
    };
  });

  const maisAntiga = new Date(Math.min(...candidatos.map((c) => c.ts.getTime())));
  // início do dia local da batida mais antiga, para contar corretamente a alternância
  const inicioDia = new Date(maisAntiga.getFullYear(), maisAntiga.getMonth(), maisAntiga.getDate(), 0, 0, 0, 0);

  const { data: existentes } = await supabase
    .from("acessos")
    .select("matricula_tentada, created_at")
    .eq("metodo", "biometria")
    .gte("created_at", inicioDia.toISOString());

  const chaveExistente = new Set(
    (existentes ?? []).map((e: any) => `${e.matricula_tentada}|${new Date(e.created_at).toISOString()}`),
  );

  const diaLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // quantidade de batidas já gravadas por aluno/dia (offset da paridade entrada/saída)
  const contagemDia = new Map<string, number>();
  for (const e of existentes ?? []) {
    const k = `${(e as any).matricula_tentada}|${diaLocal(new Date((e as any).created_at))}`;
    contagemDia.set(k, (contagemDia.get(k) ?? 0) + 1);
  }

  // ordem crescente por horário para a alternância ficar correta
  const ordenados = [...candidatos].sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const novos: any[] = [];
  let ignoradas = 0;
  let invalidas = 0;

  for (const c of ordenados) {
    const chave = `${c.matricula}|${c.ts.toISOString()}`;
    if (chaveExistente.has(chave)) {
      ignoradas++;
      continue;
    }
    chaveExistente.add(chave);

    const chaveDia = `${c.matricula}|${diaLocal(c.ts)}`;
    const indice = contagemDia.get(chaveDia) ?? 0;
    contagemDia.set(chaveDia, indice + 1);

    const valido = !!c.aluno && c.aluno.status === "ativo";
    if (!valido) invalidas++;
    novos.push({
      aluno_id: c.aluno?.id ?? null,
      matricula_tentada: c.matricula,
      tipo: indice % 2 === 0 ? "entrada" : "saida",
      metodo: "biometria",
      status: valido ? "valido" : "invalido",
      registrado_por: registradoPor,
      created_at: c.ts.toISOString(),
      observacao: c.aluno
        ? "Importado do relógio Control iD"
        : "PIS não cadastrado no sistema",
    });
  }

  if (novos.length > 0) {
    const { error } = await supabase.from("acessos").insert(novos);
    if (error) throw new Error(error.message);
  }

  return { importadas: novos.length, ignoradas, invalidas, ...base };
}
