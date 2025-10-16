import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { motion } from "framer-motion";

const OFFICES = [
  {
    nome: "São Paulo",
    path: "/equipment-movement/sp",
    subtitle: "Movimentações de equipamentos",
  },
  {
    nome: "Rio de Janeiro",
    path: "/equipment-movement/rio",
    subtitle: "Movimentações de equipamentos",
  },
  {
    nome: "João Pessoa",
    path: "/equipment-movement/jp",
    subtitle: "Movimentações de equipamentos",
  },
];

export default function EquipmentMovement() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-center gap-2 text-[var(--text)] text-3xl font-bold mb-8">
        <span className="text-[var(--accent)] drop-shadow">
          Equipment Movement
        </span>
        <Building2 className="w-8 h-8 text-pink-400" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {OFFICES.map((office, i) => (
          <motion.div
            key={office.nome}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={{ scale: 1.02 }}
            className="group relative rounded-2xl border border-[var(--line)] bg-[var(--bg-card)]
                       hover:border-[var(--accent)] transition-all duration-200 shadow-xl"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition
                         shadow-[0_0_24px_0_rgba(225,29,116,0.25),0_0_60px_0_rgba(225,29,116,0.18)]"
            />

            <Link
              to={office.path}
              className="relative flex items-center gap-4 p-6"
            >
              <div
                className="bg-pink-100/10 ring-1 ring-pink-500/30 text-pink-300 p-3 rounded-full
                            group-hover:ring-pink-500/60 transition"
              >
                <Building2 className="w-6 h-6" />
              </div>

              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-[var(--text)]">
                  {office.nome}
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {office.subtitle}
                </p>
              </div>

              <div className="ml-auto w-2 h-2 rounded-full bg-pink-400/70 group-hover:bg-pink-400" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
