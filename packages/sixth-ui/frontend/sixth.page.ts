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
  language: string;
  palette: Palette;
  allowUserPalette: boolean;
  homepageTree?: HomepageTreeNode;
  compactNavigation?: CompactNavigationItem[];
}

interface CompactNavigationItem {
  id: string;
  label: string;
  href: string;
}

interface HomepageTreeNode {
  id: string;
  label: string;
  side?: number;
  childSector?: 'bottom-right';
  action: 'route' | 'expand';
  href?: string;
  children: HomepageTreeNode[];
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

const treeRotationSeedKey = 'sixth-ui/tree-rotation-seed';

function getTreeRotationSeed() {
  const generated = crypto.getRandomValues(new Uint32Array(1))[0];
  try {
    const stored = sessionStorage.getItem(treeRotationSeedKey);
    if (stored !== null) {
      const parsed = Number(stored);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 0xFFFFFFFF) return parsed;
    }
    sessionStorage.setItem(treeRotationSeedKey, generated.toString());
  } catch {
    return generated;
  }
  return generated;
}

const treeRotationSeed = getTreeRotationSeed();

function seededRandom(key: string) {
  let hash = 2166136261 ^ treeRotationSeed;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xFFFFFFFF;
}

const gr = 20 + seededRandom('layout') * 5;
const centerNodeId = 'home';
const centerLabelWidthToEdgeRatio = 1.2;
const nonEnglishLabelScale = 1.6;
const labelMeasurementSize = 100;

function measureLabelWidth(node: HTMLElement) {
  const label = node.querySelector<HTMLElement>(':scope > span');
  if (!label) return 0;
  label.style.width = 'max-content';
  label.style.flex = '0 0 auto';
  const width = label.offsetWidth;
  label.style.width = '';
  label.style.flex = '';
  return width;
}

function sizeTreeNodeLabel(node: HTMLElement) {
  const label = node.querySelector<HTMLElement>(':scope > span');
  if (!label) return;
  node.dataset.baseLabelFontSize ||= getComputedStyle(label).fontSize;
  if (node.dataset.nodeId === centerNodeId) {
    const targetWidth = (node.offsetWidth / 2) * centerLabelWidthToEdgeRatio;
    node.style.setProperty('--tree-label-width', `${targetWidth.toFixed(3)}px`);
    label.style.fontSize = `${labelMeasurementSize}px`;
    const measuredWidth = measureLabelWidth(node);
    if (measuredWidth > 0) {
      let fontSize = targetWidth * labelMeasurementSize / measuredWidth;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        label.style.fontSize = `${fontSize.toFixed(3)}px`;
        if (label.scrollWidth <= targetWidth) break;
        fontSize *= targetWidth / label.scrollWidth;
      }
    }
    return;
  }
  const baseFontSize = node.dataset.baseLabelFontSize || getComputedStyle(label).fontSize;
  label.style.fontSize = context.language === 'en'
    ? baseFontSize
    : `${(Number.parseFloat(baseFontSize) * nonEnglishLabelScale).toFixed(3)}px`;
}

function hexagonSupport(width: number, height: number, rotation: number, direction: number) {
  const vertices = [
    [-width / 4, -height / 2],
    [width / 4, -height / 2],
    [width / 2, 0],
    [width / 4, height / 2],
    [-width / 4, height / 2],
    [-width / 2, 0],
  ];
  const rotationCosine = Math.cos(rotation);
  const rotationSine = Math.sin(rotation);
  const directionCosine = Math.cos(direction);
  const directionSine = Math.sin(direction);
  return Math.max(...vertices.map(([vertexX, vertexY]) => {
    const rotatedX = vertexX * rotationCosine - vertexY * rotationSine;
    const rotatedY = vertexX * rotationSine + vertexY * rotationCosine;
    return rotatedX * directionCosine + rotatedY * directionSine;
  }));
}

function createTreeNode(
  node: HomepageTreeNode,
  parentId: string | null,
  depth: number,
) {
  const isExpandableBranch = node.action === 'expand' && depth === 1;
  const element = document.createElement(node.action === 'route' ? 'a' : isExpandableBranch ? 'button' : 'div');
  element.className = `sixth-tree-node sixth-tree-node--depth-${Math.min(depth, 5)}`;
  element.dataset.nodeId = node.id;
  element.dataset.parentId = parentId || '';
  element.dataset.depth = depth.toString();
  const angleVariation = depth >= 2 ? 2 : 5;
  const nodeAngle = parentId === null
    ? gr
    : gr - angleVariation + seededRandom(`node:${node.id}`) * angleVariation * 2;
  element.style.setProperty('--tree-node-rotation', `${(-nodeAngle).toFixed(3)}deg`);
  element.dataset.nodeAngle = nodeAngle.toFixed(3);
  if (node.side !== undefined) element.dataset.side = node.side.toString();
  if (node.childSector) element.dataset.childSector = node.childSector;
  if (node.action === 'route') {
    (element as HTMLAnchorElement).href = node.href || '#';
    if (depth === 0) element.setAttribute('aria-current', 'page');
  } else if (isExpandableBranch) {
    element.type = 'button';
    element.dataset.expandable = 'true';
    element.setAttribute('aria-expanded', 'false');
  } else {
    element.dataset.group = 'true';
  }
  const label = document.createElement('span');
  label.textContent = node.label;
  element.appendChild(label);
  return element;
}

function renderHomepageTree() {
  const tree = document.querySelector<HTMLElement>('.sixth-hub__tree');
  if (!tree || !context.homepageTree) return;
  const appendNode = (node: HomepageTreeNode, parentId: string | null, depth: number) => {
    const element = createTreeNode(node, parentId, depth);
    tree.appendChild(element);
    node.children.forEach((child) => appendNode(child, node.id, depth + 1));
  };
  appendNode(context.homepageTree, null, 0);
}

function renderHomepageTextPanelBackgrounds() {
  const panels = [...document.querySelectorAll<HTMLElement>('.sixth-home-text-panel')];
  panels.forEach((panel) => {
    const windowElement = panel.querySelector<HTMLElement>(':scope > .sixth-home-text-panel-window');
    if (!windowElement) return;
    panel.style.removeProperty('width');
    panel.style.removeProperty('min-height');
    windowElement.replaceChildren();
    const sample = document.createElement('span');
    sample.className = 'sixth-home-text-panel-window-cell';
    sample.style.visibility = 'hidden';
    sample.style.animation = 'none';
    windowElement.append(sample);
    const renderedCellWidth = Math.max(sample.getBoundingClientRect().width, 1);
    const renderedCellHeight = Math.max(sample.getBoundingClientRect().height, 1);
    const cellWidth = Math.max(renderedCellWidth - (1 / 0.8660254038), 1);
    const cellHeight = Math.max(renderedCellHeight - 1, 1);
    sample.remove();
    const panelWidth = Math.max(panel.clientWidth, cellWidth);
    const panelHeight = Math.max(panel.clientHeight, cellHeight);
    const rowStep = cellHeight * 0.75;
    const columnsForWidth = Math.max(1, Math.floor(panelWidth / cellWidth - 0.5));
    const completeGridWidth = (columnsForWidth + 0.5) * cellWidth;
    if (completeGridWidth < panel.clientWidth - 1) panel.style.width = `${completeGridWidth}px`;
    const rows = Math.max(1, Math.ceil((panelHeight - cellHeight) / rowStep) + 1);
    const completeGridHeight = cellHeight + (rows - 1 + (columnsForWidth > 1 ? 0.5 : 0)) * rowStep;
    if (completeGridHeight > panel.clientHeight) panel.style.minHeight = `${completeGridHeight}px`;
    const textSection = panel.querySelector<HTMLElement>(':scope > .section');
    if (textSection) {
      const textWidth = Math.max(cellWidth, panel.clientWidth - cellWidth / 2);
      textSection.style.width = `${textWidth}px`;
      textSection.style.maxWidth = `${textWidth}px`;
    }
    for (let row = 0; row < rows; row += 1) {
      const rowOffset = row % 2 ? 0.5 : 0;
      for (let column = 0; column < columnsForWidth; column += 1) {
        const center = (column + rowOffset + 0.5) * cellWidth;
        const cell = document.createElement('span');
        cell.className = 'sixth-home-text-panel-window-cell';
        const waveDistance = Math.hypot(
          row,
          column + rowOffset,
        );
        cell.style.setProperty('--sixth-home-text-wave-delay', `${row * 70 + Math.max(0, waveDistance - 0.9) * 8}ms`);
        cell.style.left = `${center - cellWidth / 2}px`;
        cell.style.top = `${row * rowStep}px`;
        windowElement.append(cell);
      }
    }
  });
}

