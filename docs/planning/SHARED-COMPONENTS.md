# Shared components

Phase 41 adds reusable data, state, upload, toolbar, and confirmation components under `src/components/shared/`.

## Components

- `DataTable` accepts typed column renderers, stable row IDs, horizontal overflow, accessible table headers/caption, and loading/error/empty branches.
- `LoadingState`, `EmptyState`, and `ErrorState` make the four-state UI contract explicit without leaking exceptions to users.
- `DataTableToolbar` provides search, filter content, active-filter clearing, and result context.
- `ConfirmDialog` composes the Phase 39 dialog with explicit danger/primary confirmation, cancellation, and pending state.
- `FileUploader` supports keyboard and drag-and-drop selection, multiple files, size/type checks, progress, removal, and metadata callbacks.
- `ImageUploader` composes the file uploader with public image MIME allow-listing and preview cleanup.

## Storage boundary

The uploaders do not import a Google Drive SDK, construct an undocumented provider request, or accept raw provider credentials. They receive an `onUpload` server-action/route adapter callback carrying `{ companyId, category, visibility, file }`. The caller must use the configured `StorageAdapter` contract and persist `StorageFileMetadata`; Google Drive remains the platform default at the server boundary. Client-side checks are convenience checks only, so the server must repeat tenant, role, entitlement, MIME, size, and retention validation.

The uploader visibility/category props are explicit so public branding assets and private KYC/receipt/document files cannot be conflated. The QR business-card category is not introduced by this phase.

Run `npm run verify:phase41` for the shared-component export smoke test.
