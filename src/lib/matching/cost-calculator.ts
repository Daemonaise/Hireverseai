/**
 * Calculate costs for microtasks and total project.
 */

const BASE_HOURLY_RATE = 50; // $50/hr base rate

export function calculateTaskCost(
  estimatedHours: number,
  payRateMultiplier: number
): number {
  return Math.round(estimatedHours * BASE_HOURLY_RATE * payRateMultiplier * 100) / 100;
}

export function calculateTotalProjectCost(
  taskCosts: number[]
): number {
  return Math.round(taskCosts.reduce((sum, c) => sum + c, 0) * 100) / 100;
}

export function shouldAutoAssign(estimatedTotalCost: number): boolean {
  return estimatedTotalCost < 500;
}
