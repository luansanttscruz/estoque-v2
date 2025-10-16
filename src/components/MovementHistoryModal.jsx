import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  X,
  ArrowUp,
  ArrowDown,
  Calendar,
  MapPin,
  User,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const formatDate = (value, withTime = false) => {
  try {
    if (!value) return "—";
    if (typeof value?.toDate === "function") {
      return withTime
        ? value.toDate().toLocaleString("pt-BR")
        : value.toDate().toLocaleDateString("pt-BR");
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return withTime
      ? date.toLocaleString("pt-BR")
      : date.toLocaleDateString("pt-BR");
  } catch {
    return String(value ?? "—");
  }
};

export default function MovementHistoryModal({ open, onClose, numeroSerie }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (!numeroSerie) {
      setMovements([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "equipment-movements"),
      where("numeroSerie", "==", numeroSerie),
      orderBy("criadoEm", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setMovements(
          snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [open, numeroSerie]);

  const timeline = useMemo(() => {
    const events = [];
    const pushEntry = (entry, fallbackDoc) => {
      if (!entry) return;
      const timeSource = entry.registradoEm || entry.criadoEm || fallbackDoc?.criadoEm;
      const sanitized = { ...entry };
      delete sanitized.historico;
      events.push({
        ...sanitized,
        numeroSerie: sanitized.numeroSerie || fallbackDoc?.numeroSerie || numeroSerie,
        registradoEm: timeSource,
        _originId: fallbackDoc?.id,
      });
    };

    movements.forEach((mov) => {
      const historicoEntries = Array.isArray(mov.historico)
        ? mov.historico
        : [];
      if (historicoEntries.length) {
        historicoEntries.forEach((item) => pushEntry(item, mov));
      } else {
        pushEntry(
          {
            data: mov.data,
            tipo: mov.tipo,
            modelo: mov.modelo,
            numeroSerie: mov.numeroSerie,
            responsavel: mov.responsavel,
            local: mov.local,
            obs: mov.obs,
            status: mov.status,
            disponibilidade: mov.disponibilidade,
            email: mov.email,
            registradoEm: mov.criadoEm,
          },
          mov
        );
      }
    });

    const getTime = (value) =>
      typeof value?.toMillis === "function"
        ? value.toMillis()
        : typeof value?.toDate === "function"
        ? value.toDate().getTime()
        : value
        ? new Date(value).getTime()
        : 0;

    return events.sort((a, b) => getTime(b.registradoEm) - getTime(a.registradoEm));
  }, [movements, numeroSerie]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[120] p-4"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
          className="modal-card w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          <div className="modal-head px-6 py-4 flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-[var(--text)]">
                Histórico de Movimentações
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Nº de Série:{" "}
                <span className="font-mono text-[var(--accent)]">
                  {numeroSerie}
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-[var(--line)] hover:bg-white/5 transition text-[var(--text)]"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5 bg-[var(--bg-soft)] max-h-[calc(90vh-120px)] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] gap-3">
                <FileText className="w-12 h-12 text-[var(--text-muted)]/60" />
                <p>Nenhuma movimentação encontrada para este número de série.</p>
              </div>
            ) : (
              <div className="relative pl-6">
                <span className="absolute left-1 top-3 bottom-3 w-px bg-[var(--accent)]/30" />
                <div className="space-y-4">
                  {timeline.map((mov, index) => {
                    const isEntrada = mov.tipo === "Entrada";
                    const isDisponivel =
                      (mov.disponibilidade || "")
                        .toLowerCase()
                        .includes("dispon");
                    return (
                      <motion.div
                        key={(mov._originId || mov.id || index) + index}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="relative flex gap-4"
                      >
                        <div
                          className={[
                            "mt-1 flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center",
                            isEntrada
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                              : "bg-rose-500/15 border-rose-500/40 text-rose-300",
                          ].join(" ")}
                        >
                          {isEntrada ? (
                            <ArrowUp className="w-5 h-5" />
                          ) : (
                            <ArrowDown className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-4 space-y-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={[
                                  "px-3 py-1 rounded-full text-xs font-semibold",
                                  isEntrada
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-rose-500/15 text-rose-300",
                                ].join(" ")}
                              >
                                {mov.tipo || "Movimentação"}
                              </span>
                              <span
                                className={[
                                  "px-3 py-1 rounded-full text-xs font-semibold",
                                  mov.status === "Finalizado"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-amber-500/15 text-amber-300",
                                ].join(" ")}
                              >
                                {mov.status || "Pendente"}
                              </span>
                              <span
                                className={[
                                  "px-3 py-1 rounded-full text-xs font-semibold",
                                  isDisponivel
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-rose-500/15 text-rose-300",
                                ].join(" ")}
                              >
                                {mov.disponibilidade || "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                              <Calendar className="w-4 h-4" />
                              {formatDate(mov.data || mov.criadoEm, false)}
                              <span className="text-[var(--text-muted)]/70">
                                • {formatDate(mov.registradoEm || mov.criadoEm, true)}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[var(--text)]">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <strong className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                                  Modelo
                                </strong>
                                <span>{mov.modelo || "—"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                                <span>{mov.local || "—"}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-[var(--text-muted)]" />
                                <span>{mov.responsavel || "—"}</span>
                              </div>
                              {mov.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                                  <span>{mov.email}</span>
                                </div>
                              )}
                              {mov.usuario && (
                                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                  <span>registrado por</span>
                                  <span className="text-[var(--text)]">
                                    {mov.usuario}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {mov.obs && (
                            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2 text-xs text-[var(--text)] flex items-start gap-2">
                              <FileText className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                                  Observação
                                </span>
                                <p className="mt-1 leading-relaxed">{mov.obs}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[var(--line)] bg-[var(--bg-card)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">
              Total de registros: {timeline.length}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)]
                         hover:bg-white/5 transition"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
