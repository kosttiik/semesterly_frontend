import React, { useState, useEffect } from 'react';
import { Card, Typography, Tag, Space, Spin } from 'antd';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import locale from 'dayjs/locale/ru';
import { scheduleService } from '../services/scheduleService';

const { Text } = Typography;

// Add required plugins
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.locale(locale);

const CurrentWeekIndicator: React.FC = () => {
  const [isNumerator, setIsNumerator] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [weekNumber, setWeekNumber] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchWeekInfo = async () => {
      try {
        const weekInfo = await scheduleService.getCurrentWeek();
        setIsNumerator(weekInfo.data.weekShortName === 'чс');
        setWeekNumber(weekInfo.data.weekNumber);
        setCurrentDate(dayjs(weekInfo.date).format('DD MMMM YYYY'));
      } catch (error) {
        console.error('Failed to fetch week info:', error);
        const now = dayjs();
        const weekNum = now.isoWeek();
        setWeekNumber(weekNum);
        setIsNumerator(weekNum % 2 === 1);
        setCurrentDate(now.format('DD MMMM YYYY'));
      } finally {
        setLoading(false);
      }
    };

    fetchWeekInfo();

    const interval = setInterval(fetchWeekInfo, 3600000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card style={{ marginBottom: 16 }}>
        <Spin size="small" />
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space>
          <Text strong>Сегодня:</Text>
          <Text>{currentDate}</Text>
        </Space>
        <Space>
          <Text strong>Неделя #{weekNumber}:</Text>
          <Tag
            color={isNumerator ? 'blue' : 'green'}
            style={{ fontSize: '14px' }}
          >
            {isNumerator ? 'Числитель' : 'Знаменатель'}
          </Tag>
        </Space>
      </Space>
    </Card>
  );
};

export default CurrentWeekIndicator;
