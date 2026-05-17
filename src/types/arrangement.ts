import type { TestConversationType } from "@/data/testConversations";

export type ArrangementStatus = "active" | "completed" | "later";

export type ArrangementPriority = "normal" | "important";

export type ArrangementSource = {
  type: "sendtest";
  conversationId: string;
  conversationType: TestConversationType;
  conversationTitle: string;
  messageId: string;
  messageText: string;
  senderName: string;
  senderAvatarLabel?: string;
  sentAt: number;
};

export type Arrangement = {
  id: string;
  title: string;
  status: ArrangementStatus;
  timeText?: string;
  startText?: string;
  endText?: string;
  priority: ArrangementPriority;
  tags: string[];
  personText?: string;
  placeText?: string;
  note?: string;
  source?: ArrangementSource;
  createdAt: number;
  updatedAt: number;
};

export type ArrangementDraft = {
  title: string;
  status?: ArrangementStatus;
  timeText?: string;
  startText?: string;
  endText?: string;
  priority: ArrangementPriority;
  tags: string[];
  personText?: string;
  placeText?: string;
  note?: string;
  source?: ArrangementSource;
};

export type ArrangementAiSettings = {
  apiKey: string;
  updatedAt: number | null;
};
