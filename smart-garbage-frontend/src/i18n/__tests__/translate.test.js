import { createTranslator, lookup, resetMissingKeyWarnings } from '../translate';

const catalogs = {
  en: {
    greet: 'Hello, {name}!',
    onlyEn: 'Only in English',
    nested: { deep: 'Deep value' },
    items_one: '{count} item',
    items_other: '{count} items',
    plainCount: 'Plain {count}',
  },
  hi: {
    greet: 'नमस्ते, {name}!',
    nested: { deep: 'गहरा मान' },
    items_one: '{count} वस्तु',
    items_other: '{count} वस्तुएँ',
  },
};

describe('t()', () => {
  it('looks up nested keys in the current language', () => {
    expect(createTranslator('hi', catalogs)('nested.deep')).toBe('गहरा मान');
    expect(createTranslator('en', catalogs)('nested.deep')).toBe('Deep value');
  });

  it('interpolates {placeholders} and leaves unknown ones untouched', () => {
    const t = createTranslator('en', catalogs);
    expect(t('greet', { name: 'Asha' })).toBe('Hello, Asha!');
    expect(t('greet')).toBe('Hello, {name}!');
    expect(createTranslator('hi', catalogs)('greet', { name: 'आशा' })).toBe('नमस्ते, आशा!');
  });

  it('falls back to English, then to the key itself', () => {
    const t = createTranslator('hi', catalogs);
    expect(t('onlyEn')).toBe('Only in English');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('does not treat a group (object) as a string', () => {
    expect(createTranslator('en', catalogs)('nested')).toBe('nested');
    expect(lookup(catalogs.en, 'nested')).toBeUndefined();
  });

  it('picks plural forms with Intl.PluralRules', () => {
    const en = createTranslator('en', catalogs);
    expect(en('items', { count: 1 })).toBe('1 item');
    expect(en('items', { count: 3 })).toBe('3 items');
    expect(en('items', { count: 0 })).toBe('0 items');
    const hi = createTranslator('hi', catalogs);
    expect(hi('items', { count: 1 })).toBe('1 वस्तु');
    expect(hi('items', { count: 5 })).toBe('5 वस्तुएँ');
  });

  it('uses the plain key when no plural variants exist', () => {
    expect(createTranslator('en', catalogs)('plainCount', { count: 2 })).toBe('Plain 2');
  });

  it('exposes t.has() without warning', () => {
    const t = createTranslator('hi', catalogs);
    expect(t.has('onlyEn')).toBe(true);
    expect(t.has('nope')).toBe(false);
  });
});

describe('missing key warning', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
    resetMissingKeyWarnings();
  });

  it('warns once per key in development', () => {
    process.env.NODE_ENV = 'development';
    resetMissingKeyWarnings();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const t = createTranslator('en', catalogs);
    t('missing.one');
    t('missing.one');
    t('missing.two');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('stays silent outside development', () => {
    process.env.NODE_ENV = 'production';
    resetMissingKeyWarnings();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    createTranslator('en', catalogs)('missing.three');
    expect(warn).not.toHaveBeenCalled();
  });
});
