import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";

interface Row {
  id: string; created_at: string; tipo: string; metodo: string; status: string;
  matricula_tentada: string | null;
  alunos: { nome: string; matricula: string; curso: string } | null;
}

export default function Relatorios() {
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState(() => format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [aluno, setAluno] = useState("");
  const [curso, setCurso] = useState("todos");
  const [cursos, setCursos] = useState<string[]>([]);

  const load = async () => {
    const start = new Date(from); start.setHours(0, 0, 0, 0);
    const end = new Date(to); end.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("acessos")
      .select("id, created_at, tipo, metodo, status, matricula_tentada, alunos(nome, matricula, curso)")
      .gte("created_at", start.toISOString()).lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  };
  useEffect(() => { load(); }, [from, to]);

  useEffect(() => {
    supabase.from("alunos").select("curso").is("deleted_at", null).then(({ data }) => {
      setCursos([...new Set((data ?? []).map((d: any) => d.curso))]);
    });
  }, []);

  const filtered = useMemo(() => rows.filter(r => {
    const matchAluno = !aluno || r.alunos?.nome.toLowerCase().includes(aluno.toLowerCase()) || r.alunos?.matricula.includes(aluno);
    const matchCurso = curso === "todos" || r.alunos?.curso === curso;
    return matchAluno && matchCurso;
  }), [rows, aluno, curso]);

  const metrics = useMemo(() => ({
    total: filtered.length,
    validas: filtered.filter(r => r.status === "valido").length,
    invalidas: filtered.filter(r => r.status === "invalido").length,
    entradas: filtered.filter(r => r.tipo === "entrada").length,
  }), [filtered]);

  const exportCSV = () => {
    const header = ["Data", "Aluno", "Matrícula", "Curso", "Tipo", "Método", "Status"];
    const lines = filtered.map(r => [
      format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
      r.alunos?.nome ?? "—",
      r.alunos?.matricula ?? r.matricula_tentada ?? "",
      r.alunos?.curso ?? "—",
      r.tipo, r.metodo, r.status,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio-acessos-${from}-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const rowsHtml = filtered.map(r => `<tr>
      <td>${format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</td>
      <td>${r.alunos?.nome ?? "—"}</td>
      <td>${r.alunos?.matricula ?? r.matricula_tentada ?? ""}</td>
      <td>${r.alunos?.curso ?? "—"}</td>
      <td>${r.tipo}</td><td>${r.metodo}</td><td>${r.status}</td>
    </tr>`).join("");
    w.document.write(`<html><head><title>Relatório de Acessos</title>
      <style>body{font-family:Arial;padding:24px}h1{color:#1e40af}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#1e40af;color:#fff}.meta{margin-bottom:16px;color:#555}</style>
      </head><body>
      <h1>Relatório de Acessos</h1>
      <div class="meta">Período: ${from} a ${to} · Total: ${metrics.total} · Válidas: ${metrics.validas} · Inválidas: ${metrics.invalidas}</div>
      <table><thead><tr><th>Data</th><th>Aluno</th><th>Matrícula</th><th>Curso</th><th>Tipo</th><th>Método</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Frequência e tentativas inválidas com filtros</p>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4 grid gap-3 md:grid-cols-5">
          <div><Label>De</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>Aluno</Label><Input placeholder="Nome ou matrícula" value={aluno} onChange={e => setAluno(e.target.value)} /></div>
          <div>
            <Label>Curso</Label>
            <Select value={curso} onValueChange={setCurso}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {cursos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button onClick={exportPDF}><FileText className="h-4 w-4 mr-2" />PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { l: "Total registros", v: metrics.total, c: "text-primary" },
          { l: "Válidas", v: metrics.validas, c: "text-success" },
          { l: "Inválidas", v: metrics.invalidas, c: "text-destructive" },
          { l: "Entradas", v: metrics.entradas, c: "text-primary" },
        ].map(m => (
          <Card key={m.l} className="shadow-card"><CardContent className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{m.l}</div>
            <div className={`text-2xl font-bold ${m.c}`}>{m.v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Registros</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data/Hora</TableHead><TableHead>Aluno</TableHead><TableHead>Matrícula</TableHead>
              <TableHead>Curso</TableHead><TableHead>Tipo</TableHead><TableHead>Método</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem registros no período</TableCell></TableRow>}
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.created_at), "dd/MM HH:mm")}</TableCell>
                  <TableCell>{r.alunos?.nome ?? "—"}</TableCell>
                  <TableCell><code className="text-xs">{r.alunos?.matricula ?? r.matricula_tentada}</code></TableCell>
                  <TableCell>{r.alunos?.curso ?? "—"}</TableCell>
                  <TableCell className="capitalize">{r.tipo}</TableCell>
                  <TableCell className="capitalize">{r.metodo}</TableCell>
                  <TableCell><Badge variant={r.status === "valido" ? "default" : "destructive"}>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
