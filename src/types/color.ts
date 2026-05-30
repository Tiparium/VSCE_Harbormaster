export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

export type AccentZones = {
  frame?: string;
  accent?: string;
  surface?: string;
};

export type DerivedColors = Record<string, string>;
