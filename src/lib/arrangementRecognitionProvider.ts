import {
  defaultArrangementAiEndpointUrl,
  defaultArrangementAiModel,
  getInitialArrangementAiSettings,
  normalizeArrangementDraft,
} from "@/data/arrangements";
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
  recognize: (request: ArrangementRecognitionRequest) => Promise<ArrangementRecognitionResult>;
};

export type ArrangementRecognitionOrigin = "ai" | "local" | "none";

export type ArrangementRecognitionResult = {
  draft: ArrangementDraft | null;
  origin: ArrangementRecognitionOrigin;
  reason?: string;
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

type OpenAiFailure = {
  status: number;
  reason: string;
};

type OpenAiRequestResult =
  | {
      ok: true;
      body: unknown;
    }
  | {
      ok: false;
      failure: OpenAiFailure;
    };

const supportedPriorities: ArrangementPriority[] = [
  "important_urgent",
  "important_not_urgent",
  "urgent_not_important",
  "not_important_not_urgent",
];

const supportedTimeModes: ArrangementTimeMode[] = ["none", "point", "range", "all_day"];
const supportedTagIds = ["daily", "study", "work", "health", "family", "other"];
const aiRequestTimeoutMs = 18000;
const compatibleFallbackStatusCodes = [400, 404, 405, 422];

const localArrangementRecognitionProvider: ArrangementRecognitionProvider = {
  async recognize({ message, context }) {
    return {
      draft: detectArrangementFromMessage(message, context),
      origin: "local",
    };
  },
};

const openAiArrangementRecognitionProvider: ArrangementRecognitionProvider = {
  async recognize({ message, context }) {
    const settings = getInitialArrangementAiSettings();
    const apiKey = settings.apiKey;
    if (!apiKey) {
      return { draft: null, origin: "none", reason: "没有保存 API Key" };
    }
    const endpointUrl = normalizeEndpointUrl(settings.endpointUrl);
    const model = settings.model || defaultArrangementAiModel;
    return recognizeWithCompatibleOpenAi({
      apiKey,
      context,
      endpointUrl,
      message,
      model,
    });
  },
};

type CompatibleOpenAiRecognitionParams = {
  apiKey: string;
  context: ArrangementDetectionContext;
  endpointUrl: string;
  message: ArrangementRecognitionMessage;
  model: string;
};

async function recognizeWithCompatibleOpenAi({
  apiKey,
  context,
  endpointUrl,
  message,
  model,
}: CompatibleOpenAiRecognitionParams): Promise<ArrangementRecognitionResult> {
  if (isGeminiOpenAiEndpoint(endpointUrl)) {
    return recognizeWithGeminiOpenAi({
      apiKey,
      context,
      endpointUrl,
      message,
      model,
    });
  }

  const responsesResult = await requestResponsesRecognition({
    apiKey,
    context,
    endpointUrl,
    message,
    model,
  });

  if (responsesResult.ok) {
    return buildRecognitionResultFromBody(responsesResult.body, message, context);
  }

  if (!shouldTryCompatibleChat(responsesResult.failure.status)) {
    return {
      draft: null,
      origin: "none",
      reason: responsesResult.failure.reason,
    };
  }

  const plainResponsesResult = await requestPlainResponsesRecognition({
    apiKey,
    context,
    endpointUrl,
    message,
    model,
  });

  if (plainResponsesResult.ok) {
    return buildRecognitionResultFromBody(plainResponsesResult.body, message, context);
  }

  const chatResult = await requestChatRecognition({
    apiKey,
    context,
    endpointUrl,
    message,
    model,
    useJsonObject: true,
  });

  if (chatResult.ok) {
    return buildRecognitionResultFromBody(chatResult.body, message, context);
  }

  if (!shouldTryPlainChat(chatResult.failure.status)) {
    return {
      draft: null,
      origin: "none",
      reason: await buildRecognitionFailureReason({
        apiKey,
        endpointUrl,
        failures: [
          formatAttemptFailure("严格 Responses", responsesResult.failure),
          formatAttemptFailure("普通 Responses", plainResponsesResult.failure),
          formatAttemptFailure("Chat JSON", chatResult.failure),
        ],
        model,
        shouldCheckModels: shouldCheckModelsForFailures([
          responsesResult.failure,
          plainResponsesResult.failure,
          chatResult.failure,
        ]),
      }),
    };
  }

  const plainChatResult = await requestChatRecognition({
    apiKey,
    context,
    endpointUrl,
    message,
    model,
    useJsonObject: false,
  });

  if (plainChatResult.ok) {
    return buildRecognitionResultFromBody(plainChatResult.body, message, context);
  }

  const compactResponsesResult = await requestCompactResponsesRecognition({
    apiKey,
    context,
    endpointUrl,
    message,
    model,
  });

  if (compactResponsesResult.ok) {
    return buildRecognitionResultFromBody(compactResponsesResult.body, message, context);
  }

  const compactChatResult = await requestCompactChatRecognition({
    apiKey,
    context,
    endpointUrl,
    message,
    model,
  });

  if (compactChatResult.ok) {
    return buildRecognitionResultFromBody(compactChatResult.body, message, context);
  }

  return {
    draft: null,
    origin: "none",
    reason: await buildRecognitionFailureReason({
      apiKey,
      endpointUrl,
      failures: [
        formatAttemptFailure("严格 Responses", responsesResult.failure),
        formatAttemptFailure("普通 Responses", plainResponsesResult.failure),
        formatAttemptFailure("Chat JSON", chatResult.failure),
        formatAttemptFailure("普通 Chat", plainChatResult.failure),
        formatAttemptFailure("单文本 Responses", compactResponsesResult.failure),
        formatAttemptFailure("单消息 Chat", compactChatResult.failure),
      ],
      model,
      shouldCheckModels: shouldCheckModelsForFailures([
        responsesResult.failure,
        plainResponsesResult.failure,
        chatResult.failure,
        plainChatResult.failure,
        compactResponsesResult.failure,
        compactChatResult.failure,
      ]),
    }),
  };
}

async function recognizeWithGeminiOpenAi({
  apiKey,
  context,
  endpointUrl,
  message,
  model,
}: CompatibleOpenAiRecognitionParams): Promise<ArrangementRecognitionResult> {
  const compactChatResult = await requestCompactChatRecognition({
    apiKey,
    context,
    endpointUrl,
    message,
    model,
  });

  if (compactChatResult.ok) {
    return buildRecognitionResultFromBody(compactChatResult.body, message, context);
  }

  const chatResult = await requestChatRecognition({
    apiKey,
    context,
    endpointUrl,
    message,
    model,
    useJsonObject: false,
  });

  if (chatResult.ok) {
    return buildRecognitionResultFromBody(chatResult.body, message, context);
  }

  return {
    draft: null,
    origin: "none",
    reason: await buildRecognitionFailureReason({
      apiKey,
      endpointUrl,
      failures: [
        formatAttemptFailure("Gemini 单消息 Chat", compactChatResult.failure),
        formatAttemptFailure("Gemini 普通 Chat", chatResult.failure),
      ],
      model,
      shouldCheckModels: true,
    }),
  };
}

async function requestResponsesRecognition(params: CompatibleOpenAiRecognitionParams) {
  return postOpenAiJson({
    apiKey: params.apiKey,
    body: buildResponsesRecognitionBody(params),
    path: "responses",
    endpointUrl: params.endpointUrl,
  });
}

async function requestPlainResponsesRecognition(params: CompatibleOpenAiRecognitionParams) {
  return postOpenAiJson({
    apiKey: params.apiKey,
    body: buildPlainResponsesRecognitionBody(params),
    path: "responses",
    endpointUrl: params.endpointUrl,
  });
}

async function requestCompactResponsesRecognition(params: CompatibleOpenAiRecognitionParams) {
  return postOpenAiJson({
    apiKey: params.apiKey,
    body: buildCompactResponsesRecognitionBody(params),
    path: "responses",
    endpointUrl: params.endpointUrl,
  });
}

async function requestChatRecognition({
  apiKey,
  context,
  endpointUrl,
  message,
  model,
  useJsonObject,
}: CompatibleOpenAiRecognitionParams & { useJsonObject: boolean }) {
  return postOpenAiJson({
    apiKey,
    body: buildChatRecognitionBody({ context, message, model, useJsonObject }),
    path: "chat/completions",
    endpointUrl,
  });
}

async function requestCompactChatRecognition(params: CompatibleOpenAiRecognitionParams) {
  return postOpenAiJson({
    apiKey: params.apiKey,
    body: buildCompactChatRecognitionBody(params),
    path: "chat/completions",
    endpointUrl: params.endpointUrl,
  });
}

async function requestAvailableModels({
  apiKey,
  endpointUrl,
}: {
  apiKey: string;
  endpointUrl: string;
}) {
  return getOpenAiJson({
    apiKey,
    endpointUrl,
    path: "models",
  });
}

async function getOpenAiJson({
  apiKey,
  endpointUrl,
  path,
}: {
  apiKey: string;
  endpointUrl: string;
  path: string;
}): Promise<OpenAiRequestResult> {
  const proxyUrl = `/openai-proxy/${path}?baseUrl=${encodeURIComponent(endpointUrl)}`;
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), aiRequestTimeoutMs);

  try {
    const result = await fetch(proxyUrl, {
      method: "GET",
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const responseText = await result.text().catch(() => "");

    if (!result.ok) {
      return {
        ok: false,
        failure: {
          status: result.status,
          reason: buildOpenAiFailureReason(result.status, responseText),
        },
      };
    }

    if (looksLikeHtml(responseText)) {
      return {
        ok: false,
        failure: {
          status: result.status,
          reason: "模型列表接口返回了网页内容，请检查 API endpoint URL。",
        },
      };
    }

    try {
      return { ok: true, body: JSON.parse(responseText) as unknown };
    } catch {
      return {
        ok: false,
        failure: {
          status: result.status,
          reason: `模型列表接口返回内容不是 JSON：${responseText.slice(0, 120) || "空响应"}`,
        },
      };
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function postOpenAiJson({
  apiKey,
  body,
  endpointUrl,
  path,
}: {
  apiKey: string;
  body: unknown;
  endpointUrl: string;
  path: string;
}): Promise<OpenAiRequestResult> {
  const proxyUrl = `/openai-proxy/${path}?baseUrl=${encodeURIComponent(endpointUrl)}`;
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), aiRequestTimeoutMs);

  try {
    const result = await fetch(proxyUrl, {
      method: "POST",
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });

    const responseText = await result.text().catch(() => "");

    if (!result.ok) {
      return {
        ok: false,
        failure: {
          status: result.status,
          reason: buildOpenAiFailureReason(result.status, responseText),
        },
      };
    }

    if (looksLikeHtml(responseText)) {
      return {
        ok: false,
        failure: {
          status: result.status,
          reason:
            "智能识别服务返回了网页内容，请检查 API endpoint URL 是否填写为 OpenAI 兼容的接口地址，例如 https://api.openai.com/v1 或中转服务提供的 /v1 地址。",
        },
      };
    }

    try {
      return { ok: true, body: JSON.parse(responseText) as unknown };
    } catch {
      return {
        ok: false,
        failure: {
          status: result.status,
          reason: `智能识别服务返回内容不是 JSON：${responseText.slice(0, 120) || "空响应"}`,
        },
      };
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildRecognitionResultFromBody(
  responseBody: unknown,
  message: ArrangementRecognitionMessage,
  context: ArrangementDetectionContext
): ArrangementRecognitionResult {
  const parsed = parseAiArrangementResponse(responseBody);
  if (!parsed?.shouldCreate) {
    return {
      draft: null,
      origin: "none",
      reason: parsed ? "智能识别判断不需要创建安排" : "智能识别返回结构不合规",
    };
  }

  return {
    draft: buildDraftFromAiResponse(parsed, message, context),
    origin: "ai",
  };
}

function buildResponsesRecognitionBody({
  context,
  message,
  model,
}: Omit<CompatibleOpenAiRecognitionParams, "apiKey" | "endpointUrl">) {
  return {
    model,
    input: [
      {
        role: "system",
        content: getRecognitionSystemPrompt("json_schema"),
      },
      {
        role: "user",
        content: JSON.stringify(getRecognitionUserPayload(message, context)),
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
  };
}

function buildPlainResponsesRecognitionBody({
  context,
  message,
  model,
}: Omit<CompatibleOpenAiRecognitionParams, "apiKey" | "endpointUrl">) {
  return {
    model,
    input: [
      {
        role: "system",
        content: getRecognitionSystemPrompt("json_object"),
      },
      {
        role: "user",
        content: JSON.stringify(getRecognitionUserPayload(message, context)),
      },
    ],
  };
}

function buildCompactResponsesRecognitionBody({
  context,
  message,
  model,
}: Omit<CompatibleOpenAiRecognitionParams, "apiKey" | "endpointUrl">) {
  return {
    model,
    input: buildCompactRecognitionPrompt(message, context),
  };
}

function buildChatRecognitionBody({
  context,
  message,
  model,
  useJsonObject,
}: {
  context: ArrangementDetectionContext;
  message: ArrangementRecognitionMessage;
  model: string;
  useJsonObject: boolean;
}) {
  return {
    model,
    messages: [
      {
        role: "system",
        content: getRecognitionSystemPrompt("json_object"),
      },
      {
        role: "user",
        content: JSON.stringify(getRecognitionUserPayload(message, context)),
      },
    ],
    ...(useJsonObject ? { response_format: { type: "json_object" } } : {}),
  };
}

function buildCompactChatRecognitionBody({
  context,
  message,
  model,
}: Omit<CompatibleOpenAiRecognitionParams, "apiKey" | "endpointUrl">) {
  return {
    model,
    messages: [
      {
        role: "user",
        content: buildCompactRecognitionPrompt(message, context),
      },
    ],
  };
}

function buildCompactRecognitionPrompt(
  message: ArrangementRecognitionMessage,
  context: ArrangementDetectionContext
) {
  return [
    getRecognitionSystemPrompt("json_object"),
    "",
    "待识别消息：",
    JSON.stringify(getRecognitionUserPayload(message, context)),
  ].join("\n");
}

function getRecognitionUserPayload(
  message: ArrangementRecognitionMessage,
  context: ArrangementDetectionContext
) {
  return {
    conversationTitle: context.conversationTitle,
    conversationType: message.conversationType,
    senderName: context.senderName,
    messageText: message.text,
  };
}

function getRecognitionSystemPrompt(mode: "json_schema" | "json_object") {
  const formatHint =
    mode === "json_schema"
      ? "只返回符合 schema 的 JSON。"
      : "只返回一个 JSON 对象，不要使用 Markdown 代码块，也不要输出解释文字。";

  return [
    "你是即我 App 的安排识别助手。判断一条聊天消息是否包含需要用户后续确认的安排。",
    formatHint,
    "不要替用户执行安排，也不要直接生成已加入列表的结果。",
    "只要消息表达用户本人可能需要记住、去做、携带、提交、联系、参加、复查、上班、开会、购买或处理的事项，就应设置 shouldCreate=true。",
    "别人提醒用户做某事也算用户的待确认安排，例如“爸爸提醒我后天带资料给医生”应设置 shouldCreate=true。",
    "不要因为消息里出现“提醒我”“让我记得”“我爸说”“朋友说”等转述话术就判断为不需要创建。",
    "只有纯闲聊、情绪表达、已经明确完成、与用户行动无关，或完全没有后续事项时，才设置 shouldCreate=false。",
    "字段必须包括 shouldCreate、title、timeText、timeMode、priority、primaryTagId、tagIds、note。",
    `timeMode 只能是 ${supportedTimeModes.join("、")}。`,
    `priority 只能是 ${supportedPriorities.join("、")}。`,
    `primaryTagId 和 tagIds 只能使用 ${supportedTagIds.join("、")}。`,
    "title 必须是 6 到 18 个汉字左右的自然安排摘要，去掉语气词、称谓、提醒话术和聊天口吻，不要原样复制 messageText。",
    "例如「我爸刚刚又提醒我，后天别忘了把上次检查的资料带去给医生看」应总结为「后天带检查资料看医生」。",
    "例如「妈妈让我明天上午去医院复查」应总结为「明天上午医院复查」，并设置 shouldCreate=true。",
  ].join("");
}

function buildOpenAiFailureReason(status: number, errorText: string) {
  const errorMessage = getOpenAiErrorMessage(errorText);
  return errorMessage
    ? `智能识别请求失败（${status}）：${errorMessage}`
    : `智能识别请求失败（${status}）`;
}

function shouldTryCompatibleChat(status: number) {
  return compatibleFallbackStatusCodes.includes(status);
}

function shouldTryPlainChat(status: number) {
  return compatibleFallbackStatusCodes.includes(status);
}

function joinFailureReasons(reasons: string[]) {
  return Array.from(new Set(reasons.filter(Boolean))).join("；");
}

async function buildRecognitionFailureReason({
  apiKey,
  endpointUrl,
  failures,
  model,
  shouldCheckModels,
}: {
  apiKey: string;
  endpointUrl: string;
  failures: string[];
  model: string;
  shouldCheckModels: boolean;
}) {
  const baseReason = joinFailureReasons([
    `当前 endpoint：${endpointUrl}`,
    `当前模型：${model}`,
    ...failures,
  ]);
  if (!shouldCheckModels) return baseReason;

  const modelsResult = await requestAvailableModels({ apiKey, endpointUrl }).catch(() => null);
  if (!modelsResult) return baseReason;
  if (!modelsResult.ok) {
    return joinFailureReasons([baseReason, `模型列表检查失败：${modelsResult.failure.reason}`]);
  }

  const modelIds = getModelIds(modelsResult.body);
  if (modelIds.length === 0) {
    return joinFailureReasons([baseReason, "模型列表检查成功，但没有读取到可用模型名"]);
  }

  if (!modelIds.includes(model)) {
    return joinFailureReasons([
      baseReason,
      `当前模型 ${model} 不在该 Key 可用模型列表中，可尝试：${modelIds.slice(0, 6).join("、")}`,
    ]);
  }

  return joinFailureReasons([
    baseReason,
    `模型列表检查成功，当前模型 ${model} 可见，可能是该中转不支持当前请求参数`,
  ]);
}

function formatAttemptFailure(label: string, failure: OpenAiFailure) {
  return `${label}：${failure.reason}`;
}

function shouldCheckModelsForFailures(failures: OpenAiFailure[]) {
  return failures.some((failure) => failure.status === 400);
}

function getModelIds(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") return [];

  const body = responseBody as {
    data?: Array<{
      id?: unknown;
      name?: unknown;
    }>;
  };

  return (body.data ?? [])
    .map((item) => (typeof item.id === "string" ? item.id : item.name))
    .filter((value): value is string => typeof value === "string")
    .slice(0, 30);
}

export async function recognizeArrangementFromMessage(
  message: ArrangementRecognitionMessage,
  context: ArrangementDetectionContext
) {
  const request = { message, context };
  const hasApiKey = getInitialArrangementAiSettings().apiKey.length > 0;

  if (hasApiKey) {
    try {
      const aiResult = await openAiArrangementRecognitionProvider.recognize(request);
      if (aiResult.draft) return aiResult;
      const localResult = await localArrangementRecognitionProvider.recognize(request);
      return {
        ...localResult,
        reason:
          localResult.draft && aiResult.reason
            ? `已回退本地识别：${aiResult.reason}`
            : aiResult.reason,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "智能识别请求异常";
      const localResult = await localArrangementRecognitionProvider.recognize(request);
      return {
        ...localResult,
        reason: localResult.draft ? `已回退本地识别：${reason}` : reason,
      };
    }
  }

  const localResult = await localArrangementRecognitionProvider.recognize(request);
  return {
    ...localResult,
    reason: hasApiKey && localResult.draft ? "已回退本地识别" : localResult.reason,
  };
}

function parseAiArrangementResponse(responseBody: unknown): AiArrangementResponse | null {
  const directText = getOutputText(responseBody);
  if (!directText) return null;

  try {
    const parsed: unknown = JSON.parse(extractJsonObjectText(directText));
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
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };

  if (typeof body.output_text === "string") return body.output_text.trim();

  const chatText = body.choices
    ?.map((choice) => choice.message?.content)
    .find((content) => typeof content === "string");
  if (typeof chatText === "string") return chatText.trim();

  const outputTextItem = body.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text" && typeof content.text === "string");

  return typeof outputTextItem?.text === "string" ? outputTextItem.text.trim() : "";
}

function extractJsonObjectText(value: string) {
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const startIndex = trimmed.indexOf("{");
  const endIndex = trimmed.lastIndexOf("}");
  if (startIndex >= 0 && endIndex > startIndex) {
    return trimmed.slice(startIndex, endIndex + 1);
  }
  return trimmed;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEndpointUrl(value: unknown) {
  const text = normalizeText(value) || defaultArrangementAiEndpointUrl;
  const baseUrl = text
    .replace(/\/+$/g, "")
    .replace(/\/(?:responses|chat\/completions)$/i, "");
  const geminiOpenAiUrl = normalizeGeminiOpenAiEndpoint(baseUrl);
  if (geminiOpenAiUrl) return geminiOpenAiUrl;
  if (/^https?:\/\/[^/]+$/i.test(baseUrl)) {
    return `${baseUrl}/v1`;
  }
  return baseUrl;
}

function normalizeGeminiOpenAiEndpoint(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname !== "generativelanguage.googleapis.com") return "";
    return `${url.origin}/v1beta/openai`;
  } catch {
    return "";
  }
}

function isGeminiOpenAiEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname === "generativelanguage.googleapis.com" &&
      url.pathname.replace(/\/+$/g, "") === "/v1beta/openai"
    );
  } catch {
    return false;
  }
}

function getOpenAiErrorMessage(errorText: string) {
  if (!errorText) return "";
  if (looksLikeHtml(errorText)) {
    return "服务返回了网页内容，请检查 API endpoint URL 是否是 OpenAI 兼容的 /v1 接口地址。";
  }

  try {
    const parsed = JSON.parse(errorText) as unknown;
    const messages = collectErrorMessages(parsed);
    return messages.length > 0 ? messages.join("；") : safePreview(errorText);
  } catch {
    return safePreview(errorText);
  }
}

function looksLikeHtml(value: string) {
  return /^\s*</.test(value) || /<!doctype\s+html/i.test(value) || /<html[\s>]/i.test(value);
}

function collectErrorMessages(value: unknown): string[] {
  const messages = new Set<string>();
  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    const record = item as Record<string, unknown>;
    for (const key of ["message", "msg", "detail", "error", "code", "type"]) {
      const content = record[key];
      if (typeof content === "string" && content.trim()) {
        messages.add(content.trim());
      } else if (content && typeof content === "object") {
        visit(content);
      }
    }
  };

  visit(value);
  return Array.from(messages).slice(0, 4);
}

function safePreview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
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
