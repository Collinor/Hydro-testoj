import { readFileSync } from 'fs';
import { join } from 'path';
import {
    Context, Handler, PRIV, Schema, SystemModel,
} from 'hydrooj';
import { palettePresets, SixthUIPalette, SixthUIPreset } from './presets';

interface HomepageTreeAction {
    type: 'route' | 'expand';
    name?: string;
    args?: Record<string, unknown>;
}

type HomepageTreeChildSector = 'bottom-right';

interface HomepageTreeNode {
    id: string;
    label?: string;
    labelKey?: string;
    side?: number;
    childSector?: HomepageTreeChildSector;
    action: HomepageTreeAction;
    requiresAuth?: boolean;
    requiresGuest?: boolean;
    children?: HomepageTreeNode[];
}

interface HomepageTreeConfig {
    version: 1;
    root: HomepageTreeNode;
}

interface ResolvedHomepageTreeNode {
    id: string;
    label: string;
    side?: number;
    childSector?: HomepageTreeChildSector;
    action: 'route' | 'expand';
    href?: string;
    children: ResolvedHomepageTreeNode[];
}

interface ResolvedCompactNavigationItem {
    id: string;
    label: string;
    href: string;
}

declare module 'hydrooj' {
    interface SystemKeys {
        'sixth-ui.brand': string;
        'sixth-ui.palette': SixthUIPreset;
        'sixth-ui.allowUserPalette': boolean;
        'sixth-ui.customBackground': string;
        'sixth-ui.customTheme': string;
        'sixth-ui.customTitle': string;
        'sixth-ui.customText': string;
        'sixth-ui.customAccent': string;
    }
    interface UiContextBase {
        sixthUi?: {
            brand: string;
            language: string;
            palette: SixthUIPalette;
            allowUserPalette: boolean;
            homepageTree?: ResolvedHomepageTreeNode;
            compactNavigation?: ResolvedCompactNavigationItem[];
        };
    }
}

export const name = 'sixth-ui';
const homepageTreePath = join(__dirname, 'homepage-tree.json');
const sixthUIStyles = readFileSync(join(__dirname, 'frontend', 'sixth-ui.css'), 'utf-8');

class SixthUIStylesHandler extends Handler {
    noCheckPermView = true;

    async get() {
        this.response.type = 'text/css';
        this.response.body = sixthUIStyles;
        this.response.addHeader('Cache-Control', 'public, max-age=86400');
    }
}

