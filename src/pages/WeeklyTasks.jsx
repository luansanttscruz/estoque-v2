import React, { useState, useEffect } from "react";
import {
  collection,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import { Plus, CheckCircle, Edit, Trash2, ListChecks } from "lucide-react";
import WeeklyTaskModal from "../components/WeeklyTaskModal";
import { useAuth } from "../context/AuthContext";
import showToast from "../utils/showToast";

export default function WeeklyTasks() {
  const [activeTasks, setActiveTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const { usuario } = useAuth();
  const [view, setView] = useState("ativas"); // 'ativas' | 'finalizadas'

  useEffect(() => {
    const col = collection(db, "weekly-tasks");
    const unsub = onSnapshot(col, (snapshot) => {
      const all = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setActiveTasks(all.filter((task) => task.status !== "concluida"));
      setCompletedTasks(all.filter((task) => task.status === "concluida"));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleAdd = () => {
    setEditTask(null);
    setModalOpen(true);
  };

  const handleEdit = (task) => {
    setEditTask(task);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir esta atividade?"))
      return;
    await deleteDoc(doc(db, "weekly-tasks", id));
    showToast({
      type: "info",
      message: "Atividade removida.",
    });
  };

  const handleConclude = async (task) => {
    await updateDoc(doc(db, "weekly-tasks", task.id), { status: "concluida" });
    showToast({
      type: "success",
      message: "Atividade marcada como concluída.",
    });
  };

  const displayedTasks = view === "ativas" ? activeTasks : completedTasks;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-[var(--text)] text-3xl font-bold">
          <span className="text-[var(--accent)] drop-shadow">Weekly Tasks</span>
          <ListChecks className="w-8 h-8 text-pink-400" />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-1">
            <button
              onClick={() => setView("ativas")}
              className={[
                "px-3 py-1.5 rounded-lg text-sm font-medium transition",
                view === "ativas"
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              Ativas
            </button>
            <button
              onClick={() => setView("finalizadas")}
              className={[
                "px-3 py-1.5 rounded-lg text-sm font-medium transition",
                view === "finalizadas"
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              Finalizadas
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--accent)]/60
                       bg-[var(--accent)]/10 text-[var(--accent)] font-semibold hover:bg-[var(--accent)]/20 transition"
          >
            <Plus className="w-5 h-5" />
            Nova Atividade
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg p-4">
        <div className="grid grid-cols-12 gap-4 font-semibold text-[var(--text-muted)] text-xs uppercase tracking-wide mb-2">
          <div className="col-span-4">Atividade</div>
          <div className="col-span-2">Responsável</div>
          <div className="col-span-2">Prioridade</div>
          <div className="col-span-2">Data</div>
          <div className="col-span-2 text-center">
            {view === "finalizadas" ? "Status" : "Ações"}
          </div>
        </div>
        {loading ? (
          <div className="text-center py-10 text-[var(--text-muted)]">
            Carregando...
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-muted)]">
            {view === "finalizadas"
              ? "Nenhuma atividade finalizada."
              : "Nenhuma atividade em andamento."}
          </div>
        ) : (
          displayedTasks.map((task) => (
            <div
              key={task.id}
              className="grid grid-cols-12 gap-4 items-center border-t border-[var(--line)] py-3 last:border-b-0 hover:bg-[var(--rowHover)] transition"
            >
              <div className="col-span-4 text-sm whitespace-pre-line text-[var(--text)]">
                {task.atividade}
              </div>
              <div className="col-span-2 text-[var(--text-muted)]">
                {task.responsavel || "—"}
              </div>
              <div className="col-span-2">
                <span
                  className={[
                    "px-2 py-1 rounded text-xs font-bold inline-flex items-center gap-1",
                    task.prioridade === "Alta"
                      ? "bg-rose-500/15 text-rose-300"
                      : task.prioridade === "Média"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-emerald-500/15 text-emerald-300",
                  ].join(" ")}
                >
                  {task.prioridade}
                </span>
              </div>
              <div className="col-span-2 text-[var(--text)]">
                {task.data || "—"}
              </div>
              <div className="col-span-2 flex justify-center gap-2">
                {view === "finalizadas" ? (
                  <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300">
                    <CheckCircle className="w-4 h-4" />
                    Concluída
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(task)}
                      className="p-2 rounded-lg border border-[var(--line)] text-[var(--text)]
                                 hover:bg-white/5 transition"
                    >
                      <Edit className="w-4 h-4 text-[var(--accent)]" />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-2 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/15 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleConclude(task)}
                      className="p-2 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 transition"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <WeeklyTaskModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editTask={editTask}
          usuario={usuario}
        />
      )}
    </div>
  );
}
