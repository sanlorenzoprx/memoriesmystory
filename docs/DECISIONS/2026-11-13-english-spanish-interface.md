# English and Spanish interface with unchanged testimony

**Date:** 2026-11-13  
**Authority:** owner approval to merge the owner controls/review work and continue with the complete English/Spanish interface.  
**Status:** implementation decision; automated proof is distinct from human language acceptance.

## Behavior

Support `en-US`, `es-US` and `es-PR` for the currently implemented solo interface. Spanish variants share authored application copy; the Puerto Rico selection retains its locale for dates and future regional review. These labels do not imply independently validated dialect catalogs. Keep Memories: My Story and Muse as names; render Living Memory as Recuerdo Vivo in Spanish. Preserve the exact locked English completion sentence and use “Este recuerdo ya forma parte de la historia de tu familia.” in Spanish. Foundation vocabulary remains authoritative; this is its interface translation, not a new product object.

Choose a supported saved device preference, otherwise the browser language, otherwise English. Keep an always-visible, labeled language selector. Changes apply in place without remounting the router or discarding forms and drafts. Save the preference on this device when storage is available; it is not an account-synchronized preference. Update the document language and format dates using that locale. Clerk's official `esMX` resources localize its embedded account interface for both Spanish selections; native provider/browser/OS dialogs remain outside application copy control.

Translate only application-owned messages. Original recordings, transcriptions, storyteller corrections, context values, replies and family notes remain untouched. Mark transcript text with its recorded source-language metadata. Do not reinterpret source language when changing the interface. Existing stored Muse turns remain attributed records; new requests ask Muse in the selected UI language with a constrained locale header and a Spanish deterministic fallback. Optional context and voluntary finish follow the accepted review/finish decision.

Family links include a language query for presentation; recipients can choose another supported language. Language does not authorize access or expand the selected share artifact. Revoked/unavailable pages show localized recovery copy and retain the actual error status. Frozen captions remain the selected source text.

API error codes select catalog messages; workflow decisions still depend on stable codes/status. Unknown provider/server diagnostics use a safe translated fallback. System notices rerender when the language changes, including notices received before the switch. Never pass human story text through the message lookup.

## Acceptance and integration

This work starts from merged main `b55aaf957f6aa896c38331080c89e7e1222c084e`, after PRs #21 and #22. No migration is added. Migration 0008 from #22 remains a prerequisite for deploying that baseline. Locale code and catalogs do not alter entitlements, share selection, original media, provenance or completion prerequisites.

See `../IMPLEMENTATION/ENGLISH_SPANISH_INTERFACE_2026-11-13.md` for exact local checks and limits. Native Spanish/Puerto Rican copy review, live Clerk/provider paths, physical iPhone/Android checks and uncoached mixed-language sessions remain acceptance evidence to collect. Future expanded-release capabilities must extend this catalog and preserve the same source/UI boundary.
