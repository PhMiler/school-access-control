import axios, { AxiosInstance } from "axios";
import https from "node:https";
import { env } from "./env";
import { logger } from "./logger";
import { extractAfdText, parseAfdMarcacoes, AfdMarcacao } from "./afdParser";

/**
 * Cliente HTTP do relógio Control iD (iDClass).
 *
 * Este firmware não suporta a API moderna "Objects" (`load_objects.fcgi`
 * retorna `400 Invalid command`) — usa os comandos legados, os mesmos já
 * comprovados em produção pelo importador manual do app
 * (src/lib/controlid.ts): `login.fcgi` e `get_afd.fcgi` (arquivo-fonte de
 * dados legal, com todas as marcações gravadas na memória do equipamento).
 *
 * O AFD não tem um NSR filtrável nem paginação: cada chamada devolve o
 * histórico completo gravado no relógio. A deduplicação fica a cargo de
 * quem consome (ver `collector.ts` e `acessosSync.ts`), que usa uma marca
 * d'água de tempo local + checagem definitiva contra o Supabase.
 */
export class ControlIdClient {
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;
  private session: string | null = null;

  constructor() {
    this.baseUrl = `${env.controlId.protocol}://${env.controlId.ip}`;
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000, // o relógio pode demorar para extrair o AFD da memória interna
      httpsAgent: new https.Agent({ rejectUnauthorized: !env.controlId.ignoreSelfSigned }),
      // Relaxa o parser HTTP do Node para respostas fora do padrão RFC, comuns
      // em equipamentos embarcados ("Missing expected CR after response line").
      insecureHTTPParser: env.controlId.insecureHttpParser,
    });
  }

  private async login(): Promise<string> {
    let response;
    try {
      response = await this.http.post<{ session?: string }>("/login.fcgi", {
        login: env.controlId.login,
        password: env.controlId.password,
      });
    } catch (e) {
      logger.errorDetailed(`Falha ao conectar no relógio em ${this.baseUrl}/login.fcgi`, e);
      throw e;
    }
    const { data } = response;
    if (!data?.session) {
      throw new Error("O relógio respondeu ao login sem retornar uma sessão. Confira usuário/senha web.");
    }
    this.session = data.session;
    logger.info("Login no relógio Control iD realizado com sucesso.");
    return this.session;
  }

  private async ensureSession(): Promise<string> {
    if (this.session) return this.session;
    return this.login();
  }

  /**
   * Executa a chamada autenticada; se a sessão tiver expirado (401 ou erro de
   * sessão inválida), refaz o login uma vez e tenta de novo.
   */
  private async withSession<T>(fn: (session: string) => Promise<T>): Promise<T> {
    const session = await this.ensureSession();
    try {
      return await fn(session);
    } catch (e: any) {
      const status = e?.response?.status;
      const isSessionError = status === 401 || status === 403 || /session/i.test(String(e?.response?.data ?? ""));
      if (!isSessionError) throw e;
      logger.warn("Sessão do relógio expirada, reautenticando...");
      this.session = null;
      const fresh = await this.login();
      return fn(fresh);
    }
  }

  /**
   * Busca as marcações do AFD. Tenta os modos 671, sem parâmetro e 1510,
   * nessa ordem, e usa o primeiro que produzir marcações reconhecíveis —
   * igual ao importador manual, pois cada instalação/firmware responde melhor
   * a um modo diferente.
   */
  async fetchMarcacoes(): Promise<AfdMarcacao[]> {
    const variantes: { fonte: string; body: unknown }[] = [
      { fonte: "get_afd mode=671", body: { mode: "671" } },
      { fonte: "get_afd sem parâmetro", body: {} },
      { fonte: "get_afd mode=1510", body: { mode: "1510" } },
    ];

    for (const v of variantes) {
      try {
        const raw = await this.withSession(async (session) => {
          const { data } = await this.http.post(`/get_afd.fcgi?session=${session}`, v.body, {
            responseType: "text",
            transformResponse: [(d) => d],
          });
          return String(data ?? "");
        });
        const texto = extractAfdText(raw);
        const marcacoes = parseAfdMarcacoes(texto);
        logger.info(`AFD (${v.fonte}): ${marcacoes.length} marcação(ões) reconhecida(s).`);
        if (marcacoes.length > 0) return marcacoes;
      } catch (e) {
        logger.errorDetailed(`Falha ao buscar AFD no relógio (${v.fonte})`, e);
      }
    }
    return [];
  }
}
