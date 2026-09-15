import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { syncAluno, gerarPis } from "@/lib/controlid";
import { isConfigured } from "@/lib/controlidConfig";

interface Aluno {
  id: string; nome: string; matricula: string; status: "ativo" | "inativo";
  deleted_at: string | null; pis: string | null;
  cpf: string | null; rg: string | null; genero: string | null; idade: string | null;
  telefone: string | null; email: string | null; data_nascimento: string | null;
}

interface Curso { id: string; nome: string }

/** Idade em anos completos a partir de uma data (YYYY-MM-DD). */
export function calcularIdade(dataNascimento?: string | null): number | null {
  if (!dataNascimento) return null;
  const [ano, mes, dia] = dataNascimento.slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  const aniversarioPassou =
    hoje.getMonth() + 1 > mes || (hoje.getMonth() + 1 === mes && hoje.getDate() >= dia);
  if (!aniversarioPassou) idade -= 1;
  return idade >= 0 && idade < 130 ? idade : null;
}

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo").max(120),
  status: z.enum(["ativo", "inativo"]),
  data_nascimento: z.string().trim().min(10, "Informe a data de nascimento"),
  genero: z.string().trim().min(1, "Informe o gênero").max(30),
  telefone: z.string().trim().min(8, "Informe o telefone").max(40),
  cpf: z.string().trim().max(20).optional(),
  rg: z.string().trim().max(20).optional(),
  email: z.string().trim().max(120).optional(),
});


