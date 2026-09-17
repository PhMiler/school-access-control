import { ControlIdClient } from "./controlIdClient";
import { AcessosSync } from "./acessosSync";
import { loadWatermark, saveWatermark } from "./nsrStore";
import { logger } from "./logger";

/** Margem de segurança ao reconsultar o Supabase: o AFD tem resolução de minuto, não de segundo. */
const MARGEM_SEGURANCA_MS = 5 * 60 * 1000;

export class Collector {
  private readonly client = new ControlIdClient();

  /** Executa uma rodada: busca o AFD inteiro, filtra o que é novo, mapeia por PIS e grava no Supabase. */
  async runOnce(): Promise<void> {
    const watermark = await loadWatermark();
    const todasMarcacoes = await this.client.fetchMarcacoes();
    if (todasMarcacoes.length === 0) return;

    // O AFD sempre devolve o histórico inteiro do relógio; só olhamos a partir
    // de um pouco antes da marca d'água, para não reprocessar tudo a cada ciclo.
    const desde = new Date(Math.max(0, watermark * 1000 - MARGEM_SEGURANCA_MS));
    const novas = todasMarcacoes.filter((m) => m.time * 1000 >= desde.getTime());
    if (novas.length === 0) return;

    logger.info(`${novas.length} marcação(ões) a partir de ${desde.toISOString()} (marca d'água anterior: ${new Date(watermark * 1000).toISOString()}).`);

    const sync = new AcessosSync();
    await sync.carregarAlunos(novas.map((m) => m.pis));
    await sync.carregarExistentes(desde);

    let maiorTempoProcessado = watermark;
    let gravadas = 0;
    let ignoradas = 0;
    for (const marcacao of novas) {
      try {
        const gravou = await sync.registrarBatida({ pis: marcacao.pis, ts: new Date(marcacao.time * 1000) });
        if (gravou) gravadas++;
        else ignoradas++;
      } catch (e: any) {
        // Interrompe o lote aqui: na próxima rodada tentamos de novo a partir daqui,
        // então nenhuma batida é perdida (o pior caso é reprocessar a mesma batida depois).
        logger.errorDetailed(`Falha ao gravar a batida do PIS ${marcacao.pis} (${new Date(marcacao.time * 1000).toISOString()}), retomando dela na próxima rodada.`, e);
        break;
      }
      maiorTempoProcessado = Math.max(maiorTempoProcessado, marcacao.time);
    }

    if (gravadas > 0 || ignoradas > 0) {
      logger.info(`Ciclo concluído: ${gravadas} nova(s) gravada(s), ${ignoradas} já existente(s) ignorada(s).`);
    }
    if (maiorTempoProcessado !== watermark) {
      await saveWatermark(maiorTempoProcessado);
    }
  }
}
