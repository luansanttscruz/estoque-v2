import React, { useState } from "react";
import { addDoc, updateDoc, doc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { X } from "lucide-react";
import showToast from "../utils/showToast";

export default function WeeklyTaskModal({ open, onClose, editTask, usuario, userCollection }) {
  const [atividade, setAtividade] = useState(editTask?.atividade || "");
  const [responsavel, setResponsavel] = useState(
    editTask?.responsavel || usuario?.email || ""
  );
  const [prioridade, setPrioridade] = useState(editTask?.prioridade || "Média");
  const [data, setData] = useState(
    editTask?.data || new Date().toISOString().split("T")[0]
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const base = {
      atividade,
      responsavel,
      prioridade,
      data,
      criadoEm: new Date().toISOString(),
    };
    try {
      if (editTask) {
        await updateDoc(doc(db, userCollection, editTask.id), {
          ...base,
          status: editTask.status || "pendente",
        });
      } else {
        await addDoc(collection(db, userCollection), {
          ...base,
          status: "pendente",
          createdBy: usuario?.uid || usuario?.email || "unknown",
          comentarios: [],
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      showToast({
        type: "error",
        message: "Erro ao salvar atividade",
        description: err?.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="modal-card w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="modal-head px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text)]">
            {editTask ? "Editar Atividade" : "Nova Atividade"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-[var(--line)] hover:bg-white/5 transition text-[var(--text)]"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-pink-300" />
          </button>
        </div>

        <div className="p-6 space-y-5 bg-[var(--bg-soft)] flex-1 min-h-0 overflow-y-auto">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block mb-1 text-sm text-[var(--text-muted)]">
                Atividade
              </label>
              <textarea
                className="input-neon w-full min-h-[110px] resize-y"
                value={atividade}
                onChange={(e) => setAtividade(e.target.value)}
                required
                placeholder="Descreva a atividade..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm text-[var(--text-muted)]">
                  Responsável
                </label>
                <input
                  className="input-neon w-full"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  required
                  disabled={!!editTask}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm text-[var(--text-muted)]">
                  Prioridade
                </label>
                <select
                  className="input-neon w-full"
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value)}
                  required
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block mb-1 text-sm text-[var(--text-muted)]">
                Data
              </label>
              <input
                type="date"
                className="input-neon w-full"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={saving} className="btn-neon">
              {saving
                ? "Salvando..."
                : editTask
                ? "Salvar Alterações"
                : "Adicionar Atividade"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
