import { getInitialArrangementAiSettings, normalizeArrangementDraft } from "@/data/arrangements";
import {
  buildDetectedTitle,
  detectArrangementFromMessage,
  detectPrimaryTagId,
  detectPriority,
  detectTimeText,
  type ArrangementDetectionContext,
} from "@/lib/arrangementDetection";
import type { TestConversationType, TestMessage } from "@/data/testConversations";
import type {
  ArrangementDraft,
  ArrangementPriority,
  ArrangementTimeMode,
} from "@/types/arrangement";

type ArrangementRecognitionMessage = Pick<
  TestMessage,
  "id" | "conversationId" | "conversationType" | "identityId" | "text" | "sentAt"
>;

type ArrangementRecognitionRequest = {
  message: ArrangementRecognitionMessage;
  context: ArrangementDetectionContext;
};

type ArrangementRecognitionProvider = {
  recognize: (request: ArrangementRecognitionRequest) => Promise<ArrangementDraft | null>;
};

type AiArrangementResponse = {
  shouldCreate: boolean;
  title?: string;
  timeText?: string;
  timeMode?: ArrangementTimeMode;
  priority?: ArrangementPriority;
  primaryTagId?: string;
  tagIds?: string[];
  note?: string;
};

const supportedPriorities: ArrangementPriority[] = [
  "important_urgent",
  "important_not_urgent",
  "urgent_not_important",
  "not_important_not_urgent",
];

const supportedTimeModes: ArrangementTimeMode[] = ["none", "point", "range", "all_day"];
const supportedTagIds = ["daily", "study", "work", "health", "family", "other"];

const localArrangementRecognitionProvider: ArrangementRecognitionProvider = {
  async recognize({ message, context }) {
    return detectArrangementFromMessage(message, context);
  },
};

const openAiArrangementRecognitionProvider: ArrangementRecognitionProvider = {
  async recognize({ message, context }) {
    const apiKey = getInitialArrangementAiSettings().apiKey;
    if (!apiKey) return null;

    const result = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "你是即我 App 的安排识别助手。判断一条聊天消息是否包含需要用户后续确认的安排。只返回符合 schema 的 JSON；不要替用户执行安排，也不要直接生成已加入列表的结果。",
          },
          {
            role: "user",
            content: JSON.stringify({
              conversationTitle: context.conversationTitle,
              conversationType: message.conversationType,
              senderName: context.senderName,
              messageText: message.text,
            }),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "arrangement_recognition",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                shouldCreate: { type: "boolean" },
                title: { type: "string" },
                timeText: { type: "string" },
                timeMode: {
                  type: "string",
                  enum: supportedTimeModes,
                },
                priority: {
                  type: "string",
                  enum: supportedPriorities,
                },
                primaryTagId: {
                  type: "string",
                  enum: supportedTagIds,
                },
                tagIds: {
                  type: "array",
                  items: { type: "string", enum: supportedTagIds },
                },
                note: { type: "string" },
              },
              required: [
                "shouldCreate",
                "title",
                "timeText",
                "timeMode",
                "priority",
                "primaryTagId",
                "tagIds",
                "note",
              ],
            },
          },
        },
      }),
    });

    if (!result.ok) return null;

    const responseBody: unknown = await result.json();
    const parsed = parseAiArrangementResponse(responseBody);
    if (!parsed?.shouldCreate) return null;

    return buildDraftFromAiResponse(parsed, message, context);
  },
};

export async function recognizeArrangementFromMessage(
  message: ArrangementRecognitionMessage,
  context: ArrangementDetectionContext
) {
  const request = { message, context };
  const hasApiKey = getInitialArrangementAiSettings().apiKey.length > 0;

  if (hasApiKey) {
    try {
      const aiDraft = await openAiArrangementRecognitionProvider.recognize(request);
      if (aiDraft) return aiDraft;
    } catch {
      // A quiet local fallback keeps the test flow usable when the network or model output fails.
    }
  }

  return localArrangementRecognitionProvider.recognize(request);
}

function parseAiArrangementResponse(responseBody: unknown): AiArrangementResponse | null {
  const directText = getOutputText(responseBody);
  if (!directText) return null;

  try {
    const parsed: unknown = JSON.parse(directText);
    if (!parsed || typeof parsed !== "object") return null;

    const value = parsed as Partial<AiArrangementResponse>;
    if (typeof value.shouldCreate !== "boolean") return null;
    return {
      shouldCreate: value.shouldCreate,
      title: normalizeText(value.title),
      timeText: normalizeText(value.timeText),
      timeMode: isTimeMode(value.timeMode) ? value.timeMode : undefined,
      priority: isPriority(value.priority) ? value.priority : undefined,
      primaryTagId: isTagId(value.primaryTagId) ? value.primaryTagId : undefined,
      tagIds: Array.isArray(value.tagIds)
        ? value.tagIds.filter(isTagId).slice(0, 4)
        : undefined,
      note: normalizeText(value.note),
    };
  } catch {
    return null;
  }
}

function buildDraftFromAiResponse(
  response: AiArrangementResponse,
  message: ArrangementRecognitionMessage,
  context: ArrangementDetectionContext
) {
  const text = message.text.trim();
  const title = response.title || buildDetectedTitle(text);
  const primaryTagId = response.primaryTagId ?? detectPrimaryTagId(text);
  const tagIds = Array.from(new Set([primaryTagId, ...(response.tagIds ?? [])]));
  const timeText = response.timeText || detectTimeText(text);
  const draft = normalizeArrangementDraft({
    title,
    status: "active",
    timeText,
    timeMode: response.timeMode ?? (timeText ? "point" : "none"),
    repeatRule: { frequency: "none", interval: 1 },
    priority: response.priority ?? detectPriority(text),
    primaryTagId,
    tagIds,
    note: response.note || "请确认内容后再加入安排。",
    source: {
      type: "sendtest",
      conversationId: message.conversationId,
      conversationType: message.conversationType as TestConversationType,
      conversationTitle: context.conversationTitle,
      messageId: message.id,
      messageText: text,
      senderName: context.senderName,
      senderAvatarLabel: context.senderAvatarLabel,
      sentAt: message.sentAt,
    },
  });

  return draft;
}

function getOutputText(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") return "";

  const body = responseBody as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: unknown;
      }>;
    }>;
  };

  if (typeof body.output_text === "string") return body.output_text.trim();

  const outputTextItem = body.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text" && typeof content.text === "string");

  return typeof outputTextItem?.text === "string" ? outputTextItem.text.trim() : "";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPriority(value: unknown): value is ArrangementPriority {
  return typeof value === "string" && supportedPriorities.includes(value as ArrangementPriority);
}

function isTimeMode(value: unknown): value is ArrangementTimeMode {
  return typeof value === "string" && supportedTimeModes.includes(value as ArrangementTimeMode);
}

function isTagId(value: unknown): value is string {
  return typeof value === "string" && supportedTagIds.includes(value);
}
