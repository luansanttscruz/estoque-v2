import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { KeyRound, Laptop, PlusCircle, Trash2, Copy, Hash } from "lucide-react";
import { db } from "../firebase";
import showToast from "../utils/showToast";

const COLLECTION_NAME = "licenses-machines";

export default function LicensesPage() {
  const [form, setForm] = useState({ machine: "", serial: "", recoveryKey: "" });
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const licensesRef = collection(db, COLLECTION_NAME);
    const q = query(licensesRef, orderBy("machine", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar licenças:", error);
        showToast({
          type: "error",
          message: "Não foi possível carregar as licenças.",
        });
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    const lower = filter.trim().toLowerCase();
    if (!lower) return items;
    return items.filter(
      (item) =>
        item.machine?.toLowerCase().includes(lower) ||
        item.serial?.toLowerCase().includes(lower) ||
        item.recoveryKey?.toLowerCase().includes(lower)
    );
  }, [items, filter]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const machine = form.machine.trim();
    const serial = form.serial.trim();
    const recoveryKey = form.recoveryKey.trim();

    if (!machine || !serial || !recoveryKey) {
      showToast({
        type: "error",
        message: "Informe máquina, serial e a recovery key.",
      });
      return;
    }

    try {
      await addDoc(collection(db, COLLECTION_NAME), {
        machine,
        serial,
        recoveryKey,
        createdAt: new Date(),
      });

      showToast({
        type: "success",
        message: "Licença cadastrada com sucesso.",
      });
      setForm({ machine: "", serial: "", recoveryKey: "" });
    } catch (error) {
      console.error("Erro ao salvar licença:", error);
      showToast({
        type: "error",
        message: "Erro ao salvar licença.",
        description: error?.message,
      });
    }
  };

  const handleDelete = async (item) => {
    if (!item?.id) return;
    const confirmed =
      typeof window !== "undefined"
        ? window.confirm(
            `Deseja remover a máquina "${item.machine}" e sua recovery key?`
          )
        : true;
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, COLLECTION_NAME, item.id));
      showToast({
        type: "success",
        message: "Cadastro removido.",
      });
    } catch (error) {
      console.error("Erro ao remover licença:", error);
      showToast({
        type: "error",
        message: "Não foi possível remover o registro.",
        description: error?.message,
      });
    }
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast({
        type: "success",
        message: "Copiado para a área de transferência.",
      });
    } catch {
      showToast({
        type: "error",
        message: "Não foi possível copiar.",
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
            <KeyRound className="w-4 h-4 text-[var(--accent)]" />
            Licenças
          </div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">
            Gestão de Recovery Keys
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Cadastre cada máquina com sua respectiva recovery key para manter o
            controle centralizado.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg">
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 px-6 py-5 md:grid-cols-[2fr,1.5fr,1.5fr,auto]"
        >
          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            Máquina
            <input
              value={form.machine}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  machine: event.target.value,
                }))
              }
              placeholder="Ex.: MacBook - João Silva"
              className="input-neon"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            Serial
            <input
              value={form.serial}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  serial: event.target.value,
                }))
              }
              placeholder="Ex.: C02YD0ABC123"
              className="input-neon"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            Recovery key
            <input
              value={form.recoveryKey}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  recoveryKey: event.target.value,
                }))
              }
              placeholder="Ex.: XXXX-XXXX-XXXX-XXXX"
              className="input-neon"
              required
            />
          </label>

          <button
            type="submit"
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-4 py-2 font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
          >
            <PlusCircle className="w-5 h-5" />
            Salvar
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Laptop className="w-4 h-4 text-[var(--accent)]" />
            <span>
              {loading
                ? "Carregando..."
                : `${filteredItems.length} máquina${
                    filteredItems.length === 1 ? "" : "s"
                  } cadastrada${filteredItems.length === 1 ? "" : "s"}`}
            </span>
          </div>

          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Buscar por máquina ou recovery key"
            className="input-neon max-w-sm"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-soft)]">
          <table className="min-w-full divide-y divide-[var(--line)]">
            <thead className="bg-[var(--bg-card)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Máquina</th>
                <th className="px-4 py-3">Serial</th>
                <th className="px-4 py-3">Recovery Key</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-sm">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-[var(--text-muted)]"
                  >
                    Carregando registros...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-[var(--text-muted)]"
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-[var(--text)]">
                      {item.machine || "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">
                      <span className="font-mono text-sm">
                        {item.serial || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">
                      <span className="font-mono text-sm">
                        {item.recoveryKey || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.serial)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-white/5"
                        >
                          <Hash className="w-4 h-4" />
                          Copiar serial
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.recoveryKey)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-white/5"
                        >
                          <Copy className="w-4 h-4" />
                          Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
