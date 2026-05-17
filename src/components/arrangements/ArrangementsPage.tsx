import React from "react";
import type {
  Arrangement,
  ArrangementPriority,
  ArrangementStatus,
  ArrangementTag,
} from "@/types/arrangement";

type ArrangementActionToast =
  | {
      kind: "status";
      arrangementId: string;
      title: string;
      previousStatus: ArrangementStatus;
      nextStatus: ArrangementStatus;
    }
  | {
      kind: "delete";
      arrangement: Arrangement;
    }
  | {
      kind: "move";
      arrangement: Arrangement;
    }
  | null;

type ArrangementsPageProps = {
  arrangements: Arrangement[];
  arrangementTags: ArrangementTag[];
  actionToast: ArrangementActionToast;
  highlightedArrangementId?: string | null;
  onCreate: () => void;
  onOpen: (arrangement: Arrangement) => void;
  onCycleStatus: (arrangement: Arrangement) => void;
  onDelete: (arrangement: Arrangement) => void;
  onMove: (arrangement: Arrangement, target: ArrangementMoveTarget) => void;
  onUndoAction: () => void;
  onDismissActionToast: () => void;
};

type GroupMode = "date" | "priority" | "status" | "priorityStatus";

type TimeScope = "all" | "today" | "recent" | "unscheduled";

type ArrangementMoveTarget = {
  beforeId?: string;
  afterId?: string;
  status?: ArrangementStatus;
  priority?: ArrangementPriority;
  dateKey?: string | null;
};

type ArrangementDropTarget = Omit<ArrangementMoveTarget, "beforeId">;

type TimeScopeOption = {
  value: TimeScope;
  label: string;
  count: number;
};

