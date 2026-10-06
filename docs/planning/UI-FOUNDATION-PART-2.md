# UI foundation part 2

Phase 39 adds the interactive primitives that sit above the Phase 38 form and surface foundation. They are custom-themed and dependency-light rather than generated from a default shadcn template.

## Interactive primitives

- `Dialog` and `Sheet`: portal-backed modal and side-panel surfaces with controlled/uncontrolled state, escape and backdrop dismissal, body-scroll locking, focus restoration, labelled content, and accessible close controls.
- `DropdownMenu`: keyboard-aware menu items, checkbox items, labels, separators, outside-click dismissal, and disabled states.
- `Popover`: anchored content with outside-click and escape dismissal.
- `Tooltip`: delayed hover/focus help text with a semantic tooltip role.
- `Tabs`: controlled/uncontrolled tab state, tablist/tab/tabpanel roles, keyboard arrow navigation, and active-panel linkage.
- `Accordion`: single or multiple expansion modes with trigger/content relationships.
- `Switch` and `RadioGroup`: accessible boolean and mutually exclusive selection controls with controlled/uncontrolled state.

All interactive components use English accessibility labels only where the primitive needs a default (`Close dialog`). Product screens can provide tenant-appropriate visible copy through their props. The primitives do not decide authorization, permissions, provider data, or server state.

`Dialog`/`Sheet`, dropdown, and popover event handling is intentionally local and provider-neutral. Later phases can compose these primitives into confirm dialogs, command palettes, table actions, and role-aware layouts without duplicating focus, dismissal, or keyboard behavior.

Run `npm run verify:phase39` for the export contract smoke test.
