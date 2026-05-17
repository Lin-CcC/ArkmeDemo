import React from "react";
import type { ArrangementCompletionSuggestion } from "@/types/arrangement";

type CompletionSuggestionCardProps = {
  suggestion: ArrangementCompletionSuggestion;
  onComplete: () => void;
  onDismiss: () => void;
  onOpenArrangement: () => void;
};

export default function CompletionSuggestionCard({
  suggestion,
  onComplete,
  onDismiss,
  onOpenArrangement,
}: CompletionSuggestionCardProps) {
  const dragStartXRef = React.useRef<number | null>(null);
  const dragStartYRef = React.useRef<number | null>(null);
  const dragOffsetRef = React.useRef(0);
  const isHorizontalDragRef = React.useRef(false);
  const suppressClickRef = React.useRef(false);
  const suppressClickTimerRef = React.useRef<number | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const boundedOffset = Math.max(-112, Math.min(112, dragOffset));

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
      onComplete();
    }
  };

  const sourceText = `来自 ${suggestion.source.senderName}: ${suggestion.source.messageText}`;

  return (
    <div className="px-4 pb-2">
      <div className="relative overflow-hidden rounded-2xl">
        {dragOffset !== 0 && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center px-4 text-[12px] font-medium"
            aria-hidden="true"
          >
            {dragOffset > 0 ? (
              <span className="rounded-full bg-[#09B83E]/12 px-2.5 py-1 text-[#078B31]">
                完成
              </span>
            ) : (
              <span className="ml-auto rounded-full bg-fill-3 px-2.5 py-1 text-text-muted">
                忽略
              </span>
            )}
          </div>
        )}
        <section
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
            onOpenArrangement();
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenArrangement();
            }
          }}
          className="relative w-full rounded-2xl border border-border bg-surface px-3.5 py-3 text-left shadow-[0_6px_18px_rgba(15,23,42,0.07)] transition active:scale-[0.998]"
          style={{
            touchAction: "pan-y",
            transform: `translateX(${boundedOffset}px)`,
          }}
          aria-label="可能已完成的安排，点击查看安排，左滑忽略，右滑标记完成"
        >
          <div className="flex min-w-0 items-stretch gap-2.5">
            <div className="my-0.5 w-1.5 shrink-0 rounded-full bg-[#09B83E]/70" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="shrink-0 text-[13px] font-semibold leading-4 text-text">
                  待确认
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-medium leading-4 text-[#078B31]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#09B83E]" />
                  可能已完成
                </span>
              </div>
              <p className="mt-1.5 text-[15px] font-medium leading-5 text-text">
                这条消息可能表示「{suggestion.arrangementTitle}」已完成
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-text-muted">
                {sourceText}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
