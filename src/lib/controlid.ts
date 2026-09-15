import { baseUrl, getControlIdConfig, type ControlIdConfig } from "./controlidConfig";

/**
 * Cliente da API nativa do relógio Control iD (iDClass).
 * As chamadas saem do navegador do computador local direto para o equipamento
 * na rede interna. Certificado autoassinado precisa ser aceito uma vez no
 * navegador (o browser não permite ignorar SSL por código).
 */

let sessionCache: { key: string; base: string } | null = null;

const TIMEOUT_MS = 8000;
/** O relógio leva vários segundos para extrair o AFD da memória interna. */
const AFD_TIMEOUT_MS = 30000;

async function postRaw(
  path: string,
  body: unknown,
  cfg: ControlIdConfig,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Response> {
  const url = `${baseUrl(cfg)}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      throw new Error(`O relógio não respondeu em ${timeoutMs / 1000}s (${baseUrl(cfg)}).`);
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

async function post<T = any>(
  path: string,
  body: unknown,
  cfg: ControlIdConfig,
  timeoutMs?: number,
): Promise<T> {
  const res = await postRaw(path, body, cfg, timeoutMs);
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(`Resposta inesperada do relógio em ${path}.`);
  }
}

/** Como post(), mas devolve o corpo bruto (usado pelo AFD, que vem como texto). */
async function postText(
  path: string,
  body: unknown,
  cfg: ControlIdConfig,
  timeoutMs?: number,
): Promise<string> {
  const res = await postRaw(path, body, cfg, timeoutMs);
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
  pis?: string | null;
}

const PIS_PESOS = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Dígito verificador oficial do PIS/PASEP a partir dos 10 primeiros dígitos. */
function pisDv(base: number[]): number {
  const soma = base.reduce((acc, val, i) => acc + val * PIS_PESOS[i], 0);
  const resto = soma % 11;
  let dv = 11 - resto;
  if (dv === 10 || dv === 11) dv = 0;
  return dv;
}

/**
 * Gera um PIS válido de 11 dígitos: primeiro dígito 1 ou 2 (padrão brasileiro,
 * exigido pelo firmware do iDClass), 9 dígitos aleatórios e o dígito
 * verificador com os pesos oficiais 3-2-9-8-7-6-5-4-3-2.
 */
export function gerarPis(): string {
  const d1 = Math.floor(Math.random() * 2) + 1; // 1 ou 2
  const d2_10 = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const base = [d1, ...d2_10];
  return [...base, pisDv(base)].join("");
}

/** Confere se o texto é um PIS de 11 dígitos com dígito verificador correto. */
export function pisValido(valor: string): boolean {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 11) return false;
  const base = d.slice(0, 10).split("").map(Number);
  return pisDv(base) === Number(d[10]);
}

/** Normaliza o PIS: usa o do cadastro se for válido, senão gera um novo. */
function normalizarPis(valor?: string | null): string {
  const d = (valor ?? "").replace(/\D/g, "");
  return pisValido(d) ? d : gerarPis();
}

/** Matrícula limpa: só dígitos e sem zeros à esquerda ("005" -> "5"). */
function normalizarMatricula(matricula: string): string {
  return String(matricula).replace(/^0+/, "").replace(/\D/g, "") || "1";
}

/** Nome sem caracteres de controle, espaços duplicados nem excesso de tamanho. */
function normalizarNome(nome: string): string {
  return String(nome)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Cria o aluno como usuário do relógio, com a matrícula como registration.
 * Endpoint e payload nativos do iDClass, conforme a documentação oficial:
 * POST /add_users.fcgi?session= com { users: [{ name, registration, pis }] }.
 * O PIS vai como string de 11 dígitos válidos; se o firmware recusar com 400,
 * refaz a chamada uma vez com o PIS convertido para número.
 */
export async function syncAluno(aluno: AlunoParaSincronizar) {
  const pis = normalizarPis(aluno.pis);
  const name = normalizarNome(aluno.nome);
  const registration = normalizarMatricula(aluno.matricula);
  const enviar = (comoNumero: boolean) =>
    withSession(async (session, cfg) =>
      post(`/add_users.fcgi?session=${session}`, {
        users: [
          {
            name,
            registration: comoNumero ? Number(registration) : registration,
            pis: comoNumero ? Number(pis) : pis,
          },
        ],
      }, cfg),
    );
  try {
    return await enviar(false);
  } catch (e: any) {
    if (!/\b400\b/.test(String(e?.message ?? ""))) throw e;
    try {
      return await enviar(true);
    } catch (e2: any) {
      throw new Error(e2?.message || e?.message || "Falha ao cadastrar o aluno no relógio");
    }
  }
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

/** Converte um registro genérico do relógio em AccessLog. */
function normalizarRegistro(r: any): AccessLog | null {
  if (!r || typeof r !== "object") return null;
  const rawTime = r.time ?? r.timestamp ?? r.date ?? r.event_time ?? r.data_hora;
  let time: number | undefined;
  if (typeof rawTime === "number") {
    time = rawTime > 1e12 ? Math.floor(rawTime / 1000) : rawTime;
  } else if (typeof rawTime === "string" && rawTime.trim()) {
    const s = rawTime.trim();
    const num = Number(s);
    if (!Number.isNaN(num) && /^\d+$/.test(s)) {
      time = num > 1e12 ? Math.floor(num / 1000) : num;
    } else {
      const d = new Date(s.replace(" ", "T"));
      if (!Number.isNaN(d.getTime())) time = Math.floor(d.getTime() / 1000);
    }
  }
  if (!time) return null;
  return {
    id: typeof r.id === "number" ? r.id : undefined,
    time,
    event: typeof r.event === "number" ? r.event : undefined,
    user_id: typeof r.user_id === "number" ? r.user_id : Number(r.user_id) || undefined,
    identifier_id: r.identifier_id != null ? String(r.identifier_id) : undefined,
    card_value: r.card_value != null ? String(r.card_value) : undefined,
    portal_id: typeof r.portal_id === "number" ? r.portal_id : undefined,
    pis: r.pis != null ? String(r.pis).trim() : r.cpf != null ? String(r.cpf).trim() : undefined,
  };
}

/** Procura em qualquer resposta JSON o primeiro array de registros de batida. */
function extrairRegistros(obj: any): any[] {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== "object") return [];
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.length && typeof v[0] === "object") return v as any[];
  }
  for (const v of Object.values(obj)) {
    const found = extrairRegistros(v);
    if (found.length) return found;
  }
  return [];
}

/**
 * Tenta as tabelas de transações do iDClass via load_objects.fcgi, sem filtro
 * de data nem NSR inicial, para o relógio devolver tudo o que está na memória.
 */
async function loadLogsViaObjects(limit: number): Promise<{ logs: AccessLog[]; diagnostico: any[] }> {
  const diagnostico: any[] = [];
  const logs: AccessLog[] = [];
  for (const object of ["transactions", "access_logs"]) {
    try {
      const data = await withSession((session, cfg) =>
        post<any>(`/load_objects.fcgi?session=${session}`, { object, limit, order: ["-id"] }, cfg),
      );
      const brutos = extrairRegistros(data);
      diagnostico.push({ fonte: `load_objects:${object}`, registros: brutos.length, amostra: brutos.slice(0, 3), resposta: data });
      const convertidos = brutos.map(normalizarRegistro).filter((v): v is AccessLog => !!v);
      if (convertidos.length) {
        logs.push(...convertidos);
        break;
      }
    } catch (e: any) {
      diagnostico.push({ fonte: `load_objects:${object}`, erro: e?.message ?? String(e) });
    }
  }
  return { logs, diagnostico };
}

/**
 * Busca as batidas do relógio. Tenta primeiro as tabelas de transações do
 * firmware (load_objects) e, se não houver nada, cai no arquivo AFD
 * (Portaria 671) — sem filtro de data, para trazer tudo da memória.
 */
export async function loadAccessLogs(limit = 200): Promise<AccessLog[]> {
  const { logs: viaObjects, diagnostico } = await loadLogsViaObjects(limit);
  if (viaObjects.length) {
    viaObjects.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
    console.log("Resposta do relógio na importação (load_objects):", diagnostico);
    return viaObjects.slice(0, limit);
  }

  let afd: AccessLog[] = [];
  let afdRaw = "";
  try {
    afdRaw = await withSession((session, cfg) =>
      postText(`/get_afd.fcgi?session=${session}&mode=671`, { headerTop: true }, cfg),
    );
    afd = parseAfdMarcacoes(extractAfdText(afdRaw));
  } catch (e: any) {
    diagnostico.push({ fonte: "get_afd:671", erro: e?.message ?? String(e) });
  }

  // Alguns firmwares só respondem ao AFD legado (sem mode).
  if (afd.length === 0) {
    try {
      afdRaw = await withSession((session, cfg) =>
        postText(`/get_afd.fcgi?session=${session}`, { headerTop: true }, cfg),
      );
      afd = parseAfdMarcacoes(extractAfdText(afdRaw));
      diagnostico.push({ fonte: "get_afd:legado", marcacoes: afd.length, trecho: extractAfdText(afdRaw).slice(0, 500) });
    } catch (e: any) {
      diagnostico.push({ fonte: "get_afd:legado", erro: e?.message ?? String(e) });
    }
  } else {
    diagnostico.push({ fonte: "get_afd:671", marcacoes: afd.length, trecho: extractAfdText(afdRaw).slice(0, 500) });
  }

  console.log("Resposta do relógio na importação:", diagnostico);
  return afd.slice(0, limit);
}

/**
 * Busca os usuários do relógio (endpoint nativo do iDClass), para casar as
 * batidas do AFD — que identificam a pessoa pelo PIS/CPF — com a matrícula.
 */
export async function loadUsers(): Promise<
  { id?: number; name?: string; registration?: string; pis?: string | number; cpf?: string | number }[]
> {
  const data = await withSession((session, cfg) =>
    post<{ users?: any[] }>(`/load_users.fcgi?session=${session}`, { limit: 1000, offset: 0 }, cfg),
  );
  return data?.users ?? [];
}
