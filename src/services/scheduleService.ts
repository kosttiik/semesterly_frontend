import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ScheduleItem, Group } from '../types/schedule';

const API_URL = 'http://localhost:8080/api/v1';

// Сервис для работы с API расписания
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

  // Настраиваем перехватчики запросов для обработки ошибок
  private setupInterceptors(): void {
    this.api.interceptors.request.use(
      (config) => {
        // Добавляем заголовки запроса или токены авторизации
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          console.error('Ошибка API:', {
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

  // Получаем список всех групп
  async getAllGroups(): Promise<Group[]> {
    try {
      const { data } = await this.api.get<Group[]>('/get-groups');
      // Логируем сырой ответ API
      console.log('Сырой ответ API:', data);

      if (!data) {
        console.error('Нет данных от API');
        return [];
      }

      // Проверяем, что получили массив
      const groups = Array.isArray(data) ? data : [];
      console.log('Обработанные группы:', groups);

      // Возвращаем пустой массив, если нет валидных групп
      if (groups.length === 0) {
        console.warn('В ответе нет групп');
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

  // Получаем расписание конкретной группы
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
