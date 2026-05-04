import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, GraduationCap, ScanLine, BarChart3, HelpCircle, ShieldCheck } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: null as null },
  { title: "Controle de Acesso", url: "/controle-acesso", icon: ScanLine, roles: null },
  { title: "Alunos", url: "/alunos", icon: GraduationCap, roles: null },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3, roles: null },
  { title: "Usuários", url: "/usuarios", icon: Users, roles: ["admin"] as string[] },
  { title: "Perfis de Acesso", url: "/perfis", icon: ShieldCheck, roles: ["admin"] as string[] },
  { title: "Ajuda", url: "/ajuda", icon: HelpCircle, roles: null },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { roles, signOut, user } = useAuth();

  const visible = items.filter((i) => !i.roles || i.roles.some((r) => roles.includes(r as any)));

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
            <div className="truncate font-medium">{user.email}</div>
            <div className="text-sidebar-foreground/60 capitalize">{roles.join(", ") || "sem papel"}</div>
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
