import axios from 'axios';
import { ScheduleItem, Group } from '../types/schedule';

const API_URL = '/api/v1';

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

export const getAllGroups = async (): Promise<Group[]> => {
  // You'll need to implement this endpoint on your backend
  try {
    const response = await axios.get(`${API_URL}/get-groups`);
    return response.data;
  } catch (error) {
    console.error('Error fetching all groups:', error);
    throw error;
  }
};
