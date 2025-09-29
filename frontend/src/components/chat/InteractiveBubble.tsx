import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import avatarImg from '@/img/4.png';

interface InteractiveBubbleProps {
  data: any;
  onInteractiveSelect?: (value: any) => void;
  onInteractiveFormSubmit?: (values: any) => void;
}

export const InteractiveBubble: React.FC<InteractiveBubbleProps> = ({
  data,
  onInteractiveSelect,
  onInteractiveFormSubmit
}) => {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [selectedValue, setSelectedValue] = useState<string>(() => {
    const opts = (data?.params as any)?.userSelectOptions || [];
    return (opts[0]?.key ?? opts[0]?.value ?? '') as string;
  });

  const renderUserSelect = () => (
    <div className="flex justify-start">
      <div className="flex items-start gap-3 max-w-[80%] w-full">
        <img src={avatarImg} alt="AI" className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border bg-muted" />
        <div className="bg-card rounded-2xl px-4 py-3 shadow-sm border border-border flex-1">
          <div className="text-sm text-foreground mb-3 whitespace-pre-wrap">
            {data?.params?.description || '请选择一个选项以继续'}
          </div>
          <div className="flex items-center gap-2">
            <select
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground"
              value={selectedValue}
              onChange={(e) => setSelectedValue(e.target.value)}
            >
              {(data?.params as any)?.userSelectOptions?.map((opt: any, idx: number) => (
                <option key={idx} value={String(opt.key ?? opt.value)}>
                  {String(opt.value ?? opt.key)}
                </option>
              ))}
            </select>
            <Button
              onClick={() => {
                if ((data as any)?.origin === 'init') {
                  const varKey = (data?.params as any)?.varKey;
                  onInteractiveSelect?.({ origin: 'init', key: varKey, value: selectedValue });
                } else {
                  onInteractiveSelect?.(selectedValue);
                }
              }}
              variant="brand"
              size="md"
              radius="md"
              className="px-3 py-1.5"
            >
              {(data as any)?.origin === 'init' ? '开始对话' : '确定'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUserInput = () => (
    <div className="flex justify-start">
      <div className="flex items-start gap-3 max-w-[80%] w-full">
        <img src={avatarImg} alt="AI" className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-border bg-muted" />
        <div className="bg-card rounded-2xl px-4 py-3 shadow-sm border border-border flex-1">
          <div className="text-sm text-gray-700 dark:text-gray-200 mb-3 whitespace-pre-wrap">
            {data?.params?.description || '请填写表单以继续'}
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if ((data as any)?.origin === 'init') {
                onInteractiveFormSubmit?.({ origin: 'init', values: formValues });
              } else {
                onInteractiveFormSubmit?.(formValues);
              }
            }}
          >
            {(data?.params as any)?.inputForm?.map((item: any, idx: number) => {
              const key = item?.key || `field_${idx}`;
              const label = item?.label || key;
              const type = item?.type || 'input';
              return (
                <div key={idx} className="flex items-center gap-3">
                  <label className="w-28 text-sm text-muted-foreground">{label}</label>
                  {type === 'numberInput' ? (
                    <input
                      type="number"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      onChange={(e) => setFormValues((s) => ({ ...s, [key]: Number(e.target.value) }))}
                    />
                  ) : type === 'select' ? (
                    <select
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      onChange={(e) => setFormValues((s) => ({ ...s, [key]: e.target.value }))}
                    >
                      {(item.list || []).map((opt: any, i: number) => (
                        <option key={i} value={String(opt.value)}>
                          {String(opt.label ?? opt.value)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      onChange={(e) => setFormValues((s) => ({ ...s, [key]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
            <div className="pt-2">
              <Button
                type="submit"
                variant="brand"
                size="md"
                radius="md"
                className="px-4 py-2 text-sm"
              >
                {(data as any)?.origin === 'init' ? '开始对话' : '提交'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  if (data?.type === 'userSelect') return renderUserSelect();
  if (data?.type === 'userInput') return renderUserInput();
  return null;
};

export default InteractiveBubble;