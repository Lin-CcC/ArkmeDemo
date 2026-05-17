import React from "react";
import { cn } from "@/lib/utils";
import type {
  Arrangement,
  ArrangementDraft,
  ArrangementPriority,
  ArrangementReminderOffset,
  ArrangementRepeatFrequency,
  ArrangementRepeatRule,
  ArrangementSource,
  ArrangementStatus,
  ArrangementTag,
  ArrangementTimeMode,
} from "@/types/arrangement";

type ArrangementEditorMode = "create" | "edit" | "confirm";
type SheetType =
  | "priority"
  | "tag"
  | "date"
  | "repeatEndDate"
  | "reminder"
  | "pointTime"
  | "startTime"
  | "endTime";

type ArrangementEditorSheetProps = {
  open: boolean;
  mode: ArrangementEditorMode;
  initialValue: Arrangement | ArrangementDraft | null;
  arrangementTags: ArrangementTag[];
  onCreateTag: (name: string, color: string) => ArrangementTag;
  onClose: () => void;
  onOpenSource?: (source: ArrangementSource) => void;
  onSave: (draft: ArrangementDraft) => void;
};

const emptyRepeatRule: ArrangementRepeatRule = { frequency: "none", interval: 1 };

const emptyDraft: ArrangementDraft = {
  title: "",
  priority: "not_important_not_urgent",
  primaryTagId: "other",
  tagIds: ["other"],
  timeMode: "none",
  repeatRule: emptyRepeatRule,
  reminderEnabled: false,
  reminderOffset: "at_time",
};

const recommendedColors = [
  "#14B8A6",
  "#0E9DEC",
  "#8363FF",
  "#09B83E",
  "#F59E0B",
  "#E04DAE",
  "#EF4444",
  "#64748B",
  "#8B5CF6",
  "#06B6D4",
  "#84CC16",
  "#F97316",
];

const priorityOptions: Array<{ value: ArrangementPriority; label: string; hint: string }> = [
  { value: "important_urgent", label: "重要且紧急", hint: "现在优先处理" },
  { value: "important_not_urgent", label: "重要不紧急", hint: "值得规划推进" },
  { value: "urgent_not_important", label: "紧急不重要", hint: "尽快顺手处理" },
  { value: "not_important_not_urgent", label: "不重要不紧急", hint: "低压力记录" },
];

const statusOptions: Array<{ value: ArrangementStatus; label: string }> = [
  { value: "active", label: "未完成" },
  { value: "completed", label: "完成" },
  { value: "abandoned", label: "放弃" },
];

const timeModeOptions: Array<{ value: Exclude<ArrangementTimeMode, "none">; label: string }> = [
  { value: "point", label: "时间点" },
  { value: "range", label: "时间段" },
  { value: "all_day", label: "全天" },
];

const repeatOptions: Array<{ value: ArrangementRepeatFrequency; label: string }> = [
  { value: "daily", label: "按天" },
  { value: "weekly", label: "按周" },
  { value: "monthly", label: "按月" },
];

const reminderOptions: Array<{ value: ArrangementReminderOffset; label: string }> = [
  { value: "at_time", label: "准时" },
  { value: "5m", label: "提前 5 分钟" },
  { value: "15m", label: "提前 15 分钟" },
  { value: "1h", label: "提前 1 小时" },
  { value: "1d", label: "提前 1 天" },
];

const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minuteOptions = ["00", "15", "30", "45"];

