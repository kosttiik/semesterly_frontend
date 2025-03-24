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
    // Check cache first
    const cachedGroups = CacheService.get<Group[]>('groups');
    if (cachedGroups) {
      return cachedGroups;
    }

    const { data } = await this.api.get<Group[]>('/get-groups');
    const groups = Array.isArray(data) ? data : [];

    // Cache the result
    CacheService.set('groups', groups);
    return groups;
  }

  async getGroupSchedule(uuid: string): Promise<ScheduleItem[]> {
    // Check memory cache first
    const cachedSchedule = this.scheduleCache.get(uuid);
    if (cachedSchedule) {
      return cachedSchedule;
    }

    // Check localStorage cache
    const cacheKey = `schedule_${uuid}`;
    const cachedData = CacheService.get<ScheduleItem[]>(cacheKey);
    if (cachedData) {
      this.scheduleCache.set(uuid, cachedData);
      return cachedData;
    }

    const { data } = await this.api.get<ScheduleItem[]>(
      `/get-group-schedule/${uuid}`
    );
    const schedule = data || [];

    // Cache in both memory and localStorage
    this.scheduleCache.set(uuid, schedule);
    CacheService.set(cacheKey, schedule);

    return schedule;
  }

  async getAllTeachers(): Promise<Teacher[]> {
    const cachedTeachers = CacheService.get<Teacher[]>('teachers');
    if (cachedTeachers) {
      return cachedTeachers;
    }

    const { data } = await this.api.get<Teacher[]>('/get-teachers');
    const teachers = Array.isArray(data) ? data : [];

    CacheService.set('teachers', teachers);
    return teachers;
  }

  async getTeacherSchedule(uuid: string): Promise<ScheduleItem[]> {
    const cacheKey = `teacher_schedule_${uuid}`;
    const cachedSchedule = CacheService.get<ScheduleItem[]>(cacheKey);
    if (cachedSchedule) {
      return cachedSchedule;
    }

    const { data } = await this.api.get<ScheduleItem[]>(
      `/get-teacher-schedule/${uuid}`
    );
    const schedule = data || [];

    CacheService.set(cacheKey, schedule);
    return schedule;
  }

  clearScheduleCache(uuid?: string): void {
    if (uuid) {
      this.scheduleCache.delete(uuid);
      CacheService.remove(`schedule_${uuid}`);
    } else {
      this.scheduleCache.clear();
      // Clear all schedule-related items from localStorage
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

export const scheduleService = new ScheduleService();
