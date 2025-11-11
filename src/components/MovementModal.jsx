import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  addDoc,
  updateDoc,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  getDocs,
  deleteDoc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Mail, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import showToast from "../utils/showToast";

const tipos = ["Saida", "Entrada"];
const statusTermo = ["Pendente", "Finalizado"];
const statusDisponibilidade = ["Disponível", "Indisponível"];
const DEFAULT_MODEL_OPTIONS = [
  "MacBook Air M1",
  "Dell Latitude 5420",
  "Lenovo ThinkPad L14",
];

const normalizeSerial = (value) =>
  (value || "").toString().trim().toUpperCase();

const formatDate = (value, withTime = false) => {
  try {
    if (!value) return "—";
    if (typeof value?.toDate === "function") {
      return withTime
        ? value.toDate().toLocaleString("pt-BR")
        : value.toDate().toLocaleDateString("pt-BR");
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return withTime
      ? date.toLocaleString("pt-BR")
      : date.toLocaleDateString("pt-BR");
  } catch {
    return String(value ?? "—");
  }
};

export default function MovementModal({
  open,
  onClose,
  office,
  usuario,
  numeroSerie,
  editMovement,
  variant = "movement",
}) {
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("Saida");
  const [modelo, setModelo] = useState("");
  const [numero, setNumero] = useState(numeroSerie || "");
  const [responsavel, setResponsavel] = useState(usuario?.email || "");
  const [local, setLocal] = useState(office);
  const [obs, setObs] = useState("");
  const [status, setStatus] = useState("Pendente");
  const [disponibilidade, setDisponibilidade] = useState("Disponível");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [modelOptions, setModelOptions] = useState(DEFAULT_MODEL_OPTIONS);
  const dataRef = useRef();
  const hasModelOptions = modelOptions.length > 0;

  useEffect(() => {
    const settingsRef = doc(db, "appSettings", "global");

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const data = snapshot.data() || {};
        const remoteModels = Array.isArray(data?.inventory?.models)
          ? data.inventory.models.map((item) =>
              typeof item === "string" ? item : item?.nome || item?.label || ""
            )
          : [];

        const baseList = [
          ...remoteModels,
          ...DEFAULT_MODEL_OPTIONS,
          ...(editMovement?.modelo
            ? [String(editMovement.modelo || "").trim()]
            : []),
        ]
          .map((value) => String(value || "").trim())
          .filter((value) => value.length > 0);

        setModelOptions(Array.from(new Set(baseList)));
      },
      (error) => {
        console.error("Não foi possível carregar modelos configurados:", error);
        const fallback = [
          ...DEFAULT_MODEL_OPTIONS,
          ...(editMovement?.modelo
            ? [String(editMovement.modelo || "").trim()]
            : []),
        ]
          .map((value) => String(value || "").trim())
          .filter((value) => value.length > 0);
        setModelOptions(Array.from(new Set(fallback)));
      }
    );

    return () => unsubscribe();
  }, [editMovement?.modelo]);

  useEffect(() => {
    if (editMovement) {
      setData(editMovement.data || "");
      setTipo(editMovement.tipo || "Saida");
      setModelo(editMovement.modelo ? String(editMovement.modelo).trim() : "");
      setNumero(
        editMovement.numeroSerie
          ? normalizeSerial(editMovement.numeroSerie)
          : ""
      );
      setResponsavel(editMovement.responsavel || usuario?.email || "");
      setLocal(editMovement.local || office);
      setObs(editMovement.obs || "");
      setStatus(editMovement.status || "Pendente");
      setDisponibilidade(editMovement.disponibilidade || "Disponível");
      setEmail(editMovement.email || "");
    } else {
      const today = new Date().toISOString().split("T")[0];
      setData(variant === "inventory" ? today : "");
      setTipo(variant === "inventory" ? "Entrada" : "Saida");
      setModelo("");
      setNumero(numeroSerie ? normalizeSerial(numeroSerie) : "");
      setResponsavel(usuario?.email || "");
      setLocal(office);
      setObs("");
      setStatus("Pendente");
      setDisponibilidade(variant === "inventory" ? "Disponível" : "Disponível");
      setEmail("");
    }
  }, [editMovement, numeroSerie, usuario, office, variant]);

  useEffect(() => {
    if (open && dataRef.current) dataRef.current.focus();
    const handleEsc = (e) => e.key === "Escape" && onClose?.();
    if (open) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  useEffect(() => {
    const serialFilter = normalizeSerial(numero);
    if (serialFilter) {
      const q = query(
        collection(db, "equipment-movements"),
        where("numeroSerie", "==", serialFilter)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setHistory(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }
    setHistory([]);
  }, [numero]);

  const quickHistory = useMemo(() => {
    const events = [];
    const pushEntry = (entry, fallbackDoc) => {
      if (!entry) return;
      const sanitized = { ...entry };
      delete sanitized.historico;
      events.push({
        ...sanitized,
        numeroSerie:
          sanitized.numeroSerie ||
          fallbackDoc?.numeroSerie ||
          normalizeSerial(numero),
        registradoEm:
          sanitized.registradoEm || sanitized.criadoEm || fallbackDoc?.criadoEm,
        responsavel: sanitized.responsavel || fallbackDoc?.responsavel,
        local: sanitized.local || fallbackDoc?.local,
        modelo: sanitized.modelo || fallbackDoc?.modelo,
        usuario: sanitized.usuario || fallbackDoc?.usuario,
        tipo: sanitized.tipo || fallbackDoc?.tipo,
        status: sanitized.status || fallbackDoc?.status,
        disponibilidade:
          sanitized.disponibilidade || fallbackDoc?.disponibilidade,
        obs: sanitized.obs || fallbackDoc?.obs,
      });
    };

    history.forEach((docData) => {
      const historicoEntries = Array.isArray(docData.historico)
        ? docData.historico
        : [];
      if (historicoEntries.length) {
        historicoEntries.forEach((item) => pushEntry(item, docData));
      } else {
        pushEntry(
          {
            data: docData.data,
            tipo: docData.tipo,
            modelo: docData.modelo,
            numeroSerie: docData.numeroSerie,
            responsavel: docData.responsavel,
            local: docData.local,
            obs: docData.obs,
            status: docData.status,
            disponibilidade: docData.disponibilidade,
            email: docData.email,
            registradoEm: docData.criadoEm,
          },
          docData
        );
      }
    });

    const getTime = (value) =>
      typeof value?.toMillis === "function"
        ? value.toMillis()
        : typeof value?.toDate === "function"
        ? value.toDate().getTime()
        : value
        ? new Date(value).getTime()
        : 0;

    return events
      .sort((a, b) => getTime(b.registradoEm) - getTime(a.registradoEm))
      .slice(0, 6);
  }, [history, numero]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    showToast({ message: "Copiado!", type: "success", duration: 2000 });
  };

  // mapeia office -> coleção de estoque
  const officeToCollection = (o) =>
    o === "São Paulo"
      ? "sao-paulo"
      : o === "Rio de Janeiro"
      ? "rio-de-janeiro"
      : o === "João Pessoa"
      ? "joao-pessoa"
      : "outros";

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const normalizedModelo = modelo.trim();
      if (!normalizedModelo) {
        showToast({
          type: "error",
          message: "Informe o modelo antes de salvar.",
          duration: 3000,
        });
        setSaving(false);
        return;
      }

      const normalizedNumero = normalizeSerial(numero);
      if (!normalizedNumero) {
        showToast({
          type: "error",
          message: "Informe o número de série.",
          duration: 3000,
        });
        setSaving(false);
        return;
      }
      if (normalizedNumero !== numero) {
        setNumero(normalizedNumero);
      }

      const previousSerial = editMovement?.numeroSerie
        ? normalizeSerial(editMovement.numeroSerie)
        : null;
      const previousTipo = editMovement?.tipo || null;
      const previousLocal = editMovement?.local || office;
      const previousCollectionName = officeToCollection(previousLocal);
      const collectionName = officeToCollection(local || office);
      const currentStockRef = doc(db, collectionName, normalizedNumero);

      const maintainStock = variant === "inventory" || tipo !== "Saida";
      let existingStockSnapshot = null;
      const previousMaintained =
        previousTipo !== "Saida" && Boolean(previousSerial);
      const isSameLocation =
        previousMaintained &&
        previousSerial === normalizedNumero &&
        previousCollectionName === collectionName;
      const targetStatus =
        disponibilidade === "Disponível" ? "Disponivel" : "Indisponivel";

      if (maintainStock) {
        if (previousMaintained && !isSameLocation) {
          try {
            await deleteDoc(doc(db, previousCollectionName, previousSerial));
          } catch (err) {
            const q = query(
              collection(db, previousCollectionName),
              where("serial", "==", previousSerial)
            );
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
          }
        }

        existingStockSnapshot = await getDoc(currentStockRef);
        if (existingStockSnapshot.exists() && !isSameLocation) {
          showToast({
            type: "error",
            message:
              "Este número de série já está em estoque. Verifique o cadastro.",
          });
          setSaving(false);
          return;
        }
      } else if (previousMaintained) {
        try {
          await deleteDoc(doc(db, previousCollectionName, previousSerial));
        } catch (err) {
          const q = query(
            collection(db, previousCollectionName),
            where("serial", "==", previousSerial)
          );
          const snap = await getDocs(q);
          await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        }
      }

      // payload base
      const sanitizedObs = (obs || "").trim();

      const createdAtValue = editMovement?.criadoEm || editMovement?.createdAt || Timestamp.now();

      const payload = {
        data,
        tipo,
        modelo: normalizedModelo,
        numeroSerie: normalizedNumero,
        responsavel,
        local,
        obs: sanitizedObs,
        disponibilidade,
        criadoEm: createdAtValue,
        ...(email ? { email } : {}),
        status:
          variant !== "inventory"
            ? status
            : disponibilidade === "Disponível"
            ? "Disponível"
            : "Indisponível",
      };

      const historyEntry = {
        ...payload,
        status: payload.status,
        registradoEm: Timestamp.now(),
        usuario: usuario?.email || responsavel,
        acao: editMovement ? "Atualização" : "Cadastro",
      };

      if (editMovement) {
        const historicoAnterior = Array.isArray(editMovement.historico)
          ? editMovement.historico
          : [];
        await updateDoc(doc(db, "equipment-movements", editMovement.id), {
          ...payload,
          historico: [...historicoAnterior, historyEntry],
        });
      } else if (variant !== "inventory") {
        await addDoc(collection(db, "equipment-movements"), {
          ...payload,
          historico: [historyEntry],
        });
      }

      if (maintainStock) {
        const createdAtStock = existingStockSnapshot?.exists()
          ? existingStockSnapshot.data()?.createdAt || Timestamp.now()
          : Timestamp.now();
        await setDoc(currentStockRef, {
          serial: normalizedNumero,
          modelo: normalizedModelo,
          status: targetStatus,
          email: usuario?.email || responsavel,
          createdBy: usuario?.email || responsavel,
          updatedBy: usuario?.email || responsavel,
          observacao: sanitizedObs,
          createdAt: createdAtStock,
          updatedAt: Timestamp.now(),
        });
      } else {
        try {
          await deleteDoc(currentStockRef);
        } catch (err) {
          const q = query(
            collection(db, collectionName),
            where("serial", "==", normalizedNumero)
          );
          const snap = await getDocs(q);
          await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        }
      }

      const baseMessage = editMovement
        ? "Cadastro atualizado com sucesso."
        : "Cadastro salvo com sucesso.";
      showToast({ type: "success", message: baseMessage });

      if (!editMovement) {
        if (tipo === "Entrada" && disponibilidade === "Disponível") {
          showToast({
            type: "success",
            message: "Equipamento adicionado ao estoque.",
            duration: 4500,
          });
        } else if (tipo === "Saida") {
          showToast({
            type: "info",
            message: "Equipamento removido do estoque.",
            duration: 4500,
          });
        }
      }

      onClose?.();
    } catch (err) {
      console.error(err);
      showToast({
        type: "error",
        message: "Erro ao salvar cadastro.",
        description: err?.message || "Tente novamente em instantes.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.95, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="modal-card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Cabeçalho */}
          <div className="modal-head px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--text)]">
                {editMovement ? "Editar Cadastro" : "Cadastro"}
              </h2>
              {numero && (
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  Nº de Série:{" "}
                  <button
                    className="underline"
                    onClick={() => handleCopy(numero)}
                  >
                    {numero}
                  </button>
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-[var(--line)] hover:bg-white/5 transition text-[var(--text)]"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 text-pink-300" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="p-6 space-y-6 bg-[var(--bg-soft)] flex-1 min-h-0 overflow-y-auto">
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm text-[var(--text-muted)]">
                    Data
                  </label>
                  <input
                    ref={dataRef}
                    type="date"
                    className="input-neon w-full"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    required
                  />
                </div>

                {variant !== "inventory" && (
                  <div>
                    <label className="block mb-1 text-sm text-[var(--text-muted)]">
                      Tipo de Movimento
                    </label>
                    <select
                      className="input-neon w-full"
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      required
                    >
                      {tipos.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block mb-1 text-sm text-[var(--text-muted)]">
                    Modelo
                  </label>
                  {hasModelOptions ? (
                    <select
                      className="input-neon w-full"
                      value={modelo}
                      onChange={(e) => setModelo(e.target.value)}
                      required
                    >
                      <option value="">Selecione um modelo</option>
                      {modelOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input-neon w-full"
                      value={modelo}
                      onChange={(e) => setModelo(e.target.value)}
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block mb-1 text-sm text-[var(--text-muted)]">
                    Número de Série
                  </label>
                  <input
                    className="input-neon w-full"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm text-[var(--text-muted)]">
                    Responsável
                  </label>
                  <input
                    className="input-neon w-full"
                    value={responsavel}
                    disabled
                  />
                </div>

                {/* E-mail (opcional) */}
                <div>
                  <label className="block mb-1 text-sm text-[var(--text-muted)]">
                    E-mail (opcional)
                  </label>
                  <div className="flex items-center gap-2">
                    <Mail
                      className="w-4 h-4 text-pink-300 shrink-0"
                      aria-hidden="true"
                    />
                    <input
                      type="email"
                      placeholder="nome@empresa.com"
                      className="input-neon w-full"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-sm text-[var(--text-muted)]">
                    Local de recebimento/Destino
                  </label>
                  <input
                    className="input-neon w-full"
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block mb-1 text-sm text-[var(--text-muted)]">
                    Observações
                  </label>
                  <textarea
                    className="input-neon w-full min-h-[120px] resize-y"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    rows={4}
                    placeholder="Detalhes adicionais sobre o equipamento"
                  />
                </div>

                {variant !== "inventory" && (
                  <>
                    <div>
                      <label className="block mb-1 text-sm text-[var(--text-muted)]">
                        Envio de novo termo
                      </label>
                      <select
                        className="input-neon w-full"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        required
                      >
                        {statusTermo.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 text-sm text-[var(--text-muted)]">
                        Disponibilidade
                      </label>
                      <select
                        className="input-neon w-full"
                        value={disponibilidade}
                        onChange={(e) => setDisponibilidade(e.target.value)}
                        required
                      >
                        {statusDisponibilidade.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <button type="submit" disabled={saving} className="btn-neon">
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </form>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-pink-300">
                Histórico de movimentações
              </h3>
              <div className="bg-[var(--bg-card)] rounded-lg p-4 max-h-72 overflow-y-auto border border-[var(--line)]">
                {quickHistory.length === 0 ? (
                  <div className="text-[var(--text-muted)]">
                    Nenhuma movimentação encontrada.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quickHistory.map((mov, idx) => {
                      const isEntrada = mov.tipo === "Entrada";
                      return (
                        <div
                          key={(mov._originId || mov.numeroSerie || idx) + idx}
                          className="flex items-start gap-3 border border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--bg-soft)]"
                        >
                          <div
                            className={`mt-1 w-2 h-2 rounded-full ${
                              isEntrada ? "bg-emerald-400" : "bg-rose-400"
                            }`}
                          />
                          <div className="flex-1 text-xs text-[var(--text)] space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-sm">
                                {formatDate(
                                  mov.registradoEm || mov.criadoEm,
                                  true
                                )}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  isEntrada
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-rose-500/15 text-rose-300"
                                }`}
                              >
                                {mov.tipo || "Movimentação"}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  mov.status === "Finalizado"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-amber-500/15 text-amber-300"
                                }`}
                              >
                                {mov.status || "Pendente"}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  (mov.disponibilidade || "")
                                    .toLowerCase()
                                    .includes("dispon")
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-rose-500/15 text-rose-300"
                                }`}
                              >
                                {mov.disponibilidade || "—"}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--text)]/90">
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--text-muted)]">
                                  Modelo:
                                </span>
                                <span>{mov.modelo || "—"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--text-muted)]">
                                  Local:
                                </span>
                                <span>{mov.local || "—"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--text-muted)]">
                                  Responsável:
                                </span>
                                <span>{mov.responsavel || "—"}</span>
                              </div>
                              {mov.usuario && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[var(--text-muted)]">
                                    Registrado por:
                                  </span>
                                  <span>{mov.usuario}</span>
                                </div>
                              )}
                            </div>
                            {mov.obs && (
                              <div className="text-[var(--text-muted)]">
                                Obs: {mov.obs}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="px-6 py-3 border-t border-[var(--line)] bg-[var(--bg-card)] flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)]
                         hover:bg-white/5 transition"
            >
              Fechar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
