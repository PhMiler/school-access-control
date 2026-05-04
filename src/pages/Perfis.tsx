import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Perm { key: string; label: string; categoria: string; }
interface AP { id: string; nome: string; descricao: string | null; is_system: boolean; is_admin: boolean; }

const schema = z.object({
  nome: z.string().trim().min(2).max(80),
  descricao: z.string().trim().max(255).optional().or(z.literal("")),
});

export default function Perfis() {
  const { isAdmin } = useAuth();
  const [perms, setPerms] = useState<Perm[]>([]);
  const [profiles, setProfiles] = useState<AP[]>([]);
  const [profilePerms, setProfilePerms] = useState<Record<string, Set<string>>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AP | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    const [{ data: pms }, { data: aps }, { data: pp }] = await Promise.all([
      supabase.from("permissions").select("*").order("categoria").order("label"),
      supabase.from("access_profiles").select("*").order("nome"),
      supabase.from("profile_permissions").select("profile_id, permission_key"),
    ]);
    setPerms((pms as any) ?? []);
    setProfiles((aps as any) ?? []);
    const map: Record<string, Set<string>> = {};
    (pp ?? []).forEach((r: any) => {
      (map[r.profile_id] ??= new Set()).add(r.permission_key);
    });
    setProfilePerms(map);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null); setSelected(new Set()); setOpen(true);
  };
  const openEdit = (p: AP) => {
    setEditing(p);
    setSelected(new Set(profilePerms[p.id] ?? []));
    setOpen(true);
  };

  const togglePerm = (k: string, v: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      v ? next.add(k) : next.delete(k);
      return next;
    });
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ nome: fd.get("nome"), descricao: fd.get("descricao") ?? "" });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }

    let profileId = editing?.id;
    if (!editing) {
      const { data, error } = await supabase
        .from("access_profiles")
        .insert({ nome: parsed.data.nome, descricao: parsed.data.descricao || null })
        .select("id").single();
      if (error) return toast.error(error.message);
      profileId = data.id;
    } else {
      const { error } = await supabase.from("access_profiles")
        .update({ nome: parsed.data.nome, descricao: parsed.data.descricao || null })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    }

    // Sync permissions
    const current = profilePerms[profileId!] ?? new Set();
    const toAdd = [...selected].filter(k => !current.has(k));
    const toRm = [...current].filter(k => !selected.has(k));
    if (toAdd.length) {
      const { error } = await supabase.from("profile_permissions")
        .insert(toAdd.map(k => ({ profile_id: profileId!, permission_key: k })));
      if (error) return toast.error(error.message);
    }
    if (toRm.length) {
      const { error } = await supabase.from("profile_permissions")
        .delete().eq("profile_id", profileId!).in("permission_key", toRm);
      if (error) return toast.error(error.message);
    }
    toast.success("Perfil salvo");
    setOpen(false); setEditing(null); load();
  };

  const removeProfile = async (p: AP) => {
    const { error } = await supabase.from("access_profiles").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil excluído");
    load();
  };

  // Group permissions by category
  const grouped = perms.reduce<Record<string, Perm[]>>((acc, p) => {
    (acc[p.categoria] ??= []).push(p); return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Perfis de Acesso</h1>
          <p className="text-muted-foreground">Configure quais permissões cada perfil possui</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo perfil</Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {profiles.map(p => (
          <Card key={p.id} className="shadow-card">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${p.is_admin ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {p.nome}
                    {p.is_system && <Badge variant="secondary" className="text-xs">Sistema</Badge>}
                    {p.is_admin && <Badge variant="destructive" className="text-xs">Admin</Badge>}
                  </CardTitle>
                  {p.descricao && <p className="text-xs text-muted-foreground mt-1">{p.descricao}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} disabled={p.is_admin}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!p.is_system && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir perfil {p.nome}?</AlertDialogTitle>
                          <AlertDialogDescription>Usuários atribuídos a este perfil ficarão sem perfil.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeProfile(p)} className="bg-destructive">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {p.is_admin ? (
                  <Badge>Todas as permissões</Badge>
                ) : (profilePerms[p.id]?.size ?? 0) === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhuma permissão atribuída</span>
                ) : (
                  perms.filter(pm => profilePerms[p.id]?.has(pm.key)).map(pm => (
                    <Badge key={pm.key} variant="secondary" className="text-xs">{pm.label}</Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar perfil" : "Novo perfil"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input name="nome" defaultValue={editing?.nome} required />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input name="descricao" defaultValue={editing?.descricao ?? ""} />
            </div>
            <div className="space-y-3">
              <Label>Permissões</Label>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="rounded-md border p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">{cat}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map(p => (
                      <label key={p.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected.has(p.key)}
                          onCheckedChange={(v) => togglePerm(p.key, !!v)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter><Button type="submit">Salvar perfil</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
