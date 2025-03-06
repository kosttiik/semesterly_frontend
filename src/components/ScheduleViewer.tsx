import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  Tabs,
  Select,
  Card,
  Tag,
  Typography,
  Space,
  Spin,
  Button,
  Empty,
  message,
  Tooltip,
} from 'antd';
import type { SelectProps } from 'antd';
import {
  ReloadOutlined,
  InfoCircleOutlined,
  CompressOutlined,
  ExpandOutlined,
} from '@ant-design/icons';
import {
  ScheduleItem,
  Group,
  Teacher,
  TimeSlot,
  DayOfWeek,
} from '../types/schedule';
import { scheduleService } from '../services/scheduleService';
import { parseTime } from '../utils/timeUtils';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const DROPDOWN_ITEM_HEIGHT = 32; // height of each dropdown item in pixels

type CustomTagProps = Parameters<NonNullable<SelectProps['tagRender']>>[0];

interface ScheduleViewerProps {
  initialGroupIds?: string[];
}

// Define ScheduleMap type for memoized data structure
interface ScheduleMap {
  [weekType: string]: {
    [day: number]: {
      [timeSlot: number]: {
        [groupId: string]: ScheduleItem[];
      };
    };
  };
}

const DAYS: DayOfWeek[] = [
  { id: 1, name: 'Понедельник' },
  { id: 2, name: 'Вторник' },
  { id: 3, name: 'Среда' },
  { id: 4, name: 'Четверг' },
  { id: 5, name: 'Пятница' },
  { id: 6, name: 'Суббота' },
];

const TIME_SLOTS: TimeSlot[] = [
  { slot: 1, time: '08:30-10:00' },
  { slot: 2, time: '10:10-11:40' },
  { slot: 3, time: '11:50-13:20' },
  { slot: 4, time: '14:05-15:35' },
  { slot: 5, time: '15:50-17:20' },
  { slot: 6, time: '17:30-19:00' },
  { slot: 7, time: '19:10-20:40' },
];

const GROUP_COLORS = [
  '#1677ff', // blue
  '#f5222d', // red
  '#722ed1', // purple
  '#52c41a', // green
  '#fa8c16', // orange
] as const;

