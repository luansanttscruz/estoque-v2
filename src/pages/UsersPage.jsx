import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Search, ShieldCheck, User, Users } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import showToast from "../utils/showToast";

const ROLE_META = {
  admin: {
    label: "Admin",
    Icon: ShieldCheck,
    className: "bg-emerald-500/15 text-emerald-300",
  },
  padrao: {
    label: "Padrão",
    Icon: User,
    className: "bg-sky-500/15 text-sky-300",
  },
};

const ACCESS_META = {
  edit: {
    label: "Editar",
    className: "bg-emerald-500/15 text-emerald-300",
  },
  view: {
    label: "Somente visualizar",
    className: "bg-amber-500/15 text-amber-300",
  },
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "padrao", label: "Padrão" },
];

const ACCESS_OPTIONS = [
  { value: "edit", label: "Editar" },
  { value: "view", label: "Somente visualizar" },
];

const formatDateTime = (value) => {
  try {
    if (!value) return "—";
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString("pt-BR");
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value ?? "—")
      : date.toLocaleString("pt-BR");
  } catch {
    return String(value ?? "—");
  }
};

const RoleBadge = ({ role }) => {
  const current = ROLE_META[role] || ROLE_META.padrao;
  const Icon = current.Icon;
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        current.className,
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5" />
      {current.label}
    </span>
  );
};

const AccessBadge = ({ access }) => {
  const current = ACCESS_META[access] || ACCESS_META.edit;
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        current.className,
      ].join(" ")}
    >
      {current.label}
    </span>
  );
};

export default function UsersPage() {
  const { usuario, perfil, isAdmin, carregandoPerfil } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const usersRef = query(collection(db, "users"), orderBy("email", "asc"));
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setUsers(docs);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar usuários:", error);
        showToast({
          type: "error",
          message: "Não foi possível carregar os usuários.",
        });
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const adminCount = useMemo(
    () =>
      users.filter((user) => (user.role || "padrao") === "admin").length,
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const haystack = [user.nome, user.email, user.role, user.access]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(q);
    });
  }, [users, search]);

  const handleRoleChange = async (target, nextRole) => {
    if (!isAdmin) return;
    const currentRole = target.role || "padrao";
    if (currentRole === nextRole) return;
    if (currentRole === "admin" && nextRole !== "admin" && adminCount <= 1) {
      showToast({
        type: "error",
        message: "Mantenha ao menos um administrador ativo.",
      });
      return;
    }

    setSavingId(target.id);
    try {
      await updateDoc(doc(db, "users", target.id), {
        role: nextRole,
        updatedAt: serverTimestamp(),
        updatedBy: usuario?.email || "",
      });
      showToast({
        type: "success",
        message: "Perfil atualizado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      showToast({
        type: "error",
        message: "Não foi possível atualizar o perfil.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleAccessChange = async (target, nextAccess) => {
    if (!isAdmin) return;
    const role = target.role || "padrao";
    if (role === "admin") return;
    const currentAccess = target.access || "edit";
    if (currentAccess === nextAccess) return;

    setSavingId(target.id);
    try {
      await updateDoc(doc(db, "users", target.id), {
        access: nextAccess,
        updatedAt: serverTimestamp(),
        updatedBy: usuario?.email || "",
      });
      showToast({
        type: "success",
        message: "Acesso atualizado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao atualizar acesso:", error);
      showToast({
        type: "error",
        message: "Não foi possível atualizar o acesso.",
      });
    } finally {
      setSavingId(null);
    }
  };

  const currentRole = perfil?.role || "padrao";
  const currentAccess = perfil?.access || "edit";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
            <Users className="w-4 h-4 text-[var(--accent)]" />
            Usuários
          </div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">
            Gestão de usuários
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Admins definem se um usuário é padrão ou administrador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
            Total: <span className="text-[var(--text)]">{users.length}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
            Admins: <span className="text-[var(--text)]">{adminCount}</span>
          </span>
          {carregandoPerfil ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
              Carregando perfil...
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <RoleBadge role={currentRole} />
              <AccessBadge access={currentAccess} />
            </div>
          )}
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] w-full md:max-w-sm">
            <Search className="w-4 h-4 text-[var(--accent)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input-neon w-full"
              placeholder="Buscar por nome, e-mail ou perfil"
            />
          </label>
          {!carregandoPerfil && !isAdmin && (
            <div className="text-xs text-[var(--text-muted)]">
              Apenas administradores podem alterar perfis.
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-4 text-xs uppercase tracking-wide text-[var(--text-muted)]">
          <div className="col-span-4">Usuário</div>
          <div className="col-span-3">Perfil</div>
          <div className="col-span-3">Acesso</div>
          <div className="col-span-2">Último acesso</div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-[var(--text-muted)]">
            Carregando usuários...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)]">
            Nenhum usuário encontrado.
          </div>
        ) : (
          filtered.map((user) => {
            const nome =
              String(user.nome || "").trim() || user.email || "Sem nome";
            const role = user.role || "padrao";
            const access = user.access || "edit";
            const isSelf = usuario?.uid === user.id;
            return (
              <div
                key={user.id}
                className="grid grid-cols-12 gap-4 items-center border-t border-[var(--line)] py-3"
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text)]">
                      {nome}
                    </span>
                    {isSelf && (
                      <span className="rounded-full border border-[var(--line)] bg-[var(--bg-soft)] px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                        Você
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {user.email || "—"}
                  </div>
                </div>
                <div className="col-span-3">
                  {isAdmin ? (
                    <select
                      value={role}
                      onChange={(event) =>
                        handleRoleChange(user, event.target.value)
                      }
                      disabled={savingId === user.id}
                      className="input-neon w-full text-sm"
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <RoleBadge role={role} />
                  )}
                </div>
                <div className="col-span-3">
                  {isAdmin ? (
                    <select
                      value={role === "admin" ? "edit" : access}
                      onChange={(event) =>
                        handleAccessChange(user, event.target.value)
                      }
                      disabled={savingId === user.id || role === "admin"}
                      className="input-neon w-full text-sm"
                    >
                      {ACCESS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <AccessBadge access={access} />
                  )}
                </div>
                <div className="col-span-2 text-sm text-[var(--text-muted)]">
                  {savingId === user.id
                    ? "Salvando..."
                    : formatDateTime(user.lastLoginAt)}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
