import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Alunos from "./pages/Alunos";
import ControleAcesso from "./pages/ControleAcesso";
import Relatorios from "./pages/Relatorios";
import Usuarios from "./pages/Usuarios";
import Perfis from "./pages/Perfis";
import Ajuda from "./pages/Ajuda";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/alunos" element={<Alunos />} />
              <Route path="/controle-acesso" element={<ControleAcesso />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/ajuda" element={<Ajuda />} />
              <Route path="/usuarios" element={<ProtectedRoute roles={["admin"]}><Usuarios /></ProtectedRoute>} />
              <Route path="/perfis" element={<ProtectedRoute roles={["admin"]}><Perfis /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