function renderCodeBlockHexBackgrounds() {
  const codeBlocks = [...document.querySelectorAll<HTMLElement>('.sixth-ui pre')]
    .filter((pre) => pre.querySelector(':scope > code'));
  codeBlocks.forEach((pre) => {
    pre.classList.add('sixth-code-block');
    let background = pre.querySelector<HTMLElement>(':scope > .sixth-code-hex-background');
    if (!background) {
      background = document.createElement('span');
      background.className = 'sixth-code-hex-background';
      background.setAttribute('aria-hidden', 'true');
      pre.prepend(background);
    }
    background.replaceChildren();
    const sample = document.createElement('span');
    sample.className = 'sixth-code-hex-cell';
    sample.style.visibility = 'hidden';
    sample.style.animation = 'none';
    background.append(sample);
    const renderedCellWidth = Math.max(sample.getBoundingClientRect().width, 1);
    const renderedCellHeight = Math.max(sample.getBoundingClientRect().height, 1);
    const cellWidth = Math.max(renderedCellWidth - (1 / 0.8660254038), 1);
    const cellHeight = Math.max(renderedCellHeight - 1, 1);
    sample.remove();
    const blockWidth = Math.max(pre.clientWidth, renderedCellWidth);
    const blockHeight = Math.max(pre.clientHeight, renderedCellHeight);
    const columnStep = cellWidth * 0.75;
    const columns = Math.max(1, Math.ceil((blockWidth - renderedCellWidth) / columnStep) + 1);
    for (let column = 0; column < columns; column += 1) {
      const columnOffset = column % 2 ? 0.5 : 0;
      const rows = Math.max(1, Math.ceil((blockHeight - renderedCellHeight) / cellHeight - columnOffset) + 1);
      for (let row = 0; row < rows; row += 1) {
        const cell = document.createElement('span');
        cell.className = 'sixth-code-hex-cell';
        cell.style.setProperty('--sixth-code-wave-delay', `${(column + row) * 18}ms`);
        cell.style.left = `${column * columnStep}px`;
        cell.style.top = `${(row + columnOffset) * cellHeight}px`;
        background.append(cell);
      }
    }
  });
}

function renderLongTextPanelBackgrounds() {
  const textPanels = [...document.querySelectorAll<HTMLElement>(
    '.sixth-ui .section__body.typo:not(.col--problem-name), .sixth-ui textarea.textbox',
  )]
    .map((element) => element.matches('textarea') ? element.parentElement : element)
    .filter((panel): panel is HTMLElement => Boolean(panel))
    .filter((panel) => !panel.parentElement?.closest('.section__body.typo'))
    .filter((panel) => !panel.closest('.sixth-home-text-panel, .sixth-profile-tab-container, pre'));
  const uniquePanels = [...new Set(textPanels)];
  uniquePanels.forEach((panel) => {
    panel.style.removeProperty('width');
    panel.style.removeProperty('min-height');
    panel.style.removeProperty('padding-inline');
    panel.classList.add('sixth-long-text-panel');
    let windowElement = panel.querySelector<HTMLElement>(':scope > .sixth-long-text-panel-window');
    if (!windowElement) {
      windowElement = document.createElement('span');
      windowElement.className = 'sixth-long-text-panel-window';
      windowElement.setAttribute('aria-hidden', 'true');
      panel.prepend(windowElement);
    }
    windowElement.replaceChildren();
    const sample = document.createElement('span');
    sample.className = 'sixth-long-text-panel-window-cell';
    sample.style.visibility = 'hidden';
    sample.style.animation = 'none';
    windowElement.append(sample);
    const renderedCellWidth = Math.max(sample.getBoundingClientRect().width, 1);
    const renderedCellHeight = Math.max(sample.getBoundingClientRect().height, 1);
    const cellWidth = Math.max(renderedCellWidth - (1 / 0.8660254038), 1);
    const cellHeight = Math.max(renderedCellHeight - 1, 1);
    sample.remove();
    const inset = Math.min(cellWidth * 0.2, 16);
    panel.style.setProperty('padding-inline', `${inset}px`);
    const panelWidth = Math.max(panel.clientWidth, cellWidth + inset * 2);
    const panelHeight = Math.max(panel.clientHeight, cellHeight);
    const rowStep = cellHeight * 0.75;
    const columnsForWidth = Math.max(1, Math.floor((panelWidth - inset * 2) / cellWidth - 0.5));
    const completeGridWidth = (columnsForWidth + 0.5) * cellWidth;
    const completePanelWidth = completeGridWidth + inset * 2;
    if (completePanelWidth < panel.clientWidth - 1) panel.style.width = `${completePanelWidth}px`;
    const rows = Math.max(1, Math.ceil((panelHeight - cellHeight) / rowStep) + 1);
    const completeGridHeight = cellHeight + (rows - 1 + (columnsForWidth > 1 ? 0.5 : 0)) * rowStep;
    if (completeGridHeight > panel.clientHeight) panel.style.minHeight = `${completeGridHeight}px`;
    for (let row = 0; row < rows; row += 1) {
      const rowOffset = row % 2 ? 0.5 : 0;
      for (let column = 0; column < columnsForWidth; column += 1) {
        const center = (column + rowOffset + 0.5) * cellWidth;
        const cell = document.createElement('span');
        cell.className = 'sixth-long-text-panel-window-cell';
        const waveDistance = Math.hypot(
          row,
          column + rowOffset,
        );
        cell.style.setProperty('--sixth-long-text-wave-delay', `${row * 70 + Math.max(0, waveDistance - 0.9) * 8}ms`);
        cell.style.left = `${center - cellWidth / 2}px`;
        cell.style.top = `${row * rowStep}px`;
        windowElement.append(cell);
      }
    }
  });
}

function renderCompactNavigation() {
  if (document.documentElement.dataset.page === 'homepage' || !context.compactNavigation?.length) return;
  const panel = document.querySelector<HTMLElement>('#panel');
  const main = panel?.querySelector<HTMLElement>(':scope > .main');
  if (!panel || !main) return;
  panel.classList.add('sixth-ui--compact');
  const bar = document.createElement('div');
  bar.className = 'sixth-compact-bar';
  const navigation = document.createElement('nav');
  navigation.className = 'sixth-compact-nav';
  navigation.setAttribute('aria-label', 'Navigation');
  navigation.dataset.expanded = 'false';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sixth-compact-node sixth-compact-nav__toggle';
  toggle.setAttribute('aria-expanded', 'false');
  const toggleLabel = document.createElement('span');
  toggleLabel.textContent = context.brand;
  toggle.appendChild(toggleLabel);
  navigation.appendChild(toggle);
  const links = context.compactNavigation.map((item, index) => {
    const link = document.createElement('a');
    link.className = 'sixth-compact-node sixth-compact-nav__item';
    link.href = item.href;
    link.dataset.nodeId = item.id;
    link.style.setProperty('--compact-index', (index + 1).toString());
    link.style.setProperty('--compact-row-shift', index % 2 === 0 ? '1' : '0');
    link.style.setProperty('--compact-node-rotation', `${(-6 + seededRandom(`compact:${item.id}`) * 12).toFixed(3)}deg`);
    link.tabIndex = -1;
    link.setAttribute('aria-hidden', 'true');
    if (new URL(item.href, window.location.href).pathname === window.location.pathname) {
      link.setAttribute('aria-current', 'page');
    }
    const label = document.createElement('span');
    label.textContent = item.label;
    link.appendChild(label);
    navigation.appendChild(link);
    return link;
  });
  const setExpanded = (expanded: boolean) => {
    navigation.dataset.expanded = expanded.toString();
    toggle.setAttribute('aria-expanded', expanded.toString());
    links.forEach((link) => {
      link.tabIndex = expanded ? 0 : -1;
      link.setAttribute('aria-hidden', (!expanded).toString());
    });
  };
  toggle.addEventListener('click', () => setExpanded(navigation.dataset.expanded !== 'true'));
  navigation.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || navigation.dataset.expanded !== 'true') return;
    setExpanded(false);
    toggle.focus();
  });
  bar.appendChild(navigation);
  panel.insertBefore(bar, main);
}

