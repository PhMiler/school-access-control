import { supabase } from "@/integrations/supabase/client";
import { loadAccessLogs, loadUsers, getUltimoDiagnosticoAfd } from "./controlid";

export interface ImportResult {
  importadas: number;
  ignoradas: number;
  invalidas: number;
  /** Batidas reconhecidas no arquivo do relógio. */
  lidas: number;
  /** Linhas recebidas do relógio (ajuda a distinguir arquivo vazio de formato não reconhecido). */
  linhasRecebidas: number;
}

/**
 * Lê as batidas do relógio e grava no sistema as que ainda não existem.
 * De-duplicação por matrícula + horário da batida.
 */
export async function importarBatidas(registradoPor: string, limit = 200): Promise<ImportResult> {
  const [logs, users] = await Promise.all([loadAccessLogs(limit), loadUsers().catch(() => [])]);
  const diag = getUltimoDiagnosticoAfd();
  const base = { lidas: logs.length, linhasRecebidas: diag.linhasRecebidas };
  console.log("Resposta do relógio na importação:", { batidas: logs, usuarios: users, diagnostico: diag });
  if (logs.length === 0) return { importadas: 0, ignoradas: 0, invalidas: 0, ...base };

  const matriculaPorUserId = new Map<number, string>();
  const matriculaPorIdentificador = new Map<string, string>(); // PIS ou CPF
  for (const u of users) {
    const registration = u.registration ? String(u.registration).trim() : "";
    if (!registration) continue;
    if (typeof u.id === "number") matriculaPorUserId.set(u.id, registration);
    for (const ident of [u.pis, u.cpf]) {
      if (ident == null) continue;
      const s = String(ident).trim();
      if (!s) continue;
      // AFD trás o PIS/CPF com zeros à esquerda; guarda as duas formas.
      matriculaPorIdentificador.set(s, registration);
      matriculaPorIdentificador.set(s.replace(/^0+/, ""), registration);
    }
  }

  const candidatos = logs
    .map((l) => {
      const identificador = l.pis ? String(l.pis).trim() : "";
      const matricula =
        (identificador
          ? matriculaPorIdentificador.get(identificador) ??
            matriculaPorIdentificador.get(identificador.replace(/^0+/, ""))
          : undefined) ??
        (typeof l.user_id === "number" ? matriculaPorUserId.get(l.user_id) : undefined) ??
        (l.card_value ? String(l.card_value) : undefined) ??
        (l.identifier_id ? String(l.identifier_id) : undefined);
      const ts = l.time ? new Date(l.time * 1000) : null;
      if (!ts) return null;
      // Batida com PIS que não casou com nenhum usuário do relógio ainda é
      // importada (como inválida), usando o próprio PIS como matrícula tentada.
      const matriculaTentada = matricula?.trim() || (identificador ? `PIS ${identificador}` : null);
      return matriculaTentada ? { matricula: matriculaTentada, ts, semVinculo: !matricula } : null;
    })
    .filter((v): v is { matricula: string; ts: Date; semVinculo: boolean } => !!v);

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
    const valido = !!aluno && aluno.status === "ativo" && !c.semVinculo;
    if (!valido) invalidas++;
    novos.push({
      aluno_id: aluno?.id ?? null,
      matricula_tentada: c.matricula,
      tipo: "entrada",
      metodo: "biometria",
      status: valido ? "valido" : "invalido",
      registrado_por: registradoPor,
      created_at: c.ts.toISOString(),
      observacao: c.semVinculo
        ? "PIS não vinculado a matrícula no relógio"
        : "Importado do relógio Control iD",
    });
  }

  if (novos.length > 0) {
    const { error } = await supabase.from("acessos").insert(novos);
    if (error) throw new Error(error.message);
  }

  return { importadas: novos.length, ignoradas, invalidas };
}
