import React, { useState } from "react";
import { addDoc, updateDoc, doc, collection } from "firebase/firestore";
import { db } from "../firebase";

export default function WeeklyTaskModal({ open, onClose, editTask, usuario }) {
  const [atividade, setAtividade] = useState(editTask?.atividade || "");
  const [responsavel, setResponsavel] = useState(
    editTask?.responsavel || usuario?.email || ""
  );
  const [prioridade, setPrioridade] = useState(editTask?.prioridade || "Média");
  const [data, setData] = useState(editTask?.data || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      atividade,
      responsavel,
      prioridade,
      data,
      status: "pendente",
      criadoEm: new Date().toISOString(),
    };
    try {
      if (editTask) {
        await updateDoc(doc(db, "weekly-tasks", editTask.id), payload);
      } else {
        await addDoc(collection(db, "weekly-tasks"), payload);
      }
      onClose();
    } catch (err) {
      alert("Erro ao salvar atividade");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-pink-600 text-xl"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-pink-700 mb-6">
          {editTask ? "Editar Atividade" : "Nova Atividade"}
        </h2>
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block mb-1 font-semibold">Atividade</label>
            <textarea
              className="w-full border rounded px-3 py-3 min-h-[80px] text-base"
              value={atividade}
              onChange={(e) => setAtividade(e.target.value)}
              required
              style={{ resize: "vertical" }}
              placeholder="Descreva a atividade..."
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block mb-1 font-semibold">Responsável</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                required
                disabled={!!editTask}
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1 font-semibold">Prioridade</label>
              <select
                className="w-full border rounded px-3 py-2"
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
            <label className="block mb-1 font-semibold">Data</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`w-full py-3 rounded-lg text-white font-bold mt-2 transition ${
              saving
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-pink-600 hover:bg-pink-700"
            }`}
          >
            {saving
              ? "Salvando..."
              : editTask
              ? "Salvar Alterações"
              : "Adicionar Atividade"}
          </button>
        </form>
      </div>
    </div>
  );
}
