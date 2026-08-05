export interface SixthUIPalette {
    background: string;
    theme: string;
    title: string;
    text: string;
    accent: string;
}

export const palettePresets = {
    cheese: {
        background: '#FFE082',
        theme: '#FFD54F',
        title: '#9A450D',
        text: '#8B4513',
        accent: '#C2784B',
    },
} satisfies Record<string, SixthUIPalette>;

export type SixthUIPreset = keyof typeof palettePresets;
