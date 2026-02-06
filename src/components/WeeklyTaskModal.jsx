import React, { useEffect, useMemo, useState } from "react";
import { addDoc, updateDoc, doc, collection } from "firebase/firestore";
import { db } from "../firebase";

export default function WeeklyTaskModal({
  open,
  onClose,
  editTask,
  usuario,
  users = [],
  canEditTask = true,
  canEditAssignees = true,
}) {
  const MAX_VISIBLE_USERS = 6;
  const [atividade, setAtividade] = useState(editTask?.atividade || "");
  const [responsavel, setResponsavel] = useState("");
  const [prioridade, setPrioridade] = useState(editTask?.prioridade || "Média");
  const [data, setData] = useState(editTask?.data || "");
  const [assignees, setAssignees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);

  const orderedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        String(a.nome || a.email || "").localeCompare(
          String(b.nome || b.email || ""),
          "pt-BR",
          { sensitivity: "base" }
        )
      ),
    [users]
  );

  const buildAssignee = (user) => ({
    uid: user.id,
    email: user.email || "",
    nome: user.nome || user.email || "",
    photoURL: user.photoURL || "",
  });

  const renderAvatar = (user) => {
    const label = user.nome || user.email || "Usuário";
    return (
      <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold flex items-center justify-center relative overflow-hidden">
        <span>{label.slice(0, 2).toUpperCase()}</span>
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </div>
    );
  };

  useEffect(() => {
    if (!open) return;
    setAtividade(editTask?.atividade || "");
    setPrioridade(editTask?.prioridade || "Média");
    setData(editTask?.data || "");
    setShowAllUsers(false);

    const existing = Array.isArray(editTask?.assignees)
      ? editTask.assignees
      : [];

    let nextAssignees = existing;
    if (!nextAssignees.length && editTask?.responsavel) {
      const match = orderedUsers.find(
        (user) =>
          String(user.email || "").toLowerCase() ===
          String(editTask.responsavel).toLowerCase()
      );
      if (match) {
        nextAssignees = [buildAssignee(match)];
      }
    }
    if (!nextAssignees.length && usuario?.email) {
      const match = orderedUsers.find(
        (user) =>
          String(user.email || "").toLowerCase() ===
          String(usuario.email).toLowerCase()
      );
      nextAssignees = match ? [buildAssignee(match)] : [];
    }
    setAssignees(nextAssignees);

    const primaryEmail =
      editTask?.responsavel ||
      nextAssignees[0]?.email ||
      usuario?.email ||
      "";
    setResponsavel(primaryEmail);
  }, [open, editTask, orderedUsers, usuario?.email]);

  const toggleAssignee = (user) => {
    if (!canEditAssignees) return;
    setAssignees((prev) => {
      const exists = prev.some((item) => item.uid === user.id);
      if (exists) {
        return prev.filter((item) => item.uid !== user.id);
      }
      return [...prev, buildAssignee(user)];
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEditTask && !canEditAssignees) return;
    setSaving(true);
    let nextAssignees = assignees;
    if (responsavel) {
      const match = orderedUsers.find(
        (user) =>
          String(user.email || "").toLowerCase() ===
          String(responsavel).toLowerCase()
      );
      if (match && !nextAssignees.some((item) => item.uid === match.id)) {
        nextAssignees = [...nextAssignees, buildAssignee(match)];
      }
    }
    const payload = canEditTask
      ? {
          atividade,
          responsavel: responsavel || usuario?.email || "",
          prioridade,
          data,
          status: editTask?.status || "pendente",
          criadoEm: new Date().toISOString(),
          assignees: nextAssignees,
        }
      : {
          assignees: nextAssignees,
        };
    try {
      if (editTask) {
        await updateDoc(doc(db, "weekly-tasks", editTask.id), payload);
      } else {
        if (!canEditTask) {
          alert("Sem permissão para criar atividade.");
          return;
        }
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

  const visibleUsers = showAllUsers
    ? orderedUsers
    : orderedUsers.slice(0, MAX_VISIBLE_USERS);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="modal-card w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--accent)] text-xl"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold text-[var(--accent)] mb-6">
          {editTask ? "Editar Atividade" : "Nova Atividade"}
        </h2>
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block mb-1 font-semibold text-[var(--text)]">
              Atividade
            </label>
            <textarea
              className="input-neon w-full min-h-[80px] text-base"
              value={atividade}
              onChange={(e) => setAtividade(e.target.value)}
              required
              disabled={!canEditTask}
              style={{ resize: "vertical" }}
              placeholder="Descreva a atividade..."
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block mb-1 font-semibold text-[var(--text)]">
                Responsável principal
              </label>
              <select
                className="input-neon w-full"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                required
                disabled={!canEditTask}
              >
                <option value="">Selecionar usuário</option>
                {orderedUsers.map((user) => (
                  <option key={user.id} value={user.email || ""}>
                    {user.nome || user.email || "Usuário"}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block mb-1 font-semibold text-[var(--text)]">
                Prioridade
              </label>
              <select
                className="input-neon w-full"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value)}
                required
                disabled={!canEditTask}
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block mb-2 font-semibold text-[var(--text)]">
              Pessoas na tarefa
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
              {visibleUsers.map((user) => {
                const checked = assignees.some(
                  (item) => item.uid === user.id
                );
                return (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 border border-[var(--line)] rounded-lg px-3 py-2 cursor-pointer hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignee(user)}
                      disabled={!canEditAssignees}
                    />
                    {renderAvatar(user)}
                    <div className="text-sm">
                      <div className="font-medium text-[var(--text)]">
                        {user.nome || user.email || "Usuário"}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {user.email || "—"}
                      </div>
                    </div>
                  </label>
                );
              })}
              {!orderedUsers.length && (
                <div className="text-xs text-[var(--text-muted)]">
                  Nenhum usuário encontrado.
                </div>
              )}
            </div>
            {orderedUsers.length > MAX_VISIBLE_USERS && (
              <button
                type="button"
                onClick={() => setShowAllUsers((prev) => !prev)}
                className="mt-2 text-xs text-[var(--accent)] hover:underline"
              >
                {showAllUsers
                  ? "Mostrar menos"
                  : `Exibir mais (${orderedUsers.length - MAX_VISIBLE_USERS})`}
              </button>
            )}
          </div>
          <div>
            <label className="block mb-1 font-semibold text-[var(--text)]">
              Data
            </label>
            <input
              type="date"
              className="input-neon w-full"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
              disabled={!canEditTask}
            />
          </div>
          <button
            type="submit"
            disabled={saving || (!canEditTask && !canEditAssignees)}
            className={`w-full py-3 rounded-lg text-sm font-semibold mt-2 transition ${
              saving || (!canEditTask && !canEditAssignees)
                ? "bg-[var(--line)] text-[var(--text-muted)] cursor-not-allowed"
                : "bg-[var(--accent)] text-white hover:brightness-110"
            }`}
          >
            {!canEditTask && !canEditAssignees
              ? "Apenas visualizacao"
              : saving
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
