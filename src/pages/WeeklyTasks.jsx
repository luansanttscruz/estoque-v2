import React, { useState, useEffect } from "react";
import {
  collection,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import { Plus, CheckCircle, Edit, Trash2, ListChecks, X, MessageCircle } from "lucide-react";
import WeeklyTaskModal from "../components/WeeklyTaskModal";
import { useAuth } from "../context/AuthContext";
import showToast from "../utils/showToast";

export default function WeeklyTasks() {
  const [activeTasks, setActiveTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const { usuario } = useAuth();
  const [view, setView] = useState("ativas"); // 'ativas' | 'finalizadas'

  useEffect(() => {
    if (!usuario) return;
    const userCollection = `weeklytasks-${usuario.uid}`;
    const col = collection(db, userCollection);
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        const all = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setActiveTasks(all.filter((task) => task.status !== "concluida"));
        setCompletedTasks(all.filter((task) => task.status === "concluida"));
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar weekly tasks do usuário:", error);
        showToast({
          type: "error",
          message: "Não foi possível carregar as atividades semanais.",
        });
        setLoading(false);
      }
    );
    return () => unsub();
  }, [usuario]);

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
    const userCollection = `weeklytasks-${usuario.uid}`;
    await deleteDoc(doc(db, userCollection, id));
    showToast({
      type: "info",
      message: "Atividade removida.",
    });
  };

  const handleConclude = async (task) => {
    const userCollection = `weeklytasks-${usuario.uid}`;
    await updateDoc(doc(db, userCollection, task.id), { status: "concluida" });
    showToast({
      type: "success",
      message: "Atividade marcada como concluída.",
    });
  };

  const handleMoveToProgress = async (task) => {
    const userCollection = `weeklytasks-${usuario.uid}`;
    await updateDoc(doc(db, userCollection, task.id), { status: "andamento" });
    setSelectedTask(null);
    showToast({ type: "success", message: "Movida para Em andamento." });
  };

  const handleAddComment = async (taskId, commentText) => {
    const userCollection = `weeklytasks-${usuario.uid}`;
    await updateDoc(doc(db, userCollection, taskId), {
      comentarios: arrayUnion({
        texto: commentText,
        autor: usuario?.email || "desconhecido",
        criadoEm: new Date().toISOString(),
      }),
    });
    showToast({ type: "success", message: "Comentário adicionado." });
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
        {loading ? (
          <div className="text-center py-10 text-[var(--text-muted)]">
            Carregando...
          </div>
        ) : (
          <>
            {/* Colunas estilo kanban */}
            {view === "finalizadas" ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-3">
                  <Column
                    title="Concluídas"
                    color="emerald"
                    tasks={completedTasks}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onConclude={handleConclude}
                    readonly
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Column
                  title="Pendentes"
                  color="amber"
                  tasks={activeTasks.filter(
                    (t) => (t.status || "pendente") === "pendente"
                  )}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onConclude={handleConclude}
                  onOpenDetail={setSelectedTask}
                />
                <Column
                  title="Em andamento"
                  color="sky"
                  tasks={activeTasks.filter((t) => t.status === "andamento")}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onConclude={handleConclude}
                  onOpenDetail={setSelectedTask}
                />
              </div>
            )}
            {displayedTasks.length === 0 && (
              <div className="text-center py-10 text-[var(--text-muted)]">
                {view === "finalizadas"
                  ? "Nenhuma atividade finalizada."
                  : "Nenhuma atividade em andamento."}
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <WeeklyTaskModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editTask={editTask}
          usuario={usuario}
          userCollection={usuario ? `weeklytasks-${usuario.uid}` : null}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onMoveToProgress={() => handleMoveToProgress(selectedTask)}
          onAddComment={handleAddComment}
        />
      )}
    </div>
  );
}

