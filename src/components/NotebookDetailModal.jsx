// src/components/NotebookDetailModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { X, Mail, Info, CheckCircle2, XCircle, Cpu, Hash } from "lucide-react";
import { db } from "../firebase";
import { getTime, resolveAvailability } from "../utils/availability";

function Badge({ ok, children }) {
  const isUnknown = ok == null;
  const Icon = isUnknown ? Info : ok ? CheckCircle2 : XCircle;
  const badgeClass = isUnknown
    ? "bg-slate-500/15 text-slate-300"
    : ok
    ? "bg-green-500/15 text-green-400"
    : "bg-red-500/15 text-red-400";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        badgeClass,
      ].join(" ")}
    >
      <Icon className="w-3.5 h-3.5" />
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

const normalizeSerial = (value) =>
  (value || "").toString().trim().toUpperCase();

const normalizeOffice = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

const officeToSlug = (value) => {
  const normalized = normalizeOffice(value);
  if (normalized === "sao paulo") return "sp";
  if (normalized === "rio de janeiro") return "rio";
  if (normalized === "joao pessoa") return "jp";
  return null;
};

export default function NotebookDetailModal({
  open,
  onClose,
  notebook = {},
  onEdit, // opcional
  office,
}) {
  const navigate = useNavigate();
  const [lastMovement, setLastMovement] = useState(null);
  const [movementLoading, setMovementLoading] = useState(false);

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

  useEffect(() => {
    const serialValue = normalizeSerial(serial);
    if (!open || !serialValue) {
      setLastMovement(null);
      return undefined;
    }

    let active = true;
    setMovementLoading(true);

    const fetchMovements = async () => {
      try {
        const movementQuery = query(
          collection(db, "equipment-movements"),
          where("numeroSerie", "==", serialValue)
        );
        const snap = await getDocs(movementQuery);
        const events = [];

        snap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const historico = Array.isArray(data.historico) ? data.historico : [];

          if (historico.length) {
            historico.forEach((entry) => {
              if (!entry) return;
              events.push({
                ...entry,
                registradoEm:
                  entry.registradoEm || entry.criadoEm || data.criadoEm,
                local: entry.local || data.local,
                responsavel: entry.responsavel || data.responsavel,
                tipo: entry.tipo || data.tipo,
                status: entry.status || data.status,
                disponibilidade:
                  entry.disponibilidade || data.disponibilidade,
              });
            });
          } else {
            events.push({
              data: data.data,
              tipo: data.tipo,
              local: data.local,
              responsavel: data.responsavel,
              status: data.status,
              disponibilidade: data.disponibilidade,
              registradoEm: data.criadoEm,
            });
          }
        });

        const latest = events
          .sort((a, b) => getTime(b.registradoEm) - getTime(a.registradoEm))
          .find(Boolean);

        if (active) {
          setLastMovement(latest || null);
        }
      } catch (error) {
        console.error("Erro ao carregar última movimentação:", error);
        if (active) {
          setLastMovement(null);
        }
      } finally {
        if (active) {
          setMovementLoading(false);
        }
      }
    };

    fetchMovements();
    return () => {
      active = false;
    };
  }, [open, serial]);

  const movementLink = useMemo(() => {
    const serialValue = normalizeSerial(serial);
    const officeValue = lastMovement?.local || office;
    if (!serialValue || !officeValue) return null;
    const slug = officeToSlug(officeValue);
    if (!slug) return null;
    return `/equipment-movement/${slug}?serial=${encodeURIComponent(
      serialValue
    )}`;
  }, [lastMovement?.local, office, serial]);

  const movementResumo = lastMovement
    ? [
        lastMovement.tipo,
        lastMovement.disponibilidade || lastMovement.status,
        lastMovement.local || office,
      ]
        .filter(Boolean)
        .join(" • ")
    : null;

  const availability = useMemo(() => {
    const stockTime = getTime(updatedAt || createdAt);
    const movementTime = getTime(lastMovement?.registradoEm);
    return resolveAvailability({
      stockStatus: status,
      stockTime,
      movementStatus: lastMovement?.disponibilidade,
      movementTime,
    });
  }, [status, updatedAt, createdAt, lastMovement]);

  const availabilityLabel = availability?.label || status || "—";
  const availabilityOk = availability?.ok;

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

          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg border border-transparent text-[var(--text-muted)]
                       hover:text-white hover:bg-white/5 hover:border-[var(--line)] transition"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
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
                <Badge ok={availabilityOk}>{availabilityLabel}</Badge>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4">
              <div className="text-xs text-[var(--text-muted)] mb-1">E-mail</div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="truncate">{email || "—"}</span>
              </div>
            </div>
          </div>

          {/* Observação / Movimentação */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-semibold flex items-center gap-2">
                <Info className="w-4 h-4 text-[var(--accent)]" />
                Observação
              </div>
              <p className="text-sm mt-2 text-[var(--text)] whitespace-pre-wrap">
                {observacao || "—"}
              </p>
            </div>

            <div
              className={[
                "rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4 transition",
                movementLink ? "hover:border-[var(--accent)] cursor-pointer" : "",
              ].join(" ")}
              onClick={() => {
                if (!movementLink) return;
                onClose?.();
                navigate(movementLink);
              }}
              role={movementLink ? "button" : undefined}
              tabIndex={movementLink ? 0 : undefined}
              onKeyDown={(event) => {
                if (!movementLink) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onClose?.();
                  navigate(movementLink);
                }
              }}
            >
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[var(--accent)]" />
                Movimentação
              </div>
              {movementLoading ? (
                <p className="text-sm mt-2 text-[var(--text-muted)]">
                  Carregando última movimentação...
                </p>
              ) : lastMovement ? (
                <div className="mt-2 space-y-1 text-sm text-[var(--text)]">
                  <div className="font-semibold">{movementResumo || "—"}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {fmt(lastMovement.registradoEm)}
                  </div>
                  {lastMovement.responsavel && (
                    <div className="text-xs text-[var(--text-muted)]">
                      Responsável:{" "}
                      <span className="text-[var(--text)]">
                        {lastMovement.responsavel}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm mt-2 text-[var(--text)] whitespace-pre-wrap">
                  {movimentacao || "Nenhuma movimentação registrada."}
                </p>
              )}
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
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)]
                       hover:bg-white/5 transition"
          >
            Fechar
          </button>
          {typeof onEdit === "function" && (
            <button
              onClick={() => onEdit(notebook)}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-white
                         bg-[var(--accent)] hover:brightness-105 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
