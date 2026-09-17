import "dotenv/config";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}. Confira o seu arquivo .env (veja .env.example).`);
  }
  return value.trim();
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return /^(1|true|yes)$/i.test(raw.trim());
}

export const env = {
  controlId: {
    protocol: (process.env.CONTROLID_PROTOCOL === "https" ? "https" : "http") as "http" | "https",
    ip: required("CONTROLID_IP"),
    login: required("CONTROLID_LOGIN"),
    password: required("CONTROLID_PASSWORD"),
    ignoreSelfSigned: optionalBool("CONTROLID_IGNORE_SELF_SIGNED", true),
    // Muitos relogios/DVRs embarcados mandam respostas HTTP fora do padrao (sem CRLF
    // correto), o que faz o parser estrito do Node falhar com "Missing expected CR
    // after response line". Ativado por padrao; desative so se o seu firmware for estrito.
    insecureHttpParser: optionalBool("CONTROLID_INSECURE_HTTP_PARSER", true),
  },
  supabase: {
    url: required("SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  },
  pollIntervalMs: optionalNumber("POLL_INTERVAL_MS", 5000),
  batchLimit: optionalNumber("BATCH_LIMIT", 200),
  nsrStorePath: path.resolve(process.cwd(), process.env.NSR_STORE_PATH?.trim() || "./last_nsr.json"),
  usersCacheTtlMs: optionalNumber("USERS_CACHE_TTL_MS", 5 * 60 * 1000),
  logDir: path.resolve(process.cwd(), process.env.LOG_DIR?.trim() || "./logs"),
  // Ignora tudo o que o relógio tiver gravado antes de hoje (evita reprocessar
  // milhares de batidas antigas na primeira execução). Desative só se quiser
  // importar o histórico completo do relógio.
  somenteAPartirDeHoje: optionalBool("NSR_SOMENTE_HOJE", true),
};

export type Env = typeof env;
