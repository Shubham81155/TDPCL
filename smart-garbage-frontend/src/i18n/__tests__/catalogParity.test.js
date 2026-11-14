// Catalog parity: every non-English catalog must have exactly the keys of en.json, no empty
// values, and the same {placeholders} in every string. New languages registered in
// languages.js are picked up automatically.
//
// REMINDER: hi.json is a first draft and MUST be reviewed by a native Hindi speaker before launch.
import { LANGUAGES } from '../languages';
import en from '../en.json';
import { COMPLAINT_CATEGORIES } from '../../utils/classificationUtils';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') Object.assign(acc, flatten(v, key));
    else acc[key] = v;
    return acc;
  }, {});

const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort();

const enFlat = flatten(en);
const others = LANGUAGES.filter((l) => l.code !== 'en');

describe('English catalog', () => {
  it('has only non-empty string values', () => {
    Object.entries(enFlat).forEach(([key, value]) => {
      expect(typeof value).toBe('string');
      expect(value.trim()).not.toBe('');
      expect(key).toBeTruthy();
    });
  });

  it('has a category label for each of the 12 complaint categories, matching classificationUtils', () => {
    expect(COMPLAINT_CATEGORIES).toHaveLength(12);
    COMPLAINT_CATEGORIES.forEach((c) => expect(en.category[c.value]).toBe(c.label));
  });
});

describe.each(others.map((l) => [l.code, l]))('catalog parity: %s vs en', (code, lang) => {
  const flat = flatten(lang.catalog);

  it('is missing no keys', () => {
    const missing = Object.keys(enFlat).filter((k) => !(k in flat));
    expect(missing).toEqual([]);
  });

  it('has no extra keys', () => {
    const extra = Object.keys(flat).filter((k) => !(k in enFlat));
    expect(extra).toEqual([]);
  });

  it('has no empty values', () => {
    const empty = Object.entries(flat)
      .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('keeps every {placeholder} of the English string', () => {
    const bad = Object.keys(enFlat)
      .filter((k) => k in flat)
      .filter((k) => JSON.stringify(placeholders(enFlat[k])) !== JSON.stringify(placeholders(flat[k])));
    expect(bad).toEqual([]);
  });
});

describe('language registry', () => {
  it('has unique codes, English first, and a label and locale for each language', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes[0]).toBe('en');
    LANGUAGES.forEach((l) => {
      expect(l.label).toBeTruthy();
      expect(l.locale).toBeTruthy();
    });
  });
});
