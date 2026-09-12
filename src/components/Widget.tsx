import type { ComponentType, JSX } from 'react';

/**
 * 対話ウィジェットの自動登録。
 *
 * `src/components/widgets/*.tsx` に置いたファイルが自動的に読み込まれる。
 * 各ファイルは次の 2 つをエクスポートすること。
 *
 *   export const widgetId = 'radix';        // 本文から ```widget:radix で呼ぶ
 *   export default function RadixWidget() { ... }
 *
 * 登録ファイルを増やすだけで本文から使えるようになるので、
 * 一覧を手で管理する必要はない。
 */

interface WidgetModule {
  widgetId?: string;
  default?: ComponentType;
}

const modules = import.meta.glob<WidgetModule>('./widgets/*.tsx', { eager: true });

const REGISTRY: Record<string, ComponentType> = {};
for (const [path, mod] of Object.entries(modules)) {
  const fallbackId = path.split('/').pop()!.replace(/\.tsx$/, '');
  const id = mod.widgetId ?? fallbackId;
  if (mod.default) REGISTRY[id] = mod.default;
}

export const widgetIds = Object.keys(REGISTRY).sort();

export function Widget({ id }: { id: string }): JSX.Element {
  const Component = REGISTRY[id];
  if (!Component) {
    return (
      <div className="widget widget-missing">
        <p>対話ウィジェット「{id}」はまだ用意されていません。</p>
      </div>
    );
  }
  return (
    <div className="widget">
      <Component />
    </div>
  );
}
