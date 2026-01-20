const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export const normalizeSerial = (value) =>
  String(value || "").trim().toUpperCase();

export const getTime = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const parseAvailability = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.includes("indispon")) {
    return { label: "Indisponível", ok: false };
  }
  if (normalized.includes("dispon")) {
    return { label: "Disponível", ok: true };
  }
  return { label: String(value), ok: null };
};

export const resolveAvailability = ({
  stockStatus,
  stockTime,
  movementStatus,
  movementTime,
}) => {
  const stock = parseAvailability(stockStatus);
  const movement = parseAvailability(movementStatus);
  const stockUpdated = stockTime || 0;
  const movementUpdated = movementTime || 0;

  if (movement && (!stock || movementUpdated >= stockUpdated)) {
    return movement;
  }
  return stock || movement || null;
};
