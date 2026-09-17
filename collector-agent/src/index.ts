import { env } from "./env";
import { logger } from "./logger";
import { Collector } from "./collector";

const collector = new Collector();

let stopping = false;
let ciclosComErroSeguidos = 0;

/** Backoff simples: espera mais entre tentativas quando há falhas seguidas (rede caiu, relógio desligado etc.). */
function proximoAtrasoMs(): number {
  if (ciclosComErroSeguidos === 0) return env.pollIntervalMs;
  const fator = Math.min(ciclosComErroSeguidos, 6); // até 64x o intervalo normal
  return env.pollIntervalMs * 2 ** fator;
}

async function loop(): Promise<void> {
  if (stopping) return;
  try {
    await collector.runOnce();
    ciclosComErroSeguidos = 0;
  } catch (e: any) {
    ciclosComErroSeguidos++;
    logger.error(
      `Falha no ciclo de coleta (tentativa ${ciclosComErroSeguidos}). Tentando de novo em ${proximoAtrasoMs()}ms.`,
      e?.message ?? e,
    );
  } finally {
    if (!stopping) setTimeout(loop, proximoAtrasoMs());
  }
}

function shutdown(signal: string) {
  logger.info(`Recebido ${signal}, encerrando o coletor...`);
  stopping = true;
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => logger.error("Promise rejeitada sem tratamento:", reason));
process.on("uncaughtException", (err) => logger.error("Exceção não capturada:", err));

logger.info(`Coletor iniciado. Relógio: ${env.controlId.protocol}://${env.controlId.ip} | intervalo: ${env.pollIntervalMs}ms`);
loop();
