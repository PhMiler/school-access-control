import { supabase } from "./supabaseClient";
import { logger } from "./logger";

interface AlunoRow {
  id: string;
  matricula: string;
  status: "ativo" | "inativo";
  pis: string | null;
}

const semZeros = (v: string) => v.replace(/^0+/, "");

/** Início do dia local (00:00) da data informada, para contar a paridade entrada/saída do dia. */
function inicioDiaLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Resolve alunos por PIS (o AFD identifica a pessoa pelo PIS/CPF, não pela
 * matrícula) e mantém em memória, por processo, a contagem de acessos do dia
 * por aluno — igual à lógica do importador manual do app
 * (src/lib/controlidImport.ts), para que as duas vias de entrada alternem
 * entrada/saída da mesma forma. Também dedupe contra o que já existe no
 * Supabase, já que o AFD sempre devolve o histórico completo do relógio.
 */
export class AcessosSync {
  private alunoPorPis = new Map<string, AlunoRow>();
  private contagemDia = new Map<string, number>(); // chave: `${alunoId}|${yyyy-mm-dd}`
  private existentes = new Set<string>(); // chave: `${matricula}|${isoTimestamp}`

  async carregarAlunos(pisList: string[]): Promise<void> {
    const unicos = Array.from(new Set(pisList.flatMap((p) => [p, semZeros(p)]).filter(Boolean)));
    if (unicos.length === 0) return;
    const { data, error } = await supabase
      .from("alunos")
      .select("id, matricula, status, pis")
      .in("pis", unicos)
      .is("deleted_at", null);
    if (error) throw new Error(`Falha ao consultar alunos no Supabase: ${error.message}`);
    for (const a of (data ?? []) as AlunoRow[]) {
      const p = a.pis ? String(a.pis).replace(/\D/g, "") : "";
      if (!p) continue;
      this.alunoPorPis.set(p, a);
      this.alunoPorPis.set(semZeros(p), a);
    }
  }

  /** Carrega os acessos já gravados a partir de `desde`, para não duplicar batidas que o AFD sempre reenvia por inteiro. */
  async carregarExistentes(desde: Date): Promise<void> {
    const { data, error } = await supabase
      .from("acessos")
      .select("matricula_tentada, created_at")
      .eq("metodo", "biometria")
      .gte("created_at", desde.toISOString());
    if (error) throw new Error(`Falha ao consultar acessos existentes: ${error.message}`);
    for (const e of (data ?? []) as { matricula_tentada: string; created_at: string }[]) {
      this.existentes.add(`${e.matricula_tentada}|${new Date(e.created_at).toISOString()}`);
    }
  }

  private diaLocalChave(alunoId: string, ts: Date): string {
    const d = inicioDiaLocal(ts);
    return `${alunoId}|${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  private async contagemDoDia(alunoId: string, ts: Date): Promise<number> {
    const chave = this.diaLocalChave(alunoId, ts);
    if (this.contagemDia.has(chave)) return this.contagemDia.get(chave)!;
    const inicio = inicioDiaLocal(ts);
    const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    const { count, error } = await supabase
      .from("acessos")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", alunoId)
      .eq("metodo", "biometria")
      .gte("created_at", inicio.toISOString())
      .lt("created_at", fim.toISOString());
    if (error) throw new Error(`Falha ao contar acessos do dia: ${error.message}`);
    const total = count ?? 0;
    this.contagemDia.set(chave, total);
    return total;
  }

  /**
   * Grava uma batida na tabela `acessos` se ainda não existir lá.
   * `registrado_por` fica nulo: é um evento automático do relógio, não de um
   * usuário logado no painel. Retorna `false` quando a batida foi ignorada
   * por já existir (duplicidade).
   */
  async registrarBatida(params: { pis: string; ts: Date }): Promise<boolean> {
    const aluno = this.alunoPorPis.get(params.pis) ?? this.alunoPorPis.get(semZeros(params.pis));
    const matricula = aluno?.matricula ? String(aluno.matricula) : `PIS ${params.pis}`;

    const chaveExistente = `${matricula}|${params.ts.toISOString()}`;
    if (this.existentes.has(chaveExistente)) return false;

    const valido = !!aluno && aluno.status === "ativo";
    let tipo: "entrada" | "saida" = "entrada";
    if (aluno) {
      const indice = await this.contagemDoDia(aluno.id, params.ts);
      tipo = indice % 2 === 0 ? "entrada" : "saida";
      this.contagemDia.set(this.diaLocalChave(aluno.id, params.ts), indice + 1);
    }

    const { error } = await supabase.from("acessos").insert({
      aluno_id: aluno?.id ?? null,
      matricula_tentada: matricula,
      tipo,
      metodo: "biometria",
      status: valido ? "valido" : "invalido",
      registrado_por: null,
      created_at: params.ts.toISOString(),
      observacao: aluno ? "Importado automaticamente pelo coletor local (Control iD)" : "PIS não cadastrado no sistema",
    });
    if (error) throw new Error(`Falha ao gravar acesso no Supabase: ${error.message}`);
    this.existentes.add(chaveExistente);
    logger.info(`Acesso registrado: ${matricula} (${tipo}, ${valido ? "válido" : "inválido"}) em ${params.ts.toISOString()}`);
    return true;
  }
}