function layoutHub() {
  const hub = document.querySelector<HTMLElement>('.sixth-hub');
  const nodes = hub ? [...hub.querySelectorAll<HTMLElement>('.sixth-tree-node')] : [];
  if (!hub || !nodes.length) return;
  const byId = new Map(nodes.map((node) => [node.dataset.nodeId || '', node]));
  const isVisible = (node: HTMLElement) => {
    let parentId = node.dataset.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) return false;
      if (parent.dataset.expandable === 'true') return parent.getAttribute('aria-expanded') === 'true';
      parentId = parent.dataset.parentId;
    }
    return true;
  };
  nodes.forEach((node) => {
    const hidden = !isVisible(node);
    node.classList.toggle('is-hidden', hidden);
    sizeTreeNodeLabel(node);
  });
  const gap = Number.parseFloat(getComputedStyle(hub).getPropertyValue('--sixth-tree-gap')) || 16;
  const positions = new Map<string, {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>();
  const metrics = new Map(nodes.map((node) => [node.dataset.nodeId || '', {
    node,
    width: node.offsetWidth,
    height: node.offsetHeight,
    rotation: (Number.parseFloat(node.style.getPropertyValue('--tree-node-rotation')) * Math.PI) / 180,
  }]));
  const childrenByParent = new Map<string, HTMLElement[]>();
  nodes.forEach((node) => {
    const parentId = node.dataset.parentId || '';
    const children = childrenByParent.get(parentId) || [];
    children.push(node);
    childrenByParent.set(parentId, children);
  });
  const collectVisibleDescendants = (parentId: string) => {
    const descendants: HTMLElement[] = [];
    const visit = (currentParentId: string) => {
      (childrenByParent.get(currentParentId) || []).forEach((child) => {
        if (!isVisible(child)) return;
        descendants.push(child);
        visit(child.dataset.nodeId || '');
      });
    };
    visit(parentId);
    return descendants;
  };
  const distanceBetween = (
    first: { x: number, y: number, width: number, height: number, rotation: number },
    second: { x: number, y: number, width: number, height: number, rotation: number },
  ) => {
    const deltaX = first.x - second.x;
    const deltaY = first.y - second.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (!distance) return 0;
    const direction = Math.atan2(deltaY, deltaX);
    return distance - hexagonSupport(
      first.width, first.height, first.rotation, direction,
    ) - hexagonSupport(
      second.width, second.height, second.rotation, direction + Math.PI,
    );
  };
  const padding = 32;
  const hubDocumentTop = hub.getBoundingClientRect().top + window.scrollY;
  const firstViewportCanvasHeight = Math.max(0, window.innerHeight - hubDocumentTop);
  const viewportAspectRatio = window.innerWidth / window.innerHeight;
  const ringStep = gap;
  const maxSearchRings = nodes.length * 12 + 24;
  let rootAnchorY = 0;
  const angleDifference = (first: number, second: number) => {
    const difference = Math.abs(first - second) % (Math.PI * 2);
    return Math.min(difference, Math.PI * 2 - difference);
  };
  const getBounds = (items: Iterable<{
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>) => {
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (const item of items) {
      const horizontalExtent = hexagonSupport(item.width, item.height, item.rotation, 0);
      const verticalExtent = hexagonSupport(item.width, item.height, item.rotation, Math.PI / 2);
      minX = Math.min(minX, item.x - horizontalExtent);
      maxX = Math.max(maxX, item.x + horizontalExtent);
      minY = Math.min(minY, item.y - verticalExtent);
      maxY = Math.max(maxY, item.y + verticalExtent);
    }
    return {
      minX, maxX, minY, maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };
  const placementScore = (
    position: { x: number, y: number, width: number, height: number, rotation: number },
    preferredDirection: number,
    direction: number,
  ) => {
    const currentBounds = getBounds(positions.values());
    const nextBounds = getBounds([...positions.values(), position]);
    const currentArea = currentBounds.width * currentBounds.height;
    const nextArea = nextBounds.width * nextBounds.height;
    const availableHalfWidth = Math.max(0, hub.clientWidth / 2 - padding);
    const horizontalOverflow = Math.max(0, -availableHalfWidth - nextBounds.minX)
      + Math.max(0, nextBounds.maxX - availableHalfWidth);
    const topOverflow = Math.max(0, padding - hubDocumentTop - rootAnchorY - nextBounds.minY);
    const boundsAspectRatio = nextBounds.width / Math.max(nextBounds.height, 1);
    const aspectRatioDifference = Math.abs(Math.log(boundsAspectRatio / viewportAspectRatio));
    const centerOffset = Math.hypot(
      (nextBounds.minX + nextBounds.maxX) / 2,
      (nextBounds.minY + nextBounds.maxY) / 2,
    );
    return (horizontalOverflow + topOverflow) * 1_000_000
      + (nextArea - currentArea) * 10
      + nextArea * aspectRatioDifference
      + Math.max(nextBounds.width, nextBounds.height)
      + centerOffset
      + angleDifference(direction, preferredDirection) * gap;
  };
  const getPreferredDirection = (node: HTMLElement) => {
    const side = Number(node.dataset.side || '0');
    return -((90 + gr + side * 60) * Math.PI / 180);
  };
  const findPackedPosition = (
    parent: { x: number, y: number, width: number, height: number, rotation: number },
    child: { width: number, height: number, rotation: number },
    preferredDirection: number,
    childSector?: 'bottom-right',
  ) => {
    const referenceRadius = Math.max(parent.width, parent.height) / 2
      + Math.max(child.width, child.height) / 2
      + gap;
    const sectorSweep = childSector === 'bottom-right' ? Math.PI * 2 / 3 : Math.PI * 2;
    const directionCount = childSector === 'bottom-right'
      ? Math.ceil(sectorSweep * referenceRadius / gap) + 1
      : Math.max(24, Math.ceil(sectorSweep * referenceRadius / gap));
    for (let ring = 0; ring <= maxSearchRings; ring += 1) {
      const available: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
        direction: number;
        score: number;
      }> = [];
      for (let directionIndex = 0; directionIndex < directionCount; directionIndex += 1) {
        const direction = childSector === 'bottom-right'
          ? directionIndex * sectorSweep / (directionCount - 1)
          : preferredDirection + directionIndex * sectorSweep / directionCount;
        const touchingDistance = hexagonSupport(
          parent.width, parent.height, parent.rotation, direction,
        ) + hexagonSupport(
          child.width, child.height, child.rotation, direction + Math.PI,
        ) + gap;
        const distance = touchingDistance + ring * ringStep;
        const position = {
          x: parent.x + Math.cos(direction) * distance,
          y: parent.y + Math.sin(direction) * distance,
          width: child.width,
          height: child.height,
          rotation: child.rotation,
        };
        const clear = [...positions.values()].every((other) => distanceBetween(position, other) >= gap - 0.01);
        if (!clear) continue;
        available.push({
          ...position,
          direction,
          score: placementScore(position, childSector ? direction : preferredDirection, direction),
        });
      }
      if (available.length) return available.sort((first, second) => first.score - second.score)[0];
    }
    throw new Error('Unable to place visible homepage tree node without overlap');
  };
  const bottomRightLattice = [
    { x: 1, y: 0 },
    { x: -0.5, y: Math.sqrt(3) / 2 },
    { x: 0.5, y: Math.sqrt(3) / 2 },
    { x: 1.5, y: Math.sqrt(3) / 2 },
    { x: 0, y: Math.sqrt(3) },
    { x: 1, y: Math.sqrt(3) },
  ];
  const placeBottomRightChildren = (parentId: string, children: HTMLElement[]) => {
    const parent = positions.get(parentId);
    if (!parent || !children.length || children.length > bottomRightLattice.length) return false;
    const items = children.map((node, index) => ({
      node,
      metrics: metrics.get(node.dataset.nodeId || ''),
      lattice: bottomRightLattice[index],
    }));
    let spacing = 0;
    items.forEach((item) => {
      const latticeDistance = Math.hypot(item.lattice.x, item.lattice.y);
      const direction = Math.atan2(item.lattice.y, item.lattice.x);
      const requiredDistance = hexagonSupport(
        parent.width, parent.height, parent.rotation, direction,
      ) + hexagonSupport(
        item.metrics.width, item.metrics.height, item.metrics.rotation, direction + Math.PI,
      ) + gap;
      spacing = Math.max(spacing, requiredDistance / latticeDistance);
    });
    items.forEach((first, firstIndex) => {
      items.slice(firstIndex + 1).forEach((second) => {
        const deltaX = first.lattice.x - second.lattice.x;
        const deltaY = first.lattice.y - second.lattice.y;
        const latticeDistance = Math.hypot(deltaX, deltaY);
        const direction = Math.atan2(deltaY, deltaX);
        const requiredDistance = hexagonSupport(
          first.metrics.width, first.metrics.height, first.metrics.rotation, direction,
        ) + hexagonSupport(
          second.metrics.width, second.metrics.height, second.metrics.rotation, direction + Math.PI,
        ) + gap;
        spacing = Math.max(spacing, requiredDistance / latticeDistance);
      });
    });
    for (let ring = 0; ring <= maxSearchRings; ring += 1) {
      const currentSpacing = spacing;
      const resolved = items.map((item) => ({
        x: parent.x + item.lattice.x * currentSpacing,
        y: parent.y + item.lattice.y * currentSpacing,
        width: item.metrics.width,
        height: item.metrics.height,
        rotation: item.metrics.rotation,
      }));
      const clear = resolved.every((position, index) => [
        ...positions.values(),
        ...resolved.slice(0, index),
      ].every((other) => distanceBetween(position, other) >= gap - 0.01));
      if (clear) {
        items.forEach((item, index) => {
          const id = item.node.dataset.nodeId || '';
          const direction = Math.atan2(item.lattice.y, item.lattice.x);
          item.node.dataset.layoutAngle = (-((direction * 180) / Math.PI)).toFixed(3);
          positions.set(id, resolved[index]);
        });
        return true;
      }
      spacing += ringStep;
    }
    throw new Error('Unable to place bottom-right homepage tree children on the compact lattice');
  };
  const placeChildren = (parentId: string, children: HTMLElement[]) => {
    const parent = positions.get(parentId);
    if (!parent || !children.length) return;
    const childSector = byId.get(parentId)?.dataset.childSector as 'bottom-right' | undefined;
    if (childSector === 'bottom-right' && placeBottomRightChildren(parentId, children)) return;
    children.forEach((node) => {
      const child = metrics.get(node.dataset.nodeId || '');
      const preferredDirection = getPreferredDirection(node);
      const resolved = findPackedPosition(parent, child, preferredDirection, childSector);
      const id = node.dataset.nodeId || '';
      const layoutAngle = childSector
        ? -((resolved.direction * 180) / Math.PI)
        : (resolved.direction * 180) / Math.PI;
      node.dataset.layoutAngle = layoutAngle.toFixed(3);
      positions.set(id, {
        x: resolved.x,
        y: resolved.y,
        width: child.width,
        height: child.height,
        rotation: child.rotation,
      });
    });
  };
  const placeEvenRootChildren = (parentId: string, children: HTMLElement[]) => {
    const parent = positions.get(parentId);
    if (!parent || !children.length) return;
    const items = children.map((node) => {
      const metricsForNode = metrics.get(node.dataset.nodeId || '');
      const direction = getPreferredDirection(node);
      const touchingDistance = hexagonSupport(
        parent.width, parent.height, parent.rotation, direction,
      ) + hexagonSupport(
        metricsForNode.width, metricsForNode.height, metricsForNode.rotation, direction + Math.PI,
      ) + gap;
      return { node, metrics: metricsForNode, direction, touchingDistance };
    });
    let radius = Math.max(...items.map((item) => item.touchingDistance)) + gap;
    for (let ring = 0; ring <= maxSearchRings; ring += 1) {
      const currentRadius = radius;
      const resolved = items.map((item) => ({
        x: parent.x + Math.cos(item.direction) * currentRadius,
        y: parent.y + Math.sin(item.direction) * currentRadius,
        width: item.metrics.width,
        height: item.metrics.height,
        rotation: item.metrics.rotation,
      }));
      const clear = resolved.every((position, index) => [
        ...positions.values(),
        ...resolved.slice(0, index),
      ].every((other) => distanceBetween(position, other) >= gap - 0.01));
      if (clear) {
        items.forEach((item, index) => {
          const id = item.node.dataset.nodeId || '';
          item.node.dataset.layoutAngle = ((item.direction * 180) / Math.PI).toFixed(3);
          positions.set(id, resolved[index]);
        });
        return;
      }
      radius += ringStep;
    }
    throw new Error('Unable to place first-level homepage tree nodes with even spacing');
  };
  const root = nodes.find((node) => !node.dataset.parentId);
  if (root) {
    const rootMetrics = metrics.get(root.dataset.nodeId || '');
    positions.set(root.dataset.nodeId || '', {
      x: 0,
      y: 0,
      width: rootMetrics.width,
      height: rootMetrics.height,
      rotation: rootMetrics.rotation,
    });
    const rootId = root.dataset.nodeId || '';
    const rootChildren = (childrenByParent.get(rootId) || []).filter(isVisible);
    placeEvenRootChildren(rootId, rootChildren);
    const rootAnchorBounds = getBounds(positions.values());
    const viewportCenterAnchorY = window.innerHeight / 2 - hubDocumentTop;
    rootAnchorY = Math.max(viewportCenterAnchorY, padding - hubDocumentTop - rootAnchorBounds.minY);
    hub.style.setProperty('--hub-root-anchor-y', `${rootAnchorY.toFixed(3)}px`);
    rootChildren.forEach((child) => {
      const childId = child.dataset.nodeId || '';
      placeChildren(childId, collectVisibleDescendants(childId));
    });
  }
  const layoutBounds = getBounds(positions.values());
  const viewportWidth = document.documentElement.clientWidth;
  const hubDocumentCenterX = hub.getBoundingClientRect().left + window.scrollX + hub.clientWidth / 2;
  const horizontalPadding = Math.min(padding, Math.max(0, (viewportWidth - layoutBounds.width) / 2));
  const minimumLayoutShiftX = window.scrollX + horizontalPadding
    - hubDocumentCenterX - layoutBounds.minX;
  const maximumLayoutShiftX = window.scrollX + viewportWidth - horizontalPadding
    - hubDocumentCenterX - layoutBounds.maxX;
  const layoutFitsViewport = hubDocumentCenterX + layoutBounds.minX >= window.scrollX
    && hubDocumentCenterX + layoutBounds.maxX <= window.scrollX + viewportWidth;
  const layoutShiftX = layoutFitsViewport
    ? 0
    : minimumLayoutShiftX <= maximumLayoutShiftX
      ? Math.min(Math.max(0, minimumLayoutShiftX), maximumLayoutShiftX)
      : (minimumLayoutShiftX + maximumLayoutShiftX) / 2;
  positions.forEach((position, id) => {
    const node = byId.get(id);
    node?.style.setProperty('--tree-x', `${(position.x + layoutShiftX).toFixed(3)}px`);
    node?.style.setProperty('--tree-y', `${position.y.toFixed(3)}px`);
  });
  const requiredHeight = Math.max(
    firstViewportCanvasHeight,
    rootAnchorY + layoutBounds.maxY + padding,
  );
  hub.style.setProperty('--hub-height', `${Math.ceil(requiredHeight)}px`);
  hub.dataset.layoutAspectRatio = viewportAspectRatio.toFixed(4);
  hub.dataset.layoutRotation = gr.toFixed(3);
  hub.dataset.layoutShiftX = layoutShiftX.toFixed(3);
  hub.dataset.layoutReady = 'true';
}

function isCssColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return CSS.supports('color', value);
}

