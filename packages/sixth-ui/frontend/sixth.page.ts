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

function applyHexagonSizeVariation() {
  const hexagons = document.querySelectorAll<HTMLElement>(
    '.sixth-hub__core, .sixth-hub__branch, .nav__list > .nav__list-item .nav__item, .nav__list > .nav__list-item .nav__item--round, .sixth-wordmark, .user-profile-avatar, .profile-header__contact-item',
  );
  if (!hexagons.length) return;
  const randomValues = new Uint16Array(hexagons.length * 2);
  crypto.getRandomValues(randomValues);
  hexagons.forEach((hexagon, index) => {
    const scale = 0.94 + (randomValues[index * 2] / 65535) * 0.12;
    const tilt = -3.2 + (randomValues[index * 2 + 1] / 65535) * 6.4;
    hexagon.style.setProperty('--hex-size-scale', scale.toFixed(4));
    hexagon.style.setProperty('--hex-tilt', `${tilt.toFixed(2)}deg`);
  });
}

function layoutHub() {
  const hub = document.querySelector<HTMLElement>('.sixth-hub');
  const core = hub?.querySelector<HTMLElement>('.sixth-hub__core');
  const branches = hub ? [...hub.querySelectorAll<HTMLElement>('.sixth-hub__branch')] : [];
  if (!hub || !core || !branches.length) return;

  const gap = 24;
  const shadowClearance = 16;
  hub.style.setProperty('--hub-fit-scale', '1');
  const rawCoreWidth = core.getBoundingClientRect().width;
  const rawBranchWidths = branches.map((branch) => branch.getBoundingClientRect().width);
  const rawBranchHeights = branches.map((branch) => branch.getBoundingClientRect().height);
  const rawMaxBranchWidth = Math.max(...rawBranchWidths);
  const rawOuterRadius = rawCoreWidth / 2 + rawMaxBranchWidth + gap;
  const fitScale = Math.min(1, (hub.clientWidth / 2 - shadowClearance - gap) / rawOuterRadius);
  const appliedFitScale = Math.max(0.68, fitScale);
  hub.style.setProperty('--hub-fit-scale', appliedFitScale.toFixed(4));
  const coreWidth = rawCoreWidth * appliedFitScale;
  const branchWidths = rawBranchWidths.map((width) => width * appliedFitScale);
  const branchHeights = rawBranchHeights.map((height) => height * appliedFitScale);
  const maxBranchWidth = Math.max(...branchWidths);
  const maxBranchHeight = Math.max(...branchHeights);
  const angles = branches.map((_, index) => -90 + (index * 360) / branches.length);
  let radius = coreWidth / 2 + maxBranchWidth / 2 + gap;

  const positionsOverlap = (currentRadius: number) => {
    const points = angles.map((angle) => {
      const radians = (angle * Math.PI) / 180;
      return { x: Math.cos(radians) * currentRadius, y: Math.sin(radians) * currentRadius };
    });
    for (let first = 0; first < points.length; first += 1) {
      for (let second = first + 1; second < points.length; second += 1) {
        const distance = Math.hypot(points[first].x - points[second].x, points[first].y - points[second].y);
        const required = (branchWidths[first] + branchWidths[second]) / 2 + gap;
        if (distance < required) return true;
      }
    }
    return false;
  };

  while (positionsOverlap(radius) && radius < Math.max(hub.clientWidth, hub.clientHeight)) radius += 8;
  const orbit = `${radius.toFixed(1)}px`;
  branches.forEach((branch, index) => {
    const angle = angles[index];
    branch.style.setProperty('--orbit-angle', `${angle}deg`);
    branch.style.setProperty('--orbit-counter-angle', `${-angle}deg`);
    branch.style.setProperty('--hub-orbit-radius', orbit);
  });
  const height = radius * 2 + maxBranchHeight + shadowClearance * 2;
  hub.style.setProperty('--hub-height', `${Math.ceil(height)}px`);
  hub.dataset.layoutReady = 'true';
}

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
window.addEventListener('DOMContentLoaded', () => {
  applyHexagonSizeVariation();
  layoutHub();
  window.addEventListener('resize', layoutHub);
}, { once: true });

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
