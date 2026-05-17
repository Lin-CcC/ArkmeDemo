import React from "react";
import type {
  Arrangement,
  ArrangementPriority,
  ArrangementStatus,
  ArrangementTag,
} from "@/types/arrangement";

type ArrangementsPageProps = {
  arrangements: Arrangement[];
  arrangementTags: ArrangementTag[];
  onCreate: () => void;
  onOpen: (arrangement: Arrangement) => void;
  onComplete: (arrangement: Arrangement) => void;
  onPostpone: (arrangement: Arrangement) => void;
  onOpenAiSettings: () => void;
};

const statusSections: Array<{
  status: ArrangementStatus;
  title: string;
  emptyText: string;
}> = [
  { status: "active", title: "未完成", emptyText: "眼前没有需要处理的安排。" },
  { status: "abandoned", title: "放弃", emptyText: "放下的安排会留在这里，之后仍可重新编辑。" },
  { status: "completed", title: "完成", emptyText: "完成过的安排会留在这里。" },
];

export default function ArrangementsPage({
  arrangements,
  arrangementTags,
  onCreate,
  onOpen,
  onComplete,
  onPostpone,
  onOpenAiSettings,
}: ArrangementsPageProps) {
  const [activeTagId, setActiveTagId] = React.useState("all");
  const filteredArrangements =
    activeTagId === "all"
      ? arrangements
      : arrangements.filter((arrangement) => arrangement.primaryTagId === activeTagId);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="shrink-0 bg-bg px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-7 text-text">安排</h1>
            <p className="mt-1 text-[12px] leading-5 text-text-muted">
              用标签颜色区分安排，之后可以落到日历标记。
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAiSettings}
            className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 text-[12px] leading-4 text-text-muted transition active:scale-[0.98]"
          >
            AI 设置
          </button>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-[12px] bg-text text-[14px] font-semibold text-bg transition active:scale-[0.98]"
        >
          添加安排
        </button>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <TagFilterButton
            active={activeTagId === "all"}
            label="全部"
            onClick={() => setActiveTagId("all")}
          />
          {arrangementTags.map((tag) => (
            <TagFilterButton
              key={tag.id}
              active={activeTagId === tag.id}
              label={tag.name}
              color={tag.color}
              onClick={() => setActiveTagId(tag.id)}
            />
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        {filteredArrangements.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-[22px] text-text-muted">
                +
              </div>
              <p className="mt-3 text-[14px] font-semibold leading-5 text-text">
                还没有安排
              </p>
              <p className="mt-1 text-[12px] leading-5 text-text-muted">
                可以先添加一件今天想记住的事。
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
        ) : (
          <div className="space-y-5">
            {statusSections.map((section) => {
              const sectionItems = filteredArrangements.filter(
                (arrangement) => arrangement.status === section.status
              );
              return (
                <section key={section.status}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-[13px] font-semibold leading-5 text-text">
                      {section.title}
                    </h2>
                    <span className="text-[11px] leading-4 text-text-tertiary">
                      {sectionItems.length}
                    </span>
                  </div>
                  {sectionItems.length > 0 ? (
                    <div className="space-y-2.5">
                      {sectionItems.map((arrangement) => (
                        <ArrangementListItem
                          key={arrangement.id}
                          arrangement={arrangement}
                          arrangementTags={arrangementTags}
                          onOpen={() => onOpen(arrangement)}
                          onComplete={() => onComplete(arrangement)}
                          onPostpone={() => onPostpone(arrangement)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-[12px] bg-surface px-3 py-3 text-[12px] leading-5 text-text-muted">
                      {section.emptyText}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TagFilterButton({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] transition ${
        active ? "border-text bg-text font-semibold text-bg" : "border-border bg-surface text-text-muted"
      }`}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function ArrangementListItem({
  arrangement,
  arrangementTags,
  onOpen,
  onComplete,
  onPostpone,
}: {
  arrangement: Arrangement;
  arrangementTags: ArrangementTag[];
  onOpen: () => void;
  onComplete: () => void;
  onPostpone: () => void;
}) {
  const isCompleted = arrangement.status === "completed";
  const isAbandoned = arrangement.status === "abandoned";
  const primaryTag = arrangementTags.find((tag) => tag.id === arrangement.primaryTagId);
  return (
    <article
      className="rounded-[14px] border border-border bg-surface px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      onClick={onOpen}
    >
      <button type="button" className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-text">
              {arrangement.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {primaryTag && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 text-white"
                  style={{ backgroundColor: primaryTag.color }}
                >
                  {primaryTag.name}
                </span>
              )}
              {arrangement.timeText && (
                <span className="rounded-full bg-fill-3 px-2 py-0.5 text-[11px] leading-4 text-text-muted">
                  {arrangement.timeText}
                </span>
              )}
              <span className="rounded-full bg-fill-2 px-2 py-0.5 text-[11px] leading-4 text-text-tertiary">
                {priorityLabel(arrangement.priority)}
              </span>
            </div>
          </div>
          <span className="mt-0.5 text-[11px] leading-4 text-text-tertiary">
            {statusLabel(arrangement.status)}
          </span>
        </div>
      </button>
      {!isCompleted && !isAbandoned && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPostpone();
            }}
            className="rounded-full px-3 py-1.5 text-[12px] leading-4 text-text-tertiary"
          >
            放弃
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onComplete();
            }}
            className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium leading-4 text-white"
          >
            完成
          </button>
        </div>
      )}
    </article>
  );
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
  return "不重要不紧急";
}
