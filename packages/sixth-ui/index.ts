import {
    Context, Schema, SystemModel,
} from 'hydrooj';
import { palettePresets, SixthUIPalette, SixthUIPreset } from './presets';

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
            palette: SixthUIPalette;
            allowUserPalette: boolean;
        };
    }
}

export const name = 'sixth-ui';

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

    ctx.on('handler/create', (handler) => {
        handler.renderTitle = (pageName: string) => {
            const brand = SystemModel.get('sixth-ui.brand');
            if (handler.UiContext.extraTitleContent) {
                return `${handler.UiContext.extraTitleContent} - ${handler.translate(pageName)} - ${brand}`;
            }
            return `${handler.translate(pageName)} - ${brand}`;
        };
    });

    ctx.on('handler/after', (handler) => {
        handler.UiContext.sixthUi = {
            brand: SystemModel.get('sixth-ui.brand'),
            palette: getPalette(),
            allowUserPalette: SystemModel.get('sixth-ui.allowUserPalette'),
        };
    });
}
