import { DayOfWeek, TimeSlot } from '../types/schedule';

export const DAYS: DayOfWeek[] = [
  { id: 1, name: 'Понедельник' },
  { id: 2, name: 'Вторник' },
  { id: 3, name: 'Среда' },
  { id: 4, name: 'Четверг' },
  { id: 5, name: 'Пятница' },
  { id: 6, name: 'Суббота' },
];

export const TIME_SLOTS: TimeSlot[] = [
  { slot: 1, time: '08:30-10:00' },
  { slot: 2, time: '10:10-11:40' },
  { slot: 3, time: '11:50-13:55' },
  { slot: 4, time: '14:05-15:35' },
  { slot: 5, time: '15:55-17:25' },
  { slot: 6, time: '17:35-19:05' },
  { slot: 7, time: '19:15-20:45' },
];
