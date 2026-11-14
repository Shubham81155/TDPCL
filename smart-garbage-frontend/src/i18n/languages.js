// src/i18n/languages.js
// Registry of supported languages. To add one (e.g. Marathi):
//   1. copy en.json to mr.json and translate the values (keep the keys and {placeholders})
//   2. import it below and add an entry to LANGUAGES
// The catalog-parity test then checks the new catalog automatically. See docs/I18N.md.
//
// NOTE: hi.json MUST be reviewed by a native Hindi speaker before launch.
import en from './en.json';
import hi from './hi.json';

// label:   shown in the language switcher, written in the language itself
// locale:  BCP-47 tag used for number formatting and <html lang>
// dateLocale: tag for dates; English deliberately uses the browser default (undefined) so the
//             date text matches what the app showed before language support was added.
export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-IN', dateLocale: undefined, catalog: en },
  { code: 'hi', label: 'हिन्दी', locale: 'hi-IN', dateLocale: 'hi-IN', catalog: hi },
];

export const CATALOGS = LANGUAGES.reduce((acc, l) => ({ ...acc, [l.code]: l.catalog }), {});

export const DEFAULT_LANG_CODE = 'en';

export const LANG_CODES =LANGUAGES.map((l) => l.code);
