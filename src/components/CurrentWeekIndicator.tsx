import React, { useState, useEffect } from 'react';
import { Alert } from 'antd';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(weekOfYear);

const CurrentWeekIndicator: React.FC = () => {
  const [isNumerator, setIsNumerator] = useState<boolean>(false);

  useEffect(() => {
    // Determine whether the current week is numerator (ch) or denominator (zn)
    // You may need to adjust this logic based on your academic calendar
    const currentWeek = dayjs().week();
    setIsNumerator(currentWeek % 2 === 1); // Odd weeks are numerator, even weeks are denominator
  }, []);

  return (
    <Alert
      message={`Текущая неделя: ${isNumerator ? 'Числитель' : 'Знаменатель'}`}
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
};

export default CurrentWeekIndicator;