function applyPalette(palette: Partial<Palette>, persist = false) {
  const accepted: Partial<Palette> = {};
  for (const [name, property] of Object.entries(colorProperties) as [keyof Palette, string][]) {
    const value = palette[name];
    if (!isCssColor(value)) continue;
    document.documentElement.style.setProperty(property, value);
    accepted[name] = value;
  }
  if (persist && context.allowUserPalette) localStorage.setItem(storageKey, JSON.stringify(accepted));
}

function resetPalette() {
  localStorage.removeItem(storageKey);
  applyPalette(context.palette);
}

function applyProfileRotations() {
  const elements = [...document.querySelectorAll<HTMLElement>(
    [
      '.sixth-profile-block',
      '.sixth-profile-actions > .profile-header__contact-item',
      '.sidebar-user-stat > .balancer__body',
      '.profile-content .section__tab-header-item',
    ].join(', '),
  )];
  elements.forEach((element, index) => {
    const rotationLimit = element.matches('.profile-content .section__tab-header-item')
      ? 0
      : element.matches([
        '.sixth-profile-block',
        '.sixth-profile-actions > a.profile-header__contact-item',
      ].join(', ')) ? 2 : 5;
    const rotation = -rotationLimit
      + seededRandom(`profile:${element.className}:${index}`) * rotationLimit * 2;
    element.style.setProperty('--profile-rotation', `${rotation.toFixed(3)}deg`);
  });
}

