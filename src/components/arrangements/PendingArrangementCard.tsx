import React from "react";
import type { Arrangement, ArrangementDraft, ArrangementSource, ArrangementTag } from "@/types/arrangement";

type PendingArrangementCardProps = {
  draft: ArrangementDraft;
  arrangementTags: ArrangementTag[];
  similarArrangement?: Arrangement | null;
  onOpenEditor: () => void;
  onOpenSource?: (source: ArrangementSource) => void;
  onOpenSimilarArrangement?: (arrangement: Arrangement) => void;
  onMergeSimilar?: (draft: ArrangementDraft) => void;
  onCreateAnyway?: (draft: ArrangementDraft) => void;
  onConfirm: () => void;
  onDismiss: () => void;
};

export default function PendingArrangementCard({
  draft,
  arrangementTags,
  similarArrangement,
  onOpenEditor,
  onOpenSource,
  onOpenSimilarArrangement,
  onMergeSimilar,
  onCreateAnyway,
  onConfirm,
  onDismiss,
}: PendingArrangementCardProps) {
  const dragStartXRef = React.useRef<number | null>(null);
  const dragStartYRef = React.useRef<number | null>(null);
  const dragOffsetRef = React.useRef(0);
  const isHorizontalDragRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);
  const suppressClickTimerRef = React.useRef<number | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [showRelationSheet, setShowRelationSheet] = React.useState(false);
  const primaryTag = arrangementTags.find((tag) => tag.id === draft.primaryTagId);
  const boundedOffset = Math.max(-112, Math.min(112, dragOffset));
  const sourceText = draft.source
    ? `来自 ${draft.source.senderName}：${draft.source.messageText}`
    : "来自消息识别";
  const canOpenSource = Boolean(draft.source && onOpenSource);

  const resetDrag = () => {
    dragStartXRef.current = null;
    dragStartYRef.current = null;
    dragOffsetRef.current = 0;
    isHorizontalDragRef.current = false;
    setDragOffset(0);
  };

  const suppressNextClick = () => {
    suppressClickRef.current = true;
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
    }
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 320);
  };

  React.useEffect(() => {
    return () => {
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
    };
  }, []);

  const startDrag = (clientX: number, clientY: number) => {
    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;
    dragOffsetRef.current = 0;
    isHorizontalDragRef.current = false;
  };

  const updateDrag = (clientX: number, clientY: number) => {
    if (dragStartXRef.current === null || dragStartYRef.current === null) return;

    const nextOffset = clientX - dragStartXRef.current;
    const verticalOffset = clientY - dragStartYRef.current;
    if (!isHorizontalDragRef.current) {
      if (Math.abs(nextOffset) < 6) return;
      if (Math.abs(verticalOffset) > Math.abs(nextOffset)) return;
      isHorizontalDragRef.current = true;
    }

    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
  };

  const finishDrag = () => {
    const finalOffset = dragOffsetRef.current;
    const wasHorizontalDrag = isHorizontalDragRef.current || Math.abs(finalOffset) > 6;
    resetDrag();

    if (wasHorizontalDrag) {
      suppressNextClick();
    }

    if (finalOffset <= -64) {
      onDismiss();
      return;
    }

    if (finalOffset >= 64) {
      onConfirm();
    }
  };

  const stopNestedAction = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="px-4 pb-2">
      <div className="relative overflow-hidden rounded-2xl">
        {dragOffset !== 0 && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center px-4 text-[12px] font-medium"
            aria-hidden="true"
          >
            {dragOffset > 0 ? (
              <span className="rounded-full bg-primary/12 px-2.5 py-1 text-primary">加入</span>
            ) : (
              <span className="ml-auto rounded-full bg-fill-3 px-2.5 py-1 text-text-muted">
                忽略
              </span>
            )}
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          onPointerDown={(event) => {
            startDrag(event.clientX, event.clientY);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            updateDrag(event.clientX, event.clientY);
          }}
          onPointerCancel={resetDrag}
          onPointerUp={finishDrag}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (!touch) return;
            startDrag(touch.clientX, touch.clientY);
          }}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            if (!touch) return;
            updateDrag(touch.clientX, touch.clientY);
            if (isHorizontalDragRef.current) event.preventDefault();
          }}
          onTouchCancel={resetDrag}
          onTouchEnd={finishDrag}
          onClick={(event) => {
            if (suppressClickRef.current) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            onOpenEditor();
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenEditor();
            }
          }}
          className="relative w-full rounded-2xl border border-border bg-surface px-3.5 py-3 text-left shadow-[0_6px_18px_rgba(15,23,42,0.07)] transition active:scale-[0.998]"
          style={{
            touchAction: "pan-y",
            transform: `translateX(${boundedOffset}px)`,
          }}
          aria-label="待确认安排，点击编辑，左滑忽略，右滑加入"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 h-12 w-1.5 shrink-0 rounded-full bg-primary/65" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center justify-between gap-2 overflow-hidden">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                  <p className="shrink-0 text-[13px] font-semibold leading-4 text-text">待确认</p>
                  {primaryTag && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4"
                      style={{
                        backgroundColor: `${primaryTag.color}1A`,
                        color: primaryTag.color,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: primaryTag.color }}
                      />
                      {primaryTag.name}
                    </span>
                  )}
                  {draft.timeText && (
                    <span className="min-w-0 shrink truncate rounded-full bg-fill-2 px-2 py-0.5 text-[11px] leading-4 text-text-muted">
                      {draft.timeText}
                    </span>
                  )}
                </div>
                {similarArrangement && (
                  <button
                    type="button"
                    onPointerDown={stopNestedAction}
                    onPointerUp={stopNestedAction}
                    onTouchStart={stopNestedAction}
                    onTouchEnd={stopNestedAction}
                    onClick={(event) => {
                      stopNestedAction(event);
                      setShowRelationSheet(true);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-medium leading-4 text-[#9A5A00] shadow-[inset_0_0_0_1px_rgba(154,90,0,0.08)] transition active:scale-[0.98]"
                    aria-label="已有相关安排，点击处理"
                  >
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#F59E0B] text-[9px] font-bold leading-none text-white">
                      !
                    </span>
                    已有相关安排
                  </button>
                )}
              </div>
              <p className="mt-1.5 min-w-0 truncate text-[15px] font-medium leading-5 text-text">
                {draft.title}
              </p>
              {canOpenSource ? (
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                  }}
                  onTouchStart={(event) => {
                    event.stopPropagation();
                  }}
                  onTouchEnd={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!draft.source || suppressClickRef.current) return;
                    onOpenSource?.(draft.source);
                  }}
                  className="mt-1 block w-full truncate text-left text-[12px] leading-4 text-text-muted transition hover:text-text"
                >
                  {sourceText}
                </button>
              ) : (
                <p className="mt-1 truncate text-[12px] leading-4 text-text-muted">{sourceText}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      {similarArrangement && showRelationSheet && (
        <RelatedArrangementSheet
          arrangement={similarArrangement}
          onClose={() => setShowRelationSheet(false)}
          onOpenArrangement={() => {
            setShowRelationSheet(false);
            onOpenSimilarArrangement?.(similarArrangement);
          }}
          onMerge={() => {
            setShowRelationSheet(false);
            onMergeSimilar?.(draft);
          }}
          onCreateAnyway={() => {
            setShowRelationSheet(false);
            onCreateAnyway?.(draft);
          }}
        />
      )}
    </div>
  );
}

