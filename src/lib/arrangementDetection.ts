import type { TestConversationType, TestMessage } from "@/data/testConversations";
import type { ArrangementDraft } from "@/types/arrangement";

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
  const priority = /一定|必须|务必|重要|记得/.test(text) ? "important" : "normal";
  const tags = detectTags(text);
  const placeText = detectPlaceText(text);

  return {
    title: buildDetectedTitle(text),
    status: "active",
    timeText,
    startText: timeText,
    endText: undefined,
    priority,
    tags,
    personText: context.senderName,
    placeText,
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

function detectTags(text: string) {
  const tags: string[] = [];
  if (/医院|体检|检查|挂号|身体/.test(text)) tags.push("健康");
  if (/早餐|午餐|晚餐|带|买/.test(text)) tags.push("生活");
  if (/公司|会议|开会|客户|面试/.test(text)) tags.push("工作");
  if (/学校|课程|作业|考试/.test(text)) tags.push("学习");
  if (tags.length === 0) tags.push("待确认");
  return tags.slice(0, 3);
}

function detectPlaceText(text: string) {
  if (text.includes("医院")) return "医院";
  if (text.includes("公司")) return "公司";
  if (text.includes("学校")) return "学校";
  if (text.includes("家")) return "家";
  return undefined;
}

function buildDetectedTitle(text: string) {
  const cleaned = text
    .replace(/^(好的|好|嗯|收到|帮我|记得|一定要|请你|麻烦你)[，,。.\s]*/g, "")
    .replace(/[，,。.!！?？]+$/g, "")
    .trim();

  if (!cleaned) return "确认一条新安排";
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}...` : cleaned;
}
