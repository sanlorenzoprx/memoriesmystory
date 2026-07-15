# Repository Structure

The folder skeleton in this package separates constitutional truth, product rules, domain behavior, infrastructure, and verification.

```text
memoriesmystory/
├── README.md
├── app/
│   ├── routes/            # React Router screens, loaders, and actions
│   ├── features/          # User-outcome modules such as capture and circles
│   ├── domain/            # Memory Story, truth state, ownership, provenance
│   ├── services/          # Storage, transcription, sharing, workflow boundaries
│   ├── localization/      # BCP 47 message catalogs and locale behavior
│   └── styles/            # Accessible design tokens and global styling
├── config/                # Central entitlements and runtime-safe configuration
├── docs/
│   ├── FOUNDATION/        # Constitutional and guiding documents
│   ├── PRODUCT/           # Policies, core experiences, open decisions
│   ├── ARCHITECTURE/      # Stack and structural records
│   ├── DECISIONS/         # Dated architectural/product decisions
│   ├── IMPLEMENTATION/    # Approved build specifications and receipts
│   └── SOURCE_INDEX.md    # Provenance of supplied planning sources
├── migrations/            # D1 schema migrations
├── public/                # PWA icons, manifests, and public static assets
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
└── workers/               # Isolated Worker/DO/Queue code only when justified
```

## Feature-module order

Recommended initial feature folders:

1. `capture`
2. `memory-stories`
3. `muse`
4. `onboarding`
5. `albums`
6. `sharing`
7. `memory-circles`
8. `family-circle`
9. `archive-export`
10. `auth-and-agreements`

The first implementation should create only the boundaries required for the solo Memory Story vertical slice. Empty future modules should not become speculative architecture.

The repository is checked out at `C:\repos\memoriesmystory`. Technical naming follows `APP_IDENTITY.md`.
