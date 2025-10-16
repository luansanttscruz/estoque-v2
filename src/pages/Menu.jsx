// src/pages/Menu.jsx  (PÁGINA DE CARDS)
import { Link } from "react-router-dom";
import { Laptop, FileText, Truck, ListChecks, Settings } from "lucide-react";
import { motion } from "framer-motion";

const cards = [
  {
    to: "/inventory",
    title: "Notebook Stock",
    subtitle: "Manage the notebooks",
    Icon: Laptop,
  },
  {
    to: "/onboarding",
    title: "Onboarding Nacional",
    subtitle: "National Shipping",
    Icon: FileText,
  },
  {
    to: "/weekly-tasks",
    title: "Weekly Tasks",
    subtitle: "Weekly team tasks",
    Icon: ListChecks, // ou ClipboardList
  },
  {
    to: "/equipment-movement",
    title: "Equipment Movement",
    subtitle: "Manage movements",
    Icon: Truck,
  },
];

export default function Menu() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-center gap-2 mb-8">
        <h1 className="text-3xl font-semibold text-[var(--text)] drop-shadow">
          Menu Principal
        </h1>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ to, title, subtitle, Icon }, index) => (
          <motion.div
            key={to}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="group relative rounded-2xl border border-[var(--line)] bg-[var(--bg-card)]
                       hover:border-[var(--accent)]/60 transition duration-200 shadow-lg"
          >
            <span
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition
                         shadow-[0_0_24px_0_rgba(225,29,116,0.25),0_0_60px_0_rgba(225,29,116,0.15)]"
            />
            <Link to={to} className="relative flex items-center gap-4 p-6">
              <div
                className="bg-[var(--accent)]/15 text-[var(--accent)] p-3 rounded-full
                           border border-[var(--accent)]/30 group-hover:border-[var(--accent)]/60 transition"
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  {title}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <Settings className="w-5 h-5 text-[var(--accent)]" />
            <span>
              Personalize escritórios, acessos e aparência em{" "}
              <span className="text-[var(--accent)] font-semibold">
                Configurações
              </span>
              .
            </span>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent)]/60 px-4 py-2 text-sm font-medium
                       bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
          >
            Abrir Configurações
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
