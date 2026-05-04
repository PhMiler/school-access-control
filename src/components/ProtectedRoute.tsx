import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children, roles }: { children: JSX.Element; roles?: AppRole[] }) {
  const { user, loading, hasRole } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to="/dashboard" replace />;
  return children;
}
