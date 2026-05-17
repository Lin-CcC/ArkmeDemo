import React from "react";
import type {
  Arrangement,
  ArrangementDraft,
  ArrangementPriority,
  ArrangementStatus,
} from "@/types/arrangement";

type ArrangementEditorMode = "create" | "edit" | "confirm";

type ArrangementEditorSheetProps = {
  open: boolean;
  mode: ArrangementEditorMode;
  initialValue: Arrangement | ArrangementDraft | null;
  onClose: () => void;
  onSave: (draft: ArrangementDraft) => void;
};

const emptyDraft: ArrangementDraft = {
  title: "",
  priority: "normal",
  tags: [],
};

export default function ArrangementEditorSheet({
  open,
  mode,
  initialValue,
  onClose,
  onSave,
}: ArrangementEditorSheetProps) {
  const [draft, setDraft] = React.useState<ArrangementDraft>(emptyDraft);
  const [tagsText, setTagsText] = React.useState("");

  React.useEffect(() => {
    const nextDraft = normalizeInitialValue(initialValue);
    setDraft(nextDraft);
    setTagsText(nextDraft.tags.join("，"));
  }, [initialValue, open]);

  if (!open) return null;

  const title = getSheetTitle(mode);
  const canSave = draft.title.trim().length > 0;

  const updateDraft = (patch: Partial<ArrangementDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const handleSave = () => {
    if (!canSave) return;

    onSave({
      ...draft,
      title: draft.title.trim(),
      timeText: normalizeOptionalText(draft.timeText),
      startText: normalizeOptionalText(draft.startText),
      endText: normalizeOptionalText(draft.endText),
      personText: normalizeOptionalText(draft.personText),
      placeText: normalizeOptionalText(draft.placeText),
      note: normalizeOptionalText(draft.note),
      tags: tagsText
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-0 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="关闭安排编辑"
      />
      <section className="relative z-10 flex max-h-[92vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-bg shadow-[0_-16px_40px_rgba(15,23,42,0.18)]">
        <header className="shrink-0 border-b border-border px-4 py-4">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fill-4" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold leading-6 text-text">{title}</h2>
              <p className="mt-0.5 text-[12px] leading-5 text-text-muted">
                保存后才会写入安排列表。
              </p>
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
          <Field label="标题">
            <input
              value={draft.title}
              onChange={(event) => updateDraft({ title: event.target.value })}
              className="h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-primary"
              placeholder="例如：明天上午去医院"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3">
            <Field label="时间提示">
              <input
                value={draft.timeText ?? ""}
                onChange={(event) => updateDraft({ timeText: event.target.value })}
                className="h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-primary"
                placeholder="明天上午"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="开始">
                <input
                  value={draft.startText ?? ""}
                  onChange={(event) => updateDraft({ startText: event.target.value })}
                  className="h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-primary"
                  placeholder="09:00"
                />
              </Field>
              <Field label="结束">
                <input
                  value={draft.endText ?? ""}
                  onChange={(event) => updateDraft({ endText: event.target.value })}
                  className="h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-primary"
                  placeholder="11:00"
                />
              </Field>
            </div>
          </div>

          <Field label="优先级">
            <div className="grid grid-cols-2 gap-2 rounded-[12px] bg-surface p-1">
              {(["normal", "important"] as ArrangementPriority[]).map((priority) => {
                const active = draft.priority === priority;
                return (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => updateDraft({ priority })}
                    className={`h-10 rounded-[10px] text-[13px] transition ${
                      active
                        ? "bg-text font-semibold text-bg"
                        : "text-text-muted"
                    }`}
                  >
                    {priority === "important" ? "重要" : "普通"}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="状态">
            <div className="grid grid-cols-3 gap-2 rounded-[12px] bg-surface p-1">
              {(["active", "later", "completed"] as ArrangementStatus[]).map((status) => {
                const active = (draft.status ?? "active") === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => updateDraft({ status })}
                    className={`h-10 rounded-[10px] text-[13px] transition ${
                      active
                        ? "bg-text font-semibold text-bg"
                        : "text-text-muted"
                    }`}
                  >
                    {getStatusLabel(status)}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="标签">
            <input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              className="h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-primary"
              placeholder="健康，工作"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="人物">
              <input
                value={draft.personText ?? ""}
                onChange={(event) => updateDraft({ personText: event.target.value })}
                className="h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-primary"
                placeholder="谁相关"
              />
            </Field>
            <Field label="地点">
              <input
                value={draft.placeText ?? ""}
                onChange={(event) => updateDraft({ placeText: event.target.value })}
                className="h-11 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-text outline-none focus:border-primary"
                placeholder="在哪里"
              />
            </Field>
          </div>

          <Field label="备注">
            <textarea
              value={draft.note ?? ""}
              onChange={(event) => updateDraft({ note: event.target.value })}
              rows={3}
              className="w-full resize-none rounded-[12px] border border-border bg-surface px-3 py-2.5 text-[14px] leading-5 text-text outline-none focus:border-primary"
              placeholder="补充你想记住的细节"
            />
          </Field>

          {draft.source && (
            <div className="rounded-[12px] bg-surface px-3 py-3">
              <p className="text-[12px] font-semibold leading-5 text-text">来源消息</p>
              <p className="mt-1 text-[12px] leading-5 text-text-muted">
                {draft.source.conversationTitle} · {draft.source.senderName}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-text">{draft.source.messageText}</p>
            </div>
          )}
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
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium leading-4 text-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function normalizeInitialValue(value: Arrangement | ArrangementDraft | null): ArrangementDraft {
  if (!value) return emptyDraft;

  return {
    title: value.title ?? "",
    status: value.status,
    timeText: value.timeText,
    startText: value.startText,
    endText: value.endText,
    priority: value.priority ?? "normal",
    tags: value.tags ?? [],
    personText: value.personText,
    placeText: value.placeText,
    note: value.note,
    source: value.source,
  };
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

function getStatusLabel(status: ArrangementStatus) {
  if (status === "completed") return "已完成";
  if (status === "later") return "以后";
  return "进行中";
}