// Componentes auxiliares (no mesmo arquivo por simplicidade)
function Column({
  title,
  color,
  tasks,
  onEdit,
  onDelete,
  onConclude,
  readonly,
  onOpenDetail,
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-soft)]">
      <div
        className={[
          "flex items-center justify-between px-4 py-3 border-b",
          "border-[var(--line)]",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          <span
            className={[
              "w-2 h-2 rounded-full",
              color === "emerald"
                ? "bg-emerald-400"
                : color === "amber"
                ? "bg-amber-400"
                : "bg-sky-400",
            ].join(" ")}
          />
          <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">
          {tasks.length} itens
        </span>
      </div>

      <div className="p-3 space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            readonly={readonly}
            onEdit={onEdit}
            onDelete={onDelete}
            onConclude={onConclude}
            onOpenDetail={onOpenDetail}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-[var(--text-muted)] text-sm">
            Sem itens aqui.
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete, onConclude, readonly, onOpenDetail }) {
  const priorityClasses =
    task.prioridade === "Alta"
      ? "bg-rose-500/15 text-rose-300"
      : task.prioridade === "Média"
      ? "bg-amber-500/15 text-amber-300"
      : "bg-emerald-500/15 text-emerald-300";
  const commentCount = Array.isArray(task.comentarios) ? task.comentarios.length : 0;

  return (
    <div
      className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-3 sm:p-4 shadow-sm cursor-pointer hover:bg-white/5 transition"
      onClick={() => {
        if (!readonly && onOpenDetail) onOpenDetail(task);
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={["px-2 py-0.5 rounded text-[10px] font-bold", priorityClasses].join(" ")}>
              {task.prioridade}
            </span>
            {task.data && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-[var(--text)]">
                {task.data}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-[var(--text)] whitespace-pre-line">
            {task.atividade}
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {task.responsavel || "—"}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--line)] bg-white/5 text-[10px]">
              <MessageCircle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="text-[var(--text)] font-semibold">{commentCount}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {readonly ? (
            <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300">
              <CheckCircle className="w-4 h-4" />
              Concluída
            </span>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                className="p-2 rounded-lg border border-[var(--line)] text-[var(--text)] hover:bg-white/5 transition"
                title="Editar"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Edit className="w-4 h-4 text-[var(--accent)]" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task.id);
                }}
                className="p-2 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/15 transition"
                title="Excluir"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConclude(task);
                }}
                className="p-2 rounded-lg border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 transition"
                title="Concluir"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskDetailModal({ task, onClose, onMoveToProgress, onAddComment }) {
  const [comment, setComment] = React.useState("");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="modal-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="modal-head px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text)]">Detalhes da Atividade</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-[var(--line)] hover:bg-white/5 transition text-[var(--text)]"
          >
            <X className="w-5 h-5 text-pink-300" />
          </button>
        </div>
        <div className="p-6 space-y-5 bg-[var(--bg-soft)]">
          <div className="text-sm text-[var(--text)] whitespace-pre-line">{task.atividade}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="text-[var(--text-muted)]">
              <span className="block text-xs">Responsável</span>
              <span className="text-[var(--text)]">{task.responsavel || "—"}</span>
            </div>
            <div className="text-[var(--text-muted)]">
              <span className="block text-xs">Prioridade</span>
              <span className="text-[var(--text)]">{task.prioridade}</span>
            </div>
            <div className="text-[var(--text-muted)]">
              <span className="block text-xs">Data</span>
              <span className="text-[var(--text)]">{task.data || "—"}</span>
            </div>
            <div className="text-[var(--text-muted)]">
              <span className="block text-xs">Status</span>
              <span className="text-[var(--text)]">{task.status || "pendente"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <MessageCircle className="w-4 h-4" />
              Comentários ({Array.isArray(task.comentarios) ? task.comentarios.length : 0})
            </div>
            {Array.isArray(task.comentarios) && task.comentarios.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-2">
                {task.comentarios.map((c, idx) => (
                  <div key={idx} className="rounded-lg border border-[var(--line)] bg-[var(--bg-card)] px-3 py-2 text-xs">
                    <div className="text-[var(--text)]">{c.texto}</div>
                    <div className="mt-1 text-[var(--text-muted)]">{c.autor}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                className="input-neon w-full"
                placeholder="Adicionar comentário..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                className="px-3 py-2 rounded-lg border border-[var(--line)] text-[var(--text)] hover:bg-white/5 transition"
                onClick={() => {
                  if (!comment.trim()) return;
                  onAddComment?.(task.id, comment.trim());
                  setComment("");
                }}
              >
                Adicionar
              </button>
            </div>
          </div>
          {task.status !== "andamento" && (
            <div className="flex justify-center pt-2">
              <button
                className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)] hover:bg-white/5 transition"
                onClick={onMoveToProgress}
              >
                Mover para Em andamento
              </button>
            </div>
          )}
        </div>
        <div className="px-6 py-3 border-t border-[var(--line)] bg-[var(--bg-card)] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)] hover:bg-white/5 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
