export interface Teacher {
  id: number;
  uuid: string;
  lastName: string;
  firstName: string;
  middleName: string;
}

export interface Audience {
  id: number;
  name: string;
  uuid: string;
  building: string;
  department_uid: string | null;
}

export interface Discipline {
  id: number;
  abbr: string;
  actType: string;
  fullName: string;
  shortName: string;
}

export interface Group {
  id: number;
  name: string;
  uuid: string;
  department_uid: string;
}

export interface ScheduleItem {
  id: number;
  day: number;
  time: number;
  week: 'ch' | 'zn' | 'all'; // ch = числитель, zn = знаменатель, all = обе недели
  groups: Group[];
  stream: string;
  endTime: string;
  startTime: string;
  teachers: Teacher[];
  audiences: Audience[];
  disciplines: Discipline[];
  permission: string;
}

// Вспомогательные типы для отображения
export interface TimeSlot {
  slot: number;
  time: string;
}

export interface WeekType {
  id: string;
  name: string;
}

export interface DayOfWeek {
  id: number;
  name: string;
}
