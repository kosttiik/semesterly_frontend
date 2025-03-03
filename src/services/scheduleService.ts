import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ScheduleItem, Group } from '../types/schedule';

const API_URL = 'http://localhost:8080/api/v1';

class ScheduleService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.api.interceptors.request.use(
      (config) => {
        // Add any request headers or auth tokens here
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          console.error('API Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            url: error.config?.url,
          });
        }
        return Promise.reject(error);
      }
    );
  }

  async getAllGroups(): Promise<Group[]> {
    try {
      const { data } = await this.api.get<Group[]>('/get-groups');
      // Log the raw response data
      console.log('Raw API response:', data);

      if (!data) {
        console.error('No data received from API');
        return [];
      }

      // Ensure we have an array
      const groups = Array.isArray(data) ? data : [];
      console.log('Processed groups:', groups);

      // Return empty array if no valid groups found
      if (groups.length === 0) {
        console.warn('No groups found in response');
        return [];
      }

      return groups;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: error.config?.url,
        });
      } else {
        console.error('Error fetching groups:', error);
      }
      throw error;
    }
  }

  async getGroupSchedule(uuid: string): Promise<ScheduleItem[]> {
    try {
      const response: AxiosResponse<ScheduleItem[]> = await this.api.get(
        `/get-group-schedule/${uuid}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      return [];
    }
  }

  async saveSchedule(scheduleData: unknown): Promise<unknown> {
    const response = await this.api.post('/write-schedule', scheduleData);
    return response.data;
  }

  async insertGroupSchedule(
    uuid: string,
    scheduleData: unknown
  ): Promise<unknown> {
    const response = await this.api.post(
      `/insert-group-schedule/${uuid}`,
      scheduleData
    );
    return response.data;
  }
}

export const scheduleService = new ScheduleService();
