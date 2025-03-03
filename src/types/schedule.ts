// src/types/schedule.ts
export interface Teacher {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  uuid: string;
  lastName: string;
  firstName: string;
  middleName: string;
}

export interface Audience {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  name: string;
  uuid: string;
  building: string;
  department_uid: string | null;
}

export interface Discipline {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  abbr: string;
  actType: string;
  fullName: string;
  shortName: string;
}

export interface Group {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  name: string;
  uuid: string;
  department_uid: string;
}

export interface ScheduleItem {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  day: number;
  time: number;
  week: string;
  groups: Group[];
  stream: string;
  endTime: string;
  teachers: Teacher[];
  audiences: Audience[];
  startTime: string;
  disciplines: Discipline[];
  permission: string;
}
