import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, PlugZap, Download, ShieldAlert, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getControlIdConfig, saveControlIdConfig, baseUrl, type ControlIdConfig } from "@/lib/controlidConfig";
import { testConnection } from "@/lib/controlid";
import { importarBatidas } from "@/lib/controlidImport";
import { useAuth } from "@/lib/auth";

export default function Relogio() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<ControlIdConfig>(() => getControlIdConfig());
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const set = (patch: Partial<ControlIdConfig>) => setCfg((c) => ({ ...c, ...patch }));

  const salvar = () => {
    saveControlIdConfig(cfg);
    toast.success("Configurações do relógio salvas neste computador");
  };

  const testar = async () => {
    saveControlIdConfig(cfg);
    setTesting(true);
    setStatus(null);
    try {
      const session = await testConnection(cfg);
      setStatus({ ok: true, msg: `Conectado. Chave de sessão recebida (${session.slice(0, 8)}…).` });
      toast.success("Relógio conectado com sucesso");
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message ?? "Falha ao conectar." });
      toast.error("Não foi possível conectar ao relógio");
    } finally {
      setTesting(false);
    }
  };

  const importar = async () => {
    saveControlIdConfig(cfg);
    setImporting(true);
    try {
      const r = await importarBatidas(user!.id);
      if (r.lidas === 0) {
        if (r.linhasRecebidas > 0) {
          toast.warning(
            `O relógio devolveu ${r.linhasRecebidas} linha(s), mas nenhuma batida foi reconhecida. Veja os detalhes no console (F12).`,
          );
        } else {
          toast.info("O relógio respondeu sem nenhuma marcação registrada.");
        }
      } else {
        toast.success(`${r.importadas} batida(s) importada(s) · ${r.ignoradas} já existia(m)`);
      }
      if (r.invalidas > 0) toast.warning(`${r.invalidas} batida(s) de matrícula desconhecida ou inativa`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao importar batidas");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Relógio de Ponto</h1>
        <p className="text-muted-foreground">Conexão com o equipamento Control iD na rede local</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Credenciais do equipamento
          </CardTitle>
          <CardDescription>
            Ficam salvas apenas neste computador, que é quem conversa com o relógio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Protocolo</Label>
              <Select value={cfg.protocolo} onValueChange={(v) => set({ protocolo: v as "https" | "http" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="https">https</SelectItem>
                  <SelectItem value="http">http</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>IP do relógio</Label>
              <Input value={cfg.ip} onChange={(e) => set({ ip: e.target.value })} placeholder="192.168.1.45" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Login</Label>
              <Input value={cfg.login} onChange={(e) => set({ login: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Senha</Label>
              <Input type="password" value={cfg.senha} onChange={(e) => set({ senha: e.target.value })} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={testar} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlugZap className="h-4 w-4 mr-2" />}
              Testar conexão
            </Button>
            <Button variant="secondary" onClick={salvar}>Salvar</Button>
            <Button variant="outline" onClick={importar} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Importar batidas
            </Button>
          </div>

          {status && (
            <div className={`rounded-lg p-3 text-sm ${status.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              {status.msg}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Se a conexão falhar por causa do certificado</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            O navegador não permite ignorar o certificado autoassinado do relógio por código. Abra o endereço do
            equipamento uma vez, aceite o aviso de segurança e volte para cá.
          </p>
          <a
            href={baseUrl(cfg)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline"
          >
            Abrir {baseUrl(cfg)} <ExternalLink className="h-3 w-3" />
          </a>
          <p>Se o equipamento também aceitar <Badge variant="secondary">http</Badge>, troque o protocolo acima e nenhum certificado é necessário.</p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
