import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export const TIME_SLOT_HEIGHT = 100; // pixels per time slot
const TIME_FORMAT = 'HH:mm';

export function parseTime(timeString: string): dayjs.Dayjs {
  return dayjs(timeString, TIME_FORMAT);
}

export function calculateOffset(
  startTime: string,
  slotStartTime: string
): number {
  const start = parseTime(startTime);
  const slotStart = parseTime(slotStartTime);
  const diffMinutes = start.diff(slotStart, 'minute');
  return (diffMinutes / 90) * TIME_SLOT_HEIGHT; // 90 minutes per slot
}

export function calculateHeight(
  startTime: string,
  endTime: string,
  slotStartTime: string,
  slotEndTime: string
): number {
  const start = Math.max(
    parseTime(startTime).valueOf(),
    parseTime(slotStartTime).valueOf()
  );
  const end = Math.min(
    parseTime(endTime).valueOf(),
    parseTime(slotEndTime).valueOf()
  );
  const durationMinutes = (end - start) / (1000 * 60);
  return (durationMinutes / 90) * TIME_SLOT_HEIGHT;
}

export function getTimeSlotRange(slot: number): {
  start: string;
  end: string;
} {
  const slots: Record<number, { start: string; end: string }> = {
    1: { start: '08:30', end: '10:00' },
    2: { start: '10:10', end: '11:40' },
    3: { start: '11:50', end: '13:20' },
    4: { start: '14:05', end: '15:35' },
    5: { start: '15:50', end: '17:20' },
    6: { start: '17:30', end: '19:00' },
    7: { start: '19:10', end: '20:40' },
  };
  return slots[slot] || { start: '', end: '' };
}
