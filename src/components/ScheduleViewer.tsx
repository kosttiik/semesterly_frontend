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
  SettingOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { ScheduleItem, Group, Teacher, TimeSlot } from '../types/schedule';
import { scheduleService } from '../services/scheduleService';
import { parseTime } from '../utils/timeUtils';
import dayjs from 'dayjs';
import CacheService from '../services/cacheService';
import AdminControls from './AdminControls';
import { DAYS, TIME_SLOTS } from '../utils/constants';
import { generateExcelWorkbook, downloadExcel } from '../utils/excelExport';

const { Title } = Typography;

// Базовая высота элемента выпадающего списка
const DROPDOWN_ITEM_HEIGHT = 32;

type CustomTagProps = Parameters<NonNullable<SelectProps['tagRender']>>[0];

interface ScheduleViewerProps {
  initialGroupIds?: string[];
  displayMode: 'separate' | 'combined';
  setDisplayMode: (mode: 'separate' | 'combined') => void;
}

// Определение типа ScheduleMap для мемоизированной структуры данных
interface ScheduleMap {
  [weekType: string]: {
    [day: number]: {
      [timeSlot: number]: {
        [groupId: string]: ScheduleItem[];
      };
    };
  };
}

// Цвета для групп в расписании
const GROUP_COLORS = [
  '#1677ff', // синий
  '#f5222d', // красный
  '#722ed1', // фиолетовый
  '#52c41a', // зеленый
  '#fa8c16', // оранжевый
] as const;

