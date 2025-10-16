import { useEffect, useState } from "react";
import { updateDoc, doc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { X, Save, CheckCircle2, XCircle } from "lucide-react";
import showToast from "../utils/showToast";

const DEFAULT_STATUSES = [
  { id: "disponivel", label: "Disponível" },
  { id: "indisponivel", label: "Indisponível" },
];

function StatusBadge({ value }) {
  const ok =
    (value || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") === "disponivel";
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
        ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
      ].join(" ")}
    >
      <Icon className="w-3.5 h-3.5" />
      {ok ? "Disponível" : "Indisponível"}
    </span>
  );
}

export default function NotebookEditModal({
  open,
  onClose,
  notebook,
  collectionName,
}) {
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [form, setForm] = useState(() => ({
    modelo: notebook?.modelo || "",
    status: notebook?.status || DEFAULT_STATUSES[0].label,
    email: notebook?.email || "",
    observacao: notebook?.observacao || notebook?.obs || "",
    serial: notebook?.serial || "",
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const settingsRef = doc(db, "appSettings", "global");
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const data = snapshot.data() || {};
        const remoteStatuses = Array.isArray(data?.inventory?.statuses)
          ? data.inventory.statuses
              .map((item) => {
                if (typeof item === "string") {
                  const label = item.trim();
                  if (!label) return null;
                  const normalizedId = label
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/\p{Diacritic}/gu, "")
                    .replace(/\s+/g, "-");
                  return { id: normalizedId || label, label };
                }
                const label = (item?.label || item?.nome || "").trim();
                if (!label) return null;
                return {
                  id:
                    item?.id ||
                    label
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/\p{Diacritic}/gu, "")
                      .replace(/\s+/g, "-"),
                  label,
                  system: Boolean(item?.system),
                };
              })
              .filter(Boolean)
          : [];

        if (remoteStatuses.length) {
          setStatuses(remoteStatuses);
        } else {
          setStatuses(DEFAULT_STATUSES);
        }
      },
      (error) => {
        console.error("Não foi possível carregar status configurados:", error);
        setStatuses(DEFAULT_STATUSES);
      }
    );

    return () => unsubscribe();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setForm({
      modelo: notebook?.modelo || "",
      status:
        notebook?.status ||
        statuses.find((st) => st.label === "Disponível")?.label ||
        statuses[0]?.label ||
        "",
      email: notebook?.email || "",
      observacao: notebook?.observacao || notebook?.obs || "",
      serial: notebook?.serial || "",
    });
  }, [open, notebook, statuses]);

  if (!open || !notebook?.id) return null;

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      modelo: form.modelo.trim(),
      status: form.status,
      email: form.email.trim(),
      observacao: form.observacao.trim(),
      serial: form.serial.trim(),
      updatedAt: serverTimestamp(),
    };

    if (!payload.modelo) {
      showToast({
        type: "error",
        message: "Informe o modelo do notebook.",
        duration: 3000,
      });
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, collectionName, notebook.id), payload);
      showToast({
        type: "success",
        message: "Notebook atualizado com sucesso.",
      });
      onClose?.();
    } catch (err) {
      console.error(err);
      showToast({
        type: "error",
        message: "Não foi possível atualizar notebook.",
        description: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl modal-card overflow-hidden">
        <div className="modal-head px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text)]">
              Editar Notebook
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Serial atual:{" "}
              <span className="font-mono text-[var(--accent)]">
                {notebook.serial || "—"}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-transparent text-[var(--text-muted)]
                       hover:text-white hover:bg-white/5 hover:border-[var(--line)] transition"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 bg-[var(--bg-soft)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
              Modelo
              <input
                value={form.modelo}
                onChange={(e) => handleChange("modelo", e.target.value)}
                className="input-neon"
                placeholder="Modelo do notebook"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
              Serial
              <input
                value={form.serial}
                onChange={(e) => handleChange("serial", e.target.value)}
                className="input-neon"
                placeholder="Número de série"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
              Status
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="input-neon"
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.label}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
              Status atual
              <div className="input-neon flex items-center h-11">
                <StatusBadge value={form.status} />
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
              E-mail associado
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="input-neon"
                placeholder="email@empresa.com"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)] md:col-span-2">
              Observação
              <textarea
                value={form.observacao}
                onChange={(e) => handleChange("observacao", e.target.value)}
                className="input-neon min-h-[90px]"
                placeholder="Complementos, histórico, localização..."
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)]
                         hover:bg-white/5 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--accent)]/60
                         bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
