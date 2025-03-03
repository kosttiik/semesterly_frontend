import axios from 'axios';
import { ScheduleItem, Group } from '../types/schedule';

const API_URL = '/api/v1';

// Функция для получения расписания группы по UUID
export const getGroupSchedule = async (
  uuid: string
): Promise<ScheduleItem[]> => {
  try {
    const response = await axios.get(`${API_URL}/get-group-schedule/${uuid}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching group schedule:', error);
    throw error;
  }
};

// Функция для получения списка всех доступных групп
export const getAllGroups = async (): Promise<Group[]> => {
  try {
    const response = await axios.get(`${API_URL}/get-groups`);
    return response.data;
  } catch (error) {
    console.error('Error fetching all groups:', error);
    throw error;
  }
};

// Функция для сохранения расписания (для будущей функциональности)
export const saveSchedule = async (scheduleData: any): Promise<any> => {
  try {
    const response = await axios.post(
      `${API_URL}/write-schedule`,
      scheduleData
    );
    return response.data;
  } catch (error) {
    console.error('Error saving schedule:', error);
    throw error;
  }
};

// Функция для добавления расписания группы
export const insertGroupSchedule = async (
  uuid: string,
  scheduleData: any
): Promise<any> => {
  try {
    const response = await axios.post(
      `${API_URL}/insert-group-schedule/${uuid}`,
      scheduleData
    );
    return response.data;
  } catch (error) {
    console.error('Error inserting group schedule:', error);
    throw error;
  }
};
