import React from "react";
import {
  clearArrangementAiSettings,
  getInitialArrangementAiSettings,
  persistArrangementAiSettings,
} from "@/data/arrangements";

type AiSettingsScreenProps = {
  onBack: () => void;
};

export default function AiSettingsScreen({ onBack }: AiSettingsScreenProps) {
  const [apiKey, setApiKey] = React.useState(
    () => getInitialArrangementAiSettings().apiKey
  );
  const [savedAt, setSavedAt] = React.useState<number | null>(
    () => getInitialArrangementAiSettings().updatedAt
  );

  const hasKey = apiKey.trim().length > 0;

  const handleSave = () => {
    persistArrangementAiSettings(apiKey);
    setSavedAt(Date.now());
  };

  const handleClear = () => {
    clearArrangementAiSettings();
    setApiKey("");
    setSavedAt(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-[20px] text-text"
          aria-label="返回"
        >
          ‹
        </button>
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold leading-6 text-text">AI 识别设置</h1>
          <p className="truncate text-[12px] leading-4 text-text-muted">
            仅保存本地设置，当前识别使用本地模拟。
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <section className="rounded-[14px] bg-surface px-4 py-4">
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold leading-5 text-text">
              API Key
            </span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              autoComplete="off"
              className="h-11 w-full rounded-[12px] border border-border bg-bg px-3 text-[14px] text-text outline-none focus:border-primary"
              placeholder="粘贴你的 API Key"
            />
          </label>
          <p className="mt-3 text-[12px] leading-5 text-text-muted">
            这个 Demo 只会把输入内容保存在当前浏览器本地。V1 不会把它用于真实大模型请求，消息识别流程仍走本地模拟。
          </p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="h-10 flex-1 rounded-[12px] bg-text text-[13px] font-semibold text-bg"
            >
              保存
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="h-10 flex-1 rounded-[12px] bg-bg text-[13px] font-medium text-text-muted"
            >
              清空
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-[14px] bg-surface px-4 py-4">
          <p className="text-[13px] font-semibold leading-5 text-text">当前状态</p>
          <p className="mt-2 text-[12px] leading-5 text-text-muted">
            {hasKey ? "已保存本地 API Key。" : "还没有保存 API Key。"}
          </p>
          {savedAt && (
            <p className="mt-1 text-[12px] leading-5 text-text-tertiary">
              最近保存：{new Date(savedAt).toLocaleString()}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
