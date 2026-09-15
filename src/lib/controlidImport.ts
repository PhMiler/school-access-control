import { supabase } from "@/integrations/supabase/client";
import { loadAccessLogs, loadUsers } from "./controlid";

export interface ImportResult {
  importadas: number;
  ignoradas: number;
  invalidas: number;
}

/**
 * Lê as batidas do relógio e grava no sistema as que ainda não existem.
 * De-duplicação por matrícula + horário da batida.
 */
export async function importarBatidas(registradoPor: string, limit = 200): Promise<ImportResult> {
  const [logs, users] = await Promise.all([loadAccessLogs(limit), loadUsers().catch(() => [])]);
  if (logs.length === 0) return { importadas: 0, ignoradas: 0, invalidas: 0 };

  const matriculaPorUserId = new Map<number, string>();
  for (const u of users) {
    if (typeof u.id === "number" && u.registration) matriculaPorUserId.set(u.id, String(u.registration));
  }

  const candidatos = logs
    .map((l) => {
      const matricula =
        (typeof l.user_id === "number" ? matriculaPorUserId.get(l.user_id) : undefined) ??
        (l.card_value ? String(l.card_value) : undefined) ??
        (l.identifier_id ? String(l.identifier_id) : undefined);
      const ts = l.time ? new Date(l.time * 1000) : null;
      return matricula && ts ? { matricula: matricula.trim(), ts } : null;
    })
    .filter((v): v is { matricula: string; ts: Date } => !!v);

  if (candidatos.length === 0) return { importadas: 0, ignoradas: logs.length, invalidas: 0 };

  const maisAntiga = new Date(Math.min(...candidatos.map((c) => c.ts.getTime())));

  const { data: existentes } = await supabase
    .from("acessos")
    .select("matricula_tentada, created_at")
    .eq("metodo", "biometria")
    .gte("created_at", maisAntiga.toISOString());

  const chaveExistente = new Set(
    (existentes ?? []).map((e: any) => `${e.matricula_tentada}|${new Date(e.created_at).toISOString()}`),
  );

  const matriculas = Array.from(new Set(candidatos.map((c) => c.matricula)));
  const { data: alunos } = await supabase
    .from("alunos")
    .select("id, matricula, status")
    .in("matricula", matriculas)
    .is("deleted_at", null);

  const alunoPorMatricula = new Map((alunos ?? []).map((a: any) => [a.matricula, a]));

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
    const aluno = alunoPorMatricula.get(c.matricula);
    const valido = !!aluno && aluno.status === "ativo";
    if (!valido) invalidas++;
    novos.push({
      aluno_id: aluno?.id ?? null,
      matricula_tentada: c.matricula,
      tipo: "entrada",
      metodo: "biometria",
      status: valido ? "valido" : "invalido",
      registrado_por: registradoPor,
      created_at: c.ts.toISOString(),
      observacao: "Importado do relógio Control iD",
    });
  }

  if (novos.length > 0) {
    const { error } = await supabase.from("acessos").insert(novos);
    if (error) throw new Error(error.message);
  }

  return { importadas: novos.length, ignoradas, invalidas };
}
