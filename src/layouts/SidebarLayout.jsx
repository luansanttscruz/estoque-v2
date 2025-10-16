// src/layouts/SidebarLayout.jsx
import { Outlet } from "react-router-dom";
import Menu from "../components/Menu";

export default function SidebarLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="grid grid-cols-[260px_1fr]">
        <aside className="min-h-screen border-r border-[var(--line)] bg-[var(--bg-soft)]">
          <Menu />
        </aside>
        <main className="min-h-screen p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
