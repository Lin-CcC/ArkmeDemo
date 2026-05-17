import type { TestConversationType, TestMessage } from "@/data/testConversations";
import type { ArrangementDraft, ArrangementPriority } from "@/types/arrangement";

type ArrangementDetectionContext = {
  conversationTitle: string;
  senderName: string;
  senderAvatarLabel?: string;
};

const arrangementHints = [
  "今天",
  "明天",
  "后天",
  "上午",
  "下午",
  "晚上",
  "周",
  "星期",
  "记得",
  "一定",
  "帮",
  "去",
  "带",
  "开会",
  "医院",
  "公司",
  "学校",
  "面试",
];

export function detectArrangementFromMessage(
  message: Pick<
    TestMessage,
    "id" | "conversationId" | "conversationType" | "identityId" | "text" | "sentAt"
  >,
  context: ArrangementDetectionContext
): ArrangementDraft | null {
  const text = message.text.trim();
  if (!text) return null;

  const hasHint = arrangementHints.some((hint) => text.includes(hint));
  if (!hasHint) return null;

  const timeText = detectTimeText(text);
  const priority = detectPriority(text);
  const primaryTagId = detectPrimaryTagId(text);

  return {
    title: buildDetectedTitle(text),
    status: "active",
    timeText,
    timeMode: timeText ? "point" : "none",
    repeatRule: { frequency: "none", interval: 1 },
    priority,
    primaryTagId,
    tagIds: [primaryTagId],
    note: "来自测试消息识别，请确认内容后再加入安排。",
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
  };
}

function detectTimeText(text: string) {
  const dayMatch = text.match(/今天|明天|后天|大后天|本周|这周|下周|周[一二三四五六日天]|星期[一二三四五六日天]/)?.[0];
  const periodMatch = text.match(/早上|上午|中午|下午|晚上|今晚|傍晚/)?.[0];
  const clockMatch = text.match(/\d{1,2}[:：点]\d{0,2}/)?.[0];
  return [dayMatch, periodMatch, clockMatch].filter(Boolean).join(" ") || undefined;
}

function detectPriority(text: string): ArrangementPriority {
  const important = /一定|必须|务必|重要|记得|复查|面试/.test(text);
  const urgent = /今天|明天|马上|尽快|上午|下午|晚上/.test(text);
  if (important && urgent) return "important_urgent";
  if (important) return "important_not_urgent";
  if (urgent) return "urgent_not_important";
  return "not_important_not_urgent";
}

function detectPrimaryTagId(text: string) {
  if (/医院|体检|检查|复查|挂号|身体/.test(text)) return "health";
  if (/作业|考试|课程|阅读|学校|学习/.test(text)) return "study";
  if (/公司|会议|开会|客户|面试|工作/.test(text)) return "work";
  if (/早餐|午餐|晚餐|买菜|取快递|缴费|带/.test(text)) return "daily";
  if (/爸爸|妈妈|家人|孩子|家庭/.test(text)) return "family";
  return "other";
}

function buildDetectedTitle(text: string) {
  const cleaned = text
    .replace(/^(好的|好|嗯|收到|帮我|记得|一定要|请你|麻烦你)[，,。.\s]*/g, "")
    .replace(/[，,。.!！?？]+$/g, "")
    .trim();

  if (!cleaned) return "确认一条新安排";
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}...` : cleaned;
}
