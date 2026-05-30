import { describe, it, expect } from 'vitest';
import {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb,
  luminance, contrastColor, withAlpha, darken, normalizeHex,
} from '../../src/color/colorMath';

describe('hexToRgb', () => {
  it('parses a valid 6-digit hex', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#1a2b3c')).toEqual({ r: 26, g: 43, b: 60 });
  });
  it('returns null for invalid input', () => {
    expect(hexToRgb('#FFF')).toBeNull();
    expect(hexToRgb('red')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
});

describe('rgbToHex', () => {
  it('produces uppercase 6-digit hex', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#FF0000');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
  });
  it('clamps values to 0–255', () => {
    expect(rgbToHex(-1, 300, 128)).toBe('#00FF80');
  });
});

describe('rgbToHsl / hslToRgb round-trip', () => {
  it('round-trips red', () => {
    const rgb = { r: 255, g: 0, b: 0 };
    const hsl = rgbToHsl(rgb);
    const back = hslToRgb(hsl);
    expect(back.r).toBeCloseTo(rgb.r, 0);
    expect(back.g).toBeCloseTo(rgb.g, 0);
    expect(back.b).toBeCloseTo(rgb.b, 0);
  });
  it('round-trips a mid-tone blue', () => {
    const rgb = { r: 30, g: 100, b: 200 };
    const back = hslToRgb(rgbToHsl(rgb));
    expect(back.r).toBeCloseTo(rgb.r, 0);
    expect(back.g).toBeCloseTo(rgb.g, 0);
    expect(back.b).toBeCloseTo(rgb.b, 0);
  });
});

describe('contrastColor', () => {
  it('returns black for light colors', () => {
    expect(contrastColor('#FFFFFF')).toBe('#000000');
    expect(contrastColor('#FFFF00')).toBe('#000000');
  });
  it('returns white for dark colors', () => {
    expect(contrastColor('#000000')).toBe('#FFFFFF');
    expect(contrastColor('#1E3643')).toBe('#FFFFFF');
  });
});

describe('withAlpha', () => {
  it('appends correct hex alpha', () => {
    expect(withAlpha('#FF0000', 1)).toBe('#FF0000FF');
    expect(withAlpha('#FF0000', 0)).toBe('#FF00000000'.slice(0, 9));
    expect(withAlpha('#FF0000', 0.5)).toMatch(/^#FF0000[0-9A-F]{2}$/);
  });
});

describe('darken', () => {
  it('darkens by factor', () => {
    const result = darken('#FFFFFF', 0.5);
    const rgb = hexToRgb(result);
    expect(rgb?.r).toBe(128);
    expect(rgb?.g).toBe(128);
    expect(rgb?.b).toBe(128);
  });
  it('returns hex unchanged for invalid input', () => {
    expect(darken('notacolor', 0.5)).toBe('notacolor');
  });
});

describe('normalizeHex', () => {
  it('uppercases valid 6-digit hex', () => {
    expect(normalizeHex('#aabbcc')).toBe('#AABBCC');
  });
  it('expands 3-digit shorthand', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
  });
  it('returns undefined for invalid input', () => {
    expect(normalizeHex('red')).toBeUndefined();
    expect(normalizeHex('')).toBeUndefined();
    expect(normalizeHex(undefined)).toBeUndefined();
  });
});
