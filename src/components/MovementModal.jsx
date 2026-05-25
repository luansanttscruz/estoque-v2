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
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { Mail, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import showToast from "../utils/showToast";
import NotebookAnexoModal from "./NotebookAnexoModal";
import DhlQuickQuoteModal from "./DhlQuickQuoteModal";

const tipos = ["Saida", "Entrada", "Transferência"];
const statusTermo = ["Pendente", "Finalizado"];
const statusDisponibilidade = ["Disponível", "Indisponível"];
const contextoMovimentoOptions = [
  "Onboarding",
  "Offboarding",
  "Equipamento novo no office",
  "Troca",
];
const DEFAULT_MODEL_OPTIONS = [
  "MacBook Air M1",
  "Dell Latitude 5420",
  "Lenovo ThinkPad L14",
];
const STOCK_COLLECTIONS = [
  "sao-paulo",
  "rio-de-janeiro",
  "joao-pessoa",
  "outros",
];
const LOCAL_OPTIONS = [
  { value: "São Paulo", label: "São Paulo" },
  { value: "Rio de Janeiro", label: "Rio de Janeiro" },
  { value: "João Pessoa", label: "João Pessoa" },
  { value: "Outros", label: "Outro" },
  { value: "Envio para usuário", label: "Envio para usuário" },
];
const DRIVE_WEBAPP_URL = process.env.REACT_APP_DRIVE_WEBAPP_URL || "";
const USING_DRIVE_WEBAPP = Boolean(DRIVE_WEBAPP_URL);
const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:3001";
const DRIVE_WEBAPP_PROXY_URL = `${API_BASE}/api/drive-webapp`;

const normalizeSerial = (value) =>
  (value || "").toString().trim().toUpperCase();

const normalizeComparableValue = (value) => String(value ?? "").trim();

const buildMovementComparable = (movement) => ({
  data: normalizeComparableValue(movement?.data),
  tipo: normalizeComparableValue(movement?.tipo),
  modelo: normalizeComparableValue(movement?.modelo),
  numeroSerie: normalizeSerial(movement?.numeroSerie),
  responsavel: normalizeComparableValue(movement?.responsavel),
  local: normalizeComparableValue(movement?.local),
  obs: normalizeComparableValue(movement?.obs || movement?.observacao),
  informacoesAdicionais: normalizeComparableValue(
    movement?.informacoesAdicionais || movement?.additionalInfo,
  ),
  contextoMovimento: normalizeComparableValue(movement?.contextoMovimento),
  disponibilidade: normalizeComparableValue(movement?.disponibilidade),
  status: normalizeComparableValue(movement?.status),
  email: normalizeComparableValue(movement?.email),
});

const hasMovementChanges = (original, current) =>
  Object.keys(current).some((key) => original[key] !== current[key]);

const getTime = (value) =>
  typeof value?.toMillis === "function"
    ? value.toMillis()
    : typeof value?.toDate === "function"
      ? value.toDate().getTime()
      : value
        ? new Date(value).getTime()
        : 0;

const resolveMovementModel = (records, serial) => {
  const normalizedSerial = normalizeSerial(serial);
  if (!normalizedSerial) return "";

  const matches = [];
  const pushMatch = (entry, fallbackDoc) => {
    const entrySerial = normalizeSerial(
      entry?.numeroSerie || entry?.serial || fallbackDoc?.numeroSerie,
    );
    const entryModel = String(
      entry?.modelo || fallbackDoc?.modelo || "",
    ).trim();
    if (entrySerial !== normalizedSerial || !entryModel) return;
    matches.push({
      modelo: entryModel,
      time: getTime(
        entry?.registradoEm ||
          entry?.criadoEm ||
          entry?.updatedAt ||
          entry?.data ||
          fallbackDoc?.criadoEm,
      ),
    });
  };

  records.forEach((record) => {
    const historico = Array.isArray(record?.historico) ? record.historico : [];
    if (historico.length) {
      historico.forEach((entry) => pushMatch(entry, record));
    } else {
      pushMatch(record, record);
    }
  });

  return matches.sort((a, b) => b.time - a.time)[0]?.modelo || "";
};

const findStockEntriesBySerial = async (
  serial,
  collectionNames = STOCK_COLLECTIONS,
) => {
  const normalizedSerial = normalizeSerial(serial);
  if (!normalizedSerial) return [];

  const entriesByPath = new Map();

  for (const collectionName of collectionNames) {
    const byIdRef = doc(db, collectionName, normalizedSerial);
    const byIdSnap = await getDoc(byIdRef);
    if (byIdSnap.exists()) {
      entriesByPath.set(byIdRef.path, {
        ref: byIdRef,
        collectionName,
        data: byIdSnap.data(),
      });
    }

    const bySerialSnap = await getDocs(
      query(
        collection(db, collectionName),
        where("serial", "==", normalizedSerial),
      ),
    );
    bySerialSnap.docs.forEach((docSnap) => {
      entriesByPath.set(docSnap.ref.path, {
        ref: docSnap.ref,
        collectionName,
        data: docSnap.data(),
      });
    });
  }

  return Array.from(entriesByPath.values());
};

const deleteStockEntriesBySerial = async (serial) => {
  const entries = await findStockEntriesBySerial(serial);
  await Promise.all(entries.map((entry) => deleteDoc(entry.ref)));
  return entries.length;
};

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
  const [numero, setNumero] = useState(normalizeSerial(numeroSerie));
  const [responsavel, setResponsavel] = useState(usuario?.email || "");
  const [local, setLocal] = useState(office);
  const [obs, setObs] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [status, setStatus] = useState("Pendente");
  const [disponibilidade, setDisponibilidade] = useState("Disponível");
  const [email, setEmail] = useState("");
  const [contextoMovimento, setContextoMovimento] = useState("");
  const [additionalInfoOpen, setAdditionalInfoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [modeloLocked, setModeloLocked] = useState(false);
  const [stockLookupModel, setStockLookupModel] = useState("");
  const [modelAutoSource, setModelAutoSource] = useState("");
  const [modelOptions, setModelOptions] = useState(DEFAULT_MODEL_OPTIONS);
  const [anexoOpen, setAnexoOpen] = useState(false);
  const [anexoSerial, setAnexoSerial] = useState("");
  const [anexoEmail, setAnexoEmail] = useState("");
  const [anexoCount, setAnexoCount] = useState(0);
  const [anexoCountLoading, setAnexoCountLoading] = useState(false);
  const [anexoRefreshKey, setAnexoRefreshKey] = useState(0);
  const [dhlQuoteOpen, setDhlQuoteOpen] = useState(false);
  const [noChangesOpen, setNoChangesOpen] = useState(false);
  const dataRef = useRef();
  const hasModelOptions = modelOptions.length > 0;
  const localOptions = useMemo(() => {
    const currentLocal = String(local || "").trim();
    if (
      currentLocal &&
      !LOCAL_OPTIONS.some((option) => option.value === currentLocal)
    ) {
      return [{ value: currentLocal, label: currentLocal }, ...LOCAL_OPTIONS];
    }
    return LOCAL_OPTIONS;
  }, [local]);
  const attachmentSerial = useMemo(
    () => normalizeSerial(numero || numeroSerie || editMovement?.numeroSerie),
    [editMovement?.numeroSerie, numero, numeroSerie],
  );
  const attachmentEmail = useMemo(
    () =>
      String(
        email || editMovement?.email || responsavel || usuario?.email || "",
      ).trim(),
    [editMovement?.email, email, responsavel, usuario?.email],
  );

  useEffect(() => {
    if (!open || !attachmentSerial) {
      setAnexoCount(0);
      return undefined;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ serial: attachmentSerial });
    if (attachmentEmail) params.set("email", attachmentEmail);
    const url = USING_DRIVE_WEBAPP
      ? `${DRIVE_WEBAPP_PROXY_URL}?${params.toString()}`
      : `${API_BASE}/api/drive-equipamentos?${params.toString()}`;

    const loadAttachmentCount = async () => {
      setAnexoCountLoading(true);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          setAnexoCount(0);
          return;
        }
        const data = await response.json();
        setAnexoCount(Array.isArray(data.files) ? data.files.length : 0);
      } catch (error) {
        if (error.name !== "AbortError") {
          setAnexoCount(0);
        }
      } finally {
        if (!controller.signal.aborted) setAnexoCountLoading(false);
      }
    };

    loadAttachmentCount();
    return () => controller.abort();
  }, [anexoRefreshKey, attachmentEmail, attachmentSerial, open]);

  useEffect(() => {
    const settingsRef = doc(db, "appSettings", "global");

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const data = snapshot.data() || {};
        const remoteModels = Array.isArray(data?.inventory?.models)
          ? data.inventory.models.map((item) =>
              typeof item === "string" ? item : item?.nome || item?.label || "",
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
      },
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
          : "",
      );
      setResponsavel(editMovement.responsavel || usuario?.email || "");
      setLocal(editMovement.local || office);
      setObs(editMovement.obs || editMovement.observacao || "");
      setAdditionalInfo(
        editMovement.informacoesAdicionais || editMovement.additionalInfo || "",
      );
      setAdditionalInfoOpen(
        Boolean(
          editMovement.informacoesAdicionais || editMovement.additionalInfo,
        ),
      );
      setContextoMovimento(editMovement.contextoMovimento || "");
      setStatus(editMovement.status || "Pendente");
      setDisponibilidade(editMovement.disponibilidade || "Disponível");
      setEmail(editMovement.email || "");
      setModeloLocked(false);
      setStockLookupModel("");
      setModelAutoSource("");
    } else {
      const today = new Date().toISOString().split("T")[0];
      setData(variant === "inventory" ? today : "");
      setTipo(variant === "inventory" ? "Entrada" : "Saida");
      setModelo("");
      setNumero(numeroSerie ? normalizeSerial(numeroSerie) : "");
      setResponsavel(usuario?.email || "");
      setLocal(office);
      setObs("");
      setAdditionalInfo("");
      setAdditionalInfoOpen(false);
      setContextoMovimento("");
      setStatus("Pendente");
      setDisponibilidade(variant === "inventory" ? "Disponível" : "Disponível");
      setEmail("");
      setModeloLocked(false);
      setStockLookupModel("");
      setModelAutoSource("");
    }
  }, [editMovement, numeroSerie, usuario, office, variant]);

  useEffect(() => {
    const detectedModel = modelo.trim();
    if (!modeloLocked || !detectedModel) return;
    setModelOptions((prev) =>
      prev.includes(detectedModel) ? prev : [detectedModel, ...prev],
    );
  }, [modelo, modeloLocked]);

  useEffect(() => {
    if (editMovement) return;
    const normalizedNumero = normalizeSerial(numero);
    if (!normalizedNumero) {
      if (modeloLocked && modelAutoSource) setModelo("");
      if (modeloLocked) setModeloLocked(false);
      if (modelAutoSource) setModelAutoSource("");
      return;
    }
    const existingModel =
      stockLookupModel || resolveMovementModel(history, normalizedNumero);
    if (existingModel) {
      if (modelo !== existingModel) {
        setModelo(existingModel);
      }
      if (!modeloLocked) setModeloLocked(true);
      const nextSource = stockLookupModel ? "estoque" : "movimentações";
      if (modelAutoSource !== nextSource) setModelAutoSource(nextSource);
    } else if (modeloLocked) {
      if (modelAutoSource) setModelo("");
      setModeloLocked(false);
      if (modelAutoSource) setModelAutoSource("");
    }
  }, [
    history,
    numero,
    editMovement,
    modelo,
    modeloLocked,
    stockLookupModel,
    modelAutoSource,
  ]);

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
        where("numeroSerie", "==", serialFilter),
      );
      const unsub = onSnapshot(q, (snapshot) => {
        setHistory(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }
    setHistory([]);
  }, [numero]);

  useEffect(() => {
    if (editMovement) return undefined;

    const serialFilter = normalizeSerial(numero);
    if (!serialFilter) {
      setStockLookupModel("");
      return undefined;
    }

    let cancelled = false;

    const findStockModel = async () => {
      try {
        for (const collectionName of STOCK_COLLECTIONS) {
          const byId = await getDoc(doc(db, collectionName, serialFilter));
          if (cancelled) return;
          const byIdData = byId.data() || {};
          const byIdModel = String(byIdData.modelo || "").trim();
          const byIdObservation = String(
            byIdData.observacao || byIdData.obs || "",
          ).trim();
          if (byId.exists() && byIdModel) {
            setStockLookupModel(byIdModel);
            if (byIdObservation) {
              setObs((current) => current || byIdObservation);
            }
            return;
          }

          const bySerial = await getDocs(
            query(
              collection(db, collectionName),
              where("serial", "==", serialFilter),
            ),
          );
          if (cancelled) return;
          const bySerialData = bySerial.docs
            .map((docSnap) => docSnap.data() || {})
            .find((data) => String(data.modelo || "").trim());
          if (bySerialData) {
            setStockLookupModel(String(bySerialData.modelo || "").trim());
            const bySerialObservation = String(
              bySerialData.observacao || bySerialData.obs || "",
            ).trim();
            if (bySerialObservation) {
              setObs((current) => current || bySerialObservation);
            }
            return;
          }
        }

        if (!cancelled) setStockLookupModel("");
      } catch (error) {
        if (!cancelled) {
          console.error("Erro ao buscar modelo no estoque:", error);
          setStockLookupModel("");
        }
      }
    };

    findStockModel();

    return () => {
      cancelled = true;
    };
  }, [numero, editMovement]);

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
        obs:
          sanitized.obs ||
          sanitized.observacao ||
          fallbackDoc?.obs ||
          fallbackDoc?.observacao,
        informacoesAdicionais:
          sanitized.informacoesAdicionais ||
          sanitized.additionalInfo ||
          fallbackDoc?.informacoesAdicionais ||
          fallbackDoc?.additionalInfo,
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
            obs: docData.obs || docData.observacao,
            informacoesAdicionais:
              docData.informacoesAdicionais || docData.additionalInfo,
            status: docData.status,
            disponibilidade: docData.disponibilidade,
            email: docData.email,
            registradoEm: docData.criadoEm,
          },
          docData,
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

  const handleOpenAnexos = () => {
    const serial = normalizeSerial(numero);
    if (!serial) {
      showToast({
        type: "error",
        message: "Informe o número de série antes de anexar imagens.",
        duration: 3000,
      });
      return;
    }
    if (serial !== numero) setNumero(serial);
    setAnexoSerial(serial);
    setAnexoEmail(attachmentEmail);
    setAnexoOpen(true);
  };

  const dhlQuotePayload = useMemo(
    () => ({
      nome: email || responsavel || usuario?.email || "Destinatário",
      origem: editMovement?.origem || office,
      cidade: "",
      cep: "",
    }),
    [editMovement?.origem, email, office, responsavel, usuario?.email],
  );

  // mapeia office -> coleção de estoque
  const officeToCollection = (o) => {
    if (o === "São Paulo") return "sao-paulo";
    if (o === "Rio de Janeiro") return "rio-de-janeiro";
    if (o === "João Pessoa") return "joao-pessoa";
    if (o === "Outros" || o === "Outro") return "outros";
    return null;
  };

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

      const sanitizedObs = (obs || "").trim();
      const sanitizedAdditionalInfo = (additionalInfo || "").trim();
      const computedStatus =
        variant !== "inventory"
          ? status
          : disponibilidade === "Disponível"
            ? "Disponível"
            : "Indisponível";
      const currentComparable = buildMovementComparable({
        data,
        tipo,
        modelo: normalizedModelo,
        numeroSerie: normalizedNumero,
        responsavel,
        local,
        obs: sanitizedObs,
        informacoesAdicionais: sanitizedAdditionalInfo,
        contextoMovimento,
        disponibilidade,
        status: computedStatus,
        email,
      });

      if (
        editMovement &&
        !hasMovementChanges(
          buildMovementComparable(editMovement),
          currentComparable,
        )
      ) {
        setNoChangesOpen(true);
        setSaving(false);
        return;
      }

      const isTransfer = variant !== "inventory" && tipo === "Transferência";
      const originOffice = isTransfer ? office : editMovement?.origem || office;
      if (isTransfer) {
        const originCollectionName = officeToCollection(originOffice);
        const destinationCollectionName = officeToCollection(local);

        if (!originCollectionName || !destinationCollectionName) {
          showToast({
            type: "error",
            message:
              "Transferência exige origem e destino em escritórios cadastrados.",
          });
          setSaving(false);
          return;
        }

        if (originCollectionName === destinationCollectionName) {
          showToast({
            type: "error",
            message: "Origem e destino devem ser escritórios diferentes.",
          });
          setSaving(false);
          return;
        }

        const originStockEntries = await findStockEntriesBySerial(
          normalizedNumero,
          [originCollectionName],
        );
        if (originStockEntries.length === 0) {
          showToast({
            type: "error",
            message:
              "Equipamento não encontrado no estoque da origem da transferência.",
          });
          setSaving(false);
          return;
        }

        const destinationStockEntries = await findStockEntriesBySerial(
          normalizedNumero,
          [destinationCollectionName],
        );
        if (destinationStockEntries.length > 0) {
          showToast({
            type: "error",
            message:
              "Este número de série já existe no estoque do destino.",
          });
          setSaving(false);
          return;
        }

        const now = Timestamp.now();
        const transferenciaId = `${Date.now()}-${normalizedNumero}`;
        const commonTransferPayload = {
          data,
          modelo: normalizedModelo,
          numeroSerie: normalizedNumero,
          responsavel,
          origem: originOffice,
          local,
          obs: sanitizedObs,
          observacao: sanitizedObs,
          informacoesAdicionais: sanitizedAdditionalInfo,
          ...(contextoMovimento ? { contextoMovimento } : {}),
          criadoEm: now,
          ...(email ? { email } : {}),
          status: computedStatus,
          transferenciaId,
        };
        const saidaPayload = {
          ...commonTransferPayload,
          tipo: "Saida",
          disponibilidade: "Indisponível",
          officeScope: originOffice,
        };
        const entradaPayload = {
          ...commonTransferPayload,
          tipo: "Entrada",
          disponibilidade: "Disponível",
          officeScope: local,
        };
        const buildTransferHistory = (payload, role) => ({
          ...payload,
          registradoEm: now,
          usuario: usuario?.email || responsavel,
          acao: role === "saida" ? "Transferência - Saída" : "Transferência - Entrada",
        });

        const destinationStockRef = doc(
          db,
          destinationCollectionName,
          normalizedNumero,
        );
        const transferBatch = writeBatch(db);
        transferBatch.set(doc(collection(db, "equipment-movements")), {
          ...saidaPayload,
          historico: [buildTransferHistory(saidaPayload, "saida")],
        });
        transferBatch.set(doc(collection(db, "equipment-movements")), {
          ...entradaPayload,
          historico: [buildTransferHistory(entradaPayload, "entrada")],
        });
        originStockEntries.forEach((entry) => {
          transferBatch.delete(entry.ref);
        });
        transferBatch.set(destinationStockRef, {
          ...(originStockEntries[0]?.data || {}),
          serial: normalizedNumero,
          modelo: normalizedModelo,
          status: "Disponivel",
          email: email || originStockEntries[0]?.data?.email || usuario?.email || responsavel,
          createdBy:
            originStockEntries[0]?.data?.createdBy || usuario?.email || responsavel,
          updatedBy: usuario?.email || responsavel,
          observacao: sanitizedObs,
          obs: sanitizedObs,
          createdAt: originStockEntries[0]?.data?.createdAt || now,
          transferredFrom: originOffice,
          transferredAt: now,
          updatedAt: now,
        });
        await transferBatch.commit();

        showToast({
          type: "success",
          message: "Transferência registrada e estoque atualizado.",
          duration: 4500,
        });
        onClose?.();
        return;
      }

      const previousSerial = editMovement?.numeroSerie
        ? normalizeSerial(editMovement.numeroSerie)
        : null;
      const previousTipo = editMovement?.tipo || null;
      const previousLocal = editMovement?.local || office;
      const previousCollectionName =
        officeToCollection(previousLocal) || officeToCollection(office);
      const collectionName =
        officeToCollection(local) || officeToCollection(office) || "outros";
      const currentStockRef = doc(db, collectionName, normalizedNumero);

      const maintainStock = variant === "inventory" || tipo !== "Saida";
      const previousMaintained =
        previousTipo !== "Saida" && Boolean(previousSerial);
      const isSameLocation =
        previousMaintained &&
        previousSerial === normalizedNumero &&
        previousCollectionName === collectionName;
      const targetStatus =
        disponibilidade === "Disponível" ? "Disponivel" : "Indisponivel";

      if (maintainStock) {
        if (previousMaintained && !isSameLocation && previousSerial) {
          await deleteStockEntriesBySerial(previousSerial);
        }

        const existingStockEntries =
          await findStockEntriesBySerial(normalizedNumero);
        const conflictingStockEntry = existingStockEntries.find((entry) => {
          const isCurrentEditTarget =
            editMovement &&
            isSameLocation &&
            entry.ref.path === currentStockRef.path;
          return !isCurrentEditTarget;
        });
        if (conflictingStockEntry) {
          showToast({
            type: "error",
            message:
              "Este número de série já está em estoque. Verifique o cadastro.",
          });
          setSaving(false);
          return;
        }
      }

      const createdAtValue = editMovement?.criadoEm || Timestamp.now();
      const payload = {
        data,
        tipo,
        modelo: normalizedModelo,
        numeroSerie: normalizedNumero,
        responsavel,
        origem: editMovement?.origem || office,
        local,
        obs: sanitizedObs,
        observacao: sanitizedObs,
        informacoesAdicionais: sanitizedAdditionalInfo,
        ...(contextoMovimento ? { contextoMovimento } : {}),
        disponibilidade,
        criadoEm: createdAtValue,
        ...(email ? { email } : {}),
        status: computedStatus,
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
        await setDoc(currentStockRef, {
          serial: normalizedNumero,
          modelo: normalizedModelo,
          status: targetStatus,
          email: usuario?.email || responsavel,
          createdBy: usuario?.email || responsavel,
          updatedBy: usuario?.email || responsavel,
          observacao: sanitizedObs,
          obs: sanitizedObs,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      } else {
        await deleteStockEntriesBySerial(normalizedNumero);
        if (previousMaintained && previousSerial !== normalizedNumero) {
          await deleteStockEntriesBySerial(previousSerial);
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
      >
        <motion.div
          initial={{ scale: 0.95, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="modal-card w-full max-w-3xl max-h-[90vh] md:max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* Cabeçalho */}
          <div className="modal-head px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
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
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 bg-[var(--bg-soft)]">
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                      disabled={modeloLocked}
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
                      disabled={modeloLocked}
                    />
                  )}
                  {modeloLocked && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Modelo detectado automaticamente
                      {modelAutoSource ? ` em ${modelAutoSource}` : ""} para
                      este número de série.
                    </p>
                  )}
                  {variant === "inventory" && (
                    <Link
                      to="/settings#notebook-mo adels"
                      className="mt-2 inline-flex text-xs text-[var(--accent)] hover:underline"
                    >
                      Para criar um modelo, clique aqui.
                    </Link>
                  )}
                </div>

                <div>
                  <label className="block mb-1 text-sm text-[var(--text-muted)]">
                    Número de Série
                  </label>
                  <input
                    className="input-neon w-full"
                    value={numero}
                    onChange={(e) => setNumero(normalizeSerial(e.target.value))}
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
                  <select
                    className="input-neon w-full"
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    required
                  >
                    <option value="">Selecione uma opção</option>
                    {localOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {variant !== "inventory" && (
                  <div>
                    <label className="block mb-1 text-sm text-[var(--text-muted)]">
                      Tipo de movimentação
                    </label>
                    <select
                      className="input-neon w-full"
                      value={contextoMovimento}
                      onChange={(e) => setContextoMovimento(e.target.value)}
                      required
                    >
                      <option value="">Selecione uma opção</option>
                      {contextoMovimentoOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block mb-1 text-sm text-[var(--text-muted)]">
                    Observação
                  </label>
                  <textarea
                    className="input-neon w-full min-h-[88px] resize-y"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    rows={3}
                    placeholder="Observação do equipamento."
                  />
                </div>

                <div className="sm:col-span-2 rounded-xl border border-[var(--line)] bg-[var(--bg-card)]/60">
                  <button
                    type="button"
                    onClick={() => setAdditionalInfoOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-white/5"
                  >
                    <span>
                      Informações adicionais
                      <span className="ml-2 text-xs text-[var(--text-muted)]">
                        opcional
                      </span>
                    </span>
                    <span className="text-xs text-[var(--accent)]">
                      {additionalInfoOpen
                        ? "Ocultar"
                        : additionalInfo
                          ? "Editar"
                          : "Adicionar"}
                    </span>
                  </button>

                  {additionalInfoOpen && (
                    <div className="border-t border-[var(--line)] p-3">
                      <textarea
                        className="input-neon w-full min-h-[96px] resize-y"
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                        rows={3}
                        placeholder="Informações complementares desta movimentação. Campo opcional."
                      />
                    </div>
                  )}
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

              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" disabled={saving} className="btn-neon">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={handleOpenAnexos}
                  className="relative px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)] hover:bg-white/5 transition"
                >
                  Adicionar imagens
                  {anexoCount > 0 && (
                    <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--bg-card)] bg-[var(--accent)] px-1.5 text-[11px] font-semibold leading-none text-white">
                      {anexoCount}
                    </span>
                  )}
                  {anexoCountLoading && anexoCount === 0 && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                  )}
                </button>
              </div>
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
                                  true,
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
                            {mov.informacoesAdicionais && (
                              <div className="text-[var(--text-muted)]">
                                Info adicionais: {mov.informacoesAdicionais}
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
          <div className="px-6 py-3 border-t border-[var(--line)] bg-[var(--bg-card)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setDhlQuoteOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--accent)]/50 bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
            >
              Consultar envio
            </button>
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
      {anexoOpen && (
        <NotebookAnexoModal
          serial={anexoSerial}
          email={anexoEmail}
          onChanged={() => setAnexoRefreshKey((value) => value + 1)}
          onClose={() => {
            setAnexoOpen(false);
            setAnexoRefreshKey((value) => value + 1);
          }}
        />
      )}
      {dhlQuoteOpen && (
        <DhlQuickQuoteModal
          onboarding={dhlQuotePayload}
          onClose={() => setDhlQuoteOpen(false)}
        />
      )}
      {noChangesOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            className="w-full max-w-sm rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-5 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-[var(--text)]">
              Nenhuma alteração encontrada
            </h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Revise os campos e altere pelo menos uma informação antes de
              salvar.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setNoChangesOpen(false)}
                className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)] hover:bg-white/5 transition"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