type DragPreviewState = {
  arrangement: Arrangement;
  clientX: number;
  clientY: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

type DropIndicatorState = {
  left: number;
  top: number;
  width: number;
  target: ArrangementMoveTarget;
};

const allTimeScopeValue: TimeScope = "all";
const unscheduledDateValue = "unscheduled";

const timeScopeOptions: Array<{ value: TimeScope; label: string }> = [
  { value: "all", label: "全部" },
  { value: "today", label: "今日" },
  { value: "recent", label: "近期" },
  { value: "unscheduled", label: "无时间" },
];

const groupModes: Array<{
  value: GroupMode;
  label: string;
  description: string;
}> = [
  { value: "date", label: "按日期", description: "先看每天有什么" },
  { value: "priority", label: "按优先级", description: "先处理更需要注意的事" },
  { value: "status", label: "按状态", description: "整理未完成、完成和放弃" },
  {
    value: "priorityStatus",
    label: "优先级下按状态",
    description: "适合集中整理一批安排",
  },
];

const prioritySections: Array<{
  priority: ArrangementPriority;
  title: string;
}> = [
  { priority: "important_urgent", title: "重要且紧急" },
  { priority: "important_not_urgent", title: "重要不紧急" },
  { priority: "urgent_not_important", title: "紧急不重要" },
  { priority: "not_important_not_urgent", title: "不重要也不紧急" },
];

const statusSections: Array<{
  status: ArrangementStatus;
  title: string;
}> = [
  { status: "active", title: "未完成" },
  { status: "completed", title: "完成" },
  { status: "abandoned", title: "放弃" },
];

const statusOrder: ArrangementStatus[] = ["active", "completed", "abandoned"];

export default function ArrangementsPage({
  arrangements,
  arrangementTags,
  actionToast,
  highlightedArrangementId,
  onCreate,
  onOpen,
  onCycleStatus,
  onDelete,
  onMove,
  onUndoAction,
  onDismissActionToast,
}: ArrangementsPageProps) {
  const [activeTagId, setActiveTagId] = React.useState("all");
  const [timeScope, setTimeScope] = React.useState<TimeScope>(allTimeScopeValue);
  const [groupMode, setGroupMode] = React.useState<GroupMode>("date");
  const [showGroupSheet, setShowGroupSheet] = React.useState(false);
  const [dragPreview, setDragPreview] = React.useState<DragPreviewState | null>(null);
  const [dropIndicator, setDropIndicator] = React.useState<DropIndicatorState | null>(null);

  const tagFilteredArrangements = React.useMemo(
    () =>
      activeTagId === "all"
        ? arrangements
        : arrangements.filter((arrangement) => arrangement.primaryTagId === activeTagId),
    [activeTagId, arrangements]
  );

  const timeScopeFilters = React.useMemo(
    () => buildTimeScopeOptions(tagFilteredArrangements),
    [tagFilteredArrangements]
  );

  const selectedTimeScopeLabel =
    timeScopeFilters.find((option) => option.value === timeScope)?.label ?? "所选范围";

  const visibleArrangements = React.useMemo(
    () =>
      tagFilteredArrangements.filter((arrangement) =>
        matchesTimeScope(arrangement, timeScope)
      ),
    [timeScope, tagFilteredArrangements]
  );

  const dateGroups = React.useMemo(
    () =>
      buildDateGroups(visibleArrangements).filter((section) => section.items.length > 0),
    [visibleArrangements]
  );

  const priorityGroups = React.useMemo(
    () =>
      prioritySections
        .map((section) => ({
          ...section,
          items: visibleArrangements
            .filter((arrangement) => arrangement.priority === section.priority),
        }))
        .filter((section) => section.items.length > 0),
    [visibleArrangements]
  );

  const statusGroups = React.useMemo(
    () =>
      statusSections
        .map((section) => ({
          ...section,
          items: visibleArrangements
            .filter((arrangement) => arrangement.status === section.status),
        }))
        .filter((section) => section.items.length > 0),
    [visibleArrangements]
  );

  const currentGroupMode = groupModes.find((mode) => mode.value === groupMode) ?? groupModes[0];

  const getDropTarget = React.useCallback(
    (arrangement: Arrangement, clientX: number, clientY: number) => {
      const element = document.elementFromPoint(clientX, clientY);
      if (!element) return null;

      const cardElement = element.closest<HTMLElement>("[data-arrangement-card-id]");
      if (!cardElement) return null;

      const dropElement = cardElement.closest<HTMLElement>("[data-arrangement-drop]");
      const target: ArrangementMoveTarget = {};

      const beforeId = cardElement?.dataset.arrangementCardId;
      if (!beforeId || beforeId === arrangement.id) {
        return null;
      }

      const cardRect = cardElement.getBoundingClientRect();
      if (clientY > cardRect.top + cardRect.height / 2) {
        target.afterId = beforeId;
      } else {
        target.beforeId = beforeId;
      }

      if (dropElement?.dataset.dropStatus) {
        target.status = dropElement.dataset.dropStatus as ArrangementStatus;
      }
      if (dropElement?.dataset.dropPriority) {
        target.priority = dropElement.dataset.dropPriority as ArrangementPriority;
      }
      if (dropElement && "dropDate" in dropElement.dataset) {
        target.dateKey =
          dropElement.dataset.dropDate === unscheduledDateValue
            ? null
            : dropElement.dataset.dropDate;
      }

      if (
        target.beforeId ||
        target.afterId
      ) {
        return target;
      }
      return null;
    },
    []
  );

  const updateDropIndicator = React.useCallback(
    (arrangement: Arrangement, clientX: number, clientY: number) => {
      const target = getDropTarget(arrangement, clientX, clientY);
      if (!target) {
        setDropIndicator(null);
        return;
      }

      const anchorId = target.beforeId ?? target.afterId;
      const anchorElement = anchorId
        ? document.querySelector<HTMLElement>(
            `[data-arrangement-card-id="${CSS.escape(anchorId)}"]`
          )
        : null;
      const rect = anchorElement?.getBoundingClientRect();

      if (!rect) {
        setDropIndicator(null);
        return;
      }

      setDropIndicator({
        left: rect.left,
        top: target.afterId ? rect.bottom + 5 : rect.top - 5,
        width: rect.width,
        target,
      });
    },
    [getDropTarget]
  );

  const handleDragStart = React.useCallback(
    (
      arrangement: Arrangement,
      clientX: number,
      clientY: number,
      rect: DOMRect
    ) => {
      setDragPreview({
        arrangement,
        clientX,
        clientY,
        width: rect.width,
        height: rect.height,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
      });
    },
    []
  );

  const handleDragMove = React.useCallback(
    (arrangement: Arrangement, clientX: number, clientY: number) => {
      setDragPreview((current) =>
        current && current.arrangement.id === arrangement.id
          ? { ...current, clientX, clientY }
          : current
      );
      updateDropIndicator(arrangement, clientX, clientY);
    },
    [updateDropIndicator]
  );

  const handleDragEnd = React.useCallback(
    (arrangement: Arrangement, clientX: number, clientY: number) => {
      const target = getDropTarget(arrangement, clientX, clientY);
      setDragPreview(null);
      setDropIndicator(null);
      if (target) {
        onMove(arrangement, target);
      }
    },
    [getDropTarget, onMove]
  );

  const handleDragCancel = React.useCallback(() => {
    setDragPreview(null);
    setDropIndicator(null);
  }, []);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <header className="shrink-0 bg-bg px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-7 text-text">安排</h1>
          <p className="mt-1 text-[12px] leading-5 text-text-muted">
            按日期、状态和优先级整理需要留意的事。
          </p>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
            {timeScopeFilters.map((option) => (
              <DateFilterButton
                key={option.value}
                active={timeScope === option.value}
                label={option.label}
                count={option.count}
                onClick={() => setTimeScope(option.value)}
              />
            ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowGroupSheet(true)}
            className="flex h-8 min-w-0 items-center rounded-full bg-surface px-3 text-[12px] font-medium text-text transition active:scale-[0.98]"
          >
            <span className="text-text-muted">整理方式：</span>
            <span className="truncate">{currentGroupMode.label}</span>
            <span className="ml-1 text-text-tertiary">⌄</span>
          </button>

          <select
            value={activeTagId}
            onChange={(event) => setActiveTagId(event.target.value)}
            className="h-8 max-w-[140px] rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-text outline-none"
            aria-label="筛选标签"
          >
            <option value="all">全部标签</option>
            {arrangementTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24">
        {visibleArrangements.length === 0 ? (
          <EmptyArrangementsState
            timeScope={timeScope}
            selectedTimeScopeLabel={selectedTimeScopeLabel}
            onCreate={onCreate}
          />
        ) : (
          <div className="space-y-4">
            {groupMode === "date" &&
              dateGroups.map((section) => (
                <FlatArrangementSection
                  key={section.value}
                  title={section.title}
                  count={section.items.length}
                  dropTarget={{
                    dateKey: section.value === unscheduledDateValue ? null : section.value,
                  }}
                >
                  {section.items.map((arrangement) => (
                    <ArrangementListItem
                      key={arrangement.id}
                      arrangement={arrangement}
                      arrangementTags={arrangementTags}
                      highlighted={highlightedArrangementId === arrangement.id}
                      onOpen={() => onOpen(arrangement)}
                      onCycleStatus={() => onCycleStatus(arrangement)}
                      onDelete={() => onDelete(arrangement)}
                      dragging={dragPreview?.arrangement.id === arrangement.id}
                      onDragStart={(clientX, clientY, rect) =>
                        handleDragStart(arrangement, clientX, clientY, rect)
                      }
                      onDragMove={(clientX, clientY) =>
                        handleDragMove(arrangement, clientX, clientY)
                      }
                      onDragEnd={(clientX, clientY) =>
                        handleDragEnd(arrangement, clientX, clientY)
                      }
                      onDragCancel={handleDragCancel}
                    />
                  ))}
                </FlatArrangementSection>
              ))}

            {groupMode === "status" &&
              statusGroups.map((section) => (
                <FlatArrangementSection
                  key={section.status}
                  title={section.title}
                  count={section.items.length}
                  dropTarget={{ status: section.status }}
                >
                  {section.items.map((arrangement) => (
                    <ArrangementListItem
                      key={arrangement.id}
                      arrangement={arrangement}
                      arrangementTags={arrangementTags}
                      highlighted={highlightedArrangementId === arrangement.id}
                      onOpen={() => onOpen(arrangement)}
                      onCycleStatus={() => onCycleStatus(arrangement)}
                      onDelete={() => onDelete(arrangement)}
                      dragging={dragPreview?.arrangement.id === arrangement.id}
                      onDragStart={(clientX, clientY, rect) =>
                        handleDragStart(arrangement, clientX, clientY, rect)
                      }
                      onDragMove={(clientX, clientY) =>
                        handleDragMove(arrangement, clientX, clientY)
                      }
                      onDragEnd={(clientX, clientY) =>
                        handleDragEnd(arrangement, clientX, clientY)
                      }
                      onDragCancel={handleDragCancel}
                    />
                  ))}
                </FlatArrangementSection>
              ))}

            {groupMode === "priority" &&
              priorityGroups.map((section) => (
                <FlatArrangementSection
                  key={section.priority}
                  title={section.title}
                  count={section.items.length}
                  dropTarget={{ priority: section.priority }}
                >
                  {section.items.map((arrangement) => (
                    <ArrangementListItem
                      key={arrangement.id}
                      arrangement={arrangement}
                      arrangementTags={arrangementTags}
                      highlighted={highlightedArrangementId === arrangement.id}
                      onOpen={() => onOpen(arrangement)}
                      onCycleStatus={() => onCycleStatus(arrangement)}
                      onDelete={() => onDelete(arrangement)}
                      dragging={dragPreview?.arrangement.id === arrangement.id}
                      onDragStart={(clientX, clientY, rect) =>
                        handleDragStart(arrangement, clientX, clientY, rect)
                      }
                      onDragMove={(clientX, clientY) =>
                        handleDragMove(arrangement, clientX, clientY)
                      }
                      onDragEnd={(clientX, clientY) =>
                        handleDragEnd(arrangement, clientX, clientY)
                      }
                      onDragCancel={handleDragCancel}
                    />
                  ))}
                </FlatArrangementSection>
              ))}

            {groupMode === "priorityStatus" &&
              priorityGroups.map((section) => (
                <section
                  key={section.priority}
                  className="space-y-2.5"
                  data-arrangement-drop
                  data-drop-priority={section.priority}
                >
                  <SectionTitle title={section.title} count={section.items.length} />
                  <div className="space-y-3">
                    {statusOrder.map((status) => {
                      const statusItems = section.items.filter(
                        (arrangement) => arrangement.status === status
                      );
                      if (statusItems.length === 0) return null;

                      return (
                        <div
                          key={status}
                          className="space-y-2"
                          data-arrangement-drop
                          data-drop-priority={section.priority}
                          data-drop-status={status}
                        >
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[11px] font-medium leading-4 text-text-muted">
                              {statusLabel(status)}
                            </span>
                            <span className="text-[10px] leading-4 text-text-disabled">
                              {statusItems.length}
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {statusItems.map((arrangement) => (
                              <ArrangementListItem
                                key={arrangement.id}
                                arrangement={arrangement}
                                arrangementTags={arrangementTags}
                                highlighted={highlightedArrangementId === arrangement.id}
                                onOpen={() => onOpen(arrangement)}
                                onCycleStatus={() => onCycleStatus(arrangement)}
                                onDelete={() => onDelete(arrangement)}
                                dragging={dragPreview?.arrangement.id === arrangement.id}
                                onDragStart={(clientX, clientY, rect) =>
                                  handleDragStart(arrangement, clientX, clientY, rect)
                                }
                                onDragMove={(clientX, clientY) =>
                                  handleDragMove(arrangement, clientX, clientY)
                                }
                                onDragEnd={(clientX, clientY) =>
                                  handleDragEnd(arrangement, clientX, clientY)
                                }
                                onDragCancel={handleDragCancel}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
          </div>
        )}
      </div>

      {actionToast && (
        <ActionUndoToast
          toast={actionToast}
          onUndo={onUndoAction}
          onDismiss={onDismissActionToast}
        />
      )}

      {dropIndicator && <DropInsertIndicator indicator={dropIndicator} />}

      {dragPreview && (
        <ArrangementDragPreview
          preview={dragPreview}
          arrangementTags={arrangementTags}
        />
      )}

      <button
        type="button"
        onClick={onCreate}
        className="absolute bottom-5 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-text text-[28px] font-medium leading-none text-bg shadow-[0_12px_28px_rgba(15,23,42,0.2)] transition active:scale-95"
        aria-label="添加安排"
        title="添加安排"
      >
        +
      </button>

      {showGroupSheet && (
        <GroupModeSheet
          selectedMode={groupMode}
          onSelect={(mode) => {
            setGroupMode(mode);
            setShowGroupSheet(false);
          }}
          onClose={() => setShowGroupSheet(false)}
        />
      )}
    </div>
  );
}

function DateFilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 min-w-0 items-center justify-center rounded-[10px] border px-2 text-[13px] font-medium transition active:scale-[0.98] ${
        active ? "border-text bg-text text-bg" : "border-border bg-surface text-text-muted"
      }`}
    >
      <span>{label}</span>
      <span className={`ml-1.5 text-[11px] ${active ? "text-bg/70" : "text-text-tertiary"}`}>
        {count}
      </span>
    </button>
  );
}

function FlatArrangementSection({
  title,
  count,
  children,
  dropTarget,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  dropTarget?: ArrangementDropTarget;
}) {
  return (
    <section
      className="space-y-2.5"
      data-arrangement-drop
      data-drop-status={dropTarget?.status}
      data-drop-priority={dropTarget?.priority}
      data-drop-date={
        "dateKey" in (dropTarget ?? {})
          ? dropTarget?.dateKey ?? unscheduledDateValue
          : undefined
      }
    >
      <SectionTitle title={title} count={count} />
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-0.5">
      <h2 className="text-[13px] font-semibold leading-5 text-text">{title}</h2>
      <span className="text-[11px] leading-4 text-text-tertiary">{count}</span>
    </div>
  );
}

function EmptyArrangementsState({
  timeScope,
  selectedTimeScopeLabel,
  onCreate,
}: {
  timeScope: TimeScope;
  selectedTimeScopeLabel: string;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center text-center">
      <div>
        <p className="text-[14px] font-semibold leading-5 text-text">
          {emptyTitle(timeScope, selectedTimeScopeLabel)}
        </p>
        <p className="mt-1 text-[12px] leading-5 text-text-muted">
          可以切换时间范围或标签看看，也可以新建一条安排。
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-white"
        >
          添加安排
        </button>
      </div>
    </div>
  );
}

function ArrangementListItem({
  arrangement,
  arrangementTags,
  highlighted,
  onOpen,
  onCycleStatus,
  onDelete,
  dragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  arrangement: Arrangement;
  arrangementTags: ArrangementTag[];
  highlighted: boolean;
  onOpen: () => void;
  onCycleStatus: () => void;
  onDelete: () => void;
  dragging: boolean;
  onDragStart: (clientX: number, clientY: number, rect: DOMRect) => void;
  onDragMove: (clientX: number, clientY: number) => void;
  onDragEnd: (clientX: number, clientY: number) => void;
  onDragCancel: () => void;
}) {
  const primaryTag = arrangementTags.find((tag) => tag.id === arrangement.primaryTagId);
  const [offsetX, setOffsetX] = React.useState(0);
  const [isSwiping, setIsSwiping] = React.useState(false);
  const pointerStartRef = React.useRef<{ x: number; y: number; id: number } | null>(null);
  const dragStateRef = React.useRef<{
    x: number;
    y: number;
    currentX: number;
    currentY: number;
    rect: DOMRect;
    id: number;
    longPressTimer: number | null;
    dragging: boolean;
    moved: boolean;
    pointerType: string;
    swipeLocked: boolean;
  } | null>(null);
  const hasMovedRef = React.useRef(false);
  const deleteWidth = 74;

  const closeSwipe = React.useCallback(() => {
    setOffsetX(0);
    setIsSwiping(false);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-arrangement-status-control]")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerStartRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    dragStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      rect,
      id: event.pointerId,
      longPressTimer:
        event.pointerType === "mouse"
          ? null
          : window.setTimeout(() => {
              const state = dragStateRef.current;
              if (!state || state.id !== event.pointerId || state.dragging) return;
              state.dragging = true;
              state.moved = false;
              hasMovedRef.current = true;
              closeSwipe();
              onDragStart(state.currentX, state.currentY, state.rect);
              onDragMove(state.currentX, state.currentY);
            }, 360),
      dragging: false,
      moved: false,
      pointerType: event.pointerType,
      swipeLocked: false,
    };
    hasMovedRef.current = false;
    setIsSwiping(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const dragState = dragStateRef.current;
    if (dragState) {
      dragState.currentX = event.clientX;
      dragState.currentY = event.clientY;
    }

    if (dragState?.dragging) {
      event.preventDefault();
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        dragState.moved = true;
      }
      onDragMove(event.clientX, event.clientY);
      return;
    }

    if (dragState?.pointerType === "mouse" && !dragState.dragging && Math.abs(deltaY) > 8) {
      dragState.dragging = true;
      dragState.moved = true;
      hasMovedRef.current = true;
      closeSwipe();
      onDragStart(event.clientX, event.clientY, dragState.rect);
      onDragMove(event.clientX, event.clientY);
      return;
    }

    if (dragState?.pointerType === "touch" && dragState.longPressTimer) {
      if (!dragState.swipeLocked && deltaX < -14 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
        dragState.swipeLocked = true;
        window.clearTimeout(dragState.longPressTimer);
        dragState.longPressTimer = null;
      } else if (!dragState.swipeLocked) {
        return;
      }
    }

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) return;

    const nextOffset = Math.min(0, Math.max(-deleteWidth, deltaX));
    if (Math.abs(deltaX) > 6) hasMovedRef.current = true;
    setOffsetX(nextOffset);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    pointerStartRef.current = null;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragState?.longPressTimer) {
      window.clearTimeout(dragState.longPressTimer);
    }
    if (dragState?.dragging) {
      if (dragState.moved) {
        onDragEnd(event.clientX, event.clientY);
      } else {
        onDragCancel();
      }
      setIsSwiping(false);
      return;
    }
    setOffsetX((current) => (current < -deleteWidth / 2 ? -deleteWidth : 0));
    setIsSwiping(false);
  };

  const handlePointerCancel = () => {
    const dragState = dragStateRef.current;
    if (dragState?.longPressTimer) {
      window.clearTimeout(dragState.longPressTimer);
    }
    dragStateRef.current = null;
    pointerStartRef.current = null;
    closeSwipe();
    if (dragState?.dragging) {
      onDragCancel();
    }
  };

  const handleOpen = () => {
    if (hasMovedRef.current || offsetX !== 0) {
      closeSwipe();
      return;
    }
    onOpen();
  };

  const handleCardClick = () => {
    handleOpen();
  };

  const handleDelete = () => {
    closeSwipe();
    onDelete();
  };

  return (
    <article
      className={`relative overflow-hidden rounded-[14px] transition-all duration-150 ${
        dragging ? "opacity-25 scale-[0.99]" : ""
      }`}
      data-arrangement-card-id={arrangement.id}
    >
      <div className="absolute inset-y-0 right-0 flex w-[74px] items-center justify-end rounded-[14px] bg-[#E35D4F] pr-3">
        <button
          type="button"
          onClick={handleDelete}
          className="flex h-9 min-w-12 items-center justify-center rounded-full bg-white/16 px-3 text-[13px] font-semibold text-white transition active:scale-95"
        >
          删除
        </button>
      </div>
      <div
        className={`relative rounded-[14px] border border-border bg-surface px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
          isSwiping || dragging ? "" : "transition-transform duration-200 ease-out"
        } ${highlighted ? "arrangement-card-highlight" : ""}`}
        style={{ transform: `translateX(${dragging ? 0 : offsetX}px)`, touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onTouchCancel={handlePointerCancel}
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-3">
          <StatusCycleButton status={arrangement.status} onClick={onCycleStatus} />
          <div className="min-w-0 flex-1 text-left transition active:scale-[0.995]">
            <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-text">
              {arrangement.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {primaryTag && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 text-white"
                  style={{ backgroundColor: primaryTag.color }}
                >
                  {primaryTag.name}
                </span>
              )}
              {arrangement.timeText && (
                <span className="text-[11px] leading-4 text-text-muted">
                  {arrangement.timeText}
                </span>
              )}
              <span className="text-[11px] leading-4 text-text-tertiary">
                {priorityLabel(arrangement.priority)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusCycleButton({
  status,
  onClick,
}: {
  status: ArrangementStatus;
  onClick: () => void;
}) {
  const config =
    status === "completed"
      ? {
          label: "完成，点击切换为放弃",
          content: "✓",
          className: "border-primary bg-primary text-white",
        }
      : status === "abandoned"
        ? {
            label: "放弃，点击切换为未完成",
            content: "—",
            className: "border-border bg-fill-2 text-text-muted",
          }
        : {
            label: "未完成，点击切换为完成",
            content: "",
            className: "border-border bg-bg text-transparent",
          };

  return (
    <button
      type="button"
      data-arrangement-status-control
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[15px] font-semibold leading-none transition active:scale-90 ${config.className}`}
      aria-label={config.label}
      title={config.label}
    >
      {config.content}
    </button>
  );
}

function DropInsertIndicator({ indicator }: { indicator: DropIndicatorState }) {
  return (
    <div
      className="pointer-events-none fixed z-40 h-[3px] rounded-full bg-primary shadow-[0_0_0_4px_rgba(38,196,125,0.12)] transition-all duration-100"
      style={{
        left: indicator.left,
        top: indicator.top,
        width: indicator.width,
      }}
    >
      <span className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1 -translate-y-1/2 rounded-full bg-primary" />
      <span className="absolute right-0 top-1/2 h-2 w-2 translate-x-1 -translate-y-1/2 rounded-full bg-primary" />
    </div>
  );
}

function ArrangementDragPreview({
  preview,
  arrangementTags,
}: {
  preview: DragPreviewState;
  arrangementTags: ArrangementTag[];
}) {
  const primaryTag = arrangementTags.find(
    (tag) => tag.id === preview.arrangement.primaryTagId
  );

  return (
    <div
      className="pointer-events-none fixed z-50 origin-top-left rounded-[14px] border border-primary/30 bg-surface px-3.5 py-3 opacity-95 shadow-[0_18px_42px_rgba(15,23,42,0.22)] transition-transform duration-75"
      style={{
        left: preview.clientX - preview.offsetX,
        top: preview.clientY - preview.offsetY,
        width: preview.width,
        minHeight: preview.height,
        transform: "scale(1.02) rotate(-0.4deg)",
      }}
    >
      <div className="flex items-start gap-3">
        <StatusCycleButton status={preview.arrangement.status} onClick={() => undefined} />
        <div className="min-w-0 flex-1 text-left">
          <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-text">
            {preview.arrangement.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {primaryTag && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 text-white"
                style={{ backgroundColor: primaryTag.color }}
              >
                {primaryTag.name}
              </span>
            )}
            {preview.arrangement.timeText && (
              <span className="text-[11px] leading-4 text-text-muted">
                {preview.arrangement.timeText}
              </span>
            )}
            <span className="text-[11px] leading-4 text-text-tertiary">
              {priorityLabel(preview.arrangement.priority)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupModeSheet({
  selectedMode,
  onSelect,
  onClose,
}: {
  selectedMode: GroupMode;
  onSelect: (mode: GroupMode) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay-light"
        onClick={onClose}
        aria-label="关闭整理方式选择"
      />
      <div className="relative rounded-t-[20px] bg-surface px-4 pb-5 pt-4 shadow-[0_-10px_30px_rgba(15,23,42,0.12)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold leading-6 text-text">整理方式</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-text-muted"
          >
            完成
          </button>
        </div>
        <div className="space-y-1">
          {groupModes.map((mode) => {
            const active = selectedMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => onSelect(mode.value)}
                className={`flex min-h-[54px] w-full items-center rounded-[12px] px-3 text-left transition active:scale-[0.99] ${
                  active ? "bg-primary-soft" : "bg-surface"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-5 text-text">{mode.label}</p>
                  <p className="mt-0.5 text-[12px] leading-4 text-text-tertiary">
                    {mode.description}
                  </p>
                </div>
                {active && (
                  <span className="ml-3 text-[13px] font-semibold text-primary">已选</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function ActionUndoToast({
  toast,
  onUndo,
  onDismiss,
}: {
  toast: NonNullable<ArrangementActionToast>;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="absolute bottom-5 left-4 right-[76px] z-20 flex min-h-12 items-center justify-between gap-3 rounded-full border border-border bg-surface px-4 py-2 text-text shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
      role="status"
    >
      <span className="min-w-0 truncate text-[13px] font-medium text-text">
        {actionToastMessage(toast)}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          className="rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary transition active:scale-95"
        >
          撤销
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-1.5 py-1 text-[12px] font-medium text-text-tertiary transition active:scale-95"
          aria-label="关闭提示"
        >
          ×
        </button>
      </div>
    </div>
  );
}
function buildTimeScopeOptions(arrangements: Arrangement[]): TimeScopeOption[] {
  return timeScopeOptions.map((option) => ({
    ...option,
    count: arrangements.filter((arrangement) => matchesTimeScope(arrangement, option.value))
      .length,
  }));
}

function matchesTimeScope(arrangement: Arrangement, scope: TimeScope) {
  if (scope === "all") return true;

  const dateKey = getArrangementDateKey(arrangement);
  if (scope === "unscheduled") return !dateKey;
  if (!dateKey) return false;

  if (scope === "today") return dateKey === getLocalDateKey(0);

  const today = getLocalDateKey(0);
  const recentEnd = getLocalDateKey(7);
  return dateKey > today && dateKey <= recentEnd;
}

function buildDateGroups(arrangements: Arrangement[]) {
  const groups = new Map<string, Arrangement[]>();
  arrangements.forEach((arrangement) => {
    const dateKey = getArrangementDateKey(arrangement) ?? unscheduledDateValue;
    groups.set(dateKey, [...(groups.get(dateKey) ?? []), arrangement]);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => compareDateGroupKey(left, right))
    .map(([value, items]) => ({
      value,
      title: value === unscheduledDateValue ? "未定时间" : formatDateLabel(value),
      items,
    }));
}

function getArrangementDateKey(arrangement: Arrangement) {
  const dateText = arrangement.dateText?.trim();
  if (dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return dateText;
  }

  const scheduleText = [
    arrangement.dateText,
    arrangement.timeText,
    arrangement.startText,
    arrangement.endText,
  ]
    .filter(Boolean)
    .join(" ");

  if (scheduleText.includes("今天") || scheduleText.includes("今日")) {
    return getLocalDateKey(0);
  }
  if (scheduleText.includes("明天") || scheduleText.includes("明日")) {
    return getLocalDateKey(1);
  }
  if (scheduleText.includes("后天")) {
    return getLocalDateKey(2);
  }

  return undefined;
}

function compareDateGroupKey(left: string, right: string) {
  if (left === unscheduledDateValue) return 1;
  if (right === unscheduledDateValue) return -1;
  return left.localeCompare(right);
}

function formatDateLabel(dateKey: string) {
  const today = getLocalDateKey(0);
  const tomorrow = getLocalDateKey(1);
  const afterTomorrow = getLocalDateKey(2);

  if (dateKey === today) return "今日";
  if (dateKey === tomorrow) return "明日";
  if (dateKey === afterTomorrow) return "后天";

  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function statusLabel(status: ArrangementStatus) {
  if (status === "completed") return "完成";
  if (status === "abandoned") return "放弃";
  return "未完成";
}

function priorityLabel(priority: ArrangementPriority) {
  if (priority === "important_urgent") return "重要且紧急";
  if (priority === "important_not_urgent") return "重要不紧急";
  if (priority === "urgent_not_important") return "紧急不重要";
  return "不重要也不紧急";
}

function statusToastMessage(status: ArrangementStatus) {
  if (status === "completed") return "已完成";
  if (status === "abandoned") return "已放弃";
  return "已设为未完成";
}

function actionToastMessage(toast: NonNullable<ArrangementActionToast>) {
  if (toast.kind === "delete") return "已删除安排";
  if (toast.kind === "move") return "已移动安排";
  return statusToastMessage(toast.nextStatus);
}

function emptyTitle(scope: TimeScope, label: string) {
  if (scope === "all") return "还没有安排";
  return `${label}暂时没有安排`;
}
function getLocalDateKey(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
