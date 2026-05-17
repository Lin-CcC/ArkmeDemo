import type { TestConversationType } from "@/data/testConversations";

export type ArrangementStatus = "active" | "completed" | "abandoned";

export type ArrangementPriority =
  | "important_urgent"
  | "important_not_urgent"
  | "urgent_not_important"
  | "not_important_not_urgent";

export type ArrangementTimeMode = "none" | "point" | "range" | "all_day";

export type ArrangementRepeatFrequency = "none" | "daily" | "weekly" | "monthly";

export type ArrangementRepeatRule = {
  frequency: ArrangementRepeatFrequency;
  interval: number;
  endDate?: string;
};

export type ArrangementReminderOffset = "at_time" | "5m" | "15m" | "1h" | "1d";

export type ArrangementTag = {
  id: string;
  name: string;
  color: string;
  source: "system" | "custom";
};

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
  timeMode: ArrangementTimeMode;
  dateText?: string;
  pointTime?: string;
  startTime?: string;
  endTime?: string;
  repeatRule: ArrangementRepeatRule;
  reminderEnabled?: boolean;
  reminderOffset?: ArrangementReminderOffset;
  priority: ArrangementPriority;
  primaryTagId: string;
  tagIds: string[];
  tags?: string[];
  personText?: string;
  placeText?: string;
  note?: string;
  source?: ArrangementSource;
  sources?: ArrangementSource[];
  createdAt: number;
  updatedAt: number;
};

export type ArrangementDraft = {
  title: string;
  status?: ArrangementStatus;
  timeText?: string;
  startText?: string;
  endText?: string;
  timeMode?: ArrangementTimeMode;
  dateText?: string;
  pointTime?: string;
  startTime?: string;
  endTime?: string;
  repeatRule?: ArrangementRepeatRule;
  reminderEnabled?: boolean;
  reminderOffset?: ArrangementReminderOffset;
  priority: ArrangementPriority;
  primaryTagId: string;
  tagIds: string[];
  tags?: string[];
  personText?: string;
  placeText?: string;
  note?: string;
  source?: ArrangementSource;
  sources?: ArrangementSource[];
};

export type ArrangementCompletionSuggestion = {
  id: string;
  arrangementId: string;
  arrangementTitle: string;
  source: ArrangementSource;
  reason?: string;
  origin?: "ai" | "local";
  createdAt: number;
};

export type PendingArrangementQueueItem =
  | {
      id: string;
      kind: "completion";
      completion: ArrangementCompletionSuggestion;
      createdAt: number;
    }
  | {
      id: string;
      kind: "draft";
      draft: ArrangementDraft;
      createdAt: number;
    };

export type ArrangementAiSettings = {
  apiKey: string;
  endpointUrl?: string;
  model?: string;
  updatedAt: number | null;
};
