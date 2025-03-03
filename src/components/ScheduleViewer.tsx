import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  Tabs,
  Select,
  Card,
  Tag,
  Typography,
  Space,
  Spin,
  Input,
  Button,
  Empty,
  message,
  Tooltip,
  Divider,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { ScheduleItem, Group, TimeSlot, DayOfWeek } from '../types/schedule';
import { scheduleService } from '../services/scheduleService';
import dayjs from 'dayjs';
import debounce from 'lodash/debounce';

const { Title, Text } = Typography;

interface ScheduleViewerProps {
  initialGroupIds?: string[];
}

const ScheduleViewer: React.FC<ScheduleViewerProps> = ({
  initialGroupIds = [],
}) => {
  // Состояния
  const [selectedGroups, setSelectedGroups] =
    useState<string[]>(initialGroupIds);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [initialized, setInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Optimize search with debounce
  const [searchValue, setSearchValue] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [displayedGroups, setDisplayedGroups] = useState<Group[]>([]);
  const pageSize = 50; // Number of items to load at once

  // Memoized option renderer - move this before filteredGroups
  const renderOption = useCallback(
    (group: Group) => ({
      label: group.name,
      value: group.uuid,
    }),
    []
  );

  // Filtered groups using renderOption
  const filteredGroups = useMemo(() => {
    if (!dropdownOpen) return [];
    if (!searchText) return groups.slice(0, pageSize);
    return groups.filter((group) =>
      group.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [groups, searchText, dropdownOpen, pageSize]);

  // Select options using renderOption
  const selectOptions = useMemo(() => {
    return searchText
      ? filteredGroups.map(renderOption)
      : displayedGroups.map(renderOption);
  }, [filteredGroups, displayedGroups, renderOption, searchText]);

  // Handle dropdown visibility
  const handleDropdownVisibleChange = (open: boolean) => {
    setDropdownOpen(open);
    if (open) {
      setDisplayedGroups(groups.slice(0, pageSize));
    }
  };

  // Handle scroll in dropdown
  const handlePopupScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { currentTarget } = e;
      if (
        currentTarget.scrollTop + currentTarget.clientHeight >=
        currentTarget.scrollHeight - 50
      ) {
        const currentLength = displayedGroups.length;
        const newGroups = groups.slice(0, currentLength + pageSize);
        setDisplayedGroups(newGroups);
      }
    },
    [displayedGroups, groups]
  );

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchText(value);
    }, 300),
    []
  );

  // Handle search change with debounce
  const handleSearch = (value: string) => {
    setSearchValue(value);
    debouncedSearch(value);
  };

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Константы
  const days: DayOfWeek[] = [
    { id: 1, name: 'Понедельник' },
    { id: 2, name: 'Вторник' },
    { id: 3, name: 'Среда' },
    { id: 4, name: 'Четверг' },
    { id: 5, name: 'Пятница' },
    { id: 6, name: 'Суббота' },
  ];

  // Временные слоты
  const timeSlots: TimeSlot[] = [
    { slot: 1, time: '08:30-10:00' },
    { slot: 2, time: '10:10-11:40' },
    { slot: 3, time: '11:50-13:20' },
    { slot: 4, time: '14:05-15:35' },
    { slot: 5, time: '15:50-17:20' },
    { slot: 6, time: '17:30-19:00' },
    { slot: 7, time: '19:10-20:40' },
  ];

  // Получение всех групп
  const fetchGroups = async () => {
    console.log('Starting fetchGroups');
    setLoadingGroups(true);
    setError(null);

    try {
      const fetchedGroups = await scheduleService.getAllGroups();
      if (fetchedGroups.length === 0) {
        setError('Нет доступных групп');
        return;
      }
      setGroups(fetchedGroups);
      setInitialized(true);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message || 'Ошибка загрузки групп');
      } else {
        setError('Неизвестная ошибка при загрузке групп');
      }
      message.error('Не удалось загрузить список групп');
    } finally {
      setLoadingGroups(false);
    }
  };

  // Получение данных расписания
  const fetchScheduleData = async () => {
    if (selectedGroups.length === 0) {
      setScheduleData([]);
      return;
    }

    setLoading(true);
    try {
      const promises = selectedGroups.map((groupId) =>
        scheduleService.getGroupSchedule(groupId)
      );
      const results = await Promise.all(promises);
      const combinedData = results.flat();
      const uniqueData = Array.from(
        new Map(combinedData.map((item) => [item.id, item])).values()
      );
      setScheduleData(uniqueData);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
      message.error('Не удалось загрузить расписание');
    } finally {
      setLoading(false);
    }
  };

  // Загрузка групп при инициализации
  useEffect(() => {
    console.log('Component mounted, fetching groups');
    fetchGroups();
  }, []);

  // Add useEffect to fetch schedule when groups change
  useEffect(() => {
    if (initialized && selectedGroups.length > 0) {
      fetchScheduleData();
    }
  }, [selectedGroups, initialized]);

  // Определение клеток для отображения по типу недели
  const getClassesByWeekType = (
    day: number,
    timeSlot: number,
    weekType: 'ch' | 'zn'
  ) => {
    return scheduleData.filter(
      (item) =>
        item.day === day &&
        item.time === timeSlot &&
        (item.week === weekType || item.week === 'all')
    );
  };

  // Получение цвета для типа занятия
  const getActivityTypeColor = (actType: string): string => {
    const typeColors: Record<string, string> = {
      lecture: 'blue',
      лекция: 'blue',
      практика: 'green',
      practice: 'green',
      лабораторная: 'purple',
      laboratory: 'purple',
      семинар: 'orange',
      seminar: 'orange',
      зачет: 'gold',
      credit: 'gold',
      экзамен: 'red',
      exam: 'red',
    };
    return typeColors[actType.toLowerCase()] || 'default';
  };

  // Отображение информации о занятии
  const renderClassInfo = (classes: ScheduleItem[]) => {
    if (classes.length === 0) return null;

    return classes.map((cls) => (
      <Card
        key={cls.id}
        size="small"
        className="class-card"
        style={{
          marginBottom: 8,
          borderLeft: `3px solid ${
            getActivityTypeColor(cls.disciplines[0]?.actType) === 'default'
              ? '#d9d9d9'
              : `var(--ant-${getActivityTypeColor(
                  cls.disciplines[0]?.actType
                )}-5)`
          }`,
        }}
      >
        <div>
          <Text strong>
            {cls.disciplines[0]?.fullName || cls.disciplines[0]?.abbr}
          </Text>
          <Tag
            color={getActivityTypeColor(cls.disciplines[0]?.actType)}
            style={{ marginLeft: 8 }}
          >
            {cls.disciplines[0]?.actType}
          </Tag>
        </div>
        <div>
          <Text type="secondary">
            {cls.audiences.map((a) => `${a.building} ${a.name}`).join(', ')}
          </Text>
        </div>
        <div>
          <Text type="secondary">
            {cls.teachers
              .map((t) => `${t.lastName} ${t.firstName[0]}.${t.middleName[0]}.`)
              .join(', ')}
          </Text>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {cls.stream || cls.groups.map((g) => g.name).join(', ')}
          </Text>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {cls.startTime} - {cls.endTime}
          </Text>
        </div>
      </Card>
    ));
  };

  // Генерация столбцов для таблицы расписания
  const generateColumns = (weekType: 'ch' | 'zn') => {
    return [
      {
        title: 'Время',
        dataIndex: 'time',
        key: 'time',
        width: 100,
        fixed: 'left' as const,
      },
      ...days.map((day) => ({
        title: day.name,
        dataIndex: `day${day.id}`,
        key: `day${day.id}`,
        render: (_: unknown, record: { slot: number }) =>
          renderClassInfo(getClassesByWeekType(day.id, record.slot, weekType)),
      })),
    ];
  };

  // Генерация источника данных для таблицы
  const generateDataSource = () => {
    return timeSlots.map((slot) => ({
      key: slot.slot,
      time: slot.time,
      slot: slot.slot,
    }));
  };

  // Определение текущего дня и времени для выделения
  const currentDayIndex = dayjs().day();
  const currentTimeIndex = timeSlots.findIndex((slot) => {
    const [startHour, startMinute] = slot.time
      .split('-')[0]
      .split(':')
      .map(Number);
    const [endHour, endMinute] = slot.time.split('-')[1].split(':').map(Number);

    const now = dayjs();
    const currentHour = now.hour();
    const currentMinute = now.minute();

    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;

    return (
      currentTimeInMinutes >= startTimeInMinutes &&
      currentTimeInMinutes <= endTimeInMinutes
    );
  });

  return (
    <div className="schedule-viewer">
      <Card>
        {loadingGroups ? (
          <Spin>
            <div style={{ padding: 50, textAlign: 'center' }}>
              <Text>Загрузка групп...</Text>
            </div>
          </Spin>
        ) : error ? (
          <Empty
            description={
              <>
                <Text type="danger">{error}</Text>
                <div style={{ marginTop: 8 }}>
                  <small>Проверьте консоль разработчика для деталей</small>
                </div>
                <Button
                  onClick={fetchGroups}
                  type="primary"
                  style={{ marginTop: 16 }}
                >
                  Повторить попытку
                </Button>
              </>
            }
          />
        ) : !initialized ? (
          <Spin>
            <div style={{ padding: 50, textAlign: 'center' }}>
              <Text>Загрузка групп...</Text>
            </div>
          </Spin>
        ) : (
          <Space
            direction="vertical"
            size="large"
            style={{ width: '100%', display: 'flex' }}
          >
            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space
                  style={{ width: '100%', justifyContent: 'space-between' }}
                >
                  <Title level={4} style={{ margin: 0 }}>
                    Расписание занятий
                  </Title>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={fetchScheduleData}
                    disabled={selectedGroups.length === 0}
                  >
                    Обновить
                  </Button>
                </Space>

                <Divider style={{ margin: '12px 0' }} />

                <Space style={{ width: '100%' }} direction="vertical">
                  <Text>Выберите группы для просмотра расписания:</Text>
                  <Space style={{ width: '100%' }}>
                    <Input
                      placeholder="Поиск группы..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      prefix={<SearchOutlined />}
                      style={{ width: 200 }}
                      allowClear
                    />
                    <Select
                      mode="multiple"
                      style={{ width: 'calc(100% - 220px)' }}
                      placeholder="Выберите группы"
                      value={selectedGroups}
                      onChange={setSelectedGroups}
                      loading={loadingGroups}
                      searchValue={searchValue}
                      onSearch={handleSearch}
                      options={selectOptions}
                      filterOption={false} // Disable client-side filtering
                      popupMatchSelectWidth={false}
                      listHeight={300}
                      dropdownStyle={{ minWidth: '300px' }}
                      virtual={true} // Enable virtual scrolling
                      maxTagCount="responsive"
                      onDropdownVisibleChange={handleDropdownVisibleChange}
                      onPopupScroll={handlePopupScroll}
                    />
                    <Tooltip title="Вы можете выбрать несколько групп для отображения их общего расписания">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                </Space>
              </Space>
            </Card>

            <Spin spinning={loading}>
              {selectedGroups.length > 0 ? (
                <Tabs
                  defaultActiveKey="numerator"
                  type="card"
                  items={[
                    {
                      key: 'numerator',
                      label: 'Числитель',
                      children: (
                        <div className="table-container">
                          <Table
                            columns={generateColumns('ch')}
                            dataSource={generateDataSource()}
                            pagination={false}
                            bordered
                            size="small"
                            scroll={{ x: 'max-content' }}
                            className="schedule-table"
                            rowClassName={(record) => {
                              return currentDayIndex > 0 &&
                                currentDayIndex < 7 &&
                                record.slot === currentTimeIndex + 1
                                ? 'current-time-row'
                                : '';
                            }}
                          />
                        </div>
                      ),
                    },
                    {
                      key: 'denominator',
                      label: 'Знаменатель',
                      children: (
                        <div className="table-container">
                          <Table
                            columns={generateColumns('zn')}
                            dataSource={generateDataSource()}
                            pagination={false}
                            bordered
                            size="small"
                            scroll={{ x: 'max-content' }}
                            className="schedule-table"
                            rowClassName={(record) => {
                              return currentDayIndex > 0 &&
                                currentDayIndex < 7 &&
                                record.slot === currentTimeIndex + 1
                                ? 'current-time-row'
                                : '';
                            }}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              ) : (
                <Card>
                  <Empty
                    description="Выберите группы для отображения расписания"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                </Card>
              )}
            </Spin>
          </Space>
        )}
      </Card>
    </div>
  );
};

export default ScheduleViewer;
