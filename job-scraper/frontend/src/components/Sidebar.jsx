import { NavLink } from "react-router-dom";
import { LayoutDashboard, Briefcase, Send, Settings, Rocket } from "lucide-react";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/vagas", icon: Briefcase, label: "Vagas" },
  { to: "/candidaturas", icon: Send, label: "Candidaturas" },
  { to: "/configuracoes", icon: Settings, label: "Configuracoes" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-[var(--color-bg-card)] border-r border-[var(--color-border)] flex flex-col">
      <div className="p-6 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <Rocket className="w-8 h-8 text-[var(--color-primary)]" />
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">JobHunter</h1>
            <p className="text-xs text-[var(--color-text-muted)]">Automacao de Vagas</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Design | Motion | Video
        </p>
      </div>
    </aside>
  );
}
