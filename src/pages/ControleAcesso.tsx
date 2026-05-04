import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fingerprint, KeyRound, LogIn, LogOut, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type Tipo = "entrada" | "saida";

export default function ControleAcesso() {
  const { user } = useAuth();
  const [matricula, setMatricula] = useState("");
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [busy, setBusy] = useState(false);
  const [recentes, setRecentes] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; nome?: string; matricula?: string } | null>(null);

  const load = async () => {
    const { data } = await supabase.from("acessos")
      .select("id, tipo, metodo, status, created_at, matricula_tentada, alunos(nome, matricula)")
      .order("created_at", { ascending: false }).limit(8);
    setRecentes(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const registrar = async (metodo: "biometria" | "manual", matriculaInput: string) => {
    if (!matriculaInput.trim()) { toast.error("Informe a matrícula"); return; }
    setBusy(true);
    const { data: aluno } = await supabase.from("alunos")
      .select("id, nome, matricula, status")
      .eq("matricula", matriculaInput.trim()).is("deleted_at", null).maybeSingle();

    const valido = !!aluno && aluno.status === "ativo";
    const { error } = await supabase.from("acessos").insert({
      aluno_id: aluno?.id ?? null,
      matricula_tentada: matriculaInput.trim(),
      tipo, metodo, status: valido ? "valido" : "invalido",
      registrado_por: user!.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setFeedback({ ok: valido, nome: aluno?.nome, matricula: matriculaInput });
    if (valido) toast.success(`${tipo === "entrada" ? "Entrada" : "Saída"} registrada: ${aluno!.nome}`);
    else toast.error("Acesso inválido — matrícula não encontrada ou inativa");
    setMatricula("");
    load();
    setTimeout(() => setFeedback(null), 4000);
  };

  const simulateBiometria = async () => {
    // simula leitura: usa o último aluno cadastrado para demo
    const { data } = await supabase.from("alunos").select("matricula").is("deleted_at", null).limit(20);
    if (!data || data.length === 0) { toast.error("Nenhum aluno cadastrado para simular"); return; }
    const random = data[Math.floor(Math.random() * data.length)].matricula;
    await registrar("biometria", random);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Controle de Acesso</h1>
        <p className="text-muted-foreground">Registre entradas e saídas em tempo real</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tabs value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <TabsList>
                  <TabsTrigger value="entrada"><LogIn className="h-4 w-4 mr-1" />Entrada</TabsTrigger>
                  <TabsTrigger value="saida"><LogOut className="h-4 w-4 mr-1" />Saída</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="manual"><KeyRound className="h-4 w-4 mr-2" />Código manual</TabsTrigger>
                <TabsTrigger value="biometria"><Fingerprint className="h-4 w-4 mr-2" />Biometria</TabsTrigger>
              </TabsList>
              <TabsContent value="manual" className="mt-4 space-y-3">
                <Input
                  placeholder="Digite a matrícula do aluno"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && registrar("manual", matricula)}
                  autoFocus
                />
                <Button className="w-full" disabled={busy} onClick={() => registrar("manual", matricula)}>
                  Registrar {tipo === "entrada" ? "entrada" : "saída"}
                </Button>
              </TabsContent>
              <TabsContent value="biometria" className="mt-4">
                <div className="flex flex-col items-center gap-4 py-6 rounded-lg border-2 border-dashed">
                  <button
                    onClick={simulateBiometria}
                    disabled={busy}
                    className="h-24 w-24 rounded-full gradient-primary flex items-center justify-center shadow-elegant hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    <Fingerprint className="h-12 w-12 text-primary-foreground" />
                  </button>
                  <p className="text-sm text-muted-foreground">Toque para simular leitura biométrica</p>
                </div>
              </TabsContent>
            </Tabs>

            {feedback && (
              <div className={`mt-4 rounded-lg p-4 flex items-center gap-3 ${feedback.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {feedback.ok ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                <div>
                  <div className="font-semibold">{feedback.ok ? "Acesso válido" : "Acesso inválido"}</div>
                  <div className="text-sm opacity-90">
                    {feedback.ok ? `${feedback.nome} (${feedback.matricula})` : `Matrícula: ${feedback.matricula}`}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Registros recentes</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-auto">
            {recentes.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
            {recentes.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm border-b last:border-0 pb-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.alunos?.nome ?? r.matricula_tentada}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.tipo} · {format(new Date(r.created_at), "HH:mm")}
                  </div>
                </div>
                <Badge variant={r.status === "valido" ? "default" : "destructive"} className="text-[10px]">
                  {r.status === "valido" ? "OK" : "X"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
