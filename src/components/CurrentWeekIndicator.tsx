import React, { useState, useEffect } from 'react';
import { Card, Typography, Tag, Space } from 'antd';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import locale from 'dayjs/locale/ru';

const { Text } = Typography;

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.locale(locale);

const CurrentWeekIndicator: React.FC = () => {
  const [isNumerator, setIsNumerator] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [currentWeekNumber, setCurrentWeekNumber] = useState<number>(0);

  useEffect(() => {
    // Определяем, является ли текущая неделя числителем или знаменателем
    // Правило: нечетные недели - числитель, четные - знаменатель
    const now = dayjs();
    const weekNum = now.isoWeek();

    setIsNumerator(weekNum % 2 === 1);
    setCurrentWeekNumber(weekNum);
    setCurrentDate(now.format('DD MMMM YYYY'));

    // Обновляем каждый день
    const interval = setInterval(() => {
      const newDate = dayjs();
      if (newDate.date() !== now.date()) {
        setCurrentDate(newDate.format('DD MMMM YYYY'));

        const newWeekNum = newDate.isoWeek();
        if (newWeekNum !== weekNum) {
          setCurrentWeekNumber(newWeekNum);
          setIsNumerator(newWeekNum % 2 === 1);
        }
      }
    }, 3600000); // Проверка каждый час

    return () => clearInterval(interval);
  }, []);

  return (
    <Card style={{ marginBottom: 16 }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space>
          <Text strong>Сегодня:</Text>
          <Text>{currentDate}</Text>
        </Space>
        <Space>
          <Text strong>Неделя #{currentWeekNumber}:</Text>
          <Tag
            color={isNumerator ? 'blue' : 'green'}
            style={{ fontSize: '14px' }}
          >
            {isNumerator ? 'Числитель (нечетная)' : 'Знаменатель (четная)'}
          </Tag>
        </Space>
      </Space>
    </Card>
  );
};

export default CurrentWeekIndicator;