const ScheduleViewer: React.FC<ScheduleViewerProps> = ({
  initialGroupIds = [],
  displayMode,
  setDisplayMode,
}) => {
  // Управление состоянием
  const [selectedGroups, setSelectedGroups] =
    useState<string[]>(initialGroupIds);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [groupsStatus, setGroupsStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [groups, setGroups] = useState<Group[]>([]);
  const [, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [useShortNames, setUseShortNames] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Отслеживание загруженных расписаний
  const fetchedSchedules = useRef<Set<string>>(new Set());

  // Мемоизированная структура данных для эффективной работы с расписанием
  const scheduleMap = useMemo<ScheduleMap>(() => {
    const map: ScheduleMap = { ch: {}, zn: {} };
    ['ch', 'zn'].forEach((weekType) => {
      map[weekType] = {};
      DAYS.forEach((day) => {
        map[weekType][day.id] = {};
        TIME_SLOTS.forEach((timeSlot) => {
          map[weekType][day.id][timeSlot.slot] = {};
          selectedGroups.forEach((groupId) => {
            // Получение всех занятий для данного временного интервала и фильтрация для общих занятий
            const lessons = scheduleData.filter(
              (item) =>
                item.day === day.id &&
                item.time === timeSlot.slot &&
                (item.week === weekType || item.week === 'all') &&
                item.groups.some((g) => g.uuid === groupId)
            );

            // Создание карты уникальных занятий с использованием составного ключа
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

  // Получение цвета для группы, сохраняя последовательность
  const getGroupColor = useCallback(
    (groupId: string, selectedGroups: string[]): string => {
      const index = selectedGroups.indexOf(groupId);
      return GROUP_COLORS[index % GROUP_COLORS.length];
    },
    []
  );

  // Получение групп
  const fetchGroups = useCallback(async () => {
    console.log('Fetching groups...');
    setGroupsStatus('loading');
    setError(null);
    setGroups([]);

    // Очистка кэша групп
    CacheService.remove('groups');

    try {
      const fetchedGroups = await scheduleService.getAllGroups();

      if (fetchedGroups.length === 0) {
        setError('Нет доступных групп');
        setGroupsStatus('error');
        return;
      }
      setGroups(fetchedGroups);
      setGroupsStatus('success');
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setError('Ошибка загрузки групп');
      setGroupsStatus('error');
      message.error('Не удалось загрузить список групп');
    }
  }, []);

  // Оптимизированная загрузка данных расписания
  const fetchScheduleData = useCallback(
    async (forceRefresh = false) => {
      if (selectedGroups.length === 0) {
        setScheduleData([]);
        return;
      }

      setLoading(true);
      try {
        // Если принудительное обновление, очистить кэш для выбранных групп
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

  // Очистка кэша при размонтировании компонента
  useEffect(() => {
    return () => {
      scheduleService.clearScheduleCache();
    };
  }, []);

  // Первоначальная загрузка групп
  useEffect(() => {
    if (groupsStatus === 'idle') fetchGroups();
  }, [fetchGroups, groupsStatus]);

  // Загрузка расписания при изменении групп
  useEffect(() => {
    if (groupsStatus === 'success' && selectedGroups.length > 0)
      fetchScheduleData();
  }, [selectedGroups, groupsStatus, fetchScheduleData]);

  // Обработка изменений в выборе групп
  const handleGroupChange = useCallback(
    (selectedIds: string[]) => {
      const removedGroups = selectedGroups.filter(
        (id) => !selectedIds.includes(id)
      );

      // Очистка кэша для удаленных групп
      removedGroups.forEach((groupId) => {
        fetchedSchedules.current.delete(groupId);
        scheduleService.clearScheduleCache(groupId);
      });

      setSelectedGroups(selectedIds);

      // Немедленное обновление данных расписания для удаленных групп
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

  // Цвета для разных типов занятий
  const getActivityTypeColor = (actType: string): string =>
    ({
      // Русские варианты
      лекция: 'blue',
      'лаб. работа': 'purple',
      'практ. работа': 'green',
      семинар: 'orange',
      зачёт: 'gold',
      экзамен: 'red',
      // Английские варианты
      lecture: 'blue',
      laboratory: 'purple',
      practice: 'green',
      seminar: 'orange',
      credit: 'gold',
      exam: 'red',
      // Полные формы
      лабораторная: 'purple',
      практика: 'green',
      зачет: 'gold',
    }[actType.toLowerCase()] || 'default');

  // Перевод типов занятий
  const translateActivityType = (actType: string): string =>
    ({
      lecture: 'лекция',
      lab: 'лаб. работа',
      practice: 'практ. работа',
      seminar: 'семинар',
      credit: 'зачёт',
      exam: 'экзамен',
    }[actType.toLowerCase()] || actType);

  // Текущий день и время для подсветки
  const currentDayIndex = dayjs().day();
  const currentTimeIndex = TIME_SLOTS.findIndex((slot) => {
    const [start, end] = slot.time.split('-').map((t) => parseTime(t));
    const now = dayjs();
    return now.isAfter(start) && now.isBefore(end);
  });

  const formatTeacherFullName = (teacher: Teacher): string => {
    return `${teacher.lastName} ${teacher.firstName} ${teacher.middleName}`;
  };

  const formatTeacherInitials = (teacher: Teacher): string => {
    return `${teacher.lastName} ${teacher.firstName[0]}.${teacher.middleName[0]}.`;
  };

  // Метка недели (числитель/знаменатель)
  const WeekLabel: React.FC<{ isNumerator: boolean }> = ({ isNumerator }) => (
    <Tag className="week-label" color={isNumerator ? 'blue' : 'green'}>
      {isNumerator ? 'чс' : 'зн'}
    </Tag>
  );

  const renderLessonContent = (lesson: ScheduleItem) => {
    if (!lesson) return null;

    const discipline = lesson.disciplines[0];
    const shortName = discipline?.abbr || discipline?.shortName;
    const fullName = discipline?.fullName;

    return (
      <>
        <div className="lesson-header">
          <div className="lesson-name-container">
            {discipline ? (
              <>
                <span className="full-name">{fullName || 'Нет названия'}</span>
                <Tooltip
                  title={fullName}
                  mouseEnterDelay={0.1}
                  mouseLeaveDelay={0.15}
                  placement="topLeft"
                >
                  <span className="short-name">
                    {shortName || fullName || 'Нет названия'}
                  </span>
                </Tooltip>
                <div className="lesson-type">
                  <Tag color={getActivityTypeColor(discipline.actType)}>
                    {translateActivityType(discipline.actType)}
                  </Tag>
                </div>
              </>
            ) : (
              <span>Нет названия</span>
            )}
          </div>
          <div className="lesson-time">
            {lesson.startTime}–{lesson.endTime}
          </div>
        </div>
        <div className="lesson-location">
          {lesson.audiences.map((a) => `${a.building} ${a.name}`).join(', ')}
        </div>
        <Tooltip
          title={lesson.teachers.map(formatTeacherFullName).join('\n')}
          mouseEnterDelay={0.1}
          placement="topLeft"
          styles={{
            root: {
              maxWidth: '100%',
              whiteSpace: 'pre-line',
            },
          }}
        >
          <div className="lesson-teacher">
            {lesson.teachers.map(formatTeacherInitials).join(', ')}
          </div>
        </Tooltip>
      </>
    );
  };

  const renderCombinedCell = (
    groupId: string,
    day: number,
    timeSlot: TimeSlot
  ) => {
    const hasNumerator =
      (scheduleMap.ch[day]?.[timeSlot.slot]?.[groupId] || []).length > 0;
    const hasDenominator =
      (scheduleMap.zn[day]?.[timeSlot.slot]?.[groupId] || []).length > 0;

    if (!hasNumerator && !hasDenominator) return null;

    return (
      <div
        className="combined-lesson-card"
        style={{
          borderLeft: `3px solid ${getGroupColor(groupId, selectedGroups)}`,
        }}
        data-group-color={getGroupColor(groupId, selectedGroups)}
      >
        {(['ch', 'zn'] as const).map((week) => {
          const lessons =
            scheduleMap[week][day]?.[timeSlot.slot]?.[groupId] || [];
          const isNumerator = week === 'ch';

          return (
            <div
              key={week}
              className={`lesson-half ${
                isNumerator ? 'numerator' : 'denominator'
              }`}
            >
              {lessons.length > 0 && (
                <>
                  {renderLessonContent(lessons[0])}
                  <WeekLabel isNumerator={isNumerator} />
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderLessonCard = (lesson: ScheduleItem, groupId: string) => {
    if (!lesson) return null;

    return (
      <div
        key={`${lesson.id}_${groupId}_${
          lesson.disciplines[0]?.fullName
        }_${lesson.teachers.map((t) => t.id).join('_')}`}
        className="lesson-card"
        style={{
          borderLeft: `3px solid ${getGroupColor(groupId, selectedGroups)}`,
          backgroundColor: `${getGroupColor(groupId, selectedGroups)}10`,
        }}
      >
        {renderLessonContent(lesson)}
      </div>
    );
  };

  // Отображение таблицы расписания
  const renderScheduleTable = (weekType?: 'ch' | 'zn') => (
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
                <span
                  className="group-color-dot"
                  style={{
                    backgroundColor: getGroupColor(groupId, selectedGroups),
                  }}
                />
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
                      {displayMode === 'combined'
                        ? renderCombinedCell(groupId, day.id, timeSlot)
                        : weekType &&
                          (
                            scheduleMap[weekType][day.id]?.[timeSlot.slot]?.[
                              groupId
                            ] || []
                          ).map((lesson) => renderLessonCard(lesson, groupId))}
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

  const handleExportToExcel = useCallback(async () => {
    if (selectedGroups.length === 0) {
      message.warning('Выберите хотя бы одну группу для экспорта');
      return;
    }

    try {
      const wb = await generateExcelWorkbook(
        scheduleMap,
        selectedGroups,
        groups
      );
      const groupNames = selectedGroups
        .map((id) => groups.find((g) => g.uuid === id)?.name)
        .filter(Boolean)
        .join('_');
      const timestamp = dayjs().format('DD-MM-YYYY');
      const filename = `Расписание_${groupNames}_${timestamp}.xlsx`;

      await downloadExcel(wb, filename);
      message.success('Расписание успешно экспортировано');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Не удалось экспортировать расписание');
    }
  }, [scheduleMap, selectedGroups, groups]);

  return (
    <div className="schedule-viewer">
      <AdminControls
        isModalOpen={isAdminModalOpen}
        onModalOpen={() => setIsAdminModalOpen(true)}
        onModalClose={() => setIsAdminModalOpen(false)}
      />
      <Card className="schedule-controls-card">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space
            style={{
              width: '100%',
              justifyContent: 'space-between',
              backgroundColor: '#f5f5f5',
              padding: '12px',
              borderRadius: '6px',
            }}
          >
            <Space>
              <Button
                icon={<SettingOutlined />}
                type="primary"
                onClick={() => setIsAdminModalOpen(true)}
                style={{ fontWeight: 500 }}
              >
                Панель управления
              </Button>
              <Space.Compact>
                <Button
                  type="default"
                  onClick={() => setDisplayMode('separate')}
                  style={{
                    backgroundColor:
                      displayMode === 'separate' ? '#e6f4ff' : undefined,
                    borderColor:
                      displayMode === 'separate' ? '#91caff' : undefined,
                    color: displayMode === 'separate' ? '#0958d9' : undefined,
                  }}
                >
                  Раздельный вид
                </Button>
                <Button
                  type="default"
                  onClick={() => setDisplayMode('combined')}
                  style={{
                    backgroundColor:
                      displayMode === 'combined' ? '#e6f4ff' : undefined,
                    borderColor:
                      displayMode === 'combined' ? '#91caff' : undefined,
                    color: displayMode === 'combined' ? '#0958d9' : undefined,
                  }}
                >
                  Объединённый вид
                </Button>
              </Space.Compact>
              <Button
                icon={useShortNames ? <ExpandOutlined /> : <CompressOutlined />}
                onClick={() => setUseShortNames(!useShortNames)}
              >
                {useShortNames ? 'Полные названия' : 'Сокращённые названия'}
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportToExcel}
                disabled={selectedGroups.length === 0}
              >
                Экспорт в Excel
              </Button>
            </Space>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchScheduleData(true)}
                disabled={selectedGroups.length === 0}
              >
                Обновить
              </Button>
            </Space>
          </Space>

          <Space direction="vertical" style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space align="center">
                <Title level={4} style={{ margin: 0, paddingBottom: 4 }}>
                  Расписание занятий
                </Title>
                <Tooltip title="Вы можете выбрать несколько групп для отображения их общего расписания">
                  <InfoCircleOutlined
                    style={{ fontSize: '16px', color: '#1677ff' }}
                  />
                </Tooltip>
              </Space>
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
              notFoundContent="Ничего не нашлось"
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
        </Space>
      </Card>
      <Spin spinning={loading}>
        {selectedGroups.length > 0 ? (
          <div
            className={`schedule-container ${
              useShortNames ? 'use-short-names' : ''
            }`}
          >
            {displayMode === 'separate' ? (
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
                style={{
                  marginBottom: '-1px', // Удаление зазора между вкладками и таблицей
                  backgroundColor: '#fff',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                }}
                tabBarStyle={{
                  padding: '8px 8px 0',
                  marginBottom: 0,
                  justifyContent: 'flex-start',
                }}
                className="week-tabs"
              />
            ) : (
              renderScheduleTable()
            )}
          </div>
        ) : (
          <Empty description="Выберите группы для отображения расписания" />
        )}
      </Spin>
    </div>
  );
};

export default ScheduleViewer;
