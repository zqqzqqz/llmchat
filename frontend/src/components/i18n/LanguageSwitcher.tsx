import { Globe } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/Button';

export function LanguageSwitcher() {
  const { locale, availableLocales, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);

  const current = availableLocales.find((item) => item.code === locale);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        radius="lg"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('切换语言')}
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground"
      >
        <Globe className="h-5 w-5" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-36 rounded-xl border border-border/60 bg-background shadow-lg py-1 text-sm"
        >
          {availableLocales.map((item) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={item.code === locale}
              key={item.code}
              onClick={() => {
                setLocale(item.code);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-muted/50 ${
                item.code === locale ? 'text-brand font-medium' : 'text-foreground'
              }`}
            >
              {item.label}
              {item.code === locale && current ? (
                <span className="ml-1 text-xs text-muted-foreground">{t('当前语言')}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
