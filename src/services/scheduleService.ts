import axios, { AxiosInstance } from 'axios';
import { ScheduleItem, Group, Teacher } from '../types/schedule';
import CacheService from './cacheService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface WeekInfo {
  data: {
    term: number;
    weekName: string;
    weekNumber: number;
    weekShortName: string;
  };
  date: string;
}

class ScheduleService {
  private api: AxiosInstance;
  private lksApi: AxiosInstance;
  private scheduleCache: Map<string, ScheduleItem[]> = new Map();

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' },
    });
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
      }
    );

    this.lksApi = axios.create({
      baseURL: '/lks-api',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async getAllGroups(): Promise<Group[]> {
    const cachedGroups = CacheService.get<Group[]>('groups');
    if (cachedGroups) {
      return cachedGroups;
    }

    const response = await fetchWithAuth(`${API_URL}/get-groups`);
    const data = await response.json();
    const groups = Array.isArray(data) ? data : [];

    // Не кэшируем пустой массив групп
    if (groups.length > 0) {
      CacheService.set('groups', groups);
    }
    return groups;
  }

  async getGroupSchedule(uuid: string): Promise<ScheduleItem[]> {
    const response = await fetchWithAuth(
      `${API_URL}/get-group-schedule/${uuid}`
    );
    const data = await response.json();
    const schedule = data || [];

    this.scheduleCache.set(uuid, schedule);

    return schedule;
  }

  async getAllTeachers(): Promise<Teacher[]> {
    const cachedTeachers = CacheService.get<Teacher[]>('teachers');
    if (cachedTeachers) {
      return cachedTeachers;
    }

    const response = await fetchWithAuth(`${API_URL}/get-teachers`);
    const data = await response.json();
    const teachers = Array.isArray(data) ? data : [];

    // Не кэшируем пустой массив преподавателей
    if (teachers.length > 0) {
      CacheService.set('teachers', teachers);
    }
    return teachers;
  }

  async getTeacherSchedule(uuid: string): Promise<ScheduleItem[]> {
    const response = await fetchWithAuth(
      `${API_URL}/get-teacher-schedule/${uuid}`
    );
    const data = await response.json();
    const schedule = data || [];

    return schedule;
  }

  clearGroupsCache(): void {
    CacheService.remove('groups');
  }

  clearScheduleCache(uuid?: string): void {
    if (uuid) {
      this.scheduleCache.delete(uuid);
      CacheService.remove(`schedule_${uuid}`);
    } else {
      this.scheduleCache.clear();
      Object.keys(localStorage)
        .filter((key) => key.startsWith('schedule_'))
        .forEach((key) => CacheService.remove(key));
    }
  }

  async saveSchedule(scheduleData: unknown): Promise<unknown> {
    const { data } = await this.api.post('/write-schedule', scheduleData);
    return data;
  }

  async insertGroupSchedule(
    uuid: string,
    scheduleData: unknown
  ): Promise<unknown> {
    const { data } = await this.api.post(
      `/insert-group-schedule/${uuid}`,
      scheduleData
    );
    return data;
  }

  async getCurrentWeek(): Promise<WeekInfo> {
    const { data } = await this.lksApi.get<WeekInfo>('/schedules/current');
    return data;
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
  });
}

export const scheduleService = new ScheduleService();
