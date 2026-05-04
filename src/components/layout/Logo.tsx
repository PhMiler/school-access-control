import { GraduationCap } from "lucide-react";

export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const text = variant === "light" ? "text-sidebar-foreground" : "text-primary";
  const subtitle = variant === "light" ? "text-sidebar-foreground/70" : "text-muted-foreground";
  const iconBg = variant === "light" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "gradient-primary text-primary-foreground";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg} shadow-elegant`}>
        <GraduationCap className="h-6 w-6" strokeWidth={2.2} />
      </div>
      <div className="leading-tight">
        <div className={`font-bold text-base ${text}`}>EduAcesso</div>
        <div className={`text-[10px] uppercase tracking-wider ${subtitle}`}>Controle Institucional</div>
      </div>
    </div>
  );
}
