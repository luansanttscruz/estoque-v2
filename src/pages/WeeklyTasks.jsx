import React, { useMemo, useState, useEffect } from "react";
import {
  collection,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Plus,
  CheckCircle,
  Edit,
  Trash2,
  ListChecks,
  Play,
  RotateCcw,
} from "lucide-react";
import WeeklyTaskModal from "../components/WeeklyTaskModal";
import { useAuth } from "../context/AuthContext";
import showToast from "../utils/showToast";

const STATUS_LABELS = {
  pendente: "Pendentes",
  em_andamento: "Em andamento",
  concluida: "Concluídas",
};

const STATUS_ACTIONS = {
  pendente: [
    { label: "Iniciar", next: "em_andamento", Icon: Play },
    { label: "Concluir", next: "concluida", Icon: CheckCircle },
  ],
  em_andamento: [
    { label: "Voltar", next: "pendente", Icon: RotateCcw },
    { label: "Concluir", next: "concluida", Icon: CheckCircle },
  ],
  concluida: [{ label: "Reabrir", next: "pendente", Icon: RotateCcw }],
};

const normalizeStatus = (value) => {
  const raw = String(value || "").toLowerCase().trim();
  if (raw.includes("conclu")) return "concluida";
  if (raw.includes("and")) return "em_andamento";
  return "pendente";
};

const priorityClass = (value) => {
  if (value === "Alta") return "bg-rose-500/15 text-rose-300";
  if (value === "Média") return "bg-amber-500/15 text-amber-300";
  return "bg-emerald-500/15 text-emerald-300";
};

const getInitials = (value) => {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const formatCommentTime = (value) => {
  try {
    if (!value) return "";
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString("pt-BR");
    }
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return "";
  }
};

