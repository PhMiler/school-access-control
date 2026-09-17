import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { env } from "./env";

type Level = "INFO" | "WARN" | "ERROR";

function ensureLogDir(): void {
  if (!existsSync(env.logDir)) mkdirSync(env.logDir, { recursive: true });
}

function logFilePath(): string {
  const dia = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  return path.join(env.logDir, `collector-${dia}.log`);
}

/** Extrai de um erro do axios/Node os detalhes que realmente ajudam a diagnosticar (código de rede, status HTTP, corpo da resposta). */
export function describeError(e: unknown): Record<string, unknown> {
  const err = e as any;
  const details: Record<string, unknown> = {
    message: err?.message ?? String(e),
  };
  if (err?.code) details.code = err.code; // ex: ECONNREFUSED, ECONNRESET, ETIMEDOUT, EPROTO
  if (err?.config?.url) details.url = err.config.url;
  if (err?.response) {
    details.httpStatus = err.response.status;
    const data = err.response.data;
    details.responseBody = typeof data === "string" ? data.slice(0, 500) : data;
  }
  if (err?.cause?.message) details.cause = err.cause.message;
  if (!err?.response && err?.stack) details.stack = String(err.stack).split("\n").slice(0, 4).join(" | ");
  return details;
}

function write(level: Level, msg: string, extra?: unknown): void {
  const line = { time: new Date().toISOString(), level, msg, extra };
  const consoleLine = `[${line.time}] ${level.padEnd(5)} ${msg}`;
  if (level === "ERROR") console.error(consoleLine, extra ?? "");
  else if (level === "WARN") console.warn(consoleLine, extra ?? "");
  else console.log(consoleLine, extra ?? "");

  try {
    ensureLogDir();
    appendFileSync(logFilePath(), JSON.stringify(line) + "\n", "utf8");
  } catch {
    // Se nem o log em arquivo funcionar (disco cheio, permissão etc.), não derruba o processo por causa disso.
  }
}

export const logger = {
  info: (msg: string, extra?: unknown) => write("INFO", msg, extra),
  warn: (msg: string, extra?: unknown) => write("WARN", msg, extra),
  error: (msg: string, extra?: unknown) => write("ERROR", msg, extra),
  /** Loga um erro de rede/HTTP com todos os detalhes úteis extraídos automaticamente. */
  errorDetailed: (msg: string, e: unknown) => write("ERROR", msg, describeError(e)),
};
