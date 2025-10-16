// src/components/NotebookDetailModal.jsx
import React from "react";
import { X, Pencil, Mail, Info, CheckCircle2, XCircle, Cpu, Hash } from "lucide-react";

function Badge({ ok, children }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold " +
        (ok ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")
      }
    >
      {ok ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <XCircle className="w-3.5 h-3.5" />
      )}
      {children}
    </span>
  );
}

const fmt = (d) => {
  try {
    if (!d) return "—";
    if (typeof d?.toDate === "function")
      return d.toDate().toLocaleString("pt-BR");
    if (typeof d === "string") return new Date(d).toLocaleString("pt-BR");
    return String(d);
  } catch {
    return "—";
  }
};

export default function NotebookDetailModal({
  open,
  onClose,
  notebook = {},
  onEdit, // opcional
  onDelete,
  deleting = false,
}) {
  if (!open) return null;

  const {
    modelo,
    serial,
    status,
    email,
    observacao,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    movimentacao, // se existir
  } = notebook || {};

  const isDisponivel = (status || "")
    .toString()
    .toLowerCase()
    .includes("dispon");

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl modal-card overflow-hidden">
        {/* Header */}
        <div className="modal-head px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">
              {modelo || "Notebook"}
            </h2>
            <p className="text-[var(--text-muted)] text-xs mt-1 flex items-center gap-2">
              <Hash className="w-4 h-4" />
              <span className="truncate">
                Serial:{" "}
                <span className="text-[var(--accent)]">{serial || "—"}</span>
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {typeof onEdit === "function" && (
              <button
                onClick={() => onEdit(notebook)}
                className="px-3 py-2 rounded-lg border border-[var(--line)] text-[var(--text)]
                           hover:bg-white/5 transition"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-transparent text-[var(--text-muted)]
                         hover:text-white hover:bg-white/5 hover:border-[var(--line)] transition"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Linha de status e email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4">
              <div className="text-xs text-[var(--text-muted)] mb-1">
                Status
              </div>
              <div className="flex items-center gap-2">
                <Badge ok={isDisponivel}>
                  {isDisponivel ? "Disponível" : status || "Indisponível"}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4">
              <div className="text-xs text-[var(--text-muted)] mb-1">Email</div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="truncate">{email || "—"}</span>
              </div>
            </div>
          </div>

          {/* Observação / Movimentação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-semibold flex items-center gap-2">
                <Info className="w-4 h-4 text-[var(--accent)]" />
                Observação
              </div>
              <p className="text-sm mt-2 text-[var(--text)]">
                {observacao || "—"}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[var(--accent)]" />
                Movimentação
              </div>
              <p className="text-sm mt-2 text-[var(--text)]">
                {movimentacao || "—"}
              </p>
            </div>
          </div>

          {/* Metadados */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4 text-xs text-[var(--text-muted)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <span className="font-semibold text-[var(--text)]">
                  Criado em:
                </span>{" "}
                {fmt(createdAt)}{" "}
                <span className="ml-2">
                  por:{" "}
                  <span className="text-[var(--text)]">{createdBy || "—"}</span>
                </span>
              </div>
              <div>
                <span className="font-semibold text-[var(--text)]">
                  Atualizado em:
                </span>{" "}
                {fmt(updatedAt)}{" "}
                <span className="ml-2">
                  por:{" "}
                  <span className="text-[var(--text)]">{updatedBy || "—"}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--line)] bg-[var(--bg-soft)]/60 flex justify-end gap-2">
          <div className="flex items-center gap-2">
            {typeof onDelete === "function" && (
              <button
                onClick={() => onDelete(notebook)}
                className="px-4 py-2 rounded-lg border border-rose-500/40 text-rose-300
                           hover:bg-rose-500/15 transition disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={deleting}
              >
                Excluir
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)]
                         hover:bg-white/5 transition"
            >
              Fechar
            </button>
          </div>
          {typeof onEdit === "function" && (
            <button
              onClick={() => onEdit(notebook)}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-white
                         bg-[var(--accent)] hover:brightness-105 transition disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={deleting}
            >
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
