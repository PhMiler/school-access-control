export interface ControlIdConfig {
  protocolo: "https" | "http";
  ip: string;
  login: string;
  senha: string;
}

const KEY = "controlid.config";

export const defaultConfig: ControlIdConfig = {
  protocolo: "https",
  ip: "192.168.1.45",
  login: "admin",
  senha: "admin",
};

export function getControlIdConfig(): ControlIdConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultConfig };
    const parsed = JSON.parse(raw) as Partial<ControlIdConfig>;
    return { ...defaultConfig, ...parsed };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveControlIdConfig(cfg: ControlIdConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function isConfigured(cfg = getControlIdConfig()) {
  return !!cfg.ip && !!cfg.login;
}

export function baseUrl(cfg = getControlIdConfig()) {
  return `${cfg.protocolo}://${cfg.ip}`;
}
