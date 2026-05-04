import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PermissionKey =
  | "dashboard.view"
  | "usuarios.view" | "usuarios.create" | "usuarios.update" | "usuarios.delete"
  | "perfis.manage"
  | "alunos.view" | "alunos.create" | "alunos.update" | "alunos.delete"
  | "relatorios.view"
  | "acesso.registrar";

interface ProfileRow {
  id: string;
  nome: string;
  email: string;
  numero_usuario: string | null;
  ativo: boolean;
  access_profile_id: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: ProfileRow | null;
  permissions: PermissionKey[];
  isAdmin: boolean;
  loading: boolean;
  can: (...keys: PermissionKey[]) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadContext = async (uid: string) => {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, nome, email, numero_usuario, ativo, access_profile_id")
      .eq("id", uid)
      .maybeSingle();
    setProfile(prof as ProfileRow | null);

    let admin = false;
    if (prof?.access_profile_id) {
      const { data: ap } = await supabase
        .from("access_profiles")
        .select("is_admin")
        .eq("id", prof.access_profile_id)
        .maybeSingle();
      admin = !!ap?.is_admin;
    }
    setIsAdmin(admin);

    const { data: perms } = await supabase.rpc("current_user_permissions");
    setPermissions((perms as PermissionKey[]) ?? []);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadContext(s.user.id), 0);
      } else {
        setProfile(null); setPermissions([]); setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadContext(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user, session, profile, permissions, isAdmin, loading,
    can: (...keys) => isAdmin || keys.some((k) => permissions.includes(k)),
    signOut: async () => { await supabase.auth.signOut(); },
    refresh: async () => { if (user) await loadContext(user.id); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
