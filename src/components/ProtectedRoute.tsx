import { Navigate } from "react-router-dom";
import { useAuth, PermissionKey } from "@/lib/auth";
import { Loader2 } from "lucide-react";

interface Props {
  children: JSX.Element;
  /** Required permissions (any of them grants access). Admin always passes. */
  permissions?: PermissionKey[];
  /** Require admin profile. */
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, permissions, adminOnly }: Props) {
  const { user, loading, isAdmin, can, profile } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (profile && !profile.ativo) return <Navigate to="/auth" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (permissions && permissions.length > 0 && !can(...permissions))
    return <Navigate to="/dashboard" replace />;
  return children;
}