function validateHomepageTreeNode(value: unknown, path: string): HomepageTreeNode {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object`);
    const node = value as Record<string, unknown>;
    if (typeof node.id !== 'string' || !node.id) throw new Error(`${path}.id must be a non-empty string`);
    if (typeof node.label !== 'string' && typeof node.labelKey !== 'string') {
        throw new TypeError(`${path} must define label or labelKey`);
    }
    if (!node.action || typeof node.action !== 'object' || Array.isArray(node.action)) {
        throw new Error(`${path}.action must be an object`);
    }
    const action = node.action as Record<string, unknown>;
    if (action.type !== 'route' && action.type !== 'expand') {
        throw new TypeError(`${path}.action.type must be route or expand`);
    }
    if (action.type === 'route' && (typeof action.name !== 'string' || !action.name)) {
        throw new Error(`${path}.action.name must be a non-empty string for route actions`);
    }
    if (action.args !== undefined && (!action.args || typeof action.args !== 'object' || Array.isArray(action.args))) {
        throw new Error(`${path}.action.args must be an object`);
    }
    if (node.side !== undefined && (!Number.isInteger(node.side) || Number(node.side) < 0 || Number(node.side) > 5)) {
        throw new Error(`${path}.side must be an integer from 0 to 5`);
    }
    if (node.childSector !== undefined && node.childSector !== 'bottom-right') {
        throw new Error(`${path}.childSector must be bottom-right`);
    }
    if (node.children !== undefined && !Array.isArray(node.children)) throw new Error(`${path}.children must be an array`);
    return {
        id: node.id,
        label: typeof node.label === 'string' ? node.label : undefined,
        labelKey: typeof node.labelKey === 'string' ? node.labelKey : undefined,
        side: node.side as number | undefined,
        childSector: node.childSector as HomepageTreeChildSector | undefined,
        action: {
            type: action.type,
            name: typeof action.name === 'string' ? action.name : undefined,
            args: action.args as Record<string, unknown> | undefined,
        },
        requiresAuth: node.requiresAuth === true,
        requiresGuest: node.requiresGuest === true,
        children: Array.isArray(node.children)
            ? node.children.map((child, index) => validateHomepageTreeNode(child, `${path}.children[${index}]`))
            : [],
    };
}

function loadHomepageTree(): HomepageTreeConfig {
    const parsed = JSON.parse(readFileSync(homepageTreePath, 'utf-8')) as Record<string, unknown>;
    if (parsed.version !== 1) throw new Error('homepage-tree.json version must be 1');
    return { version: 1, root: validateHomepageTreeNode(parsed.root, 'root') };
}

const homepageTree = loadHomepageTree();

const compactNavigation = [
    { id: 'home', labelKey: 'sixth_nav_home', name: 'homepage' },
    { id: 'problems', labelKey: 'sixth_nav_problems', name: 'problem_main' },
    { id: 'training', labelKey: 'sixth_nav_training', name: 'training_main' },
    { id: 'contests', labelKey: 'sixth_nav_contests', name: 'contest_main' },
    { id: 'records', labelKey: 'sixth_nav_records', name: 'record_main' },
] as const;

function resolveHomepageTreeNode(node: HomepageTreeNode, handler, depth = 0): ResolvedHomepageTreeNode | null {
    if (node.requiresAuth && !handler.user.hasPriv(PRIV.PRIV_USER_PROFILE)) return null;
    if (node.requiresGuest && handler.user._id) return null;
    const navNode = node.action.type === 'route'
        ? global.Hydro.ui.getNodes('Nav').find((item) => item.name === node.action.name)
        : null;
    if (navNode && !navNode.checker(handler)) return null;
    const args = Object.fromEntries(Object.entries(node.action.args || {}).map(([key, value]) => [
        key, value === '$currentUser' ? handler.user._id : value,
    ]));
    const query = navNode
        ? (typeof navNode.args.query === 'function' ? navNode.args.query(handler) : navNode.args.query || {})
        : {};
    const children = (node.children || [])
        .map((child) => resolveHomepageTreeNode(child, handler, depth + 1))
        .filter((child): child is ResolvedHomepageTreeNode => Boolean(child));
    if (depth === 0 && children.length > 6) throw new Error(`${node.id} resolves to more than 6 visible children`);
    return {
        id: node.id,
        label: node.label || handler.translate(node.labelKey),
        side: node.side,
        childSector: node.childSector,
        action: node.action.type,
        href: node.action.type === 'route' && node.action.name
            ? handler.url(node.action.name, Object.keys(args).length ? args : (navNode?.args || {}), { query })
            : undefined,
        children,
    };
}

function resolveCompactNavigation(handler): ResolvedCompactNavigationItem[] {
    const items: ResolvedCompactNavigationItem[] = compactNavigation.flatMap((item) => {
        const navNode = global.Hydro.ui.getNodes('Nav').find((node) => node.name === item.name);
        if (!navNode) return [];
        const query = typeof navNode.args.query === 'function'
            ? navNode.args.query(handler)
            : navNode.args.query || {};
        return [{
            id: item.id,
            label: handler.translate(item.labelKey),
            href: handler.url(item.name, navNode.args || {}, { query }),
        }];
    });
    const authenticated = handler.user.hasPriv(PRIV.PRIV_USER_PROFILE);
    items.push({
        id: 'user',
        label: handler.translate('sixth_nav_user'),
        href: authenticated
            ? handler.url('user_detail', { uid: handler.user._id })
            : handler.url('user_login'),
    });
    return items;
}

const colorSetting = (description: string, fallback: string) => Schema.string()
    .default(fallback)
    .description(description);

function getPalette(): SixthUIPalette {
    const preset = SystemModel.get('sixth-ui.palette');
    const base = palettePresets[preset];
    return {
        background: SystemModel.get('sixth-ui.customBackground') || base.background,
        theme: SystemModel.get('sixth-ui.customTheme') || base.theme,
        title: SystemModel.get('sixth-ui.customTitle') || base.title,
        text: SystemModel.get('sixth-ui.customText') || base.text,
        accent: SystemModel.get('sixth-ui.customAccent') || base.accent,
    };
}

export function apply(ctx: Context) {
    ctx.setting.SystemSetting(Schema.object({
        'sixth-ui': Schema.object({
            brand: Schema.string().default('SixthOJ').description('Site brand'),
            palette: Schema.union(Object.keys(palettePresets) as SixthUIPreset[])
                .default('cheese')
                .description('Color preset'),
            allowUserPalette: Schema.boolean().default(true).description('Allow browser-local user palettes'),
            customBackground: colorSetting('Custom surface blend color', ''),
            customTheme: colorSetting('Custom component color', ''),
            customTitle: colorSetting('Custom title color', ''),
            customText: colorSetting('Custom text color', ''),
            customAccent: colorSetting('Custom page background color', ''),
        }).description('Sixth UI'),
    }));

    if (process.env.HYDRO_CLI) return;

    ctx.Route('sixth_ui_styles', '/sixth-ui.css', SixthUIStylesHandler);

    ctx.on('handler/create', (handler) => {
        handler.UiContext.sixthUi = {
            brand: SystemModel.get('sixth-ui.brand'),
            language: handler.translate('__id'),
            palette: getPalette(),
            allowUserPalette: SystemModel.get('sixth-ui.allowUserPalette'),
        };
        handler.renderTitle = (pageName: string) => {
            const brand = SystemModel.get('sixth-ui.brand');
            if (handler.UiContext.extraTitleContent) {
                return `${handler.UiContext.extraTitleContent} - ${handler.translate(pageName)} - ${brand}`;
            }
            return `${handler.translate(pageName)} - ${brand}`;
        };
    });

    ctx.on('handler/after', (handler) => {
        if (handler.response.template === 'user_detail.html') {
            handler.response.template = 'user_detail.sixth.html';
        }
        const resolvedHomepageTree = resolveHomepageTreeNode(homepageTree.root, handler);
        if (!resolvedHomepageTree) throw new Error('homepage-tree.json root route is unavailable');
        handler.UiContext.sixthUi.homepageTree = resolvedHomepageTree;
        handler.UiContext.sixthUi.compactNavigation = resolveCompactNavigation(handler);
    });
}