export default function Alunos() {
  const { can } = useAuth();
  const canCreate = can("alunos.create");
  const canUpdate = can("alunos.update");
  const canDelete = can("alunos.delete");
  const [list, setList] = useState<Aluno[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [vinculos, setVinculos] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Aluno | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [nascimento, setNascimento] = useState("");

  const [naoSincronizados, setNaoSincronizados] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState<string | null>(null);

  const nomeCurso = useMemo(
    () => Object.fromEntries(cursos.map((c) => [c.id, c.nome])),
    [cursos],
  );

  /** Garante que o aluno tenha um PIS gravado na ficha (exigido pelo relógio). */
  const garantirPis = async (id: string, pis?: string | null) => {
    const atual = pis?.trim();
    if (atual) return atual;
    const novo = gerarPis();
    const { error } = await supabase.from("alunos").update({ pis: novo }).eq("id", id);
    if (error) return novo;
    setList((l) => l.map((a) => (a.id === id ? { ...a, pis: novo } : a)));
    return novo;
  };

  const sincronizar = async (aluno: { id: string; nome: string; matricula: string; pis?: string | null }, silencioso = false) => {
    if (!isConfigured()) {
      setNaoSincronizados((m) => ({ ...m, [aluno.id]: "Relógio não configurado" }));
      if (!silencioso) toast.warning("Relógio não configurado — configure em Relógio de Ponto");
      return false;
    }
    setSyncing(aluno.id);
    try {
      const pis = await garantirPis(aluno.id, aluno.pis);
      await syncAluno({ ...aluno, pis });
      setNaoSincronizados((m) => { const n = { ...m }; delete n[aluno.id]; return n; });
      toast.success(`${aluno.nome} sincronizado no relógio`);
      return true;
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao sincronizar com o relógio";
      setNaoSincronizados((m) => ({ ...m, [aluno.id]: msg }));
      toast.error(`Aluno salvo, mas não sincronizado: ${msg}`);
      return false;
    } finally {
      setSyncing(null);
    }
  };

  const load = async () => {
    const [alunosRes, cursosRes, vincRes] = await Promise.all([
      supabase.from("alunos").select("*").is("deleted_at", null).order("nome"),
      supabase.from("cursos").select("id,nome").order("nome"),
      supabase.from("aluno_cursos").select("aluno_id,curso_id"),
    ]);
    if (alunosRes.error) toast.error(alunosRes.error.message);
    else setList((alunosRes.data as any) ?? []);
    if (cursosRes.data) setCursos(cursosRes.data as any);
    if (vincRes.data) {
      const m: Record<string, string[]> = {};
      for (const v of vincRes.data as any[]) {
        (m[v.aluno_id] ??= []).push(v.curso_id);
      }
      setVinculos(m);
    }
  };
  useEffect(() => { load(); }, []);

  const abrirNovo = () => { setEditing(null); setSelecionados([]); setNascimento(""); setOpen(true); };
  const abrirEdicao = (a: Aluno) => {
    setEditing(a);
    setSelecionados(vinculos[a.id] ?? []);
    setNascimento(a.data_nascimento?.slice(0, 10) ?? "");
    setOpen(true);
  };


  const salvarCursos = async (alunoId: string) => {
    await supabase.from("aluno_cursos").delete().eq("aluno_id", alunoId);
    if (selecionados.length) {
      const { error } = await supabase.from("aluno_cursos").insert(
        selecionados.map((curso_id) => ({ aluno_id: alunoId, curso_id, data_inscricao: new Date().toISOString() })),
      );
      if (error) toast.error(`Cursos não salvos: ${error.message}`);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (!selecionados.length) { toast.error("Selecione pelo menos um curso"); return; }
    const idade = calcularIdade(parsed.data.data_nascimento);
    if (idade === null) { toast.error("Data de nascimento inválida"); return; }
    const vazio = (v?: string) => (v && v.trim() ? v.trim() : null);
    const payload = {
      nome: parsed.data.nome,
      status: parsed.data.status,
      data_nascimento: parsed.data.data_nascimento,
      genero: parsed.data.genero,
      idade: String(idade),
      telefone: parsed.data.telefone,
      cpf: vazio(parsed.data.cpf),
      rg: vazio(parsed.data.rg),
      email: vazio(parsed.data.email),
    };
    // Garante um PIS por aluno (exigido pelo firmware do relógio iDClass)
    const pis = editing?.pis || gerarPis();
    const payloadCompleto = editing?.pis ? payload : { ...payload, pis };
    let salvoId: string | null = null;
    let matriculaSalva = editing?.matricula ?? "";
    if (editing) {
      const { error } = await supabase.from("alunos").update(payloadCompleto).eq("id", editing.id);
      if (error) return toast.error(error.message);
      salvoId = editing.id;
      toast.success("Aluno atualizado");
    } else {
      const { data, error } = await supabase
        .from("alunos").insert(payloadCompleto as any).select("id,matricula").maybeSingle();
      if (error) return toast.error(error.message);
      salvoId = (data as any)?.id ?? null;
      matriculaSalva = (data as any)?.matricula ?? "";
      toast.success(`Aluno cadastrado — matrícula ${matriculaSalva}`);
    }
    if (salvoId) await salvarCursos(salvoId);
    setOpen(false); setEditing(null); setSelecionados([]); load();
    if (salvoId) {
      void sincronizar({ id: salvoId, nome: payload.nome, matricula: matriculaSalva, pis }, true);
    }
  };


  const remove = async (id: string) => {
    const { error } = await supabase.from("alunos")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Aluno excluído");
    load();
  };

  const termo = q.toLowerCase();
  const filtered = list.filter((a) => {
    const cursosDoAluno = (vinculos[a.id] ?? []).map((id) => nomeCurso[id] ?? "");
    return [a.nome, a.matricula, a.cpf ?? "", a.telefone ?? "", ...cursosDoAluno]
      .some((v) => v.toLowerCase().includes(termo));
  });

  const toggleCurso = (id: string) =>
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alunos</h1>
          <p className="text-muted-foreground">Cadastro completo da instituição</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setSelecionados([]); setNascimento(""); } }}>
            <DialogTrigger asChild>
              <Button onClick={abrirNovo}><Plus className="h-4 w-4 mr-2" />Novo aluno</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar aluno" : "Cadastrar aluno"}</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input name="nome" defaultValue={editing?.nome} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Data de nascimento</Label>
                    <Input
                      name="data_nascimento"
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      value={nascimento}
                      onChange={(e) => setNascimento(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {calcularIdade(nascimento) !== null
                        ? `${calcularIdade(nascimento)} anos`
                        : "A idade é calculada automaticamente"}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select name="status" defaultValue={editing?.status ?? "ativo"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Gênero</Label>
                    <Select name="genero" defaultValue={editing?.genero ?? ""}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Feminino">Feminino</SelectItem>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Telefone</Label>
                    <Input name="telefone" defaultValue={editing?.telefone ?? ""} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>CPF <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    <Input name="cpf" defaultValue={editing?.cpf ?? ""} />
                  </div>
                  <div className="grid gap-2">
                    <Label>RG <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    <Input name="rg" defaultValue={editing?.rg ?? ""} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Email <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Input name="email" type="email" defaultValue={editing?.email ?? ""} />
                </div>

                <div className="grid gap-2">
                  <Label>Cursos / turmas</Label>
                  <ScrollArea className="h-44 rounded-md border p-3">
                    <div className="grid sm:grid-cols-2 gap-2">
                      {cursos.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={selecionados.includes(c.id)}
                            onCheckedChange={() => toggleCurso(c.id)}
                          />
                          {c.nome}
                        </label>
                      ))}
                      {cursos.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum curso cadastrado</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
                <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, matrícula, telefone ou curso…"
              className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Cursos</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum aluno encontrado</TableCell></TableRow>
              )}
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {a.nome}
                      {naoSincronizados[a.id] && (
                        <span
                          title={`Não sincronizado no relógio: ${naoSincronizados[a.id]}`}
                          className="inline-flex items-center gap-1 text-xs text-destructive"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          não sincronizado
                        </span>
                      )}
                    </span>
                    {(() => {
                      const anos = calcularIdade(a.data_nascimento) ?? (a.idade ? Number(a.idade) : null);
                      const texto = anos !== null && !Number.isNaN(anos) ? `${anos} anos` : a.idade ?? "";
                      return texto || a.genero ? (
                        <div className="text-xs text-muted-foreground">
                          {texto}{texto && a.genero ? " · " : ""}{a.genero ?? ""}
                        </div>
                      ) : null;
                    })()}

                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{a.matricula}</code>
                    {a.pis && <div className="text-xs text-muted-foreground" title="PIS usado no relógio de ponto">PIS {a.pis}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(vinculos[a.id] ?? []).map((id) => (
                        <Badge key={id} variant="outline" className="text-xs">{nomeCurso[id]}</Badge>
                      ))}
                      {!(vinculos[a.id] ?? []).length && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.telefone ?? "—"}
                    {a.email && <div>{a.email}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === "ativo" ? "default" : "secondary"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Sincronizar com o relógio"
                      disabled={syncing === a.id}
                      onClick={() => sincronizar({ id: a.id, nome: a.nome, matricula: a.matricula, pis: a.pis })}
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing === a.id ? "animate-spin" : ""}`} />
                    </Button>
                    {canUpdate && (
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir {a.nome}?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação fará a exclusão lógica do aluno.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(a.id)} className="bg-destructive">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