const ScheduleViewer: React.FC<ScheduleViewerProps> = ({
  initialGroupIds = [],
}) => {
  // State management
  const [selectedGroups, setSelectedGroups] =
    useState<string[]>(initialGroupIds);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [groupsStatus, setGroupsStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [useShortNames, setUseShortNames] = useState(false);

  // Keep track of fetched schedules
  const fetchedSchedules = useRef<Set<string>>(new Set());

  // Memoized schedule map for performance
  const scheduleMap = useMemo<ScheduleMap>(() => {
    const map: ScheduleMap = { ch: {}, zn: {} };
    ['ch', 'zn'].forEach((weekType) => {
      map[weekType] = {};
      DAYS.forEach((day) => {
        map[weekType][day.id] = {};
        TIME_SLOTS.forEach((timeSlot) => {
          map[weekType][day.id][timeSlot.slot] = {};
          selectedGroups.forEach((groupId) => {
            // Get all lessons for this time slot and filter for shared lessons
            const lessons = scheduleData.filter(
              (item) =>
                item.day === day.id &&
                item.time === timeSlot.slot &&
                (item.week === weekType || item.week === 'all') &&
                item.groups.some((g) => g.uuid === groupId)
            );

            // Create a map of unique lessons using a composite key
            const uniqueLessons = lessons.reduce((acc, lesson) => {
              const key = `${lesson.disciplines[0]?.fullName}_${lesson.teachers
                .map((t) => t.id)
                .join('_')}_${lesson.audiences.map((a) => a.id).join('_')}`;
              if (!acc.has(key)) {
                acc.set(key, lesson);
              }
              return acc;
            }, new Map());

            map[weekType][day.id][timeSlot.slot][groupId] = Array.from(
              uniqueLessons.values()
            );
          });
        });
      });
    });
    return map;
  }, [scheduleData, selectedGroups]);

  // Consistent group color assignment
  const getGroupColor = useCallback(
    (groupId: string, selectedGroups: string[]): string => {
      const index = selectedGroups.indexOf(groupId);
      return GROUP_COLORS[index % GROUP_COLORS.length];
    },
    []
  );

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    setGroupsStatus('loading');
    setError(null);
    try {
      const fetchedGroups = await scheduleService.getAllGroups();
      if (fetchedGroups.length === 0) {
        setError('Нет доступных групп');
        setGroupsStatus('error');
        return;
      }
      setGroups(fetchedGroups);
      setGroupsStatus('success');
    } catch {
      setError('Ошибка загрузки групп');
      setGroupsStatus('error');
      message.error('Не удалось загрузить список групп');
    }
  }, []);

  // Optimized schedule data fetching
  const fetchScheduleData = useCallback(
    async (forceRefresh = false) => {
      if (selectedGroups.length === 0) {
        setScheduleData([]);
        return;
      }

      setLoading(true);
      try {
        // If force refresh, clear cache for selected groups
        if (forceRefresh) {
          selectedGroups.forEach((groupId) => {
            fetchedSchedules.current.delete(groupId);
            scheduleService.clearScheduleCache(groupId);
          });
        }

        const newSchedules = selectedGroups.filter(
          (groupId) => !fetchedSchedules.current.has(groupId)
        );

        if (newSchedules.length > 0 || forceRefresh) {
          const results = await Promise.all(
            selectedGroups.map((groupId) =>
              scheduleService.getGroupSchedule(groupId)
            )
          );

          selectedGroups.forEach((groupId) =>
            fetchedSchedules.current.add(groupId)
          );

          setScheduleData(results.flat());
        }
      } catch {
        message.error('Не удалось загрузить расписание');
      } finally {
        setLoading(false);
      }
    },
    [selectedGroups]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scheduleService.clearScheduleCache();
    };
  }, []);

  // Initial group fetch
  useEffect(() => {
    if (groupsStatus === 'idle') fetchGroups();
  }, [fetchGroups, groupsStatus]);

  // Fetch schedule when groups change
  useEffect(() => {
    if (groupsStatus === 'success' && selectedGroups.length > 0)
      fetchScheduleData();
  }, [selectedGroups, groupsStatus, fetchScheduleData]);

  // Handle group selection changes
  const handleGroupChange = useCallback(
    (selectedIds: string[]) => {
      const removedGroups = selectedGroups.filter(
        (id) => !selectedIds.includes(id)
      );

      // Clear cache for removed groups
      removedGroups.forEach((groupId) => {
        fetchedSchedules.current.delete(groupId);
        scheduleService.clearScheduleCache(groupId);
      });

      setSelectedGroups(selectedIds);

      // Update schedule data immediately for removals
      setScheduleData((prevData) =>
        prevData.filter((item) =>
          selectedIds.some((groupId) =>
            item.groups.some((g) => g.uuid === groupId)
          )
        )
      );
    },
    [selectedGroups]
  );

  // Activity type colors
  const getActivityTypeColor = (actType: string): string =>
    ({
      // Russian variants
      лекция: 'blue',
      'лаб. работа': 'purple',
      'практ. работа': 'green',
      семинар: 'orange',
      зачёт: 'gold',
      экзамен: 'red',
      // English variants - map to same colors
      lecture: 'blue',
      laboratory: 'purple',
      practice: 'green',
      seminar: 'orange',
      credit: 'gold',
      exam: 'red',
      // Handle full forms too
      лабораторная: 'purple',
      практика: 'green',
      зачет: 'gold', // Handle both with and without ё
    }[actType.toLowerCase()] || 'default');

  // Add this translation function near the other utility functions
  const translateActivityType = (actType: string): string =>
    ({
      lecture: 'лекция',
      lab: 'лаб. работа',
      practice: 'практ. работа',
      seminar: 'семинар',
      credit: 'зачёт',
      exam: 'экзамен',
      // Add any other translations needed
    }[actType.toLowerCase()] || actType);

  // Current time highlighting
  const currentDayIndex = dayjs().day();
  const currentTimeIndex = TIME_SLOTS.findIndex((slot) => {
    const [start, end] = slot.time.split('-').map((t) => parseTime(t));
    const now = dayjs();
    return now.isAfter(start) && now.isBefore(end);
  });

  // Helper function to format teacher name - simplified to last name and initials only
  const formatTeacherFullName = (teacher: Teacher): string => {
    return `${teacher.lastName} ${teacher.firstName} ${teacher.middleName}`;
  };

  const formatTeacherInitials = (teacher: Teacher): string => {
    return `${teacher.lastName} ${teacher.firstName[0]}.${teacher.middleName[0]}.`;
  };

  // Render schedule table
  const renderScheduleTable = (weekType: 'ch' | 'zn') => (
    <div className="schedule-table-container">
      <table
        className="schedule-table"
        data-groups={selectedGroups.length}
        style={{
          ['--group-count' as keyof React.CSSProperties]: selectedGroups.length,
        }}
      >
        <thead>
          <tr>
            <th className="time-column" scope="col">
              Время
            </th>
            {selectedGroups.map((groupId) => (
              <th key={groupId} className="group-column" scope="col">
                {groups.find((g) => g.uuid === groupId)?.name ||
                  'Неизвестная группа'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) => (
            <React.Fragment key={day.id}>
              <tr className="day-row">
                <td colSpan={selectedGroups.length + 1} className="day-header">
                  {day.name}
                </td>
              </tr>
              {TIME_SLOTS.map((timeSlot) => (
                <tr
                  key={`${day.id}-${timeSlot.slot}`}
                  className={
                    day.id === currentDayIndex &&
                    timeSlot.slot === currentTimeIndex + 1
                      ? 'current-time-slot'
                      : ''
                  }
                >
                  <td className="time-cell" scope="row">
                    {timeSlot.time}
                  </td>
                  {selectedGroups.map((groupId) => (
                    <td key={groupId} className="schedule-cell">
                      {(
                        scheduleMap[weekType][day.id]?.[timeSlot.slot]?.[
                          groupId
                        ] || []
                      ).map((lesson) => (
                        <div
                          key={`${lesson.id}_${groupId}_${
                            lesson.disciplines[0]?.fullName
                          }_${lesson.teachers.map((t) => t.id).join('_')}`}
                          className="lesson-card"
                          style={{
                            borderLeft: `3px solid ${getGroupColor(
                              groupId,
                              selectedGroups
                            )}`,
                            backgroundColor: `${getGroupColor(
                              groupId,
                              selectedGroups
                            )}10`,
                          }}
                        >
                          <div className="lesson-header">
                            <div className="lesson-name-container">
                              {lesson.disciplines[0] ? (
                                <>
                                  <span className="full-name">
                                    {lesson.disciplines[0].fullName ||
                                      lesson.disciplines[0].abbr ||
                                      'Нет названия'}
                                  </span>
                                  <Tooltip
                                    title={
                                      <div style={{ textAlign: 'left' }}>
                                        <b>
                                          {lesson.disciplines[0].fullName ||
                                            lesson.disciplines[0].abbr ||
                                            'Нет названия'}
                                        </b>
                                      </div>
                                    }
                                    placement="topLeft"
                                    mouseEnterDelay={0.2}
                                    mouseLeaveDelay={0.1}
                                  >
                                    <span className="short-name">
                                      {(lesson.disciplines[0].abbr !==
                                        lesson.disciplines[0].fullName &&
                                        lesson.disciplines[0].abbr) ||
                                        lesson.disciplines[0].fullName ||
                                        'Нет названия'}
                                    </span>
                                  </Tooltip>
                                </>
                              ) : (
                                <span className="full-name">Нет названия</span>
                              )}
                            </div>
                            <div className="lesson-time">
                              {lesson.startTime}–{lesson.endTime}
                            </div>
                          </div>
                          <div className="lesson-type">
                            <Tag
                              color={getActivityTypeColor(
                                lesson.disciplines[0]?.actType
                              )}
                            >
                              {translateActivityType(
                                lesson.disciplines[0]?.actType
                              )}
                            </Tag>
                          </div>
                          <div className="lesson-location">
                            {lesson.audiences
                              .map((a) => `${a.building} ${a.name}`)
                              .join(', ')}
                          </div>
                          <div className="lesson-teacher">
                            <Tooltip
                              title={
                                <div style={{ textAlign: 'left' }}>
                                  {lesson.teachers.map((t, i) => (
                                    <div key={t.id}>
                                      {formatTeacherFullName(t)}
                                      {i < lesson.teachers.length - 1 ? (
                                        <br />
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              }
                              placement="bottom"
                              mouseEnterDelay={0.2} // Slightly slower tooltip appearance
                              mouseLeaveDelay={0.1}
                            >
                              <span>
                                {lesson.teachers
                                  .map(formatTeacherInitials)
                                  .join(', ')}
                              </span>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="schedule-viewer">
      <Card>
        {groupsStatus === 'loading' ? (
          <Spin tip="Загрузка групп...">
            <div style={{ padding: 50, textAlign: 'center' }} />
          </Spin>
        ) : error ? (
          <Empty
            description={
              <>
                <Text type="danger">{error}</Text>
                <Button
                  type="primary"
                  onClick={fetchGroups}
                  style={{ marginTop: 16 }}
                >
                  Повторить попытку
                </Button>
              </>
            }
          />
        ) : groupsStatus !== 'success' ? (
          <Spin tip="Загрузка групп...">
            <div style={{ padding: 50, textAlign: 'center' }} />
          </Spin>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space
                  style={{ width: '100%', justifyContent: 'space-between' }}
                >
                  <Space align="center">
                    <Space>
                      <Title level={4} style={{ margin: 0, marginTop: -4 }}>
                        Расписание занятий
                      </Title>
                      <Tooltip title="Вы можете выбрать несколько групп для отображения их общего расписания">
                        <InfoCircleOutlined
                          style={{ fontSize: '16px', color: '#1677ff' }}
                        />
                      </Tooltip>
                    </Space>
                    <Button
                      icon={
                        useShortNames ? (
                          <ExpandOutlined />
                        ) : (
                          <CompressOutlined />
                        )
                      }
                      onClick={() => setUseShortNames(!useShortNames)}
                      size="small"
                    >
                      {useShortNames
                        ? 'Полные названия'
                        : 'Сокращённые названия'}
                    </Button>
                  </Space>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => fetchScheduleData(true)}
                    disabled={selectedGroups.length === 0}
                  >
                    Обновить
                  </Button>
                </Space>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  placeholder="Выберите группы"
                  value={selectedGroups}
                  onChange={handleGroupChange}
                  loading={loading}
                  showSearch
                  searchValue={searchTerm}
                  onSearch={setSearchTerm}
                  filterOption={(input, option) =>
                    (option?.label as string)
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onSelect={() => {
                    setTimeout(() => {
                      const selectInput = document.querySelector(
                        '.ant-select-selection-search-input'
                      ) as HTMLInputElement;
                      if (selectInput) {
                        selectInput.value = searchTerm;
                      }
                    }, 0);
                  }}
                  virtual={true}
                  listHeight={256}
                  optionLabelProp="label"
                  dropdownRender={(menu) => (
                    <div>
                      <div
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid #f0f0f0',
                          fontWeight: 500,
                          color: '#666',
                        }}
                      >
                        Количество групп: {groups.length}
                      </div>
                      {menu}
                    </div>
                  )}
                  options={groups.map((g, index) => ({
                    label: g.name,
                    value: g.uuid,
                    children: (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          height: DROPDOWN_ITEM_HEIGHT,
                          alignItems: 'center',
                          padding: '0 8px',
                        }}
                      >
                        <span>{g.name}</span>
                        <span style={{ color: '#8c8c8c' }}>#{index + 1}</span>
                      </div>
                    ),
                  }))}
                  tagRender={(props: CustomTagProps) => {
                    const { label, value, closable, onClose } = props;

                    if (!value || typeof value !== 'string') return <></>;

                    const index = selectedGroups.indexOf(value);
                    const color = GROUP_COLORS[index % GROUP_COLORS.length];

                    return (
                      <Tag
                        color={color}
                        closable={closable}
                        onClose={onClose}
                        style={{
                          margin: '2px',
                          color: '#fff',
                          fontWeight: 500,
                        }}
                      >
                        {label}
                      </Tag>
                    );
                  }}
                />
              </Space>
            </Card>
            <Spin spinning={loading}>
              {selectedGroups.length > 0 ? (
                <div
                  className={`schedule-container ${
                    useShortNames ? 'use-short-names' : ''
                  }`}
                >
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
                </div>
              ) : (
                <Empty description="Выберите группы для отображения расписания" />
              )}
            </Spin>
          </Space>
        )}
      </Card>
    </div>
  );
};

export default ScheduleViewer;