function profileHexSupport(width: number, height: number, rotation: number, direction: number, pointed = false) {
  const vertices = pointed ? [
    [0, -height / 2],
    [width / 2, -height / 4],
    [width / 2, height / 4],
    [0, height / 2],
    [-width / 2, height / 4],
    [-width / 2, -height / 4],
  ] : [
    [-width / 4, -height / 2],
    [width / 4, -height / 2],
    [width / 2, 0],
    [width / 4, height / 2],
    [-width / 4, height / 2],
    [-width / 2, 0],
  ];
  const rotationCosine = Math.cos(rotation);
  const rotationSine = Math.sin(rotation);
  const directionCosine = Math.cos(direction);
  const directionSine = Math.sin(direction);
  return Math.max(...vertices.map(([vertexX, vertexY]) => {
    const rotatedX = vertexX * rotationCosine - vertexY * rotationSine;
    const rotatedY = vertexX * rotationSine + vertexY * rotationCosine;
    return rotatedX * directionCosine + rotatedY * directionSine;
  }));
}

function applyProfileLayout() {
  const layout = document.querySelector<HTMLElement>('.sixth-profile-layout');
  const core = layout?.querySelector<HTMLElement>('.sixth-profile-core');
  const nameBlock = core?.querySelector<HTMLElement>('.sixth-profile-block--name');
  const avatarBlock = core?.querySelector<HTMLElement>('.sixth-profile-block--avatar');
  const metaBlock = core?.querySelector<HTMLElement>('.sixth-profile-block--meta');
  const statsBlock = core?.querySelector<HTMLElement>('.sixth-profile-block--stats');
  if (!layout || !core || !nameBlock || !avatarBlock || !metaBlock || !statsBlock) return;
  interface ProfileMetrics {
    width: number;
    height: number;
    rotation: number;
  }
  interface ProfileCenter {
    x: number;
    y: number;
  }
  interface ProfileEntry {
    element: HTMLElement;
    metrics: ProfileMetrics;
    center: ProfileCenter;
    mobility: number;
    anchor: ProfileCenter;
  }
  const readBlock = (element: HTMLElement): ProfileMetrics => {
    const styles = getComputedStyle(element);
    const width = Number.parseFloat(styles.width);
    const height = Number.parseFloat(styles.height);
    const rotation = Number.parseFloat(element.style.getPropertyValue('--profile-rotation')) * Math.PI / 180;
    return { width, height, rotation };
  };
  const name = readBlock(nameBlock);
  const avatar = readBlock(avatarBlock);
  const meta = readBlock(metaBlock);
  const stats = readBlock(statsBlock);
  const gap = Number.parseFloat(getComputedStyle(layout).getPropertyValue('--sixth-tree-gap')) || 16;
  const actionGap = Number.parseFloat(getComputedStyle(layout).getPropertyValue('--profile-action-gap')) || 6;
  const centerDistance = (first: ProfileMetrics, second: ProfileMetrics, direction: number) => gap
    + profileHexSupport(first.width, first.height, first.rotation, direction)
    + profileHexSupport(second.width, second.height, second.rotation, direction + Math.PI);
  const avatarCenter = {
    x: avatar.width / 2,
    y: avatar.height / 2,
  };
  const avatarNameDirection = Math.PI / 6;
  const avatarNameDistance = centerDistance(avatar, name, avatarNameDirection);
  const nameCenter = {
    x: avatarCenter.x + avatarNameDistance * Math.cos(avatarNameDirection),
    y: avatarCenter.y + avatarNameDistance * Math.sin(avatarNameDirection),
  };
  const upperDirection = -Math.PI / 6;
  const lowerDirection = Math.PI / 6;
  const metaCenter = {
    x: nameCenter.x + centerDistance(name, meta, upperDirection) * Math.cos(upperDirection),
    y: nameCenter.y + centerDistance(name, meta, upperDirection) * Math.sin(upperDirection),
  };
  const statsCenter = {
    x: nameCenter.x + centerDistance(name, stats, lowerDirection) * Math.cos(lowerDirection),
    y: nameCenter.y + centerDistance(name, stats, lowerDirection) * Math.sin(lowerDirection),
  };
  const edgeGap = (
    first: ProfileMetrics,
    firstCenter: ProfileCenter,
    second: ProfileMetrics,
    secondCenter: ProfileCenter,
  ) => {
    const direction = Math.atan2(secondCenter.y - firstCenter.y, secondCenter.x - firstCenter.x);
    return Math.hypot(secondCenter.x - firstCenter.x, secondCenter.y - firstCenter.y)
      - profileHexSupport(first.width, first.height, first.rotation, direction)
      - profileHexSupport(second.width, second.height, second.rotation, direction + Math.PI);
  };
  const blocks: ProfileEntry[] = [
    { element: avatarBlock, metrics: avatar, center: avatarCenter, mobility: 0.12, anchor: { ...avatarCenter } },
    { element: nameBlock, metrics: name, center: nameCenter, mobility: 0.28, anchor: { ...nameCenter } },
    { element: metaBlock, metrics: meta, center: metaCenter, mobility: 0.45, anchor: { ...metaCenter } },
    { element: statsBlock, metrics: stats, center: statsCenter, mobility: 0.45, anchor: { ...statsCenter } },
  ];
  const actionEntries: ProfileEntry[] = [...core.querySelectorAll<HTMLElement>(
    '.sixth-profile-actions > .profile-header__contact-item',
  )].map((element) => ({
    element,
    metrics: readBlock(element),
    center: { x: 0, y: 0 },
    mobility: 1,
    anchor: { x: 0, y: 0 },
  }));
  const iconEntries = actionEntries.filter((entry) => entry.element.matches('a.profile-header__contact-item'));
  const badgeEntry = actionEntries.find((entry) => entry.element.matches('.user-profile-badge'));
  const placeFrom = (
    origin: ProfileEntry,
    target: ProfileEntry,
    direction: number,
    spacing = gap,
  ) => {
    const distance = spacing
      + profileHexSupport(origin.metrics.width, origin.metrics.height, origin.metrics.rotation, direction)
      + profileHexSupport(target.metrics.width, target.metrics.height, target.metrics.rotation, direction + Math.PI);
    target.center.x = origin.center.x + Math.cos(direction) * distance;
    target.center.y = origin.center.y + Math.sin(direction) * distance;
  };
  const firstIcon = iconEntries[0];
  const secondIcon = iconEntries[1];
  const thirdIcon = iconEntries[2];
  if (firstIcon) placeFrom({ ...blocks[0], center: avatarCenter }, firstIcon, Math.PI / 3, actionGap);
  else if (badgeEntry) placeFrom({ ...blocks[0], center: avatarCenter }, badgeEntry, Math.PI / 3, actionGap);
  if (firstIcon && secondIcon) placeFrom(firstIcon, secondIcon, Math.PI * 5 / 6, actionGap);
  if (firstIcon && thirdIcon) placeFrom(firstIcon, thirdIcon, Math.PI / 2, actionGap);
  if (badgeEntry && firstIcon) placeFrom(firstIcon, badgeEntry, Math.PI / 6, actionGap);
  const positionedEntries = [...blocks, ...actionEntries];
  positionedEntries.forEach((entry) => { entry.anchor = { ...entry.center }; });
  const repelPair = (first: ProfileEntry, second: ProfileEntry) => {
    let deltaX = second.center.x - first.center.x;
    let deltaY = second.center.y - first.center.y;
    let distance = Math.hypot(deltaX, deltaY);
    if (distance < 0.001) {
      const angle = (positionedEntries.indexOf(first) + positionedEntries.indexOf(second) + 1) * Math.PI / 7;
      deltaX = Math.cos(angle);
      deltaY = Math.sin(angle);
      distance = 1;
    }
    const direction = Math.atan2(deltaY, deltaX);
    const requiredGap = first.element.closest('.sixth-profile-actions') && second.element.closest('.sixth-profile-actions')
      ? actionGap
      : gap;
    const overlap = requiredGap + profileHexSupport(first.metrics.width, first.metrics.height, first.metrics.rotation, direction)
      + profileHexSupport(second.metrics.width, second.metrics.height, second.metrics.rotation, direction + Math.PI)
      - distance;
    if (overlap <= 0) return 0;
    const mobilityTotal = first.mobility + second.mobility;
    const firstShare = first.mobility / mobilityTotal;
    const secondShare = second.mobility / mobilityTotal;
    first.center.x -= Math.cos(direction) * overlap * firstShare;
    first.center.y -= Math.sin(direction) * overlap * firstShare;
    second.center.x += Math.cos(direction) * overlap * secondShare;
    second.center.y += Math.sin(direction) * overlap * secondShare;
    return overlap;
  };
  for (let attempt = 0; attempt < 240; attempt += 1) {
    let maximumOverlap = 0;
    positionedEntries.forEach((entry, firstIndex) => {
      positionedEntries.slice(firstIndex + 1).forEach((other) => {
        maximumOverlap = Math.max(maximumOverlap, repelPair(entry, other));
      });
    });
    positionedEntries.forEach((entry) => {
      const anchorStrength = entry.mobility < 1 ? 0.025 : 0.008;
      entry.center.x += (entry.anchor.x - entry.center.x) * anchorStrength;
      entry.center.y += (entry.anchor.y - entry.center.y) * anchorStrength;
    });
    if (maximumOverlap < 0.05) break;
  }
  const rotatedBounds = (block: ProfileEntry) => {
    const halfWidth = Math.abs(Math.cos(block.metrics.rotation)) * block.metrics.width / 2
      + Math.abs(Math.sin(block.metrics.rotation)) * block.metrics.height / 2;
    const halfHeight = Math.abs(Math.sin(block.metrics.rotation)) * block.metrics.width / 2
      + Math.abs(Math.cos(block.metrics.rotation)) * block.metrics.height / 2;
    return {
      left: block.center.x - halfWidth,
      right: block.center.x + halfWidth,
      top: block.center.y - halfHeight,
      bottom: block.center.y + halfHeight,
    };
  };
  const initialBounds = positionedEntries.map(rotatedBounds);
  const shiftX = -Math.min(...initialBounds.map((bounds) => bounds.left));
  const shiftY = -Math.min(...initialBounds.map((bounds) => bounds.top));
  positionedEntries.forEach((entry) => {
    entry.center.x += shiftX;
    entry.center.y += shiftY;
  });
  blocks.forEach((block) => {
    block.element.style.setProperty('--profile-left-position', `${(block.center.x - block.metrics.width / 2).toFixed(3)}px`);
    block.element.style.setProperty('--profile-top-position', `${(block.center.y - block.metrics.height / 2).toFixed(3)}px`);
  });
  actionEntries.forEach((entry) => {
    entry.element.style.setProperty(
      '--profile-action-item-left',
      `${(entry.center.x - entry.metrics.width / 2).toFixed(3)}px`,
    );
    entry.element.style.setProperty(
      '--profile-action-item-top',
      `${(entry.center.y - entry.metrics.height / 2).toFixed(3)}px`,
    );
  });
  const finalBounds = positionedEntries.map(rotatedBounds);
  core.style.setProperty('--profile-core-width', `${Math.max(...finalBounds.map((bounds) => bounds.right)).toFixed(3)}px`);
  const coreHeight = Math.max(...finalBounds.map((bounds) => bounds.bottom));
  core.style.setProperty('--profile-core-height', `${coreHeight.toFixed(3)}px`);
  core.dataset.avatarNameGap = edgeGap(avatar, avatarCenter, name, nameCenter).toFixed(3);
  core.dataset.nameMetaGap = edgeGap(name, nameCenter, meta, metaCenter).toFixed(3);
  core.dataset.nameStatsGap = edgeGap(name, nameCenter, stats, statsCenter).toFixed(3);
  core.dataset.metaStatsGap = edgeGap(meta, metaCenter, stats, statsCenter).toFixed(3);
  if (firstIcon) {
    core.dataset.nameFirstIconGap = edgeGap(
      name,
      nameCenter,
      firstIcon.metrics,
      firstIcon.center,
    ).toFixed(3);
  }
}

