import type { ArrangementDraft } from "@/types/arrangement";

type PendingArrangementCardProps = {
  draft: ArrangementDraft;
  onOpenEditor: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
};

export default function PendingArrangementCard({
  draft,
  onOpenEditor,
  onConfirm,
  onDismiss,
}: PendingArrangementCardProps) {
  return (
    <div className="px-4 pb-2">
      <button
        type="button"
        onClick={onOpenEditor}
        className="w-full rounded-[18px] border border-border/80 bg-surface px-3.5 py-3 text-left shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition active:scale-[0.99]"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[15px] font-semibold text-primary">
            ✓
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-[14px] font-semibold leading-5 text-text">
                待确认安排
              </p>
              {draft.timeText && (
                <span className="shrink-0 rounded-full bg-fill-3 px-2 py-0.5 text-[11px] leading-4 text-text-muted">
                  {draft.timeText}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-text">
              {draft.title}
            </p>
            {draft.source && (
              <p className="mt-1 truncate text-[11px] leading-4 text-text-tertiary">
                来自 {draft.source.senderName}：{draft.source.messageText}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onDismiss();
              }
            }}
            className="rounded-full px-3 py-1.5 text-[12px] leading-4 text-text-tertiary"
          >
            暂不处理
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onConfirm();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onConfirm();
              }
            }}
            className="rounded-full bg-text px-3 py-1.5 text-[12px] font-medium leading-4 text-bg"
          >
            加入安排
          </span>
        </div>
      </button>
    </div>
  );
}
