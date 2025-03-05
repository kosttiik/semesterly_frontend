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
import { ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { ScheduleItem, Group, TimeSlot, DayOfWeek } from '../types/schedule';
import { scheduleService } from '../services/scheduleService';
import { parseTime } from '../utils/timeUtils';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

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
  const fetchScheduleData = useCallback(async () => {
    if (selectedGroups.length === 0) {
      setScheduleData([]);
      return;
    }

    setLoading(true);
    try {
      const newSchedules = selectedGroups.filter(
        (groupId) => !fetchedSchedules.current.has(groupId)
      );

      if (newSchedules.length > 0) {
        const results = await Promise.all(
          newSchedules.map((groupId) =>
            scheduleService.getGroupSchedule(groupId)
          )
        );

        newSchedules.forEach((groupId) =>
          fetchedSchedules.current.add(groupId)
        );

        setScheduleData((prevData) => {
          const existingData = prevData.filter((item) =>
            selectedGroups.some((groupId) =>
              item.groups.some((g) => g.uuid === groupId)
            )
          );
          return [...existingData, ...results.flat()];
        });
      }
    } catch {
      message.error('Не удалось загрузить расписание');
    } finally {
      setLoading(false);
    }
  }, [selectedGroups]);

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
    }[actType.toLowerCase()] || 'default');

  // Current time highlighting
  const currentDayIndex = dayjs().day();
  const currentTimeIndex = TIME_SLOTS.findIndex((slot) => {
    const [start, end] = slot.time.split('-').map((t) => parseTime(t));
    const now = dayjs();
    return now.isAfter(start) && now.isBefore(end);
  });

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
                            <Tooltip
                              title={lesson.teachers
                                .map(
                                  (t) =>
                                    `${t.lastName} ${t.firstName} ${t.middleName}`
                                )
                                .join(', ')}
                            >
                              {lesson.teachers
                                .map(
                                  (t) =>
                                    `${t.lastName} ${t.firstName[0]}.${t.middleName[0]}.`
                                )
                                .join(', ')}
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
                    // Don't clear the search input after selection
                    setTimeout(() => {
                      const selectInput = document.querySelector(
                        '.ant-select-selection-search-input'
                      ) as HTMLInputElement;
                      if (selectInput) {
                        selectInput.value = searchTerm;
                      }
                    }, 0);
                  }}
                  options={groups.map((g) => ({
                    label: g.name,
                    value: g.uuid,
                  }))}
                  tagRender={(props: TagRenderProps) => {
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
                <Tooltip title="Вы можете выбрать несколько групп для отображения их общего расписания">
                  <InfoCircleOutlined />
                </Tooltip>
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