function layoutProfileHexChain(
  container: HTMLElement,
  elements: HTMLElement[],
  directionForIndex: (index: number) => number,
  pointed = false,
  requestedGap?: number,
) {
  if (!elements.length) return;
  const gap = requestedGap
    ?? (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sixth-tree-gap')) || 16);
  const metrics = elements.map((element) => {
    const styles = getComputedStyle(element);
    return {
      width: Number.parseFloat(styles.width),
      height: Number.parseFloat(styles.height),
      rotation: Number.parseFloat(element.style.getPropertyValue('--profile-rotation')) * Math.PI / 180,
    };
  });
  const centers = [{ x: metrics[0].width / 2, y: metrics[0].height / 2 }];
  for (let index = 1; index < elements.length; index += 1) {
    const previous = metrics[index - 1];
    const current = metrics[index];
    const direction = directionForIndex(index);
    const distance = gap
      + profileHexSupport(previous.width, previous.height, previous.rotation, direction, pointed)
      + profileHexSupport(current.width, current.height, current.rotation, direction + Math.PI, pointed);
    centers.push({
      x: centers[index - 1].x + Math.cos(direction) * distance,
      y: centers[index - 1].y + Math.sin(direction) * distance,
    });
  }
  const anchors = centers.map((center) => ({ ...center }));
  for (let attempt = 0; attempt < 180; attempt += 1) {
    let maximumOverlap = 0;
    for (let firstIndex = 0; firstIndex < centers.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < centers.length; secondIndex += 1) {
        let deltaX = centers[secondIndex].x - centers[firstIndex].x;
        let deltaY = centers[secondIndex].y - centers[firstIndex].y;
        let distance = Math.hypot(deltaX, deltaY);
        if (distance < 0.001) {
          const angle = (firstIndex + secondIndex + 1) * Math.PI / 7;
          deltaX = Math.cos(angle);
          deltaY = Math.sin(angle);
          distance = 1;
        }
        const direction = Math.atan2(deltaY, deltaX);
        const overlap = gap
          + profileHexSupport(metrics[firstIndex].width, metrics[firstIndex].height, metrics[firstIndex].rotation, direction, pointed)
          + profileHexSupport(metrics[secondIndex].width, metrics[secondIndex].height, metrics[secondIndex].rotation, direction + Math.PI, pointed)
          - distance;
        if (overlap <= 0) continue;
        maximumOverlap = Math.max(maximumOverlap, overlap);
        centers[firstIndex].x -= Math.cos(direction) * overlap * 0.5;
        centers[firstIndex].y -= Math.sin(direction) * overlap * 0.5;
        centers[secondIndex].x += Math.cos(direction) * overlap * 0.5;
        centers[secondIndex].y += Math.sin(direction) * overlap * 0.5;
      }
    }
    centers.forEach((center, index) => {
      center.x += (anchors[index].x - center.x) * 0.01;
      center.y += (anchors[index].y - center.y) * 0.01;
    });
    if (maximumOverlap < 0.05) break;
  }
  const bounds = centers.map((center, index) => {
    const item = metrics[index];
    const halfWidth = Math.abs(Math.cos(item.rotation)) * item.width / 2
      + Math.abs(Math.sin(item.rotation)) * item.height / 2;
    const halfHeight = Math.abs(Math.sin(item.rotation)) * item.width / 2
      + Math.abs(Math.cos(item.rotation)) * item.height / 2;
    return {
      left: center.x - halfWidth,
      right: center.x + halfWidth,
      top: center.y - halfHeight,
      bottom: center.y + halfHeight,
    };
  });
  const shiftX = -Math.min(...bounds.map((item) => item.left));
  const shiftY = -Math.min(...bounds.map((item) => item.top));
  elements.forEach((element, index) => {
    element.style.setProperty('--profile-chain-left', `${(centers[index].x + shiftX - metrics[index].width / 2).toFixed(3)}px`);
    element.style.setProperty('--profile-chain-top', `${(centers[index].y + shiftY - metrics[index].height / 2).toFixed(3)}px`);
  });
  container.style.setProperty('--profile-chain-width', `${(Math.max(...bounds.map((item) => item.right)) + shiftX).toFixed(3)}px`);
  container.style.setProperty('--profile-chain-height', `${(Math.max(...bounds.map((item) => item.bottom)) + shiftY).toFixed(3)}px`);
}

function applyProfileSecondaryLayouts() {
  const statContainer = document.querySelector<HTMLElement>('.sidebar-user-stat');
  if (statContainer) {
    layoutProfileHexChain(
      statContainer,
      [...statContainer.querySelectorAll<HTMLElement>(':scope > .balancer__body')],
      (index) => index % 2 === 1 ? Math.PI / 6 : -Math.PI / 6,
    );
  }
  const tabContainer = document.querySelector<HTMLElement>('.profile-content .section__tab-header');
  if (tabContainer) {
    const tabElements = [...tabContainer.querySelectorAll<HTMLElement>(
      ':scope > .section__tab-header-item',
    )];
    const firstTab = tabElements[0];
    const selectedTab = tabContainer.querySelector<HTMLElement>(':scope > .section__tab-header-item.selected')
      || firstTab;
    const firstTabStyles = firstTab ? getComputedStyle(firstTab) : null;
    const selectedTabStyles = selectedTab ? getComputedStyle(selectedTab) : null;
    const tabBaseWidth = Number.parseFloat(firstTabStyles?.width || '');
    const tabSelectedScale = Number.parseFloat(selectedTabStyles?.getPropertyValue('--profile-tab-scale') || '') || 1;
    const tabSelectedWidth = tabBaseWidth * tabSelectedScale;
    layoutProfileHexChain(
      tabContainer,
      tabElements,
      () => 0,
      true,
      tabSelectedWidth - tabBaseWidth,
    );
    if (firstTab) {
      const shift = tabSelectedWidth + (tabSelectedWidth - tabBaseWidth) / 2;
      tabContainer.style.setProperty('--profile-tab-group-shift', `${shift.toFixed(3)}px`);
    }
  }
}

