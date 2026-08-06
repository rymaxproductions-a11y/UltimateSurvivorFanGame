/** Server-side bounds for the pre-air reminder lead time. */
export const MIN_REMINDER_LEAD_MINUTES = 1;
export const MAX_REMINDER_LEAD_MINUTES = 1440;

export function isValidReminderLead(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= MIN_REMINDER_LEAD_MINUTES &&
    minutes <= MAX_REMINDER_LEAD_MINUTES
  );
}
