# UI foundation part 1

Phase 38 establishes the custom KD SOLUTION IT UI foundation under `src/components/ui/`. It is intentionally not a default shadcn visual surface: the primitives use the product's blue fintech palette, restrained rounded geometry, layered surfaces, compact typography, and branded focus/hover motion.

## Primitives

- `Button` and `IconButton`: primary, secondary, quiet, outline, danger, success, and link actions with loading state, touch-sized targets, focus rings, and icon slots.
- `Input`, `Textarea`, and `Select`: controlled-friendly native form controls with error messaging, invalid state, adornments, and accessible descriptions.
- `Label` and `Field`: consistent labels, required markers, descriptions, and alert-role field errors.
- `Card`: header, title, description, content, and footer composition for tenant dashboards and public surfaces.
- `Badge` and `Alert`: semantic neutral/brand/success/warning/danger/info status treatments.
- `Separator`, `Avatar`, `Skeleton`, `Progress`, and `Checkbox`: small primitives for structure, identity, loading, completion, and boolean form state.

`src/lib/cn.ts` is the shared `clsx` plus `tailwind-merge` boundary. `src/app/globals.css` defines the light and dark design tokens, spacing/radius/motion values, accessible selection and focus treatment, and the custom brand palette consumed by `tailwind.config.ts`.

The components are presentational only. Tenant branding from the Phase 35 store can provide runtime CSS variables later, but authorization, role visibility, validation, and data access remain server-side concerns. Additional overlays, menus, dialogs, tabs, and richer data controls are intentionally reserved for later UI foundation phases.

Run `npm run verify:phase38` for the deterministic class-contract smoke test.
