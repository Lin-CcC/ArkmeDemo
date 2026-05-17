import type { Arrangement, ArrangementDraft } from "@/types/arrangement";

export type SimilarArrangementMatch = {
  arrangement: Arrangement;
  score: number;
  reasons: string[];
};

const topicKeywords = [
  "医院",
  "复查",
  "体检",
  "检查",
  "挂号",
  "早餐",
  "午餐",
  "晚餐",
  "公司",
  "上班",
  "工作",
  "会议",
  "开会",
  "面试",
  "学校",
  "考试",
  "作业",
  "爸爸",
  "妈妈",
  "家人",
];

const weakWords = [
  "今天",
  "明天",
  "后天",
  "大后天",
  "上午",
  "下午",
  "晚上",
  "记得",
  "一定",
  "提醒",
  "帮我",
  "需要",
  "安排",
  "去",
  "到",
  "的",
  "我",
  "你",
  "他",
  "她",
];

export function findSimilarArrangement(
  draft: ArrangementDraft | null,
  arrangements: Arrangement[]
): SimilarArrangementMatch | null {
  if (!draft) return null;

  const candidates = arrangements
    .filter((arrangement) => arrangement.status === "active")
    .map((arrangement) => scoreArrangementSimilarity(draft, arrangement))
    .filter((match): match is SimilarArrangementMatch => Boolean(match))
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

function scoreArrangementSimilarity(
  draft: ArrangementDraft,
  arrangement: Arrangement
): SimilarArrangementMatch | null {
  let score = 0;
  const reasons: string[] = [];
  const draftText = textForSimilarity(draft);
  const arrangementText = textForSimilarity(arrangement);
  const titleOverlap = textOverlapScore(draft.title, arrangement.title);
  if (titleOverlap >= 0.48) {
    score += titleOverlap >= 0.72 ? 4 : 3;
    reasons.push("标题相近");
  }

  const draftKeywords = extractKeywords(draftText);
  const arrangementKeywords = extractKeywords(arrangementText);
  const sharedKeywords = draftKeywords.filter((keyword) => arrangementKeywords.includes(keyword));
  if (sharedKeywords.length > 0) {
    score += Math.min(3, sharedKeywords.length) * 2;
    reasons.push(`都提到${sharedKeywords.slice(0, 2).join("、")}`);
  }

  if (draft.primaryTagId && draft.primaryTagId === arrangement.primaryTagId) {
    score += 2;
    reasons.push("标签相同");
  }

  const sharedTopic = sharedTopicKeywords(draft, arrangement);
  if (sharedTopic.length > 0) {
    score += Math.min(2, sharedTopic.length) * 3;
    reasons.push(`语境接近：${sharedTopic.slice(0, 2).join("、")}`);
  }

  if (timeIsClose(draft, arrangement)) {
    score += 2;
    reasons.push("时间接近");
  }

  if (score < 5) return null;
  return { arrangement, score, reasons };
}

function textForSimilarity(value: Arrangement | ArrangementDraft) {
  const sourceTexts = [
    value.source?.messageText,
    ...(value.sources ?? []).map((source) => source.messageText),
  ];
  return [
    value.title,
    value.timeText,
    value.dateText,
    value.note,
    ...sourceTexts,
  ]
    .filter(Boolean)
    .join(" ");
}

function extractKeywords(text: string) {
  const normalized = text
    .replace(/[，。！？、,.!?;；:："'“”‘’（）()[\]【】]/g, " ")
    .split(/\s+/)
    .flatMap((part) => {
      if (!part) return [];
      if (/^[a-z0-9]+$/i.test(part)) return [part.toLowerCase()];
      return Array.from(part.matchAll(/[\u4e00-\u9fa5]{2,}/g)).map((match) => match[0]);
    })
    .flatMap(splitChinesePhrase)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !weakWords.includes(word));

  return Array.from(new Set(normalized));
}

function splitChinesePhrase(phrase: string) {
  const matchedTopics = topicKeywords.filter((keyword) => phrase.includes(keyword));
  if (matchedTopics.length > 0) return matchedTopics;
  return [phrase];
}

function textOverlapScore(left: string, right: string) {
  const leftTokens = extractComparableCharacters(left);
  const rightTokens = extractComparableCharacters(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const rightSet = new Set(rightTokens);
  const sharedCount = leftTokens.filter((token) => rightSet.has(token)).length;
  return sharedCount / Math.min(leftTokens.length, rightTokens.length);
}

function extractComparableCharacters(text: string) {
  const cleaned = weakWords.reduce(
    (current, word) => current.split(word).join(""),
    text.replace(/[，。！？、,.!?;；:："'“”‘’（）()[\]【】\s]/g, "")
  );
  return Array.from(new Set(Array.from(cleaned).filter((char) => /[\u4e00-\u9fa5a-z0-9]/i.test(char))));
}

function sharedTopicKeywords(draft: ArrangementDraft, arrangement: Arrangement) {
  const draftText = textForSimilarity(draft);
  const arrangementText = textForSimilarity(arrangement);
  return topicKeywords.filter((keyword) => draftText.includes(keyword) && arrangementText.includes(keyword));
}

function timeIsClose(draft: ArrangementDraft, arrangement: Arrangement) {
  if (draft.timeMode && arrangement.timeMode && draft.timeMode === arrangement.timeMode) {
    if (!draft.timeText && !draft.dateText && !arrangement.timeText && !arrangement.dateText) return true;
  }

  const draftTime = `${draft.dateText ?? ""} ${draft.timeText ?? ""}`;
  const arrangementTime = `${arrangement.dateText ?? ""} ${arrangement.timeText ?? ""}`;
  if (!draftTime.trim() || !arrangementTime.trim()) return false;

  return extractTimeHints(draftTime).some((hint) => extractTimeHints(arrangementTime).includes(hint));
}

function extractTimeHints(text: string) {
  const hints = Array.from(
    text.matchAll(/今天|明天|后天|大后天|本周|这周|下周|周[一二三四五六日天]|星期[一二三四五六日天]|\d{4}-\d{2}-\d{2}/g)
  ).map((match) => match[0]);
  return Array.from(new Set(hints));
}
