import './sixth-ui.css';

interface Palette {
  background: string;
  theme: string;
  title: string;
  text: string;
  accent: string;
}

interface SixthUIContext {
  brand: string;
  palette: Palette;
  allowUserPalette: boolean;
}

declare global {
  const UiContext: {
    sixthUi: SixthUIContext;
  };
  interface Window {
    SixthUI: {
      applyPalette: (palette: Partial<Palette>, persist?: boolean) => void;
      resetPalette: () => void;
    };
  }
}

const colorProperties: Record<keyof Palette, string> = {
  background: '--sixth-background',
  theme: '--sixth-theme',
  title: '--sixth-title',
  text: '--sixth-text',
  accent: '--sixth-accent',
};
const storageKey = 'sixth-ui/palette';
const context = UiContext.sixthUi as SixthUIContext;

function isCssColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return CSS.supports('color', value);
}

function readRgb(property: string) {
  const probe = document.createElement('span');
  probe.style.color = `var(${property})`;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const channels = getComputedStyle(probe).color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  probe.remove();
  return channels?.length === 3 ? channels : null;
}

function luminance(channels: number[]) {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function updateShadow() {
  if (!document.body) return;
  const background = readRgb('--sixth-background');
  const theme = readRgb('--sixth-theme');
  const text = readRgb('--sixth-text');
  if (!background || !theme || !text) return;
  const difference = Math.min(1, Math.abs(luminance(background) - luminance(theme)) * 3);
  const opacity = Math.max(0.08, 0.2 - difference * 0.12);
  document.documentElement.style.setProperty(
    '--sixth-shadow-color',
    `rgb(${text.join(' ')} / ${opacity})`,
  );
}

function applyPalette(palette: Partial<Palette>, persist = false) {
  const accepted: Partial<Palette> = {};
  for (const [name, property] of Object.entries(colorProperties) as [keyof Palette, string][]) {
    const value = palette[name];
    if (!isCssColor(value)) continue;
    document.documentElement.style.setProperty(property, value);
    accepted[name] = value;
  }
  updateShadow();
  if (persist && context.allowUserPalette) localStorage.setItem(storageKey, JSON.stringify(accepted));
}

function resetPalette() {
  localStorage.removeItem(storageKey);
  applyPalette(context.palette);
}

document.documentElement.classList.add('sixth-ui');
document.documentElement.dataset.app = context.brand;
applyPalette(context.palette);
window.addEventListener('DOMContentLoaded', updateShadow, { once: true });

if (context.allowUserPalette) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) applyPalette(stored);
  } catch {
    localStorage.removeItem(storageKey);
  }
}

window.SixthUI = { applyPalette, resetPalette };

const logo = document.querySelector<HTMLImageElement>('.nav__logo');
if (logo) {
  const brand = document.createElement('span');
  brand.className = 'sixth-wordmark';
  brand.textContent = context.brand;
  logo.replaceWith(brand);
}

export default {};
