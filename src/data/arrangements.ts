import type {
  Arrangement,
  ArrangementAiSettings,
  ArrangementDraft,
  ArrangementPriority,
  ArrangementSource,
  ArrangementStatus,
} from "@/types/arrangement";

export const arrangementsStorageKey = "arkme-demo.arrangements";
export const pendingArrangementDraftStorageKey = "arkme-demo.pendingArrangementDraft";
export const arrangementAiSettingsStorageKey = "arkme-demo.arrangementAiSettings";
export const arrangementsStorageEvent = "arkme-demo:arrangements-updated";
export const pendingArrangementStorageEvent = "arkme-demo:pending-arrangement-updated";

const defaultArrangements: Arrangement[] = [
  {
    id: "demo-arrangement-health",
    title: "后天去一趟医院",
    status: "active",
    timeText: "后天上午",
    startText: "后天 09:00",
    endText: "后天 11:00",
    priority: "important",
    tags: ["健康"],
    personText: "自己",
    placeText: "医院",
    note: "先把检查资料带齐，具体时间可以再确认。",
    createdAt: 1760000000000,
    updatedAt: 1760000000000,
  },
  {
    id: "demo-arrangement-breakfast",
    title: "明天到公司帮同事带早餐",
    status: "later",
    timeText: "明天早上",
    priority: "normal",
    tags: ["生活", "同事"],
    personText: "同事",
    placeText: "公司",
    note: "暂时放到以后再说，不需要有逾期压力。",
    createdAt: 1760000001000,
    updatedAt: 1760000001000,
  },
  {
    id: "demo-arrangement-review",
    title: "整理一次安排模块需求",
    status: "completed",
    timeText: "今天",
    priority: "normal",
    tags: ["工作"],
    note: "已完成，用来展示完成状态的轻量样式。",
    createdAt: 1760000002000,
    updatedAt: 1760000002000,
  },
];

function readJsonValue(key: string): unknown {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeJsonValue(key: string, value: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the in-memory interaction usable if localStorage is unavailable.
  }
}

function notify(name: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTimestamp(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizePriority(value: unknown): ArrangementPriority {
  return value === "important" ? "important" : "normal";
}

function normalizeStatus(value: unknown): ArrangementStatus {
  if (value === "completed" || value === "later") return value;
  return "active";
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeText).filter(Boolean).slice(0, 6);
}

function normalizeSource(value: unknown): ArrangementSource | undefined {
  if (!value || typeof value !== "object") return undefined;

  const source = value as Partial<ArrangementSource>;
  if (source.type !== "sendtest") return undefined;

  const conversationId = normalizeText(source.conversationId);
  const conversationTitle = normalizeText(source.conversationTitle);
  const messageId = normalizeText(source.messageId);
  const messageText = normalizeText(source.messageText);
  const senderName = normalizeText(source.senderName);

  if (!conversationId || !conversationTitle || !messageId || !messageText || !senderName) {
    return undefined;
  }

  return {
    type: "sendtest",
    conversationId,
    conversationType: source.conversationType === "group" ? "group" : "private",
    conversationTitle,
    messageId,
    messageText,
    senderName,
    senderAvatarLabel: normalizeText(source.senderAvatarLabel) || undefined,
    sentAt: normalizeTimestamp(source.sentAt, Date.now()),
  };
}

export function normalizeArrangementDraft(value: unknown): ArrangementDraft | null {
  if (!value || typeof value !== "object") return null;

  const draft = value as Partial<ArrangementDraft>;
  const title = normalizeText(draft.title);
  if (!title) return null;

  return {
    title,
    status: draft.status ? normalizeStatus(draft.status) : undefined,
    timeText: normalizeText(draft.timeText) || undefined,
    startText: normalizeText(draft.startText) || undefined,
    endText: normalizeText(draft.endText) || undefined,
    priority: normalizePriority(draft.priority),
    tags: normalizeTags(draft.tags),
    personText: normalizeText(draft.personText) || undefined,
    placeText: normalizeText(draft.placeText) || undefined,
    note: normalizeText(draft.note) || undefined,
    source: normalizeSource(draft.source),
  };
}

function normalizeArrangement(value: unknown, index: number): Arrangement | null {
  const draft = normalizeArrangementDraft(value);
  if (!draft || !value || typeof value !== "object") return null;

  const arrangement = value as Partial<Arrangement>;
  const fallbackTime = Date.now() + index;

  return {
    ...draft,
    id: normalizeText(arrangement.id) || `arrangement-${fallbackTime}-${index}`,
    status: normalizeStatus(arrangement.status),
    createdAt: normalizeTimestamp(arrangement.createdAt, fallbackTime),
    updatedAt: normalizeTimestamp(arrangement.updatedAt, fallbackTime),
  };
}

export function getInitialArrangements() {
  const parsedValue = readJsonValue(arrangementsStorageKey);
  if (parsedValue === null) return defaultArrangements;
  if (!Array.isArray(parsedValue)) return [];

  return parsedValue
    .map(normalizeArrangement)
    .filter((arrangement): arrangement is Arrangement => Boolean(arrangement));
}

export function persistArrangements(arrangements: Arrangement[]) {
  writeJsonValue(arrangementsStorageKey, arrangements);
  notify(arrangementsStorageEvent);
}

export function getInitialPendingArrangementDraft() {
  return normalizeArrangementDraft(readJsonValue(pendingArrangementDraftStorageKey));
}

export function persistPendingArrangementDraft(draft: ArrangementDraft) {
  writeJsonValue(pendingArrangementDraftStorageKey, draft);
  notify(pendingArrangementStorageEvent);
}

export function clearPendingArrangementDraft() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(pendingArrangementDraftStorageKey);
  notify(pendingArrangementStorageEvent);
}

export function getInitialArrangementAiSettings(): ArrangementAiSettings {
  const value = readJsonValue(arrangementAiSettingsStorageKey);
  if (!value || typeof value !== "object") {
    return { apiKey: "", updatedAt: null };
  }

  const settings = value as Partial<ArrangementAiSettings>;
  return {
    apiKey: normalizeText(settings.apiKey),
    updatedAt:
      typeof settings.updatedAt === "number" && Number.isFinite(settings.updatedAt)
        ? settings.updatedAt
        : null,
  };
}

export function persistArrangementAiSettings(apiKey: string) {
  writeJsonValue(arrangementAiSettingsStorageKey, {
    apiKey: apiKey.trim(),
    updatedAt: Date.now(),
  });
}

export function clearArrangementAiSettings() {
  writeJsonValue(arrangementAiSettingsStorageKey, { apiKey: "", updatedAt: null });
}

export function createArrangementFromDraft(draft: ArrangementDraft): Arrangement {
  const timestamp = Date.now();
  return {
    ...draft,
    id: `arrangement-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    status: draft.status ?? "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