export default function ArrangementEditorSheet({
  open,
  mode,
  initialValue,
  arrangementTags,
  onCreateTag,
  onClose,
  onOpenSource,
  onSave,
}: ArrangementEditorSheetProps) {
  const [draft, setDraft] = React.useState<ArrangementDraft>(emptyDraft);
  const [activeSheet, setActiveSheet] = React.useState<SheetType | null>(null);
  const [creatingTag, setCreatingTag] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState("");
  const [newTagColor, setNewTagColor] = React.useState(recommendedColors[0]);

  React.useEffect(() => {
    setDraft(normalizeInitialValue(initialValue, arrangementTags));
    setActiveSheet(null);
    setCreatingTag(false);
    setNewTagName("");
    setNewTagColor(recommendedColors[0]);
  }, [arrangementTags, initialValue, open]);

  if (!open) return null;

  const title = getSheetTitle(mode);
  const canSave = draft.title.trim().length > 0;
  const selectedTag = arrangementTags.find((tag) => tag.id === draft.primaryTagId);
  const priority = priorityOptions.find((option) => option.value === draft.priority) ?? priorityOptions[3];
  const repeatRule = draft.repeatRule ?? emptyRepeatRule;
  const timeEnabled = Boolean(draft.timeMode && draft.timeMode !== "none");
  const reminderEnabled = Boolean(draft.reminderEnabled);

  const updateDraft = (patch: Partial<ArrangementDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const updateRepeatRule = (patch: Partial<ArrangementRepeatRule>) => {
    updateDraft({
      repeatRule: {
        ...emptyRepeatRule,
        ...repeatRule,
        ...patch,
      },
    });
  };

  const handleCreateTag = () => {
    const tagName = newTagName.trim();
    if (!tagName) return;

    const createdTag = onCreateTag(tagName, newTagColor);
    updateDraft({
      primaryTagId: createdTag.id,
      tagIds: Array.from(new Set([createdTag.id, ...draft.tagIds])),
    });
    setNewTagName("");
    setCreatingTag(false);
  };

  const selectPrimaryTag = (tagId: string) => {
    updateDraft({
      primaryTagId: tagId,
      tagIds: Array.from(new Set([tagId, ...draft.tagIds])),
    });
    setActiveSheet(null);
  };

  const toggleTimeEnabled = () => {
    if (timeEnabled) {
      updateDraft({
        timeMode: "none",
        timeText: undefined,
        startText: undefined,
        endText: undefined,
        dateText: undefined,
        pointTime: undefined,
        startTime: undefined,
        endTime: undefined,
        repeatRule: emptyRepeatRule,
        reminderEnabled: false,
        reminderOffset: "at_time",
      });
      return;
    }

    updateDraft({
      timeMode: inferUsefulTimeMode(draft),
      repeatRule,
      reminderEnabled: true,
      reminderOffset: draft.reminderOffset ?? defaultReminderOffset(draft.timeMode),
    });
  };

  const applyDuration = (minutes: number) => {
    const baseTime = draft.startTime ?? "09:00";
    updateDraft({
      startTime: baseTime,
      endTime: addMinutesToTime(baseTime, minutes),
    });
  };

  const handleSave = () => {
    if (!canSave) return;

    const normalizedTagIds = Array.from(new Set([draft.primaryTagId, ...draft.tagIds])).filter(
      (tagId) => arrangementTags.some((tag) => tag.id === tagId)
    );
    const timeSummary = buildTimeSummary(draft);

    onSave({
      ...draft,
      title: draft.title.trim(),
      timeText: timeSummary,
      startText: draft.timeMode === "range" ? joinDateTime(draft.dateText, draft.startTime) : undefined,
      endText: draft.timeMode === "range" ? joinDateTime(draft.dateText, draft.endTime) : undefined,
      note: normalizeOptionalText(draft.note),
      primaryTagId: draft.primaryTagId,
      tagIds: normalizedTagIds.length > 0 ? normalizedTagIds : [draft.primaryTagId],
      tags: normalizedTagIds
        .map((tagId) => arrangementTags.find((tag) => tag.id === tagId)?.name)
        .filter((tagName): tagName is string => Boolean(tagName)),
      repeatRule: timeEnabled ? repeatRule : emptyRepeatRule,
      reminderEnabled: timeEnabled ? reminderEnabled : false,
      reminderOffset: timeEnabled ? draft.reminderOffset ?? defaultReminderOffset(draft.timeMode) : "at_time",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-0 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="关闭安排编辑" />
      <section className="relative z-10 flex max-h-[92vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-bg shadow-[0_-16px_40px_rgba(15,23,42,0.18)]">
        <header className="shrink-0 border-b border-border px-4 py-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fill-4" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold leading-6 text-text">{title}</h2>
              {mode === "confirm" && (
                <p className="mt-0.5 text-[12px] leading-5 text-text-muted">确认后才会写入安排列表。</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-[18px] text-text-muted"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <section className="rounded-[16px] border border-border bg-surface px-3 py-2">
            <p className="px-1 pb-1 text-[12px] font-semibold leading-5 text-text-muted">基础设置</p>
            <SettingRow label="标题">
              <InlineEditableText
                value={draft.title}
                onChange={(value) => updateDraft({ title: value })}
                ariaLabel="标题"
                className="min-h-9 flex-1 py-2 text-right text-[15px] font-medium leading-5 text-text"
                placeholder="例如：明天上午去医院"
              />
            </SettingRow>
            <SettingRow label="状态">
              <div className="inline-flex shrink-0 gap-1 rounded-full bg-bg p-1">
                {statusOptions.map((status) => {
                  const active = (draft.status ?? "active") === status.value;
                  return (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => updateDraft({ status: status.value })}
                      className={`h-8 rounded-full px-3 text-[12px] transition ${
                        active ? "bg-text font-semibold text-bg" : "text-text-muted"
                      }`}
                    >
                      {status.label}
                    </button>
                  );
                })}
              </div>
            </SettingRow>
            <SettingRow label="优先级">
              <CompactChip onClick={() => setActiveSheet("priority")}>{priority.label}</CompactChip>
            </SettingRow>
            <SettingRow label="标签">
              <CompactChip onClick={() => setActiveSheet("tag")}>
                {selectedTag && <ColorDot color={selectedTag.color} />}
                {selectedTag?.name ?? "选择"}
              </CompactChip>
            </SettingRow>
            <SettingRow label="备注" last align="start">
              <InlineEditableText
                value={draft.note ?? ""}
                onChange={(value) => updateDraft({ note: value })}
                ariaLabel="备注"
                multiline
                className="min-h-9 flex-1 py-2 text-right text-[13px] leading-5 text-text"
                placeholder="未填写"
              />
            </SettingRow>
          </section>

          {draft.source && (
            <section className="rounded-[16px] border border-border bg-surface px-3 py-3">
              <button
                type="button"
                onClick={() => onOpenSource?.(draft.source!)}
                disabled={!onOpenSource}
                className="block w-full text-left disabled:cursor-default"
              >
                <span className="block text-[12px] font-semibold leading-5 text-text">来源消息</span>
                <span className="mt-0.5 block truncate text-[12px] leading-5 text-text-muted">
                  来自 {draft.source.senderName}：{draft.source.messageText}
                </span>
              </button>
            </section>
          )}

          <section className="rounded-[16px] border border-border bg-surface px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold leading-5 text-text">时间管理</p>
                <p className="mt-0.5 text-[11px] leading-4 text-text-tertiary">
                  {timeEnabled ? "选择日期、时间和重复方式。" : "需要提醒或时间段时再开启。"}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTimeEnabled}
                className={`flex h-7 w-12 shrink-0 items-center rounded-full px-0.5 transition ${
                  timeEnabled ? "bg-text" : "bg-fill-4"
                }`}
                aria-label={timeEnabled ? "关闭时间管理" : "开启时间管理"}
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-bg shadow-sm transition-transform ${
                    timeEnabled ? "translate-x-[20px]" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {!timeEnabled ? (
              <p className="border-t border-border/70 px-1 py-3 text-[13px] leading-5 text-text-muted">
                未设置时间
              </p>
            ) : (
              <div className="mt-2">
                <PropertyRow label="类型">
                  <div className="inline-flex gap-1 rounded-full bg-bg p-1">
                    {timeModeOptions.map((option) => {
                      const active = draft.timeMode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateDraft({ timeMode: option.value })}
                          className={`h-8 rounded-full px-3 text-[12px] transition ${
                            active ? "bg-text font-semibold text-bg" : "text-text-muted"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </PropertyRow>

                <PropertyButton
                  label="日期"
                  value={formatDateValue(draft.dateText)}
                  onClick={() => setActiveSheet("date")}
                />

                {draft.timeMode === "point" && (
                  <PropertyButton
                    label="提醒时间"
                    value={draft.pointTime || "选择时间"}
                    onClick={() => setActiveSheet("pointTime")}
                  />
                )}

                {draft.timeMode === "range" && (
                  <>
                    <div className="grid grid-cols-2 gap-4 border-b border-border/70 px-1">
                      <TimePairButton
                        label="开始"
                        value={draft.startTime || "选择"}
                        onClick={() => setActiveSheet("startTime")}
                      />
                      <TimePairButton
                        label="结束"
                        value={draft.endTime || "选择"}
                        onClick={() => setActiveSheet("endTime")}
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto px-1 py-2">
                      {[30, 60, 120].map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          onClick={() => applyDuration(minutes)}
                          className="shrink-0 rounded-full bg-bg px-3 py-1.5 text-[12px] text-text-muted"
                        >
                          {minutes < 60 ? `${minutes} 分钟` : `${minutes / 60} 小时`}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <PropertyButton
                  label="提醒"
                  value={reminderEnabled ? reminderLabel(draft.reminderOffset, draft.timeMode) : "关闭"}
                  onClick={() => setActiveSheet("reminder")}
                />

                <section className="px-1 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold leading-5 text-text">重复</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-text-tertiary">
                        {repeatRule.frequency === "none" ? "关闭" : repeatSummary(repeatRule)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateRepeatRule({
                          frequency: repeatRule.frequency === "none" ? "daily" : "none",
                          interval: repeatRule.frequency === "none" ? 1 : repeatRule.interval,
                        })
                      }
                      className={`flex h-7 w-12 shrink-0 items-center rounded-full px-0.5 transition ${
                        repeatRule.frequency !== "none" ? "bg-text" : "bg-fill-4"
                      }`}
                      aria-label={repeatRule.frequency !== "none" ? "关闭重复" : "开启重复"}
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-bg shadow-sm transition-transform ${
                          repeatRule.frequency !== "none" ? "translate-x-[20px]" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  {repeatRule.frequency !== "none" && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-surface p-1">
                        {repeatOptions.map((option) => {
                          const active = repeatRule.frequency === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => updateRepeatRule({ frequency: option.value })}
                              className={`h-9 rounded-[10px] text-[12px] transition ${
                                active ? "bg-text font-semibold text-bg" : "text-text-muted"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] font-medium leading-4 text-text-muted">
                          频率间隔
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={repeatRule.interval}
                          onChange={(event) =>
                            updateRepeatRule({ interval: Math.max(1, Number(event.target.value) || 1) })
                          }
                          className="h-10 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-primary"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveSheet("repeatEndDate")}
                        className="flex w-full items-center justify-between rounded-[12px] border border-border bg-surface px-3 py-2 text-left"
                      >
                        <span>
                          <span className="block text-[12px] text-text-muted">结束日期</span>
                          <span className="block text-[13px] text-text">
                            {repeatRule.endDate || "不设置结束"}
                          </span>
                        </span>
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>

        <footer className="shrink-0 border-t border-border bg-bg px-4 py-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-[12px] bg-surface text-[14px] font-medium text-text-muted"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="h-11 flex-1 rounded-[12px] bg-text text-[14px] font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-35"
            >
              保存
            </button>
          </div>
        </footer>

        {activeSheet && (
          <BottomSheet onClose={() => setActiveSheet(null)}>
            {activeSheet === "priority" && (
              <PriorityPicker
                value={draft.priority}
                onChange={(value) => {
                  updateDraft({ priority: value });
                  setActiveSheet(null);
                }}
              />
            )}
            {activeSheet === "tag" && (
              <TagPicker
                tags={arrangementTags}
                selectedTagId={draft.primaryTagId}
                creatingTag={creatingTag}
                newTagName={newTagName}
                newTagColor={newTagColor}
                onSelectTag={selectPrimaryTag}
                onToggleCreate={() => setCreatingTag((creating) => !creating)}
                onNewTagNameChange={setNewTagName}
                onNewTagColorChange={setNewTagColor}
                onCreateTag={handleCreateTag}
              />
            )}
            {activeSheet === "date" && (
              <DatePicker
                value={draft.dateText}
                onChange={(dateText) => {
                  updateDraft({ dateText });
                  setActiveSheet(null);
                }}
              />
            )}
            {activeSheet === "repeatEndDate" && (
              <DatePicker
                value={repeatRule.endDate}
                onChange={(endDate) => {
                  updateRepeatRule({ endDate });
                  setActiveSheet(null);
                }}
              />
            )}
            {activeSheet === "reminder" && (
              <ReminderPicker
                enabled={reminderEnabled}
                offset={draft.reminderOffset ?? defaultReminderOffset(draft.timeMode)}
                timeMode={draft.timeMode}
                onChange={(enabled, reminderOffset) => {
                  updateDraft({ reminderEnabled: enabled, reminderOffset });
                  setActiveSheet(null);
                }}
              />
            )}
            {(activeSheet === "pointTime" || activeSheet === "startTime" || activeSheet === "endTime") && (
              <TimePicker
                title={
                  activeSheet === "pointTime" ? "选择提醒时间" : activeSheet === "startTime" ? "选择开始时间" : "选择结束时间"
                }
                value={
                  activeSheet === "pointTime"
                    ? draft.pointTime
                    : activeSheet === "startTime"
                      ? draft.startTime
                      : draft.endTime
                }
                onChange={(time) => {
                  if (activeSheet === "pointTime") updateDraft({ pointTime: time });
                  if (activeSheet === "startTime") updateDraft({ startTime: time });
                  if (activeSheet === "endTime") updateDraft({ endTime: time });
                  setActiveSheet(null);
                }}
              />
            )}
          </BottomSheet>
        )}
      </section>
    </div>
  );
}

function SettingRow({
  label,
  children,
  last = false,
  align = "center",
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3 px-1 py-2",
        align === "start" ? "items-start" : "items-center",
        !last && "border-b border-border/70"
      )}
    >
      <span
        className={cn(
          "w-12 shrink-0 text-[13px] font-medium leading-5 text-text-muted",
          align === "start" && "pt-2"
        )}
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

function InlineEditableText({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  multiline?: boolean;
}) {
  const textRef = React.useRef<HTMLDivElement>(null);
  const isEditingRef = React.useRef(false);

  React.useEffect(() => {
    const node = textRef.current;
    if (!node || isEditingRef.current || node.textContent === value) return;
    node.textContent = value;
  }, [value]);

  const commitValue = () => {
    const nextValue = textRef.current?.textContent ?? "";
    onChange(nextValue.replace(/\u00a0/g, " "));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (multiline) return;
    if (event.key === "Enter") {
      event.preventDefault();
      textRef.current?.blur();
    }
  };

  return (
    <div
      ref={textRef}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline={multiline || undefined}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={() => {
        isEditingRef.current = true;
      }}
      onInput={commitValue}
      onBlur={() => {
        isEditingRef.current = false;
        commitValue();
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "min-w-0 cursor-text whitespace-pre-wrap break-words bg-transparent outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-text-tertiary focus-visible:ring-0",
        className
      )}
    />
  );
}

function CompactChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-[180px] items-center gap-1.5 rounded-full bg-bg px-3 py-1.5 text-[13px] font-medium leading-5 text-text"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate">{children}</span>
      <span className="text-[14px] text-text-tertiary">›</span>
    </button>
  );
}

function ColorDot({ color }: { color: string }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[48px] w-full items-center justify-between gap-3 border-t border-border/70 px-1 py-2">
      <span className="shrink-0 text-[13px] leading-5 text-text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

function PropertyButton({
  label,
  value,
  onClick,
  compact = false,
}: {
  label: string;
  value: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[48px] w-full items-center justify-between gap-3 px-1 py-2 text-left ${
        compact ? "" : "border-t border-border/70"
      }`}
    >
      <span className="shrink-0 text-[13px] leading-5 text-text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-[14px] font-medium leading-5 text-text">{value}</span>
    </button>
  );
}

function TimePairButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[48px] min-w-0 items-center justify-between gap-2 py-2 text-left"
    >
      <span className="shrink-0 text-[13px] leading-5 text-text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-[14px] font-medium leading-5 text-text">{value}</span>
    </button>
  );
}

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/20">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="关闭选择面板" />
      <section className="relative max-h-[74vh] w-full overflow-y-auto rounded-t-[22px] bg-bg px-4 pb-4 pt-3 shadow-[0_-12px_32px_rgba(15,23,42,0.18)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fill-4" />
        {children}
      </section>
    </div>
  );
}

function PriorityPicker({
  value,
  onChange,
}: {
  value: ArrangementPriority;
  onChange: (value: ArrangementPriority) => void;
}) {
  return (
    <div>
      <h3 className="text-[16px] font-semibold text-text">选择优先级</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {priorityOptions.map((priority) => {
          const active = priority.value === value;
          return (
            <button
              key={priority.value}
              type="button"
              onClick={() => onChange(priority.value)}
              className={`min-h-[64px] rounded-[14px] border px-3 py-2 text-left transition ${
                active ? "border-text bg-text text-bg" : "border-border bg-surface text-text"
              }`}
            >
              <span className="block text-[13px] font-semibold leading-5">{priority.label}</span>
              <span className={`mt-0.5 block text-[11px] leading-4 ${active ? "text-bg/70" : "text-text-tertiary"}`}>
                {priority.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagPicker({
  tags,
  selectedTagId,
  creatingTag,
  newTagName,
  newTagColor,
  onSelectTag,
  onToggleCreate,
  onNewTagNameChange,
  onNewTagColorChange,
  onCreateTag,
}: {
  tags: ArrangementTag[];
  selectedTagId: string;
  creatingTag: boolean;
  newTagName: string;
  newTagColor: string;
  onSelectTag: (tagId: string) => void;
  onToggleCreate: () => void;
  onNewTagNameChange: (name: string) => void;
  onNewTagColorChange: (color: string) => void;
  onCreateTag: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-text">选择标签</h3>
        <button
          type="button"
          onClick={onToggleCreate}
          className="rounded-full bg-surface px-3 py-1.5 text-[12px] font-medium text-text"
        >
          新增
        </button>
      </div>
      <div className="mt-3 flex max-h-[180px] flex-wrap gap-2 overflow-y-auto">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => onSelectTag(tag.id)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] transition ${
              selectedTagId === tag.id ? "border-text bg-text font-semibold text-bg" : "border-border bg-surface text-text-muted"
            }`}
          >
            <ColorDot color={tag.color} />
            {tag.name}
          </button>
        ))}
      </div>
      {creatingTag && (
        <div className="mt-4 rounded-[14px] bg-surface px-3 py-3">
          <div className="flex items-center gap-2">
            <input
              value={newTagName}
              onChange={(event) => onNewTagNameChange(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-[12px] border border-border bg-bg px-3 text-[13px] text-text outline-none focus:border-primary"
              placeholder="新增标签"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(event) => onNewTagColorChange(event.target.value)}
              className="h-10 w-12 rounded-[12px] border border-border bg-bg p-1"
              aria-label="自定义标签颜色"
            />
            <button
              type="button"
              onClick={onCreateTag}
              disabled={!newTagName.trim()}
              className="h-10 rounded-[12px] bg-text px-3 text-[13px] font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-35"
            >
              保存
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {recommendedColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onNewTagColorChange(color)}
                className={`h-6 w-6 rounded-full border-2 ${newTagColor === color ? "border-text" : "border-transparent"}`}
                style={{ backgroundColor: color }}
                aria-label={`选择标签颜色 ${color}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderPicker({
  enabled,
  offset,
  timeMode,
  onChange,
}: {
  enabled: boolean;
  offset: ArrangementReminderOffset;
  timeMode?: ArrangementTimeMode;
  onChange: (enabled: boolean, offset: ArrangementReminderOffset) => void;
}) {
  return (
    <div>
      <h3 className="text-[16px] font-semibold text-text">提醒</h3>
      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={() => onChange(false, defaultReminderOffset(timeMode))}
          className={`flex h-10 w-full items-center justify-between rounded-[12px] border px-3 text-[13px] ${
            enabled ? "border-border bg-surface text-text-muted" : "border-text bg-text font-semibold text-bg"
          }`}
        >
          关闭提醒
        </button>
        {reminderOptions.map((option) => {
          const active = enabled && offset === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(true, option.value)}
              className={`flex h-10 w-full items-center justify-between rounded-[12px] border px-3 text-[13px] ${
                active ? "border-text bg-text font-semibold text-bg" : "border-border bg-surface text-text"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DatePicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const quickDates = React.useMemo(() => buildDateOptions(), []);
  const [visibleMonth, setVisibleMonth] = React.useState(() => startOfMonth(value ? new Date(value) : new Date()));
  const monthDays = React.useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-text">选择日期</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}
            className="h-8 w-8 rounded-full bg-surface text-[16px] text-text"
          >
            ‹
          </button>
          <span className="min-w-[74px] text-center text-[13px] font-medium text-text">
            {visibleMonth.getFullYear()}.{visibleMonth.getMonth() + 1}
          </span>
          <button
            type="button"
            onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
            className="h-8 w-8 rounded-full bg-surface text-[16px] text-text"
          >
            ›
          </button>
        </div>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {quickDates.map((date) => {
          const active = value === date.value;
          return (
            <button
              key={date.value}
              type="button"
              onClick={() => onChange(date.value)}
              className={`min-h-[52px] min-w-[70px] rounded-[13px] border px-2 py-2 text-center transition ${
                active ? "border-text bg-text text-bg" : "border-border bg-surface text-text"
              }`}
            >
              <span className="block text-[12px] font-semibold leading-4">{date.label}</span>
              <span className={`mt-0.5 block text-[11px] leading-4 ${active ? "text-bg/70" : "text-text-tertiary"}`}>
                {date.display}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {["日", "一", "二", "三", "四", "五", "六"].map((weekday) => (
          <span key={weekday} className="py-1 text-[11px] text-text-tertiary">
            {weekday}
          </span>
        ))}
        {monthDays.map((day, index) =>
          day ? (
            <button
              key={day.value}
              type="button"
              onClick={() => onChange(day.value)}
              className={`h-9 rounded-full text-[12px] transition ${
                value === day.value ? "bg-text font-semibold text-bg" : "text-text"
              }`}
            >
              {day.day}
            </button>
          ) : (
            <span key={`blank-${index}`} />
          )
        )}
      </div>
    </div>
  );
}

function TimePicker({
  title,
  value,
  onChange,
}: {
  title: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  const [hour, minute] = splitTime(value);
  const [selectedHour, setSelectedHour] = React.useState(hour);
  const [selectedMinute, setSelectedMinute] = React.useState(minute);

  return (
    <div>
      <h3 className="text-[16px] font-semibold text-text">{title}</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <WheelColumn title="小时" options={hourOptions} value={selectedHour} onChange={setSelectedHour} />
        <WheelColumn title="分钟" options={minuteOptions} value={selectedMinute} onChange={setSelectedMinute} />
      </div>
      <button
        type="button"
        onClick={() => onChange(`${selectedHour}:${selectedMinute}`)}
        className="mt-3 h-10 w-full rounded-[12px] bg-text text-[14px] font-semibold text-bg"
      >
        确定 {selectedHour}:{selectedMinute}
      </button>
    </div>
  );
}

function WheelColumn({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-center text-[12px] text-text-muted">{title}</p>
      <div className="max-h-[190px] snap-y overflow-y-auto rounded-[14px] bg-surface p-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`mb-1 h-10 w-full snap-center rounded-[11px] text-[15px] transition last:mb-0 ${
              value === option ? "bg-text font-semibold text-bg" : "text-text-muted"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function normalizeInitialValue(
  value: Arrangement | ArrangementDraft | null,
  arrangementTags: ArrangementTag[]
): ArrangementDraft {
  if (!value) return emptyDraft;

  const primaryTagId =
    value.primaryTagId && arrangementTags.some((tag) => tag.id === value.primaryTagId)
      ? value.primaryTagId
      : arrangementTags[0]?.id ?? "other";
  const tagIds = Array.from(new Set([primaryTagId, ...(value.tagIds ?? [])])).filter((tagId) =>
    arrangementTags.some((tag) => tag.id === tagId)
  );

  return {
    title: value.title ?? "",
    status: value.status,
    timeText: value.timeText,
    startText: value.startText,
    endText: value.endText,
    timeMode: value.timeMode ?? inferTimeMode(value),
    dateText: value.dateText,
    pointTime: value.pointTime,
    startTime: value.startTime,
    endTime: value.endTime,
    repeatRule: value.repeatRule ?? emptyRepeatRule,
    reminderEnabled: value.reminderEnabled,
    reminderOffset: value.reminderOffset ?? defaultReminderOffset(value.timeMode),
    priority: value.priority ?? "not_important_not_urgent",
    primaryTagId,
    tagIds: tagIds.length > 0 ? tagIds : [primaryTagId],
    tags: value.tags,
    note: value.note,
    source: value.source,
  };
}

function inferTimeMode(value: Arrangement | ArrangementDraft): ArrangementTimeMode {
  if (value.timeMode) return value.timeMode;
  if (value.startText || value.endText) return "range";
  if (value.timeText) return "point";
  return "none";
}

function inferUsefulTimeMode(draft: ArrangementDraft): Exclude<ArrangementTimeMode, "none"> {
  if (draft.timeMode && draft.timeMode !== "none") return draft.timeMode;
  if (draft.startText || draft.endText) return "range";
  if (draft.timeText) return "point";
  return "point";
}

function getSheetTitle(mode: ArrangementEditorMode) {
  if (mode === "confirm") return "确认安排";
  if (mode === "edit") return "安排详情";
  return "添加安排";
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function joinDateTime(dateText?: string, timeText?: string) {
  return [dateText, timeText].filter(Boolean).join(" ") || undefined;
}

function buildTimeSummary(draft: ArrangementDraft) {
  if (!draft.timeMode || draft.timeMode === "none") return undefined;
  if (draft.timeMode === "all_day") {
    return draft.dateText ? `${draft.dateText} 全天` : draft.timeText ?? "全天";
  }
  if (draft.timeMode === "point") {
    return [draft.dateText, draft.pointTime].filter(Boolean).join(" ") || draft.timeText;
  }
  const datePrefix = draft.dateText ? `${draft.dateText} ` : "";
  const range = [draft.startTime, draft.endTime].filter(Boolean).join(" - ");
  return range ? `${datePrefix}${range}` : draft.dateText || draft.timeText;
}

function repeatSummary(rule: ArrangementRepeatRule) {
  if (rule.frequency === "none") return "不重复";
  const unit = rule.frequency === "daily" ? "天" : rule.frequency === "weekly" ? "周" : "月";
  const intervalText = rule.interval > 1 ? `每 ${rule.interval} ${unit}` : `每${unit}`;
  return rule.endDate ? `${intervalText}，到 ${rule.endDate} 结束` : intervalText;
}

function defaultReminderOffset(timeMode?: ArrangementTimeMode): ArrangementReminderOffset {
  if (timeMode === "all_day") return "1d";
  if (timeMode === "range") return "15m";
  return "at_time";
}

function reminderLabel(offset: ArrangementReminderOffset | undefined, timeMode?: ArrangementTimeMode) {
  const value = offset ?? defaultReminderOffset(timeMode);
  return reminderOptions.find((option) => option.value === value)?.label ?? "准时";
}

function formatDateValue(value?: string) {
  if (!value) return "选择日期";
  const matched = buildDateOptions().find((date) => date.value === value);
  return matched ? `${matched.label} ${matched.display}` : value;
}

function buildDateOptions() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const value = toDateInputValue(date);
    const label = index === 0 ? "今天" : index === 1 ? "明天" : index === 2 ? "后天" : getWeekdayLabel(date);
    const display = `${date.getMonth() + 1}/${date.getDate()}`;
    return { value, label, display };
  });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, monthDelta: number) {
  return new Date(date.getFullYear(), date.getMonth() + monthDelta, 1);
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = startOfMonth(monthDate);
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const blanks = Array.from({ length: firstDay.getDay() }, () => null);
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), index + 1);
    return {
      day: index + 1,
      value: toDateInputValue(date),
    };
  });
  return [...blanks, ...days];
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekdayLabel(date: Date) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function splitTime(value?: string) {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return ["09", "00"];
  const hour = String(Math.min(23, Math.max(0, Number(match[1])))).padStart(2, "0");
  const minuteValue = Math.min(59, Math.max(0, Number(match[2])));
  const minute = minuteOptions.includes(String(minuteValue).padStart(2, "0"))
    ? String(minuteValue).padStart(2, "0")
    : minuteOptions.reduce((closest, option) =>
        Math.abs(Number(option) - minuteValue) < Math.abs(Number(closest) - minuteValue) ? option : closest
      );
  return [hour, minute];
}

function addMinutesToTime(value: string, minutes: number) {
  const [hour, minute] = splitTime(value);
  const total = (Number(hour) * 60 + Number(minute) + minutes) % (24 * 60);
  const nextHour = String(Math.floor(total / 60)).padStart(2, "0");
  const nextMinute = String(total % 60).padStart(2, "0");
  return `${nextHour}:${nextMinute}`;
}
