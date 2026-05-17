import type {
  Arrangement,
  ArrangementAiSettings,
  ArrangementDraft,
  ArrangementPriority,
  ArrangementReminderOffset,
  ArrangementRepeatRule,
  ArrangementSource,
  ArrangementStatus,
  ArrangementTag,
  ArrangementTimeMode,
} from "@/types/arrangement";

export const arrangementsStorageKey = "arkme-demo.arrangements";
export const pendingArrangementDraftStorageKey = "arkme-demo.pendingArrangementDraft";
export const arrangementAiSettingsStorageKey = "arkme-demo.arrangementAiSettings";
export const arrangementTagsStorageKey = "arkme-demo.arrangementTags";
export const arrangementsStorageEvent = "arkme-demo:arrangements-updated";
export const pendingArrangementStorageEvent = "arkme-demo:pending-arrangement-updated";
export const arrangementTagsStorageEvent = "arkme-demo:arrangement-tags-updated";

export const defaultArrangementTags: ArrangementTag[] = [
  { id: "daily", name: "日常", color: "#14B8A6", source: "system" },
  { id: "study", name: "学习", color: "#0E9DEC", source: "system" },
  { id: "work", name: "工作", color: "#8363FF", source: "system" },
  { id: "health", name: "健康", color: "#09B83E", source: "system" },
  { id: "family", name: "家庭", color: "#F59E0B", source: "system" },
  { id: "other", name: "其他", color: "#94A3B8", source: "system" },
];

const customTagColors = ["#E04DAE", "#F97316", "#64748B", "#22C55E", "#8B5CF6", "#06B6D4"];

