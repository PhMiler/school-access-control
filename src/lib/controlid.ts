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
 * Cria o aluno como usuário do relógio, com a matrícula como registration.
 * Endpoint e payload nativos do iDClass, conforme a documentação oficial:
 * POST /add_users.fcgi?session= com { users: [{ name, registration }] } —
 * registration sempre string, sem id manual e sem campos extras.
 */
export async function syncAluno(aluno: AlunoParaSincronizar) {
  return withSession(async (session, cfg) => {
    return post(`/add_users.fcgi?session=${session}`, {
      users: [{ name: aluno.nome, registration: String(aluno.matricula) }],
    }, cfg);
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
  /** PIS/CPF que identifica a batida no AFD do iDClass. */
  pis?: string;
}

/**
 * Extrai o texto do AFD da resposta do relógio. Dependendo do firmware o
 * corpo vem como texto puro ou embrulhado em JSON; pega a maior string.
 */
function extractAfdText(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("{")) return t;
  try {
    const obj = JSON.parse(t);
    let melhor = "";
    const visit = (v: any) => {
      if (typeof v === "string") {
        if (v.length > melhor.length) melhor = v;
      } else if (v && typeof v === "object") {
        Object.values(v).forEach(visit);
      }
    };
    visit(obj);
    return melhor || t;
  } catch {
    return t;
  }
}

/**
 * Interpreta as marcações do arquivo AFD (registros tipo 3, formato fixo
 * comum ao formato legado e ao da Portaria 671):
 * "3" + NSR(9) + data ddmmaaaa(8) + hora HHMM(4) + PIS/CPF(12).
 * A hora do relógio é local, sem fuso — tratamos como hora local do navegador.
 */
function parseAfdMarcacoes(text: string): AccessLog[] {
  const logs: AccessLog[] = [];
  for (const linha of text.split(/\r?\n/)) {
    const l = linha.trim();
    if (l.length < 34 || l[0] !== "3") continue;
    const data = l.slice(10, 18);
    const hora = l.slice(18, 22);
    const pis = l.slice(22, 34).trim();
    const dia = +data.slice(0, 2);
    const mes = +data.slice(2, 4);
    const ano = +data.slice(4, 8);
    const h = +hora.slice(0, 2);
    const m = +hora.slice(2, 4);
    if (!dia || !mes || !ano || !hora || Number.isNaN(h) || Number.isNaN(m)) continue;
    const ts = new Date(ano, mes - 1, dia, h, m);
    if (Number.isNaN(ts.getTime())) continue;
    logs.push({ time: Math.floor(ts.getTime() / 1000), pis });
  }
  logs.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
  return logs;
}

/**
 * Busca as batidas do relógio via arquivo AFD (Portaria 671). A linha iDClass
 * não expõe a tabela access_logs — o AFD é o canal oficial de marcações.
 * Filtra os últimos 90 dias para limitar o tamanho da resposta.
 */
export async function loadAccessLogs(limit = 200): Promise<AccessLog[]> {
  const inicial = new Date();
  inicial.setDate(inicial.getDate() - 90);
  const initial_date = {
    day: inicial.getDate(),
    month: inicial.getMonth() + 1,
    year: inicial.getFullYear(),
  };
  const raw = await withSession((session, cfg) =>
    postText(`/get_afd.fcgi?session=${session}&mode=671`, { headerTop: true, initial_date }, cfg),
  );
  return parseAfdMarcacoes(extractAfdText(raw)).slice(0, limit);
}

/** Busca os usuários do relógio, para casar as batidas com a matrícula. */
export async function loadUsers(): Promise<{ id?: number; name?: string; registration?: string }[]> {
  const data = await withSession((session, cfg) =>
    post<{ users?: any[] }>(`/load_objects.fcgi?session=${session}`, { object: "users" }, cfg),
  );
  return data?.users ?? [];
}
