import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import {
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

interface GroupColor {
  uuid: string;
  colorIndex: number;
}

const ScheduleViewer: FC<ScheduleViewerProps> = ({ initialGroupIds = [] }) => {
  // Основное хранилище данных компонента
  const [selectedGroups, setSelectedGroups] =
    useState<string[]>(initialGroupIds);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [initialized, setInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [groupColors, setGroupColors] = useState<GroupColor[]>([]);

  // Оптимизация поиска с помощью debounce
  const [searchValue, setSearchValue] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [displayedGroups, setDisplayedGroups] = useState<Group[]>([]);
  const pageSize = 50; // Количество элементов для загрузки за раз

  // Мемоизированный рендерер опций
  const renderOption = useCallback(
    (group: Group) => ({
      label: group.name,
      value: group.uuid,
    }),
    []
  );

  // Отфильтрованные группы с использованием renderOption
  const filteredGroups = useMemo(() => {
    if (!dropdownOpen) return [];
    if (!searchText) return groups.slice(0, pageSize);
    return groups.filter((group) =>
      group.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [groups, searchText, dropdownOpen, pageSize]);

  // Опции выбора с использованием renderOption
  const selectOptions = useMemo(() => {
    return searchText
      ? filteredGroups.map(renderOption)
      : displayedGroups.map(renderOption);
  }, [filteredGroups, displayedGroups, renderOption, searchText]);

  // Обработка видимости выпадающего списка
  const handleDropdownVisibleChange = (open: boolean) => {
    setDropdownOpen(open);
    if (open) {
      setDisplayedGroups(groups.slice(0, pageSize));
    }
  };

  // Обработка прокрутки в выпадающем списке
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

  // Отложенный обработчик поиска
  const debouncedSearch = useMemo(
    () =>
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

  // Список пар в течение дня
  const timeSlots: TimeSlot[] = [
    { slot: 1, time: '08:30-10:00' },
    { slot: 2, time: '10:10-11:40' },
    { slot: 3, time: '11:50-13:20' },
    { slot: 4, time: '14:05-15:35' },
    { slot: 5, time: '15:50-17:20' },
    { slot: 6, time: '17:30-19:00' },
    { slot: 7, time: '19:10-20:40' },
  ];

  // Загружаем список всех групп с сервера
  const fetchGroups = async () => {
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

  // Update the memoized fetch function to handle multiple groups and deduplicate items
  const memoizedFetchScheduleData = useCallback(() => {
    if (selectedGroups.length === 0) {
      setScheduleData([]);
      return;
    }

    setLoading(true);
    Promise.all(
      selectedGroups.map((groupId) => scheduleService.getGroupSchedule(groupId))
    )
      .then((results) => {
        // Deduplicate schedule items based on their unique characteristics
        const combinedSchedule = results.flat();
        const uniqueSchedule = combinedSchedule.filter(
          (item, index, self) =>
            index ===
            self.findIndex(
              (t) =>
                t.day === item.day &&
                t.time === item.time &&
                t.week === item.week &&
                t.disciplines[0]?.fullName === item.disciplines[0]?.fullName &&
                t.startTime === item.startTime &&
                t.endTime === item.endTime
            )
        );
        setScheduleData(uniqueSchedule);
      })
      .catch((error) => {
        console.error('Error fetching schedule data:', error);
        message.error('Не удалось загрузить расписание');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedGroups]);

  // Загрузка групп при инициализации
  useEffect(() => {
    let mounted = true;

    const initializeGroups = async () => {
      if (!initialized && mounted) {
        await fetchGroups();
      }
    };

    initializeGroups();

    return () => {
      mounted = false;
    };
  }); // Empty dependency array

  // Add useEffect to fetch schedule when groups change
  useEffect(() => {
    if (initialized && selectedGroups.length > 0) {
      memoizedFetchScheduleData();
    }
  }, [selectedGroups, initialized, memoizedFetchScheduleData]);

  // Определяем цвет карточки в зависимости от типа занятия
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

  const getGroupColorIndex = useCallback(
    (groupId: string) => {
      const colorMapping = groupColors.find((gc) => gc.uuid === groupId);
      return colorMapping ? colorMapping.colorIndex : 0;
    },
    [groupColors]
  );

  // Отрисовываем карточку занятия со всей информацией

  // Add time markers

  // Inside your table cell rendering

  // Создаём колонки для таблицы расписания

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

  const handleGroupChange = (selectedIds: string[]) => {
    setSelectedGroups(selectedIds);

    // Update color mappings
    const newGroupColors: GroupColor[] = selectedIds.map((uuid, index) => ({
      uuid,
      colorIndex: (index % 5) + 1, // 1-5 colors
    }));
    setGroupColors(newGroupColors);
  };

  // Update renderScheduleTable function
  const renderScheduleTable = (weekType: 'ch' | 'zn') => {
    const groupCount = selectedGroups.length;

    // Replace the CSS variable type annotation
    const tableStyle = {
      ['--group-count' as string]: groupCount,
    };

    return (
      <div className="schedule-table-container">
        <table
          className="schedule-table"
          data-groups={groupCount}
          style={tableStyle}
        >
          <thead>
            <tr>
              <th className="time-column">Время</th>
              {selectedGroups.map((groupId) => {
                const group = groups.find((g) => g.uuid === groupId);
                return (
                  <th key={groupId} className="group-column">
                    {group?.name || 'Неизвестная группа'}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <React.Fragment key={day.id}>
                <tr className="day-row">
                  <td
                    colSpan={selectedGroups.length + 1}
                    className="day-header"
                  >
                    {day.name}
                  </td>
                </tr>
                {timeSlots.map((timeSlot) => (
                  <tr
                    key={`${day.id}-${timeSlot.slot}`}
                    className={`time-slot-row ${
                      day.id === currentDayIndex &&
                      timeSlot.slot === currentTimeIndex + 1
                        ? 'current-time-slot'
                        : ''
                    }`}
                  >
                    <td className="time-cell">{timeSlot.time}</td>
                    {selectedGroups.map((groupId) => {
                      const lessons = scheduleData.filter(
                        (item) =>
                          item.day === day.id &&
                          item.time === timeSlot.slot &&
                          (item.week === weekType || item.week === 'all') &&
                          item.groups.some((g) => g.uuid === groupId)
                      );
                      return (
                        <td key={groupId} className="schedule-cell">
                          {lessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              className={`lesson-card group-card-${
                                getGroupColorIndex(groupId) || 1
                              }`}
                            >
                              <div className="lesson-name">
                                {lesson.disciplines[0]?.fullName}
                              </div>
                              <div className="lesson-type">
                                <Tag
                                  color={getActivityTypeColor(
                                    lesson.disciplines[0]?.actType
                                  )}
                                >
                                  {lesson.disciplines[0]?.actType}
                                </Tag>
                              </div>
                              <div className="lesson-location">
                                {lesson.audiences
                                  .map((a) => `${a.building} ${a.name}`)
                                  .join(', ')}
                              </div>
                              <div className="lesson-teacher">
                                {lesson.teachers
                                  .map(
                                    (t) =>
                                      `${t.lastName} ${t.firstName[0]}.${t.middleName[0]}.`
                                  )
                                  .join(', ')}
                              </div>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

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
                    onClick={memoizedFetchScheduleData}
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
                      className="groups-select"
                      size="large"
                      style={{
                        width: 'calc(100% - 220px)',
                        display: 'inline-flex',
                      }}
                      dropdownStyle={{
                        minWidth: '200px',
                        maxWidth: '400px',
                      }}
                      maxTagCount={3}
                      placeholder="Выберите группы"
                      value={selectedGroups}
                      onChange={handleGroupChange}
                      loading={loadingGroups}
                      searchValue={searchValue}
                      onSearch={handleSearch}
                      options={selectOptions}
                      filterOption={false}
                      popupMatchSelectWidth={false}
                      listHeight={300}
                      virtual={true}
                      onDropdownVisibleChange={handleDropdownVisibleChange}
                      onPopupScroll={handlePopupScroll}
                      tagRender={(props) => {
                        const { label, closable, onClose, value } = props;
                        const colorIndex =
                          getGroupColorIndex(value as string) || 1;
                        return (
                          <Tag
                            closable={closable}
                            onClose={onClose}
                            style={{
                              margin: '2px',
                              padding: '4px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: `var(--group-color-${colorIndex})`,
                              color: 'white',
                              border: 'none',
                            }}
                          >
                            {label}
                          </Tag>
                        );
                      }}
                      dropdownRender={(menu) => (
                        <div className="groups-dropdown">
                          <div className="groups-dropdown-header">
                            Найдено групп: {groups.length}
                          </div>
                          <div className="groups-dropdown-content">{menu}</div>
                        </div>
                      )}
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
                      children: renderScheduleTable('ch'),
                    },
                    {
                      key: 'denominator',
                      label: 'Знаменатель',
                      children: renderScheduleTable('zn'),
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
