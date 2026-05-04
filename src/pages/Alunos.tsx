import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface Aluno {
  id: string; nome: string; matricula: string; curso: string; turma: string;
  status: "ativo" | "inativo"; deleted_at: string | null;
}

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  matricula: z.string().trim().min(2).max(50),
  curso: z.string().trim().min(1).max(80),
  turma: z.string().trim().min(1).max(40),
  status: z.enum(["ativo", "inativo"]),
});

export default function Alunos() {
  const { can } = useAuth();
  const canCreate = can("alunos.create");
  const canUpdate = can("alunos.update");
  const canDelete = can("alunos.delete");
  const [list, setList] = useState<Aluno[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Aluno | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("alunos").select("*").is("deleted_at", null).order("nome");
    if (error) toast.error(error.message); else setList((data as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const payload = {
      nome: parsed.data.nome!,
      matricula: parsed.data.matricula!,
      curso: parsed.data.curso!,
      turma: parsed.data.turma!,
      status: parsed.data.status!,
    };
    if (editing) {
      const { error } = await supabase.from("alunos").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Aluno atualizado");
    } else {
      const { error } = await supabase.from("alunos").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Aluno cadastrado");
    }
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("alunos")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Aluno excluído");
    load();
  };

  const filtered = list.filter(a =>
    [a.nome, a.matricula, a.curso, a.turma].some(v => v.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alunos</h1>
          <p className="text-muted-foreground">Cadastro completo da instituição</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo aluno</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar aluno" : "Cadastrar aluno"}</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input name="nome" defaultValue={editing?.nome} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Matrícula</Label>
                    <Input name="matricula" defaultValue={editing?.matricula} required />
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
                    <Label>Curso</Label>
                    <Input name="curso" defaultValue={editing?.curso} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Turma</Label>
                    <Input name="turma" defaultValue={editing?.turma} required />
                  </div>
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
            <Input placeholder="Buscar por nome, matrícula, curso ou turma…"
              className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Turma</TableHead>
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
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell><code className="text-xs">{a.matricula}</code></TableCell>
                  <TableCell>{a.curso}</TableCell>
                  <TableCell>{a.turma}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "ativo" ? "default" : "secondary"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canUpdate && (
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpen(true); }}>
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
