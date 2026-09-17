/**
 * Parser do arquivo AFD (portado de src/lib/controlid.ts, mesma lógica usada
 * com sucesso no importador manual do app, para o mesmo hardware).
 */
export interface AfdMarcacao {
  /** Unix timestamp (segundos). */
  time: number;
  /** PIS/CPF gravado na marcação. */
  pis: string;
}

/** Extrai o texto do AFD da resposta do relógio (texto puro ou embrulhado em JSON). */
export function extractAfdText(raw: string): string {
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
 * Interpreta as marcações do arquivo AFD, aceitando os dois layouts usados
 * pelos REPs:
 *  - legado (1510): "3" + NSR(9) + data ddmmaaaa(8) + hora HHMM(4) + PIS(12)
 *  - Portaria 671:  NSR(9) + "3" + aaaa-mm-ddTHH:MM:SS±hhmm + CPF/PIS(11-12)
 * A hora sem fuso é tratada como hora local do computador.
 */
export function parseAfdMarcacoes(text: string): AfdMarcacao[] {
  const logs: AfdMarcacao[] = [];
  for (const linha of text.split(/\r?\n/)) {
    const l = linha.replace(/\s+$/, "");
    if (l.length < 20) continue;

    if (l.length >= 34 && l.charAt(9) === "3") {
      const dia = +l.substring(10, 12);
      const mes = +l.substring(12, 14);
      const ano = +l.substring(14, 18);
      const h = +l.substring(18, 20);
      const m = +l.substring(20, 22);
      const pis = l.substring(22, 34).replace(/\D/g, "").slice(-11);
      if (!dia || !mes || !ano || Number.isNaN(h) || Number.isNaN(m) || !pis) continue;
      const ts = new Date(ano, mes - 1, dia, h, m);
      if (Number.isNaN(ts.getTime())) continue;
      logs.push({ time: Math.floor(ts.getTime() / 1000), pis });
      continue;
    }

    const iso = l.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (iso && (l[9] === "3" || l[0] === "3")) {
      const ts = new Date(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5], +(iso[6] ?? 0));
      if (Number.isNaN(ts.getTime())) continue;
      const resto = l.slice((iso.index ?? 0) + iso[0].length);
      const ident = resto.match(/\d{11,12}/);
      if (!ident) continue;
      logs.push({ time: Math.floor(ts.getTime() / 1000), pis: ident[0].replace(/\D/g, "").slice(-11) });
      continue;
    }

    if (l.length < 34 || l[0] !== "3") continue;
    const dia = +l.slice(10, 12);
    const mes = +l.slice(12, 14);
    const ano = +l.slice(14, 18);
    const h = +l.slice(18, 20);
    const m = +l.slice(20, 22);
    const pis = l.slice(22, 34).replace(/\D/g, "").slice(-11);
    if (!dia || !mes || !ano || Number.isNaN(h) || Number.isNaN(m) || !pis) continue;
    const ts = new Date(ano, mes - 1, dia, h, m);
    if (Number.isNaN(ts.getTime())) continue;
    logs.push({ time: Math.floor(ts.getTime() / 1000), pis });
  }
  logs.sort((a, b) => a.time - b.time);
  return logs;
}
