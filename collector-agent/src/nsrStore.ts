import { promises as fs } from "node:fs";
import { env } from "./env";
import { logger } from "./logger";

interface WatermarkState {
  /**
   * Unix timestamp (segundos) da batida mais recente já processada com
   * sucesso. O AFD não tem NSR filtrável, então usamos isso como marca
   * d'água só para reduzir o quanto precisamos reconferir a cada ciclo — a
   * deduplicação de verdade é feita contra o Supabase (ver acessosSync.ts).
   */
  ultimoProcessadoEm: number;
  updatedAt: string;
}

let cache: WatermarkState | null = null;

/** Início (00:00) do dia local atual, em segundos unix. */
function inicioDeHojeSegundos(): number {
  const agora = new Date();
  return Math.floor(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0).getTime() / 1000);
}

export async function loadWatermark(): Promise<number> {
  if (cache) return cache.ultimoProcessadoEm;
  let armazenado = 0;
  try {
    const raw = await fs.readFile(env.nsrStorePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<WatermarkState>;
    armazenado = Number(parsed.ultimoProcessadoEm) || 0;
  } catch (e: any) {
    if (e?.code !== "ENOENT") {
      logger.warn(`Não foi possível ler ${env.nsrStorePath}, começando do zero.`, e?.message);
    }
  }
  // Nunca processa nada anterior ao início do dia de hoje (a menos que já
  // tenha processado algo mais recente ainda hoje) — evita reimportar o
  // histórico inteiro do relógio (milhares de batidas antigas).
  const piso = env.somenteAPartirDeHoje ? inicioDeHojeSegundos() : 0;
  const efetivo = Math.max(armazenado, piso);
  cache = { ultimoProcessadoEm: efetivo, updatedAt: new Date().toISOString() };
  return efetivo;
}

/** Grava em arquivo temporário e renomeia por cima do definitivo (write atômico). */
export async function saveWatermark(ultimoProcessadoEm: number): Promise<void> {
  cache = { ultimoProcessadoEm, updatedAt: new Date().toISOString() };
  const tmpPath = `${env.nsrStorePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(cache, null, 2), "utf8");
  await fs.rename(tmpPath, env.nsrStorePath);
}
