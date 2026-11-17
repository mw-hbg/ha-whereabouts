# Translating Whereabouts

Thank you for helping! A new language needs two things:

1. **Integration texts:** copy `custom_components/whereabouts/translations/en.json`
   to `<language>.json` (e.g. `fr.json`) and translate the values – never the keys
   and never the `{placeholders}`.
2. **Card texts:** copy `custom_components/whereabouts/frontend/i18n/en.json` to
   `<language>.json` and translate the values the same way. The cards use the
   language of the Home Assistant user, English if it is missing.

The tests check that every language has exactly the same keys as English.
Then open a pull request.
