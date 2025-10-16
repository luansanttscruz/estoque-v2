// src/components/SidebarLink.jsx
import { NavLink } from "react-router-dom";

/**
 * Componente de link para o menu lateral com estado ativo bem visível.
 * - Fundo preenchido (accent-weak) quando ativo
 * - Anel/ring rosa forte
 * - Ícone com “pill” e mesma cor de destaque
 */
export default function SidebarLink({ to, icon: Icon, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          "group flex items-center gap-3 w-full select-none",
          "rounded-2xl px-3 py-3 text-[15px] font-medium transition-colors",
          "text-[var(--text)]/85 hover:text-[var(--text)] hover:bg-white/5",
          isActive &&
            "bg-[var(--accent-weak)] text-white ring-2 ring-[var(--accent)] " +
              "shadow-[0_0_0_3px_rgba(225,29,116,.12)_inset]",
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      <span className={({ isActive }) => (isActive ? "" : "")}>
        {/* ícone em um “pill” */}
      </span>

      <span
        className={[
          "inline-flex items-center justify-center rounded-xl border",
          "border-[var(--line)] bg-white/5 p-2 transition-colors",
          "shrink-0",
        ].join(" ")}
        style={{
          color: "var(--accent)",
          borderColor: "color-mix(in oklab, var(--accent) 35%, var(--line))",
          background: "color-mix(in oklab, var(--accent) 18%, transparent)",
        }}
      >
        {Icon ? <Icon className="w-5 h-5" /> : null}
      </span>

      <span className="truncate">{children}</span>
    </NavLink>
  );
}
