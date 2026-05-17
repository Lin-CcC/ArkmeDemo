import React from "react";
import {
  clearArrangementAiSettings,
  defaultArrangementAiEndpointUrl,
  defaultArrangementAiModel,
  getInitialArrangementAiSettings,
  persistArrangementAiSettings,
} from "@/data/arrangements";

type AiSettingsScreenProps = {
  onBack: () => void;
};

export default function AiSettingsScreen({ onBack }: AiSettingsScreenProps) {
  const initialSettings = React.useMemo(() => getInitialArrangementAiSettings(), []);
  const [apiKey, setApiKey] = React.useState(
    () => initialSettings.apiKey
  );
  const [endpointUrl, setEndpointUrl] = React.useState(
    () => initialSettings.endpointUrl ?? defaultArrangementAiEndpointUrl
  );
  const [model, setModel] = React.useState(
    () => initialSettings.model ?? defaultArrangementAiModel
  );
  const [savedAt, setSavedAt] = React.useState<number | null>(
    () => initialSettings.updatedAt
  );

  const hasKey = apiKey.trim().length > 0;
  const normalizedEndpointUrl = endpointUrl.trim() || defaultArrangementAiEndpointUrl;
  const normalizedModel = model.trim() || defaultArrangementAiModel;

  const handleSave = () => {
    persistArrangementAiSettings({
      apiKey,
      endpointUrl: normalizedEndpointUrl,
      model: normalizedModel,
    });
    setSavedAt(Date.now());
  };

  const handleClear = () => {
    clearArrangementAiSettings();
    setApiKey("");
    setEndpointUrl(defaultArrangementAiEndpointUrl);
    setModel(defaultArrangementAiModel);
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
            保存后会优先用于消息识别。
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <section className="rounded-[14px] bg-surface px-4 py-4">
          <label className="block">
            <span className="mb-2 block text-[13px] font-semibold leading-5 text-text">
              API endpoint URL
            </span>
            <input
              value={endpointUrl}
              onChange={(event) => setEndpointUrl(event.target.value)}
              type="url"
              autoComplete="off"
              className="h-11 w-full rounded-[12px] border border-border bg-bg px-3 text-[14px] text-text outline-none focus:border-primary"
              placeholder={defaultArrangementAiEndpointUrl}
            />
          </label>
          <p className="mt-2 text-[12px] leading-5 text-text-muted">
            OpenAI 兼容的 base URL。中转服务通常填 /v1 地址；Gemini 原生地址会自动改用它的兼容入口。
          </p>

          <label className="mt-4 block">
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
          <p className="mt-2 text-[12px] leading-5 text-text-muted">
            和上面的 endpoint 配套。这个 Demo 只保存在当前浏览器本地。
          </p>

          <label className="mt-4 block">
            <span className="mb-2 block text-[13px] font-semibold leading-5 text-text">
              默认模型
            </span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              type="text"
              autoComplete="off"
              className="h-11 w-full rounded-[12px] border border-border bg-bg px-3 text-[14px] text-text outline-none focus:border-primary"
              placeholder={defaultArrangementAiModel}
            />
          </label>
          <p className="mt-2 text-[12px] leading-5 text-text-muted">
            官方 OpenAI 可用 {defaultArrangementAiModel}。中转服务请按它支持的模型名填写。
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
            {hasKey
              ? `已保存本地 API Key，消息会优先用 ${normalizedModel} 识别。`
              : "还没有保存 API Key，消息会使用本地规则识别。"}
          </p>
          <p className="mt-1 break-all text-[12px] leading-5 text-text-tertiary">
            当前 endpoint：{normalizedEndpointUrl}
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
