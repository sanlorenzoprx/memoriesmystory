# Application Identity

**Status:** Binding technical naming standard  
**Technical application name:** `memoriesmystory`

## Canonical identities

| Concern | Required value |
| --- | --- |
| Local Windows repository | `C:\repos\memoriesmystory` |
| GitHub repository | `sanlorenzoprx/memoriesmystory` |
| Repository root folder | `memoriesmystory` |
| npm root package | `memoriesmystory` |
| Internal npm scope | `@memoriesmystory/*` |
| React Router application | `memoriesmystory` |
| Cloudflare Worker | `memoriesmystory` |
| D1 database | `memoriesmystory` |
| R2 media bucket | `memoriesmystory-media` |
| Processing queue | `memoriesmystory-processing` |
| PWA short name | `memoriesmystory` |

## Naming rule

Use lowercase `memoriesmystory` without spaces, hyphens, underscores, or mixed casing for the application identity and as the prefix for technical resource names.

Do not use these forms as technical application identifiers:

- separated words;
- hyphenated words;
- underscored words;
- mixed-case concatenation.

Suffixes that describe infrastructure purpose are allowed, such as `memoriesmystory-media` and `memoriesmystory-processing`.

## Brand distinction

The customer-facing product and company brand remains **Memories: My Story**. This human-facing name may appear in headings, interface copy, mission documents, and marketing. It must not be used as a filesystem folder, package name, deployment name, database name, queue name, or code namespace.
