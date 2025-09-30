import React from 'react';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n';

export interface DialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  title,
  description,
  confirmText,
  cancelText,
  destructive = false,
  onConfirm,
  onClose,
}) => {
  if (!open) return null;
  const { t } = useI18n();
  const resolvedTitle = title ?? t('确认操作');
  const resolvedConfirm = confirmText ?? t('确认');
  const resolvedCancel = cancelText ?? t('取消');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[61] w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl">
        <div className="p-4 sm:p-5">
          <div className="text-base font-semibold text-foreground">{resolvedTitle}</div>
          {description && (
            <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {description}
            </div>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="md"
              radius="md"
              onClick={onClose}
              className="min-w-[84px]"
            >
              {resolvedCancel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'brand'}
              size="md"
              radius="md"
              onClick={() => onConfirm?.()}
              className="min-w-[84px]"
            >
              {resolvedConfirm}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dialog;

