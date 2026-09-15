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

  const { data: existentes } = await supabase
    .from("acessos")
    .select("matricula_tentada, created_at")
    .eq("metodo", "biometria")
    .gte("created_at", maisAntiga.toISOString());

  const chaveExistente = new Set(
    (existentes ?? []).map((e: any) => `${e.matricula_tentada}|${new Date(e.created_at).toISOString()}`),
  );

  const novos: any[] = [];
  let ignoradas = 0;
  let invalidas = 0;

  for (const c of candidatos) {
    const chave = `${c.matricula}|${c.ts.toISOString()}`;
    if (chaveExistente.has(chave)) {
      ignoradas++;
      continue;
    }
    chaveExistente.add(chave);
    const valido = !!c.aluno && c.aluno.status === "ativo";
    if (!valido) invalidas++;
    novos.push({
      aluno_id: c.aluno?.id ?? null,
      matricula_tentada: c.matricula,
      tipo: "entrada",
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
