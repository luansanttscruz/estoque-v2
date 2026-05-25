import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const normalizeObject = (value) => {
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
};

export const createAuditLog = async ({
  module,
  entityType,
  entityId,
  action,
  before = null,
  after = null,
  changedFields = [],
  actor,
  metadata = {},
}) => {
  if (!actor?.uid || !actor?.email || !module || !entityType || !action) {
    return;
  }

  try {
    await addDoc(collection(db, "audit-logs"), {
      module,
      entityType,
      entityId: String(entityId || ""),
      action,
      before: normalizeObject(before),
      after: normalizeObject(after),
      changedFields: Array.isArray(changedFields) ? changedFields : [],
      actor: {
        uid: actor.uid,
        email: actor.email,
        nome: actor.displayName || actor.nome || "",
      },
      metadata: normalizeObject(metadata) || {},
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao criar log de auditoria:", error);
  }
};

export const diffFields = (before = {}, after = {}) => {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return Array.from(keys).filter(
    (key) =>
      JSON.stringify(before?.[key] ?? null) !==
      JSON.stringify(after?.[key] ?? null),
  );
};
