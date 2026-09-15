import { baseUrl, getControlIdConfig, type ControlIdConfig } from "./controlidConfig";

/**
 * Cliente da API nativa do relógio Control iD (iDClass).
 * As chamadas saem do navegador do computador local direto para o equipamento
 * na rede interna. Certificado autoassinado precisa ser aceito uma vez no
 * navegador (o browser não permite ignorar SSL por código).
 */

let sessionCache: { key: string; base: string } | null = null;

const TIMEOUT_MS = 8000;

async function postRaw(path: string, body: unknown, cfg: ControlIdConfig): Promise<Response> {
  const url = `${baseUrl(cfg)}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      throw new Error(`O relógio não respondeu em ${TIMEOUT_MS / 1000}s (${baseUrl(cfg)}).`);
    }
    throw new Error(
      `Não foi possível falar com o relógio em ${baseUrl(cfg)}. Verifique o IP, a rede e se o certificado do equipamento já foi aceito no navegador.`,
    );
  }
  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(
      `O relógio respondeu com erro ${res.status} em ${path}${detalhe ? `: ${detalhe.slice(0, 200)}` : "."}`,
    );
  }
  return res;
}

async function post<T = any>(path: string, body: unknown, cfg: ControlIdConfig): Promise<T> {
  const res = await postRaw(path, body, cfg);
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(`Resposta inesperada do relógio em ${path}.`);
  }
}

/** Como post(), mas devolve o corpo bruto (usado pelo AFD, que vem como texto). */
async function postText(path: string, body: unknown, cfg: ControlIdConfig): Promise<string> {
  const res = await postRaw(path, body, cfg);
  return res.text();
}

export async function login(cfg: ControlIdConfig = getControlIdConfig()): Promise<string> {
  const data = await post<{ session?: string }>("/login.fcgi", { login: cfg.login, password: cfg.senha }, cfg);
  if (!data?.session) throw new Error("O relógio respondeu, mas não retornou a chave de sessão. Confira login e senha.");
  sessionCache = { key: data.session, base: baseUrl(cfg) };
  return data.session;
}

async function getSession(cfg: ControlIdConfig): Promise<string> {
  if (sessionCache && sessionCache.base === baseUrl(cfg)) return sessionCache.key;
  return login(cfg);
}

export function clearSession() {
  sessionCache = null;
}

/** Executa a chamada e refaz o login automaticamente se a sessão expirou. */
async function withSession<T>(fn: (session: string, cfg: ControlIdConfig) => Promise<T>): Promise<T> {
  const cfg = getControlIdConfig();
  const session = await getSession(cfg);
  try {
    return await fn(session, cfg);
  } catch (e: any) {
    clearSession();
    const fresh = await login(cfg);
    return await fn(fresh, cfg);
  }
}

export async function testConnection(cfg: ControlIdConfig) {
  clearSession();
  const session = await login(cfg);
  return session;
}

export interface AlunoParaSincronizar {
  id: string;
  nome: string;
  matricula: string;
}

/**
 * Cria o aluno como usuário do relógio, com a matrícula como cartão.
 * Payload estrito conforme a documentação oficial da Control iD:
 * { object: "users", values: [{ name, registration }] } — sem id manual
 * (o relógio autogera) e sem campos extras, que alguns firmwares rejeitam
 * com erro 400. Se o equipamento recusar, reenvia uma única vez incluindo
 * password: "" (firmwares antigos exigem o campo presente).
 */
export async function syncAluno(aluno: AlunoParaSincronizar) {
  return withSession(async (session, cfg) => {
    const base = {
      name: aluno.nome,
      registration: String(aluno.matricula),
    };
    try {
      return await post(`/create_objects.fcgi?session=${session}`, { object: "users", values: [base] }, cfg);
    } catch (e: any) {
      if (!/\b400\b/.test(e?.message ?? "")) throw e;
      return await post(
        `/create_objects.fcgi?session=${session}`,
        { object: "users", values: [{ ...base, password: "" }] },
        cfg,
      );
    }
  });
}

export interface AccessLog {
  id?: number;
  time?: number;
  event?: number;
  user_id?: number;
  identifier_id?: string;
  card_value?: string;
  portal_id?: number;
}

/** Busca as batidas (tabela access_logs) do relógio. */
export async function loadAccessLogs(limit = 200): Promise<AccessLog[]> {
  const data = await withSession((session, cfg) =>
    post<{ access_logs?: AccessLog[] }>(
      `/load_objects.fcgi?session=${session}`,
      { object: "access_logs", order: ["-time"], limit },
      cfg,
    ),
  );
  return data?.access_logs ?? [];
}

/** Busca os usuários do relógio, para casar as batidas com a matrícula. */
export async function loadUsers(): Promise<{ id?: number; name?: string; registration?: string }[]> {
  const data = await withSession((session, cfg) =>
    post<{ users?: any[] }>(`/load_objects.fcgi?session=${session}`, { object: "users" }, cfg),
  );
  return data?.users ?? [];
}
