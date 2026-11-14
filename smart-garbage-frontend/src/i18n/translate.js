// src/i18n/translate.js
// Pure translation helpers (no React). See docs/I18N.md.
//
// Lookup order for t('some.key'):  current language -> English -> the key itself.
// Interpolation:  t('x', { name: 'Asha' })  replaces {name} in the string.
// Plurals:        t('x', { count: 3 }) looks for x_<category> (Intl.PluralRules of the
//                 language: zero/one/two/few/many/other), then x_other, then plain x.

export const DEFAULT_LANG = 'en';

const warned = new Set();

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// Resolve 'a.b.c' inside a nested catalog object. Only returns strings.
export const lookup = (catalog, key) => {
  if (!catalog || typeof key !== 'string') return undefined;
  let node = catalog;
  const parts = key.split('.');
  for (let i = 0; i < parts.length; i += 1) {
    if (node === null || typeof node !== 'object' || !hasOwn(node, parts[i])) return undefined;
    node = node[parts[i]];
  }
  return typeof node === 'string' ? node : undefined;
};

export const interpolate = (str, params) =>
  str.replace(/\{(\w+)\}/g, (match, name) =>
    params && params[name] !== undefined && params[name] !== null ? String(params[name]) : match
  );

const pluralRulesCache = {};
const pluralCategory = (lang, count) => {
  try {
    if (!pluralRulesCache[lang]) pluralRulesCache[lang] = new Intl.PluralRules(lang);
    return pluralRulesCache[lang].select(count);
  } catch (e) {
    return count === 1 ? 'one' : 'other';
  }
};

const warnMissing = (key) => {
  if (process.env.NODE_ENV !== 'development') return;
  if (warned.has(key)) return;
  warned.add(key);
  // eslint-disable-next-line no-console
  console.warn(`[i18n] Missing translation key: "${key}"`);
};

// Exposed for tests.
export const resetMissingKeyWarnings = () => warned.clear();

/**
 * Build a translator.
 * @param {string} lang        active language code
 * @param {Object} catalogs    { [code]: nestedCatalog }
 * @param {string} fallback    language to fall back to (default 'en')
 */
export const createTranslator = (lang, catalogs, fallback = DEFAULT_LANG) => {
  const chain = lang === fallback ? [lang] : [lang, fallback];

  const find = (key, count) => {
    for (let i = 0; i < chain.length; i += 1) {
      const code = chain[i];
      const catalog = catalogs[code];
      if (catalog) {
        if (typeof count === 'number') {
          const plural =
            lookup(catalog, `${key}_${pluralCategory(code, count)}`) || lookup(catalog, `${key}_other`);
          if (plural !== undefined) return plural;
        }
        const plain = lookup(catalog, key);
        if (plain !== undefined) return plain;
      }
    }
    return undefined;
  };

  const t = (key, params) => {
    const count = params && typeof params.count === 'number' ? params.count : undefined;
    const found = find(key, count);
    if (found === undefined) {
      warnMissing(key);
      return key;
    }
    return interpolate(found, params);
  };

  // true when the key resolves in the current language or English (no warning).
  t.has = (key) => find(key) !== undefined;
  return t;
};
