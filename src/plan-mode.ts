/** Shared ACP config option. Planning does not change sandbox or approval policy. */
export const LODY_PLAN_MODE_CONFIG_ID = 'plan_mode' as const;

export type LodyPlanModeConfigOption = {
  id: typeof LODY_PLAN_MODE_CONFIG_ID;
  name: string;
  description: string;
  type: 'boolean';
  currentValue: boolean;
};

/** Advertise only when the current session supports independent planning. */
export function createPlanModeConfigOption(currentValue: boolean): LodyPlanModeConfigOption {
  return {
    id: LODY_PLAN_MODE_CONFIG_ID,
    name: 'Plan',
    description: 'Plan before implementing; permissions are controlled separately.',
    type: 'boolean',
    currentValue,
  };
}
