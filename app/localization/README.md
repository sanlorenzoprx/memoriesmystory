# Localization

Use BCP 47 locale identifiers, message catalogs, preserved original-language transcripts, optional additive translations, code-switching support, and right-to-left-ready layout.

The current solo interface supports `en-US`, `es-US` and `es-PR`. Spanish variants share `messages.ts`; they do not imply separate human-validated dialect translations. `locale.ts` and `messages.ts` are pure so public Worker views can use them. `language.ts` owns the browser preference and React subscription. Every component rendering translated copy subscribes with `useLocale()` so it updates in place.

Use `t("English interface key", { placeholder: value })` only for application-owned copy. Add its Spanish translation with matching placeholders. Source testimony, transcript revisions, Muse turns, context values and family notes must never be passed through `t` or a DOM translator. Use source metadata for their `lang` attributes. UI preference changes must not rewrite source locale/media or reset unsaved forms.

Keep stable English message keys in system-notice state; render with `notice()` so changing locale also updates old notices. Map API error codes through `errors.ts`; unknown diagnostics use a safe catalog fallback. Continue making workflow decisions using codes/status, never translated text. For new Muse requests send only supported `X-UI-Locale` values; preserve historical turns as stored content.

Device preference uses `memoriesmystory:ui-locale`, otherwise browser language and English fallback. This is not account synchronization. `?lang=` controls public family-view presentation without changing share authority. The official pinned Clerk `esMX` resource supplies the embedded Spanish account UI. See the [implementation receipt](../../docs/IMPLEMENTATION/ENGLISH_SPANISH_INTERFACE_2026-11-13.md) for proof and remaining acceptance.
