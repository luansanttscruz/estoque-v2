import { NavLink } from "react-router-dom";
import {
  Home,
  Laptop,
  FileText,
  Truck,
  ListChecks,
  Settings,
  KeyRound,
  Download,
  Building2,
} from "lucide-react";

export default function SideMenu({ collapsed = false }) {
  const principal = [
    { to: "/", label: "Início", icon: Home },
    { to: "/inventory", label: "Notebook Stock", icon: Laptop },
    { to: "/onboarding", label: "Onboarding", icon: FileText },
    { to: "/docs", label: "Documentation", icon: FileText },
    { to: "/weekly-tasks", label: "Weekly Tasks", icon: ListChecks },
    { to: "/equipment-movement", label: "Equipment Movement", icon: Truck },
  ];

  const offices = [
    { to: "/sp", label: "São Paulo", icon: Building2 },
    { to: "/rio", label: "Rio de Janeiro", icon: Building2 },
    { to: "/jp", label: "João Pessoa", icon: Building2 },
    { to: "/ou", label: "Outros", icon: Building2 },
  ];

  const extras = [
    { to: "/licenses", label: "Licenças", icon: KeyRound },
    { to: "/downloads", label: "Downloads", icon: Download },
    { to: "/settings", label: "Configurações", icon: Settings },
  ];

  const Item = ({ to, label, Icon }) => (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      end
      className={({ isActive }) =>
        [
          "group flex items-center gap-3 mx-2 rounded-xl border transition-colors",
          "border-transparent text-[var(--text)] hover:bg-white/[.04]",
          collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
          isActive
            ? "bg-[var(--accent-weak)]/40 border-[var(--accent-weak)] text-white"
            : "",
        ].join(" ")
      }
    >
      <Icon className="w-5 h-5 text-pink-400 shrink-0" />
      {!collapsed && (
        <span className="text-[15px] font-medium truncate">{label}</span>
      )}
    </NavLink>
  );

  return (
    <nav className="py-4">
      {/* Principal */}
      <div
        className={[
          "px-4 pb-2 text-xs tracking-wide text-[var(--text-muted)] select-none transition-opacity",
          collapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100",
        ].join(" ")}
      >
        PRINCIPAL
      </div>
      <ul className="space-y-1 mb-3">
        {principal.map((it) => (
          <li key={it.to}>
            <Item to={it.to} label={it.label} Icon={it.icon} />
          </li>
        ))}
      </ul>

      {/* Offices */}
      <div
        className={[
          "px-4 pb-2 text-xs tracking-wide text-[var(--text-muted)] select-none transition-opacity",
          collapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100",
        ].join(" ")}
      >
        OFFICES
      </div>
      <ul className="space-y-1 mb-3">
        {offices.map((it) => (
          <li key={it.to}>
            <Item to={it.to} label={it.label} Icon={it.icon} />
          </li>
        ))}
      </ul>

      {/* Extras */}
      <div
        className={[
          "px-4 pb-2 text-xs tracking-wide text-[var(--text-muted)] select-none transition-opacity",
          collapsed ? "opacity-0 h-0 overflow-hidden" : "opacity-100",
        ].join(" ")}
      >
        OUTROS
      </div>
      <ul className="space-y-1">
        {extras.map((it) => (
          <li key={it.to}>
            <Item to={it.to} label={it.label} Icon={it.icon} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