const defaultArrangements: Arrangement[] = [
  {
    id: "demo-arrangement-health",
    title: "后天去一趟医院",
    status: "active",
    timeText: "后天上午",
    startText: "后天 09:00",
    endText: "后天 11:00",
    timeMode: "range",
    dateText: "",
    startTime: "09:00",
    endTime: "11:00",
    repeatRule: { frequency: "none", interval: 1 },
    priority: "important_urgent",
    primaryTagId: "health",
    tagIds: ["health"],
    tags: ["健康"],
    note: "先把检查资料带齐，具体时间可以再确认。",
    createdAt: 1760000000000,
    updatedAt: 1760000000000,
  },
  {
    id: "demo-arrangement-breakfast",
    title: "明天到公司帮同事带早餐",
    status: "abandoned",
    timeText: "明天早上",
    timeMode: "point",
    dateText: "",
    pointTime: "08:00",
    repeatRule: { frequency: "none", interval: 1 },
    priority: "urgent_not_important",
    primaryTagId: "daily",
    tagIds: ["daily", "work"],
    tags: ["日常", "工作"],
    note: "暂时放下，不需要有逾期压力。",
    createdAt: 1760000001000,
    updatedAt: 1760000001000,
  },
  {
    id: "demo-arrangement-review",
    title: "整理一次安排模块需求",
    status: "completed",
    timeText: "今天",
    timeMode: "all_day",
    dateText: "",
    repeatRule: { frequency: "none", interval: 1 },
    priority: "important_not_urgent",
    primaryTagId: "work",
    tagIds: ["work"],
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
  if (
    value === "important_urgent" ||
    value === "important_not_urgent" ||
    value === "urgent_not_important" ||
    value === "not_important_not_urgent"
  ) {
    return value;
  }

  if (value === "important") return "important_urgent";
  return "not_important_not_urgent";
}

function normalizeStatus(value: unknown): ArrangementStatus {
  if (value === "completed" || value === "abandoned") return value;
  if (value === "later") return "abandoned";
  return "active";
}

function normalizeTimeMode(value: unknown): ArrangementTimeMode {
  if (value === "point" || value === "range" || value === "all_day") return value;
  return value === "none" ? "none" : "none";
}

function normalizeRepeatRule(value: unknown): ArrangementRepeatRule {
  if (!value || typeof value !== "object") {
    return { frequency: "none", interval: 1 };
  }

  const rule = value as Partial<ArrangementRepeatRule>;
  const frequency =
    rule.frequency === "daily" || rule.frequency === "weekly" || rule.frequency === "monthly"
      ? rule.frequency
      : "none";
  const interval =
    typeof rule.interval === "number" && Number.isFinite(rule.interval) && rule.interval > 0
      ? Math.floor(rule.interval)
      : 1;
  return {
    frequency,
    interval,
    endDate: normalizeText(rule.endDate) || undefined,
  };
}

function normalizeReminderOffset(value: unknown): ArrangementReminderOffset {
  if (value === "at_time" || value === "5m" || value === "15m" || value === "1h" || value === "1d") {
    return value;
  }
  return "at_time";
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

function normalizeTag(value: unknown, index: number): ArrangementTag | null {
  if (!value || typeof value !== "object") return null;

  const tag = value as Partial<ArrangementTag>;
  const name = normalizeText(tag.name);
  if (!name) return null;

  return {
    id: normalizeText(tag.id) || createTagId(name),
    name,
    color: normalizeText(tag.color) || customTagColors[index % customTagColors.length],
    source: tag.source === "custom" ? "custom" : "system",
  };
}

function createTagId(name: string) {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `custom-${Array.from(name).map((char) => char.charCodeAt(0).toString(36)).join("")}`;
}

function mergeTags(tags: ArrangementTag[]) {
  const byId = new Map<string, ArrangementTag>();
  [...defaultArrangementTags, ...tags].forEach((tag) => {
    if (!byId.has(tag.id)) byId.set(tag.id, tag);
  });
  return Array.from(byId.values());
}

function findTagByName(tags: ArrangementTag[], name: string) {
  return tags.find((tag) => tag.name.trim().toLowerCase() === name.trim().toLowerCase());
}

function getLegacyTagNames(value: Partial<ArrangementDraft>) {
  return Array.isArray(value.tags)
    ? value.tags.map(normalizeText).filter(Boolean).slice(0, 6)
    : [];
}

function collectLegacyCustomTags() {
  const parsedValue = readJsonValue(arrangementsStorageKey);
  if (!Array.isArray(parsedValue)) return [];

  const customNames = new Set<string>();
  parsedValue.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const arrangement = item as Partial<Arrangement>;
    getLegacyTagNames(arrangement).forEach((tagName) => {
      if (!findTagByName(defaultArrangementTags, tagName)) {
        customNames.add(tagName);
      }
    });
  });

  return Array.from(customNames).map<ArrangementTag>((name, index) => ({
    id: createTagId(name),
    name,
    color: customTagColors[index % customTagColors.length],
    source: "custom",
  }));
}

function resolveTagIds(value: Partial<ArrangementDraft>, tags: ArrangementTag[]) {
  const directIds = Array.isArray(value.tagIds)
    ? value.tagIds.map(normalizeText).filter((id) => tags.some((tag) => tag.id === id))
    : [];
  const legacyIds = getLegacyTagNames(value)
    .map((tagName) => findTagByName(tags, tagName)?.id)
    .filter((id): id is string => Boolean(id));
  const candidatePrimaryTagId = normalizeText(value.primaryTagId);
  const primaryTagId =
    candidatePrimaryTagId && tags.some((tag) => tag.id === candidatePrimaryTagId)
      ? candidatePrimaryTagId
      : directIds[0] || legacyIds[0] || "other";

  return {
    primaryTagId,
    tagIds: Array.from(new Set([primaryTagId, ...directIds, ...legacyIds])),
  };
}

export function getInitialArrangementTags() {
  const parsedValue = readJsonValue(arrangementTagsStorageKey);
  const storedTags = Array.isArray(parsedValue)
    ? parsedValue
        .map(normalizeTag)
        .filter((tag): tag is ArrangementTag => Boolean(tag))
    : [];

  return mergeTags([...storedTags, ...collectLegacyCustomTags()]);
}

