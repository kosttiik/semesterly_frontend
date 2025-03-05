import axios, { AxiosInstance } from 'axios';
import { ScheduleItem, Group } from '../types/schedule';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

class ScheduleService {
  private api: AxiosInstance;

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
  }

  async getAllGroups(): Promise<Group[]> {
    const { data } = await this.api.get<Group[]>('/get-groups');
    return Array.isArray(data) ? data : [];
  }

  async getGroupSchedule(uuid: string): Promise<ScheduleItem[]> {
    const { data } = await this.api.get<ScheduleItem[]>(
      `/get-group-schedule/${uuid}`
    );
    return data || [];
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
}

export const scheduleService = new ScheduleService();