const renderAvatar = (person, sizeClass) => {
  const label = person.nome || person.email || "Usuário";
  return (
    <div
      className={`${sizeClass} rounded-full border border-[var(--line)] bg-[var(--bg-card)] relative overflow-hidden`}
      title={label}
    >
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[var(--text)]">
        {getInitials(label)}
      </span>
      {person.photoURL ? (
        <img
          src={person.photoURL}
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

export default function WeeklyTasks() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [commentsTask, setCommentsTask] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [editingSaving, setEditingSaving] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const { usuario, canEditModule, isAdmin } = useAuth();
  const canEditTasks = canEditModule("weeklyTasks");
  const normalizedEmail = (value) => String(value || "").trim().toLowerCase();

  const isTaskOwner = (task) => {
    if (!usuario?.email) return false;
    return (
      normalizedEmail(task?.responsavel) === normalizedEmail(usuario.email)
    );
  };

  const isTaskAssignee = (task) => {
    if (!usuario) return false;
    const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
    return assignees.some(
      (person) =>
        (person.uid && person.uid === usuario.uid) ||
        (person.email &&
          normalizedEmail(person.email) === normalizedEmail(usuario.email))
    );
  };

  const canSeeTask = (task) =>
    Boolean(isAdmin || isTaskOwner(task) || isTaskAssignee(task));

  const canManageAssignees = (task) => canSeeTask(task);

  useEffect(() => {
    const usersRef = query(collection(db, "users"), orderBy("email", "asc"));
    const unsub = onSnapshot(
      usersRef,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setUsers(docs);
      },
      (error) => {
        console.error("Erro ao carregar usuários:", error);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const col = collection(db, "weekly-tasks");
    const unsub = onSnapshot(col, (snapshot) => {
      const all = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setTasks(all);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!commentsTask?.id) return;
    const updated = tasks.find((task) => task.id === commentsTask.id);
    if (!updated) return;
    setCommentsTask((prev) => (prev ? { ...prev, ...updated } : updated));
  }, [tasks, commentsTask?.id]);

  const handleAdd = () => {
    if (!canEditTasks) {
      showToast({
        type: "info",
        message: "Seu perfil possui acesso somente de visualização.",
      });
      return;
    }
    setEditTask(null);
    setModalOpen(true);
  };

  const handleEdit = (task) => {
    if (!canEditTasks && !canManageAssignees(task)) {
      showToast({
        type: "info",
        message: "Seu perfil possui acesso somente de visualização.",
      });
      return;
    }
    setEditTask(task);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!canEditTasks) {
      showToast({
        type: "info",
        message: "Seu perfil possui acesso somente de visualização.",
      });
      return;
    }
    if (!window.confirm("Tem certeza que deseja excluir esta atividade?"))
      return;
    await deleteDoc(doc(db, "weekly-tasks", id));
    showToast({
      type: "info",
      message: "Atividade removida.",
    });
  };

  const handleConclude = async (task) => {
    if (!canEditTasks) {
      showToast({
        type: "info",
        message: "Seu perfil possui acesso somente de visualização.",
      });
      return;
    }
    await updateDoc(doc(db, "weekly-tasks", task.id), {
      status: "concluida",
      concluidoEm: new Date().toISOString(),
    });
    showToast({
      type: "success",
      message: "Atividade marcada como concluída.",
    });
  };

  const grouped = useMemo(() => {
    const base = {
      pendente: [],
      em_andamento: [],
      concluida: [],
    };
    const visibleTasks = isAdmin ? tasks : tasks.filter((task) => canSeeTask(task));
    visibleTasks.forEach((task) => {
      const status = normalizeStatus(task.status);
      base[status].push(task);
    });
    return base;
  }, [tasks, isAdmin, usuario?.uid, usuario?.email]);

  const updateStatus = async (task, nextStatus) => {
    if (!canEditTasks) {
      showToast({
        type: "info",
        message: "Seu perfil possui acesso somente de visualização.",
      });
      return;
    }
    try {
      await updateDoc(doc(db, "weekly-tasks", task.id), {
        status: nextStatus,
        concluidoEm: nextStatus === "concluida" ? new Date().toISOString() : "",
      });
      showToast({
        type: "success",
        message: "Status atualizado.",
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      showToast({
        type: "error",
        message: "Não foi possível atualizar o status.",
      });
    }
  };

  const resolveAssignees = (task) => {
    const current = Array.isArray(task.assignees) ? task.assignees : [];
    if (current.length) return current;
    const responsavel = String(task.responsavel || "").trim();
    if (!responsavel) return [];
    const match = users.find(
      (user) =>
        String(user.email || "").toLowerCase() === responsavel.toLowerCase()
    );
    if (!match) {
      return [
        {
          uid: responsavel,
          email: responsavel,
          nome: responsavel,
          photoURL: "",
        },
      ];
    }
    return [
      {
        uid: match.id,
        email: match.email || "",
        nome: match.nome || match.email || "",
        photoURL: match.photoURL || "",
      },
    ];
  };

  const openComments = (task) => {
    if (draggingTaskId) return;
    setCommentsTask(task);
    setCommentText("");
    setEditingCommentId(null);
    setEditingText("");
  };

  const closeComments = () => {
    setCommentsTask(null);
    setCommentText("");
    setEditingCommentId(null);
    setEditingText("");
  };

  const handleAddComment = async () => {
    if (!commentsTask?.id) return;
    if (!canEditTasks && !canSeeTask(commentsTask)) {
      showToast({
        type: "info",
        message: "Seu perfil possui acesso somente de visualização.",
      });
      return;
    }
    const text = commentText.trim();
    if (!text) return;
    setCommentSaving(true);
    const uid = usuario?.uid || "";
    const nome = usuario?.displayName || "";
    const email = usuario?.email || "";
    const photoURL = usuario?.photoURL || "";
    const commentId =
      (globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    try {
      await updateDoc(doc(db, "weekly-tasks", commentsTask.id), {
        comments: arrayUnion({
          id: commentId,
          text,
          createdAt: new Date().toISOString(),
          user: { uid, nome, email, photoURL },
        }),
      });
      setCommentText("");
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      showToast({
        type: "error",
        message: "Não foi possível adicionar o comentário.",
      });
    } finally {
      setCommentSaving(false);
    }
  };

  const startEditComment = (comment) => {
    if (!comment?.id) return;
    setEditingCommentId(comment.id);
    setEditingText(comment.text || "");
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingText("");
  };

  const handleEditComment = async () => {
    if (!commentsTask?.id || !editingCommentId) return;
    if (!canEditTasks && !canSeeTask(commentsTask)) {
      showToast({
        type: "info",
        message: "Seu perfil possui acesso somente de visualização.",
      });
      return;
    }
    const text = editingText.trim();
    if (!text) return;
    setEditingSaving(true);
    const uid = usuario?.uid || "";
    const nome = usuario?.displayName || "";
    const email = usuario?.email || "";
    const photoURL = usuario?.photoURL || "";
    try {
      const updatedComments = (commentsTask.comments || []).map((comment) =>
        comment.id === editingCommentId
          ? {
              ...comment,
              text,
              editedAt: new Date().toISOString(),
              editedBy: { uid, nome, email, photoURL },
            }
          : comment
      );
      await updateDoc(doc(db, "weekly-tasks", commentsTask.id), {
        comments: updatedComments,
      });
      setCommentsTask((prev) =>
        prev ? { ...prev, comments: updatedComments } : prev
      );
      cancelEditComment();
    } catch (error) {
      console.error("Erro ao editar comentário:", error);
      showToast({
        type: "error",
        message: "Não foi possível editar o comentário.",
      });
    } finally {
      setEditingSaving(false);
    }
  };

  const handleDragStart = (event, task) => {
    if (!canEditTasks) return;
    event.dataTransfer.setData("text/plain", task.id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  };

  const handleDragOverColumn = (event, statusKey) => {
    if (!canEditTasks) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverStatus !== statusKey) {
      setDragOverStatus(statusKey);
    }
  };

  const handleDropColumn = async (event, statusKey) => {
    if (!canEditTasks) return;
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    setDragOverStatus(null);
    if (!taskId) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (normalizeStatus(task.status) === statusKey) return;
    await updateStatus(task, statusKey);
    setDraggingTaskId(null);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-[var(--text)] text-3xl font-bold">
          <span className="text-[var(--accent)] drop-shadow">Weekly Tasks</span>
          <ListChecks className="w-8 h-8 text-pink-400" />
        </div>
        <button
          onClick={handleAdd}
          disabled={!canEditTasks}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--accent)]/60
                     bg-[var(--accent)]/10 text-[var(--accent)] font-semibold hover:bg-[var(--accent)]/20 transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Nova Atividade
        </button>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg p-8 text-center text-[var(--text-muted)]">
          Carregando...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Object.entries(STATUS_LABELS).map(([statusKey, label]) => {
            const columnTasks = grouped[statusKey] || [];
            const isDragOver = dragOverStatus === statusKey;
            return (
              <div
                key={statusKey}
                onDragOver={(event) => handleDragOverColumn(event, statusKey)}
                onDragEnter={() => setDragOverStatus(statusKey)}
                onDrop={(event) => handleDropColumn(event, statusKey)}
                className={[
                  "rounded-2xl border bg-[var(--bg-card)] shadow-lg p-4 flex flex-col gap-3 min-h-[360px] transition",
                  isDragOver
                    ? "border-[var(--accent)]/60 ring-2 ring-[var(--accent)]/20"
                    : "border-[var(--line)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-[var(--text)]">
                    {label}
                  </div>
                  <span className="inline-flex items-center rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                    {columnTasks.length}
                  </span>
                </div>

                {columnTasks.length === 0 ? (
                  <div className="flex-1 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-soft)]/60 p-4 text-xs text-[var(--text-muted)]">
                    Nenhuma tarefa por aqui.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {columnTasks.map((task) => (
                      (() => {
                        const assignees = resolveAssignees(task);
                        const names = assignees
                          .map((person) => person.nome || person.email)
                          .filter(Boolean);
                        const commentCount = Array.isArray(task.comments)
                          ? task.comments.length
                          : 0;
                        const concluidoEm =
                          statusKey === "concluida"
                            ? formatCommentTime(task.concluidoEm)
                            : "";
                        return (
                          <div
                            key={task.id}
                            onClick={() => openComments(task)}
                            draggable={canEditTasks}
                            onDragStart={(event) => handleDragStart(event, task)}
                            onDragEnd={handleDragEnd}
                            className={[
                              "rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-3 space-y-2 shadow-sm cursor-pointer transition",
                              "hover:border-[var(--accent)]/40",
                              canEditTasks ? "cursor-grab active:cursor-grabbing" : "",
                              draggingTaskId === task.id ? "opacity-70" : "",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm font-semibold text-[var(--text)]">
                                {task.atividade || "Sem descrição"}
                              </div>
                              <div className="flex items-center gap-2">
                                {commentCount > 0 && (
                                  <span className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text)]">
                                    {commentCount}
                                  </span>
                                )}
                                {assignees.length > 0 && (
                                  <div className="flex -space-x-2">
                                    {assignees.slice(0, 3).map((person) => {
                                      return (
                                        <div key={person.uid || person.email}>
                                          {renderAvatar(person, "w-7 h-7")}
                                        </div>
                                      );
                                    })}
                                    {assignees.length > 3 && (
                                      <div
                                        className="w-7 h-7 rounded-full border border-[var(--line)] bg-[var(--bg-card)] text-[10px] font-semibold text-[var(--text)] flex items-center justify-center"
                                        title={`${assignees.length - 3} pessoas`}
                                      >
                                        +{assignees.length - 3}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {names.length
                                ? names.join(", ")
                                : task.responsavel || "Sem responsável"}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={[
                                  "px-2 py-0.5 rounded-full font-semibold",
                                  priorityClass(task.prioridade),
                                ].join(" ")}
                              >
                                {task.prioridade || "Média"}
                              </span>
                              <span className="px-2 py-0.5 rounded-full border border-[var(--line)] text-[var(--text-muted)]">
                                {task.data || "Sem data"}
                              </span>
                            </div>
                            {concluidoEm && (
                              <div className="text-xs text-[var(--text-muted)]">
                                Concluído em:{" "}
                                <span className="text-[var(--text)]">
                                  {concluidoEm}
                                </span>
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                disabled={!canEditTasks && !canManageAssignees(task)}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEdit(task);
                                }}
                                title="Editar"
                                aria-label="Editar"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--line)] text-[var(--text)]
                                           hover:bg-white/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Edit className="w-3.5 h-3.5 text-[var(--accent)]" />
                              </button>
                              <button
                                disabled={!canEditTasks}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDelete(task.id);
                                }}
                                title="Remover"
                                aria-label="Remover"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-rose-500/40 text-rose-300
                                           hover:bg-rose-500/15 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {STATUS_ACTIONS[statusKey].map(
                                ({ label, next, Icon }) => (
                                  <button
                                    key={label}
                                    disabled={!canEditTasks}
                                    onMouseDown={(event) =>
                                      event.stopPropagation()
                                    }
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateStatus(task, next);
                                    }}
                                    title={label}
                                    aria-label={label}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--accent)]/50 text-[var(--accent)]
                                               hover:bg-[var(--accent)]/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Icon className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <WeeklyTaskModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editTask={editTask}
          usuario={usuario}
          users={users}
          canEditTask={canEditTasks}
          canEditAssignees={
            editTask ? canManageAssignees(editTask) : canEditTasks
          }
        />
      )}

      {commentsTask && (
        <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-xl">
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">
                  Comentários da tarefa
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {commentsTask.atividade || "Sem descrição"}
                </p>
              </div>
              <button
                onClick={closeComments}
                className="rounded-full border border-[var(--line)] bg-[var(--bg-soft)] p-1.5 text-[var(--text)] hover:bg-white/5 transition"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {Array.isArray(commentsTask.comments) &&
              commentsTask.comments.length ? (
                <div className="space-y-3">
                  {commentsTask.comments.map((comment) => {
                    const author = comment.user || {};
                    const label = author.nome || author.email || "Usuário";
                    const isOwn =
                      (author.uid && author.uid === usuario?.uid) ||
                      (author.email && author.email === usuario?.email);
                    const isEditing = editingCommentId === comment.id;
                    return (
                      <div
                        key={comment.id || comment.createdAt}
                        className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-soft)]/60 p-3"
                      >
                        {renderAvatar(
                          { ...author, nome: label },
                          "w-8 h-8"
                        )}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-[var(--text)]">
                                {label}
                              </span>
                              {comment.editedAt && (
                                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                                  editado
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[var(--text-muted)]">
                              {formatCommentTime(comment.createdAt)}
                            </span>
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingText}
                                onChange={(event) =>
                                  setEditingText(event.target.value)
                                }
                                className="input-neon w-full min-h-[70px]"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleEditComment}
                                  disabled={!editingText.trim() || editingSaving}
                                  className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {editingSaving ? "Salvando..." : "Salvar"}
                                </button>
                                <button
                                  onClick={cancelEditComment}
                                  className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs text-[var(--text)] hover:bg-white/5 transition"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-[var(--text)] whitespace-pre-wrap">
                              {comment.text}
                            </p>
                          )}
                          {isOwn && !isEditing && comment.id && (
                            <button
                              onClick={() => startEditComment(comment)}
                              className="text-xs text-[var(--accent)] hover:underline"
                            >
                              Editar comentário
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-soft)]/60 p-4 text-sm text-[var(--text-muted)]">
                  Nenhum comentário ainda.
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--line)] space-y-3">
              <label className="text-xs text-[var(--text-muted)]">
                Novo comentário
              </label>
              <textarea
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                className="input-neon w-full min-h-[80px]"
                placeholder="Escreva um comentário..."
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={closeComments}
                  className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)] hover:bg-white/5 transition"
                >
                  Fechar
                </button>
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || commentSaving}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {commentSaving ? "Enviando..." : "Enviar comentário"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
