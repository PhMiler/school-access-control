import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, LogIn, LogOut, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Acesso {
  id: string; tipo: "entrada" | "saida"; metodo: string; status: string;
  created_at: string; matricula_tentada: string | null;
  alunos: { nome: string; matricula: string } | null;
}

export default function Dashboard() {
  const [presentes, setPresentes] = useState(0);
  const [entradasHoje, setEntradasHoje] = useState(0);
  const [invalidasHoje, setInvalidasHoje] = useState(0);
  const [ultimos, setUltimos] = useState<Acesso[]>([]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("dash-acessos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "acessos" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const load = async () => {
    const startDay = new Date(); startDay.setHours(0, 0, 0, 0);
    const { data: ult } = await supabase
      .from("acessos")
      .select("id, tipo, metodo, status, created_at, matricula_tentada, alunos(nome, matricula)")
      .order("created_at", { ascending: false }).limit(10);
    setUltimos((ult as any) ?? []);

    const { data: hoje } = await supabase
      .from("acessos").select("tipo,status,aluno_id,created_at")
      .gte("created_at", startDay.toISOString());
    const arr = hoje ?? [];
    setEntradasHoje(arr.filter(a => a.tipo === "entrada" && a.status === "valido").length);
    setInvalidasHoje(arr.filter(a => a.status === "invalido").length);

    // presentes = alunos com última leitura = entrada hoje
    const map = new Map<string, string>();
    [...arr].sort((a, b) => a.created_at.localeCompare(b.created_at))
      .forEach(a => { if (a.aluno_id) map.set(a.aluno_id, a.tipo); });
    setPresentes([...map.values()].filter(t => t === "entrada").length);
  };

  const stats = [
    { label: "Alunos presentes", value: presentes, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Entradas hoje", value: entradasHoje, icon: LogIn, color: "text-success", bg: "bg-success/10" },
    { label: "Tentativas inválidas", value: invalidasHoje, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do controle de acesso institucional</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
                <div className="text-3xl font-bold mt-1">{s.value}</div>
              </div>
              <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${s.bg}`}>
                <s.icon className={`h-6 w-6 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Últimas movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          {ultimos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
          <ul className="divide-y">
            {ultimos.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${a.tipo === "entrada" ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
                    {a.tipo === "entrada" ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.alunos?.nome ?? `Matrícula: ${a.matricula_tentada ?? "—"}`}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.alunos?.matricula ?? "—"} · {a.metodo} · {format(new Date(a.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
                <Badge variant={a.status === "valido" ? "default" : "destructive"}>
                  {a.status === "valido" ? "Válido" : "Inválido"}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
