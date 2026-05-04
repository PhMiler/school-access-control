import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  id: string; nome: string; email: string;
  numero_usuario: string | null;
  access_profile_id: string | null;
  ativo: boolean;
}
interface AccessProfile { id: string; nome: string; is_admin: boolean; }

const schema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  email: z.string().trim().email("Email inválido").max(255),
  numero_usuario: z.string().trim().min(1, "Número obrigatório").max(40),
  password: z.string().max(72).optional().or(z.literal("")),
  access_profile_id: z.string().uuid("Selecione um perfil"),
  ativo: z.string().optional(),
});

export default function Usuarios() {
  const { can, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = can("usuarios.create");
  const canUpdate = can("usuarios.update");
  const canDelete = can("usuarios.delete");

  const load = async () => {
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.from("profiles").select("id, nome, email, numero_usuario, access_profile_id, ativo").order("nome"),
      supabase.from("access_profiles").select("id, nome, is_admin").order("nome"),
    ]);
    setUsers((u as any) ?? []);
    setProfiles((p as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const profileName = (id: string | null) => profiles.find(p => p.id === id)?.nome ?? "—";

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (!editing && (!parsed.data.password || parsed.data.password.length < 6)) {
      toast.error("Senha mínima de 6 caracteres"); return;
    }
    setBusy(true);
    const action = editing ? "update" : "create";
    const payload: any = {
      action,
      id: editing?.id,
      nome: parsed.data.nome,
      email: parsed.data.email,
      numero_usuario: parsed.data.numero_usuario,
      access_profile_id: parsed.data.access_profile_id,
      ativo: fd.get("ativo") === "on",
      password: parsed.data.password || undefined,
    };
    const { error } = await supabase.functions.invoke("admin-users", { body: payload });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Usuário atualizado" : "Usuário cadastrado");
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.functions.invoke("admin-users", { body: { action: "delete", id } });
    if (error) return toast.error(error.message);
    toast.success("Usuário excluído");
    load();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuários do sistema</h1>
          <p className="text-muted-foreground">Gerencie os acessos da instituição</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo usuário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar usuário" : "Cadastrar usuário"}</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input name="nome" defaultValue={editing?.nome} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input name="email" type="email" defaultValue={editing?.email} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Número do usuário</Label>
                    <Input name="numero_usuario" defaultValue={editing?.numero_usuario ?? ""} required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Perfil de acesso</Label>
                  <Select name="access_profile_id" defaultValue={editing?.access_profile_id ?? ""}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{editing ? "Nova senha (opcional)" : "Senha"}</Label>
                  <Input name="password" type="password" minLength={editing ? 0 : 6} placeholder={editing ? "Deixe em branco para manter" : "Mínimo 6 caracteres"} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="ativo" defaultChecked={editing?.ativo ?? true} className="h-4 w-4" />
                  Usuário ativo
                </label>
                <DialogFooter><Button type="submit" disabled={busy}>Salvar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Lista de usuários</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Email</TableHead>
              <TableHead>Nº Usuário</TableHead><TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {users.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário</TableCell></TableRow>
              )}
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell><code className="text-xs">{u.numero_usuario ?? "—"}</code></TableCell>
                  <TableCell>{profileName(u.access_profile_id)}</TableCell>
                  <TableCell>
                    <Badge variant={u.ativo ? "default" : "secondary"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canUpdate && (
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(u); setOpen(true); }}>
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
                            <AlertDialogTitle>Excluir {u.nome}?</AlertDialogTitle>
                            <AlertDialogDescription>O usuário perderá acesso imediatamente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(u.id)} className="bg-destructive">Excluir</AlertDialogAction>
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
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Algumas ações podem estar indisponíveis conforme as permissões do seu perfil.
        </p>
      )}
    </div>
  );
}
