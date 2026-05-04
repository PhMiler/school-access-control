import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { AppRole } from "@/lib/auth";

const ALL_ROLES: AppRole[] = ["admin", "diretor", "gestor", "rh", "professor"];

interface Profile { id: string; nome: string; email: string; }

export default function Usuarios() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, AppRole[]>>({});

  const load = async () => {
    const { data: profs } = await supabase.from("profiles").select("id, nome, email").order("nome");
    setUsers(profs ?? []);
    const { data: ur } = await supabase.from("user_roles").select("user_id, role");
    const map: Record<string, AppRole[]> = {};
    (ur ?? []).forEach((r: any) => { (map[r.user_id] ??= []).push(r.role); });
    setRolesMap(map);
  };
  useEffect(() => { load(); }, []);

  const toggleRole = async (uid: string, role: AppRole, checked: boolean) => {
    if (checked) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
      if (error) return toast.error(error.message);
    }
    toast.success("Permissões atualizadas");
    load();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Usuários do sistema</h1>
        <p className="text-muted-foreground">Gerencie os perfis de acesso de cada usuário</p>
      </div>
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Lista de usuários</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Email</TableHead>
              {ALL_ROLES.map(r => <TableHead key={r} className="text-center capitalize">{r}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  {ALL_ROLES.map(r => {
                    const has = rolesMap[u.id]?.includes(r) ?? false;
                    return (
                      <TableCell key={r} className="text-center">
                        <Checkbox checked={has} onCheckedChange={(v) => toggleRole(u.id, r, !!v)} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
