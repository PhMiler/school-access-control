import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, GraduationCap, ScanLine, BarChart3, HelpCircle, ShieldCheck, LogOut } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useAuth, PermissionKey } from "@/lib/auth";
import { Button } from "@/components/ui/button";

interface Item {
  title: string;
  url: string;
  icon: any;
  permission?: PermissionKey;
  adminOnly?: boolean;
}

const items: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { title: "Controle de Acesso", url: "/controle-acesso", icon: ScanLine, permission: "acesso.registrar" },
  { title: "Alunos", url: "/alunos", icon: GraduationCap, permission: "alunos.view" },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, permission: "relatorios.view" },
  { title: "Usuários", url: "/usuarios", icon: Users, permission: "usuarios.view" },
  { title: "Perfis de Acesso", url: "/perfis", icon: ShieldCheck, permission: "perfis.manage" },
  { title: "Ajuda", url: "/ajuda", icon: HelpCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut, user, profile, can, isAdmin } = useAuth();

  const visible = items.filter((i) => {
    if (!i.permission && !i.adminOnly) return true;
    if (i.adminOnly) return isAdmin;
    return can(i.permission!);
  });

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-3 py-4">
        {!collapsed ? <Logo variant="light" /> : (
          <div className="flex justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && user && (
          <div className="mb-2 rounded-md bg-sidebar-accent/40 px-3 py-2 text-xs text-sidebar-foreground/90">
            <div className="truncate font-medium">{profile?.nome ?? user.email}</div>
            <div className="text-sidebar-foreground/60">{isAdmin ? "Administrador" : "Usuário"}</div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