export function persistArrangementTags(tags: ArrangementTag[]) {
  writeJsonValue(arrangementTagsStorageKey, mergeTags(tags));
  notify(arrangementTagsStorageEvent);
}

export function normalizeArrangementDraft(
  value: unknown,
  availableTags: ArrangementTag[] = getInitialArrangementTags()
): ArrangementDraft | null {
  if (!value || typeof value !== "object") return null;

  const draft = value as Partial<ArrangementDraft>;
  const title = normalizeText(draft.title);
  if (!title) return null;

  const resolvedTags = resolveTagIds(draft, availableTags);
  const timeText = normalizeText(draft.timeText) || undefined;
  const startText = normalizeText(draft.startText) || undefined;
  const endText = normalizeText(draft.endText) || undefined;
  const timeMode = draft.timeMode
    ? normalizeTimeMode(draft.timeMode)
    : inferLegacyTimeMode(timeText, startText, endText);

  return {
    title,
    status: draft.status ? normalizeStatus(draft.status) : undefined,
    timeText,
    startText,
    endText,
    timeMode,
    dateText: normalizeText(draft.dateText) || undefined,
    pointTime: normalizeText(draft.pointTime) || undefined,
    startTime: normalizeText(draft.startTime) || undefined,
    endTime: normalizeText(draft.endTime) || undefined,
    repeatRule: normalizeRepeatRule(draft.repeatRule),
    reminderEnabled: typeof draft.reminderEnabled === "boolean" ? draft.reminderEnabled : undefined,
    reminderOffset: normalizeReminderOffset(draft.reminderOffset),
    priority: normalizePriority(draft.priority),
    primaryTagId: resolvedTags.primaryTagId,
    tagIds: resolvedTags.tagIds,
    tags: resolvedTags.tagIds
      .map((tagId) => availableTags.find((tag) => tag.id === tagId)?.name)
      .filter((name): name is string => Boolean(name)),
    personText: normalizeText(draft.personText) || undefined,
    placeText: normalizeText(draft.placeText) || undefined,
    note: normalizeText(draft.note) || undefined,
    source: normalizeSource(draft.source),
  };
}

function inferLegacyTimeMode(
  timeText: string | undefined,
  startText: string | undefined,
  endText: string | undefined
): ArrangementTimeMode {
  if (startText || endText) return "range";
  if (timeText) return "point";
  return "none";
}

function normalizeArrangement(
  value: unknown,
  index: number,
  availableTags: ArrangementTag[]
): Arrangement | null {
  const draft = normalizeArrangementDraft(value, availableTags);
  if (!draft || !value || typeof value !== "object") return null;

  const arrangement = value as Partial<Arrangement>;
  const fallbackTime = Date.now() + index;

  return {
    ...draft,
    id: normalizeText(arrangement.id) || `arrangement-${fallbackTime}-${index}`,
    status: normalizeStatus(arrangement.status),
    timeMode: draft.timeMode ?? "none",
    repeatRule: draft.repeatRule ?? { frequency: "none", interval: 1 },
    createdAt: normalizeTimestamp(arrangement.createdAt, fallbackTime),
    updatedAt: normalizeTimestamp(arrangement.updatedAt, fallbackTime),
  };
}

export function getInitialArrangements() {
  const parsedValue = readJsonValue(arrangementsStorageKey);
  if (parsedValue === null) return defaultArrangements;
  if (!Array.isArray(parsedValue)) return [];

  const tags = getInitialArrangementTags();
  return parsedValue
    .map((item, index) => normalizeArrangement(item, index, tags))
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
    timeMode: draft.timeMode ?? "none",
    repeatRule: draft.repeatRule ?? { frequency: "none", interval: 1 },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