function measureProfileTabContentHeight(tabContent: HTMLElement) {
  const panes = [...tabContent.querySelectorAll<HTMLElement>(':scope > .section__tab-main')];
  const contentWidth = tabContent.clientWidth;
  return Math.max(0, ...panes.map((pane) => {
    const originalStyle = pane.getAttribute('style');
    pane.style.setProperty('display', 'block', 'important');
    pane.style.setProperty('position', 'absolute', 'important');
    pane.style.setProperty('visibility', 'hidden', 'important');
    pane.style.setProperty('width', `${contentWidth}px`, 'important');
    const height = pane.getBoundingClientRect().height;
    if (originalStyle === null) pane.removeAttribute('style');
    else pane.setAttribute('style', originalStyle);
    return height;
  }));
}

function profileTabTextRows(pane: HTMLElement) {
  const sectionBody = pane.querySelector<HTMLElement>('.section__body');
  if (!sectionBody) {
    const directChildren = [...pane.children] as HTMLElement[];
    return directChildren.length ? directChildren : [pane];
  }
  const listItems = [...sectionBody.querySelectorAll<HTMLElement>('li')];
  if (listItems.length) return listItems;
  const directChildren = [...sectionBody.children] as HTMLElement[];
  return directChildren.length ? directChildren : [sectionBody];
}

function animateProfileTabText(
  tabContent: HTMLElement,
  previousHeader: HTMLElement,
  nextHeader: HTMLElement,
) {
  const panes = [...tabContent.querySelectorAll<HTMLElement>(':scope > .section__tab-main')];
  const headers = [...previousHeader.parentElement?.querySelectorAll<HTMLElement>(
    ':scope > .section__tab-header-item',
  ) || []];
  const previousIndex = headers.indexOf(previousHeader);
  const nextIndex = headers.indexOf(nextHeader);
  const previousPane = panes[previousIndex];
  const nextPane = panes[nextIndex];
  if (!previousPane || !nextPane || previousPane === nextPane) return;
  const previousHeaderRect = previousHeader.getBoundingClientRect();
  const nextHeaderRect = nextHeader.getBoundingClientRect();
  const animateRows = (
    pane: HTMLElement,
    headerRect: DOMRect,
    className: string,
    duration: number,
    waveStep: number,
    initialOpacity: string,
  ) => {
    const rows = profileTabTextRows(pane);
    const rowStep = Math.max(headerRect.height * 0.75, 1);
    let maximumDelay = 0;
    pane.classList.add('sixth-profile-text-pane');
    rows.forEach((row) => {
      const rowRect = row.getBoundingClientRect();
      const distance = Math.max(0, (rowRect.top - (headerRect.top + headerRect.height / 2)) / rowStep - 0.9);
      const delay = distance * waveStep;
      maximumDelay = Math.max(maximumDelay, delay);
      row.classList.remove('sixth-profile-text-row-enter', 'sixth-profile-text-row-exit');
      row.style.setProperty('--profile-tab-text-wave-delay', `${delay}ms`);
      row.style.opacity = initialOpacity;
      row.classList.add(className);
    });
    return duration + maximumDelay;
  };
  const previousDuration = animateRows(
    previousPane,
    previousHeaderRect,
    'sixth-profile-text-row-exit',
    320,
    55,
    '1',
  );
  const nextDuration = animateRows(
    nextPane,
    nextHeaderRect,
    'sixth-profile-text-row-enter',
    360,
    70,
    '0',
  );
  window.setTimeout(() => {
    [previousPane, nextPane].forEach((pane) => {
      pane.classList.remove('sixth-profile-text-pane');
      profileTabTextRows(pane).forEach((row) => {
        row.classList.remove('sixth-profile-text-row-enter', 'sixth-profile-text-row-exit');
        row.style.removeProperty('--profile-tab-text-wave-delay');
        row.style.removeProperty('opacity');
      });
    });
  }, Math.max(previousDuration, nextDuration));
}

function repelProfileTabWindowRow(
  centers: number[],
  cellWidth: number,
  leftBoundary: number,
  rightBoundary: number,
) {
  if (!centers.length) return centers;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    let maximumOverlap = 0;
    for (let index = 1; index < centers.length; index += 1) {
      const overlap = cellWidth - (centers[index] - centers[index - 1]);
      if (overlap <= 0) continue;
      maximumOverlap = Math.max(maximumOverlap, overlap);
      centers[index - 1] -= overlap / 2;
      centers[index] += overlap / 2;
    }
    const leftOverlap = leftBoundary - (centers[0] - cellWidth / 2);
    if (leftOverlap > 0) centers.forEach((center, index) => { centers[index] = center + leftOverlap; });
    const rightOverlap = centers[centers.length - 1] + cellWidth / 2 - rightBoundary;
    if (rightOverlap > 0) centers.forEach((center, index) => { centers[index] = center - rightOverlap; });
    if (maximumOverlap < 0.01 && leftOverlap <= 0 && rightOverlap <= 0) break;
  }
  return centers;
}

interface ProfileTabOrigin {
  x: number;
  y: number;
}