function RelatedArrangementSheet({
  arrangement,
  onClose,
  onOpenArrangement,
  onMerge,
  onCreateAnyway,
}: {
  arrangement: Arrangement;
  onClose: () => void;
  onOpenArrangement: () => void;
  onMerge: () => void;
  onCreateAnyway: () => void;
}) {
  const summary = [arrangement.timeText, arrangement.note].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 px-0 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="关闭相关安排提示"
      />
      <section className="relative z-10 w-full max-w-[430px] rounded-t-[22px] bg-bg px-4 pb-5 pt-3 shadow-[0_-14px_34px_rgba(15,23,42,0.18)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fill-4" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[16px] font-semibold leading-6 text-text">可能是同一件事</p>
            <p className="mt-0.5 text-[12px] leading-5 text-text-muted">
              这条新安排和已有安排很接近，可以合并来源，也可以保留为新的安排。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-[17px] text-text-muted"
            aria-label="关闭"
          >
            x
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenArrangement}
          className="mt-3 block w-full rounded-[14px] border border-[#F2C46D]/50 bg-[#FFF8E5] px-3 py-3 text-left transition active:scale-[0.99]"
        >
          <span className="block truncate text-[14px] font-semibold leading-5 text-text">
            {arrangement.title}
          </span>
          <span className="mt-0.5 block truncate text-[12px] leading-5 text-text-muted">
            {summary || "查看这条已有安排"}
          </span>
        </button>

        <div className="mt-4">
          <button
            type="button"
            onClick={onMerge}
            className="h-11 w-full rounded-[12px] bg-text text-[14px] font-semibold text-bg transition active:scale-[0.99]"
          >
            合并到已有安排
          </button>
          <button
            type="button"
            onClick={onCreateAnyway}
            className="mt-2 h-11 w-full rounded-[12px] bg-surface text-[14px] font-semibold text-text shadow-[inset_0_0_0_1px_var(--color-border)] transition active:scale-[0.99]"
          >
            仍然新建
          </button>
        </div>
      </section>
    </div>
  );
}
