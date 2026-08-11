export interface SixthUIPalette {
    background: string;
    theme: string;
    title: string;
    text: string;
    accent: string;
}

export const palettePresets = {
    cheese: {
        background: '#C2784B',
        theme: '#FFD54F',
        title: '#9A450D',
        text: '#8B4513',
        accent: '#FFE082',
    },
} satisfies Record<string, SixthUIPalette>;

export type SixthUIPreset = keyof typeof palettePresets;