function updateProfileTabWindow(previousOrigin?: ProfileTabOrigin) {
  const container = document.querySelector<HTMLElement>('.profile-content .section__tab-container');
  const header = container?.querySelector<HTMLElement>('.section__tab-header');
  const tabContent = container?.querySelector<HTMLElement>('.section__tab-content');
  const windowElement = container?.querySelector<HTMLElement>('.sixth-profile-tab-window');
  if (!container || !header || !tabContent || !windowElement) return;
  const selected = header.querySelector<HTMLElement>('.section__tab-header-item.selected')
    || header.querySelector<HTMLElement>('.section__tab-header-item');
  if (!selected) return;
  const existingCells = [...windowElement.querySelectorAll<HTMLElement>('.sixth-profile-tab-window-cell')];
  const activeExistingCells = existingCells.filter((cell) => !cell.classList.contains('is-exiting'));
  existingCells.filter((cell) => cell.classList.contains('is-exiting')).forEach((cell) => cell.remove());
  if (previousOrigin && activeExistingCells.length) {
    let maximumExitDelay = 0;
    activeExistingCells.forEach((cell) => {
      const rect = cell.getBoundingClientRect();
      const cellWidth = Math.max(rect.width, 1);
      const cellHeight = Math.max(rect.height, 1);
      const distance = Math.hypot(
        (rect.left + rect.width / 2 - previousOrigin.x) / cellWidth,
        (rect.top + rect.height / 2 - previousOrigin.y) / (cellHeight * 0.75),
      );
      const exitDelay = Math.max(0, distance - 0.9) * 55;
      maximumExitDelay = Math.max(maximumExitDelay, exitDelay);
      cell.style.setProperty('--profile-tab-wave-out-delay', `${exitDelay}ms`);
      cell.classList.add('is-exiting');
    });
    window.setTimeout(() => {
      activeExistingCells.forEach((cell) => cell.remove());
    }, maximumExitDelay + 320);
  } else {
    activeExistingCells.forEach((cell) => cell.remove());
  }
  windowElement.style.setProperty('--profile-tab-window-top', '0px');
  windowElement.style.setProperty('--profile-tab-window-height', '0px');
  container.style.removeProperty('--profile-tab-container-height');
  const containerRect = container.getBoundingClientRect();
  const headerRect = header.getBoundingClientRect();
  const selectedRect = selected.getBoundingClientRect();
  const selectedStyles = getComputedStyle(selected);
  const selectedScale = Number.parseFloat(selectedStyles.getPropertyValue('--profile-tab-scale')) || 1;
  const cellBaseWidth = Number.parseFloat(selectedStyles.width);
  const cellBaseHeight = Number.parseFloat(selectedStyles.height);
  const cellWidth = cellBaseWidth * selectedScale;
  const cellHeight = cellBaseHeight * selectedScale;
  const selectedCenterX = selectedRect.left - containerRect.left + selectedRect.width / 2;
  const start = headerRect.top - containerRect.top - (cellHeight - cellBaseHeight) / 2;
  const rowStep = cellHeight * 0.75;
  const minimumRows = 5;
  const minimumWindowHeight = cellHeight + minimumRows * rowStep;
  const contentWindowHeight = headerRect.height + measureProfileTabContentHeight(tabContent) + 80 - start;
  const targetWindowHeight = Math.max(
    minimumWindowHeight,
    contentWindowHeight,
  );
  const rows = Math.max(
    minimumRows,
    Math.ceil((targetWindowHeight - cellHeight) / rowStep),
  );
  const windowHeight = cellHeight + rows * rowStep;
  windowElement.style.setProperty('--profile-tab-window-top', `${start.toFixed(3)}px`);
  windowElement.style.setProperty('--profile-tab-window-height', `${windowHeight.toFixed(3)}px`);
  container.style.setProperty('--profile-tab-container-height', `${(start + windowHeight).toFixed(3)}px`);
  const viewportWidth = document.documentElement.clientWidth;
  const contentWidth = container.clientWidth;
  const leftBoundary = Math.max(0, -containerRect.left);
  const rightBoundary = Math.min(contentWidth, viewportWidth - containerRect.left);
  const availableWidth = rightBoundary - leftBoundary;
  if (availableWidth < cellWidth) return;
  const columns = Math.max(
    1,
    Math.floor((availableWidth - cellWidth / 2) / cellWidth),
  );
  const gridWidth = (columns + 0.5) * cellWidth;
  const firstTab = header.querySelector<HTMLElement>(':scope > .section__tab-header-item');
  const firstTabRect = firstTab?.getBoundingClientRect();
  const alignedGridLeft = firstTabRect
    ? firstTabRect.left - containerRect.left + firstTabRect.width / 2 - cellWidth * 1.5
    : leftBoundary + (availableWidth - gridWidth) / 2;
  const gridLeft = Math.min(
    Math.max(alignedGridLeft, leftBoundary),
    rightBoundary - gridWidth,
  );
  const textLeft = gridLeft + cellWidth / 2;
  const textRight = gridLeft + columns * cellWidth;
  container.style.setProperty('--profile-tab-text-left', `${textLeft.toFixed(3)}px`);
  container.style.setProperty('--profile-tab-text-width', `${(textRight - textLeft).toFixed(3)}px`);
  for (let row = 1; row <= rows; row += 1) {
    const rowOffset = row % 2 ? 0.5 : 0;
    const centers = repelProfileTabWindowRow(
      Array.from(
        { length: columns },
        (_, column) => gridLeft + (column + rowOffset + 0.5) * cellWidth,
      ),
      cellWidth,
      leftBoundary,
      rightBoundary,
    );
    centers.forEach((cellCenterX) => {
      const cell = document.createElement('span');
      cell.className = 'sixth-profile-tab-window-cell';
      const waveDistance = previousOrigin
        ? Math.hypot(
          (cellCenterX - selectedCenterX) / cellWidth,
          row * 0.75,
        )
        : row * 0.75;
      cell.style.setProperty('--profile-tab-window-cell-scale', selectedScale.toString());
      cell.style.setProperty('--profile-tab-wave-delay', `${Math.max(0, waveDistance - 0.9) * 70}ms`);
      cell.style.left = `${cellCenterX - cellBaseWidth / 2}px`;
      cell.style.top = `${row * rowStep + (cellHeight - cellBaseHeight) / 2}px`;
      windowElement.append(cell);
    });
  }
}

function prepareProfileTabWindow() {
  const container = document.querySelector<HTMLElement>('.profile-content .section__tab-container');
  const header = container?.querySelector<HTMLElement>('.section__tab-header');
  const tabContent = container?.querySelector<HTMLElement>('.section__tab-content');
  if (!container || !header || !tabContent) return;
  container.classList.add('sixth-profile-tab-container');
  header.classList.add('sixth-profile-tab-header');
  let profileTabUpdateTimer = 0;
  header.querySelectorAll<HTMLElement>(':scope > .section__tab-header-item').forEach((item) => {
    item.classList.add('sixth-profile-tab-item');
    if (!item.querySelector(':scope > .sixth-profile-tab-label')) {
      const label = document.createElement('span');
      label.className = 'sixth-profile-tab-label';
      label.textContent = item.textContent?.trim() || '';
      item.replaceChildren(label);
    }
    if (item.dataset.sixthProfileTabBound !== 'true') {
      item.addEventListener('click', () => {
        const previousSelected = header.querySelector<HTMLElement>('.section__tab-header-item.selected');
        const previousRect = previousSelected?.getBoundingClientRect();
        const previousOrigin = previousRect ? {
          x: previousRect.left + previousRect.width / 2,
          y: previousRect.top + previousRect.height / 2,
        } : undefined;
        if (previousSelected && previousSelected !== item) {
          animateProfileTabText(tabContent, previousSelected, item);
        }
        window.clearTimeout(profileTabUpdateTimer);
        profileTabUpdateTimer = window.setTimeout(() => {
          if (!item.classList.contains('selected')) return;
          updateProfileTabWindow(previousOrigin);
        }, 0);
      }, { capture: true });
      item.dataset.sixthProfileTabBound = 'true';
    }
  });
  tabContent.classList.add('sixth-profile-tab-content');
  if (!container.querySelector('.sixth-profile-tab-window')) {
    const windowElement = document.createElement('div');
    windowElement.className = 'sixth-profile-tab-window';
    windowElement.setAttribute('aria-hidden', 'true');
    container.prepend(windowElement);
  }
  updateProfileTabWindow();
}

function refreshProfileLayout() {
  renderHomepageTextPanelBackgrounds();
  renderLongTextPanelBackgrounds();
  prepareProfileTabWindow();
  applyProfileRotations();
  applyProfileLayout();
  applyProfileSecondaryLayouts();
  updateProfileTabWindow();
  renderCodeBlockHexBackgrounds();
}

let pageRedrawFrame = 0;
let resizeEndTimer = 0;
function redrawPage() {
  refreshProfileLayout();
  layoutHub();
}

function schedulePageRedraw() {
  if (pageRedrawFrame) return;
  pageRedrawFrame = window.requestAnimationFrame(() => {
    pageRedrawFrame = 0;
    redrawPage();
  });
}

function handlePageResize() {
  document.documentElement.classList.add('sixth-ui--resizing');
  schedulePageRedraw();
  window.clearTimeout(resizeEndTimer);
  resizeEndTimer = window.setTimeout(() => {
    resizeEndTimer = 0;
    schedulePageRedraw();
    window.requestAnimationFrame(() => {
      if (!resizeEndTimer) document.documentElement.classList.remove('sixth-ui--resizing');
    });
  }, 160);
}

document.documentElement.classList.add('sixth-ui');
document.documentElement.dataset.app = context.brand;
applyPalette(context.palette);

function initializePage() {
  renderCompactNavigation();
  renderHomepageTree();
  refreshProfileLayout();
  schedulePageRedraw();
  const expandableNodes = [...document.querySelectorAll<HTMLElement>('[data-expandable="true"]')];
  const treeNodes = [...document.querySelectorAll<HTMLElement>('.sixth-tree-node')];
  const byId = new Map(treeNodes.map((node) => [node.dataset.nodeId || '', node]));
  let expansionAnimationFrame = 0;
  expandableNodes.forEach((element) => {
    element.addEventListener('click', () => {
      const expanded = element.getAttribute('aria-expanded') === 'true';
      cancelAnimationFrame(expansionAnimationFrame);
      treeNodes.forEach((node) => node.classList.remove('is-entering'));
      expandableNodes.forEach((other) => other.setAttribute('aria-expanded', 'false'));
      layoutHub();
      if (expanded) return;
      const elementId = element.dataset.nodeId || '';
      const enteringNodes = treeNodes.filter((node) => {
        let parentId = node.dataset.parentId;
        while (parentId) {
          if (parentId === elementId) return true;
          parentId = byId.get(parentId)?.dataset.parentId;
        }
        return false;
      });
      const originX = element.style.getPropertyValue('--tree-x') || '0px';
      const originY = element.style.getPropertyValue('--tree-y') || '0px';
      element.setAttribute('aria-expanded', 'true');
      enteringNodes.forEach((node) => {
        node.style.setProperty('--tree-x', originX);
        node.style.setProperty('--tree-y', originY);
        node.classList.remove('is-hidden');
        node.classList.add('is-entering');
      });
      enteringNodes[0]?.getBoundingClientRect();
      expansionAnimationFrame = requestAnimationFrame(() => {
        layoutHub();
        enteringNodes.forEach((node) => node.classList.remove('is-entering'));
      });
    });
  });
  redrawPage();
  window.addEventListener('resize', handlePageResize);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initializePage, { once: true });
} else {
  initializePage();
}

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
