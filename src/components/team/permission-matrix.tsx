// src/components/team/permission-matrix.tsx
// The grid an owner uses to decide exactly what a staff member may do. The
// send action is never offered, because only an owner writes to a client.

'use client';

import { Checkbox } from '@/components/ui/checkbox';
import {
  RESOURCE_DEFINITIONS,
  RESOURCE_GROUPS,
  type PermissionMap,
  type PermissionResource,
} from '@/config/permissions';
import type { PermissionAction } from '@/types/enums';

export interface PermissionMatrixProps {
  /** Identifier prefix, so several grids can live on one page. */
  idPrefix: string;
  /** The permissions currently chosen. */
  value: PermissionMap;
  /** Called with the new permissions whenever a box is ticked. */
  onChange: (value: PermissionMap) => void;
  /** True while the form is saving. */
  isDisabled?: boolean;
}

const ACTION_LABELS: Readonly<Record<PermissionAction, string>> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  export: 'Export',
  send: 'Send',
};

/**
 * Renders the permission grid.
 *
 * @param props The chosen permissions and the change handler.
 * @returns The rendered grid.
 */
export function PermissionMatrix({
  idPrefix,
  value,
  onChange,
  isDisabled = false,
}: PermissionMatrixProps) {
  /**
   * Ticks or unticks one action of one resource.
   *
   * @param resource Resource being changed.
   * @param action Action being changed.
   * @param isAllowed True when the box has just been ticked.
   * @returns Nothing.
   */
  function toggle(
    resource: PermissionResource,
    action: PermissionAction,
    isAllowed: boolean
  ): void {
    const current = value[resource] ?? [];
    const next = isAllowed
      ? Array.from(new Set([...current, action]))
      : current.filter((entry) => entry !== action);

    const updated: PermissionMap = { ...value };

    if (next.length === 0) {
      delete updated[resource];
    } else {
      updated[resource] = next;
    }

    onChange(updated);
  }

  return (
    <div className="space-y-6">
      {RESOURCE_GROUPS.map((group) => (
        <fieldset key={group.key} className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">{group.label}</legend>

          <div className="space-y-4">
            {group.resources.map((resource) => {
              const definition = RESOURCE_DEFINITIONS[resource];
              const chosen = value[resource] ?? [];
              const offered = definition.actions.filter((action) => action !== 'send');

              return (
                <div
                  key={resource}
                  className="rounded-md border border-border bg-surface p-4 shadow-xs"
                >
                  <p className="text-sm font-medium text-foreground">{definition.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{definition.description}</p>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                    {offered.map((action) => (
                      <Checkbox
                        key={action}
                        id={`${idPrefix}-${resource}-${action}`}
                        label={ACTION_LABELS[action]}
                        checked={chosen.includes(action)}
                        disabled={isDisabled}
                        onChange={(event) => {
                          toggle(resource, action, event.target.checked);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
