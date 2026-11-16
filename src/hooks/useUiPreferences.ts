import { useEffect, useState } from 'react';
import type { FontOption, FontScaleOption, ThemeMode } from '../types';

const THEME_KEY = 'traiheo_theme';
const FONT_KEY = 'traiheo_font';
const SCALE_KEY = 'traiheo_font_scale';

const FONT_CSS_MAP: Record<FontOption, string> = {
  jakarta: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  vietnam: "'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif",
  manrope: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
  lora: "'Lora', Georgia, serif",
};

const SCALE_PX_MAP: Record<FontScaleOption, string> = {
  sm: '14px',
  md: '16px',
  lg: '17.5px',
  xl: '19px',
};

export function useUiPreferences() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof localStorage === 'undefined') return 'light';
    return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'light';
  });

  const [font, setFont] = useState<FontOption>(() => {
    if (typeof localStorage === 'undefined') return 'jakarta';
    return (localStorage.getItem(FONT_KEY) as FontOption) || 'jakarta';
  });

  const [fontScale, setFontScale] = useState<FontScaleOption>(() => {
    if (typeof localStorage === 'undefined') return 'md';
    return (localStorage.getItem(SCALE_KEY) as FontScaleOption) || 'md';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', FONT_CSS_MAP[font]);
    localStorage.setItem(FONT_KEY, font);
  }, [font]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-scale', SCALE_PX_MAP[fontScale]);
    localStorage.setItem(SCALE_KEY, fontScale);
  }, [fontScale]);

  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    font,
    setFont,
    fontScale,
    setFontScale,
  };
}
