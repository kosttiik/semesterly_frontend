import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Select,
  Card,
  Typography,
  Space,
  Spin,
  Empty,
  message,
  Tooltip,
  Button,
  Tabs,
  Tag,
} from 'antd';
import {
  ReloadOutlined,
  InfoCircleOutlined,
  CompressOutlined,
  ExpandOutlined,
  SettingOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { ScheduleItem, Teacher, Group } from '../types/schedule';
import { scheduleService } from '../services/scheduleService';
import AdminControls from './AdminControls';
import { DAYS, TIME_SLOTS } from '../utils/constants';
import {
  generateTeacherExcelWorkbook,
  downloadExcel,
  generateTeacherExcelWorkbookForWeek, // добавлено
} from '../utils/excelExport';
import dayjs from 'dayjs';
import '../App.css';
import CacheService from '../services/cacheService';

const { Title } = Typography;

// Цвета для типов занятий
const getActivityTypeColor = (actType: string): string =>
  ({
    лекция: 'blue',
    'лаб. работа': 'purple',
    'практ. работа': 'green',
    семинар: 'orange',
    зачёт: 'gold',
    экзамен: 'red',
    lecture: 'blue',
    laboratory: 'purple',
    practice: 'green',
    seminar: 'orange',
    credit: 'gold',
    exam: 'red',
    лабораторная: 'purple',
    практика: 'green',
    зачет: 'gold',
  }[actType.toLowerCase()] || 'default');

// Функция перевода типов занятий
const translateActivityType = (actType: string): string =>
  ({
    lecture: 'лекция',
    lab: 'лаб. работа',
    practice: 'практ. работа',
    seminar: 'семинар',
    credit: 'зачёт',
    exam: 'экзамен',
  }[actType.toLowerCase()] || actType);

interface TeacherScheduleViewerProps {
  displayMode: 'separate' | 'combined';
  setDisplayMode: (mode: 'separate' | 'combined') => void;
}

const TeacherScheduleViewer: React.FC<TeacherScheduleViewerProps> = ({
  displayMode,
  setDisplayMode,
}) => {
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [useShortNames, setUseShortNames] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedWeekType, setSelectedWeekType] = useState<'ch' | 'zn'>('ch');

  const getLessonKey = (item: ScheduleItem): string => {
    return [
      item.day,
      item.time,
      item.startTime,
      item.endTime,
      item.disciplines[0]?.fullName,
      item.disciplines[0]?.actType,
      item.audiences.map((a) => `${a.building}${a.name}`).join(','),
    ].join('_');
  };

  const organizedSchedule = useMemo(() => {
    const organized: Record<
      string,
      Record<number, Record<number, ScheduleItem[]>>
    > = {
      ch: {},
      zn: {},
    };

    const uniqueLessons = new Map<string, ScheduleItem>();

    scheduleData.forEach((item) => {
      const key = getLessonKey(item);
      if (!uniqueLessons.has(key)) {
        uniqueLessons.set(key, {
          ...item,
          groups: [...item.groups],
        });
      } else {
        const existingItem = uniqueLessons.get(key)!;
        const newGroups = item.groups.filter(
          (newGroup) =>
            !existingItem.groups.some(
              (existingGroup) => existingGroup.uuid === newGroup.uuid
            )
        );
        existingItem.groups.push(...newGroups);
      }
    });

    Array.from(uniqueLessons.values()).forEach((item) => {
      const weeks = item.week === 'all' ? ['ch', 'zn'] : [item.week];
      weeks.forEach((week) => {
        if (!organized[week][item.day]) {
          organized[week][item.day] = {};
        }
        if (!organized[week][item.day][item.time]) {
          organized[week][item.day][item.time] = [];
        }
        organized[week][item.day][item.time].push(item);
      });
    });

    return organized;
  }, [scheduleData]);

  const fetchTeachers = useCallback(async () => {
    try {
      const fetchedTeachers = await scheduleService.getAllTeachers();
      setTeachers(fetchedTeachers);
    } catch (err) {
      console.error('Failed to fetch teachers:', err);
      message.error('Не удалось загрузить список преподавателей');
    }
  }, []);

  const fetchTeacherSchedule = useCallback(
    async (uuid: string, forceRefresh = false) => {
      if (!uuid) return;

      setLoading(true);
      try {
        if (forceRefresh) {
          scheduleService.clearScheduleCache(`teacher_${uuid}`);
        }
        const schedule = await scheduleService.getTeacherSchedule(uuid);
        setScheduleData(schedule);
      } catch (err) {
        console.error('Failed to fetch teacher schedule:', err);
        message.error('Не удалось загрузить расписание преподавателя');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scheduleService
      .getAllGroups()
      .then(setGroups)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      fetchTeacherSchedule(selectedTeacher);
    }
  }, [selectedTeacher, fetchTeacherSchedule]);

  const filterTeacher = (
    input: string,
    option?: { label: string; value: string; searchValue?: string }
  ) => {
    if (!option) return false;
    const search = input.trim().toLowerCase();
    return (
      option.label.toLowerCase().includes(search) ||
      (option.searchValue?.includes(search) ?? false)
    );
  };

  const formatTeacherName = (teacher: Teacher) => {
    return `${teacher.lastName} ${teacher.firstName} ${teacher.middleName}`.trim();
  };

  const getTeacherOptions = useCallback(() => {
    // Удаляем дубликаты по uuid с помощью Map
    const uniqueTeachers = Array.from(
      new Map(teachers.map((teacher) => [teacher.uuid, teacher])).values()
    );

    return uniqueTeachers.map((teacher) => ({
      label: formatTeacherName(teacher),
      value: teacher.uuid,
      searchValue: [
        teacher.lastName,
        teacher.firstName,
        teacher.middleName,
        `${teacher.lastName} ${teacher.firstName}`,
        `${teacher.lastName} ${teacher.firstName} ${teacher.middleName}`,
        `${teacher.firstName} ${teacher.lastName}`,
      ]
        .join(' ')
        .toLowerCase(),
    }));
  }, [teachers]);

  const renderLessonContent = (
    lesson: ScheduleItem,
    compact: boolean = false
  ) => {
    if (!lesson) return null;
    const discipline = lesson.disciplines[0];
    const shortName = discipline?.abbr || discipline?.shortName;
    const fullName = discipline?.fullName;

    const timeWidth = compact ? 65 : 75;
    const timePadding = compact ? 6 : 10;
    const maxContentWidth = `calc(100% - ${timeWidth + timePadding * 2}px)`;

    return (
      <div
        className={`lesson-card${compact ? ' compact' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: compact ? 40 : 50,
          padding: compact ? '4px 6px 4px 6px' : '6px 10px 6px 10px',
          marginBottom: compact ? 2 : 4,
          boxSizing: 'border-box',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: maxContentWidth,
            minWidth: 0,
          }}
        >
          {discipline ? (
            <>
              {useShortNames ? (
                <Tooltip
                  title={fullName}
                  mouseEnterDelay={0.1}
                  mouseLeaveDelay={0.15}
                  placement="topLeft"
                >
                  <span
                    className="short-name"
                    style={{
                      fontWeight: 400,
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                      textAlign: 'left',
                      minWidth: 0,
                    }}
                  >
                    {shortName || fullName || 'Нет названия'}
                  </span>
                </Tooltip>
              ) : (
                <span
                  className="full-name"
                  title={fullName}
                  style={{
                    fontWeight: 400,
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                    textAlign: 'left',
                    minWidth: 0,
                  }}
                >
                  {fullName || 'Нет названия'}
                </span>
              )}

              <div className="lesson-type" style={{ marginTop: 2 }}>
                <Tag color={getActivityTypeColor(discipline.actType)}>
                  {translateActivityType(discipline.actType)}
                </Tag>
              </div>
            </>
          ) : (
            <span>Нет названия</span>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              marginTop: 2,
              minWidth: 0,
            }}
          >
            <div
              className="lesson-groups"
              style={{
                color: '#1677ff',
                cursor: lesson.groups.length > 1 ? 'help' : 'default',
                fontWeight: 400,
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
              }}
            >
              {lesson.groups.length === 1 ? (
                lesson.groups[0].name
              ) : (
                <Tooltip
                  title={lesson.groups.map((g) => g.name).join('\n')}
                  mouseEnterDelay={0.1}
                  mouseLeaveDelay={0.15}
                  placement="topLeft"
                  overlayInnerStyle={{
                    maxWidth: 320,
                    whiteSpace: 'pre-line',
                  }}
                >
                  <span>{lesson.groups.length} групп(ы)</span>
                </Tooltip>
              )}
            </div>
            <div
              className="lesson-location"
              style={{
                fontSize: 13,
                fontWeight: 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: '#444',
                width: '100%',
              }}
            >
              {lesson.audiences
                .map((a) => `${a.building} ${a.name}`)
                .join(', ')}
            </div>
          </div>
        </div>

        <div
          className="lesson-time"
          style={{
            position: 'absolute',
            right: compact ? 6 : 10,
            top: compact ? 4 : 6,
            width: timeWidth,
            color: '#888',
            fontSize: 13,
            fontWeight: 400,
            textAlign: 'right',
            background: 'white',
            paddingLeft: 4,
            paddingRight: 2,
            zIndex: 2,
            borderRadius: 4,
            whiteSpace: 'nowrap',
            overflow: 'visible',
          }}
        >
          {lesson.startTime}–{lesson.endTime}
        </div>
      </div>
    );
  };

  const renderScheduleTable = (weekType?: 'ch' | 'zn') => (
    <div className={`schedule-table-container teacher-schedule`}>
      <table className="schedule-table">
        <thead>
          <tr>
            <th className="time-column">Время</th>
            {DAYS.map((day) => (
              <th key={day.id}>{day.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIME_SLOTS.map((timeSlot) => (
            <tr key={timeSlot.slot}>
              <td className="time-cell">{timeSlot.time}</td>
              {DAYS.map((day) => (
                <td key={day.id} className="schedule-cell">
                  {displayMode === 'combined'
                    ? renderCombinedCell(day.id, timeSlot.slot)
                    : weekType &&
                      organizedSchedule[weekType as 'ch' | 'zn'][day.id]?.[
                        timeSlot.slot
                      ]?.map((lesson, idx) => (
                        <React.Fragment
                          key={`${weekType}-${day.id}-${timeSlot.slot}-${idx}-${
                            lesson.id || 'noid'
                          }`}
                        >
                          {renderLessonContent(lesson)}
                        </React.Fragment>
                      ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCombinedCell = (dayId: number, timeSlot: number) => {
    const numeratorLessons = organizedSchedule.ch[dayId]?.[timeSlot] || [];
    const denominatorLessons = organizedSchedule.zn[dayId]?.[timeSlot] || [];

    if (!numeratorLessons.length && !denominatorLessons.length) {
      return (
        <div className="combined-lesson-card no-lesson">
          <div className="lesson-half no-lesson-cell">
            <span className="no-lesson-text">—</span>
          </div>
        </div>
      );
    }

    return (
      <div className="combined-lesson-card teacher-combined-highlight">
        <div className="lesson-half numerator">
          {numeratorLessons.length > 0 ? (
            <>
              {numeratorLessons.map((lesson, idx) => (
                <React.Fragment
                  key={`num-${dayId}-${timeSlot}-${idx}-${lesson.id || 'noid'}`}
                >
                  {renderLessonContent(lesson, true)}
                </React.Fragment>
              ))}
              <WeekLabel isNumerator={true} />
            </>
          ) : (
            <span className="no-lesson-text">—</span>
          )}
        </div>
        <div className="lesson-half denominator">
          {denominatorLessons.length > 0 ? (
            <>
              {denominatorLessons.map((lesson, idx) => (
                <React.Fragment
                  key={`den-${dayId}-${timeSlot}-${idx}-${lesson.id || 'noid'}`}
                >
                  {renderLessonContent(lesson, true)}
                </React.Fragment>
              ))}
              <WeekLabel isNumerator={false} />
            </>
          ) : (
            <span className="no-lesson-text">—</span>
          )}
        </div>
      </div>
    );
  };

  const WeekLabel: React.FC<{ isNumerator: boolean }> = ({ isNumerator }) => (
    <Tag className="week-label" color={isNumerator ? 'blue' : 'green'}>
      {isNumerator ? 'чс' : 'зн'}
    </Tag>
  );

  const teacherScheduleMap = useMemo(() => {
    type WeekType = 'ch' | 'zn';
    const map: Record<
      WeekType,
      { [day: number]: { [slot: number]: ScheduleItem[] } }
    > = { ch: {}, zn: {} };
    (['ch', 'zn'] as WeekType[]).forEach((weekType) => {
      map[weekType] = {};
      DAYS.forEach((day) => {
        map[weekType][day.id] = {};
        TIME_SLOTS.forEach((slot) => {
          map[weekType][day.id][slot.slot] =
            organizedSchedule[weekType][day.id]?.[slot.slot] || [];
        });
      });
    });
    return map;
  }, [organizedSchedule]);

  // Экспорт в Excel
  const handleExportToExcel = useCallback(async () => {
    if (!selectedTeacher) {
      message.warning('Выберите преподавателя для экспорта');
      return;
    }
    try {
      const teacherObj = teachers.find((t) => t.uuid === selectedTeacher);
      const teacherName = teacherObj
        ? `${teacherObj.lastName} ${teacherObj.firstName} ${teacherObj.middleName}`.replace(
            /\s+/g,
            ' '
          )
        : 'Преподаватель';

      let wb;
      let filename;
      const timestamp = dayjs().format('DD-MM-YYYY');

      if (displayMode === 'separate') {
        // Экспорт только выбранной недели
        wb = await generateTeacherExcelWorkbookForWeek(
          teacherName,
          selectedWeekType,
          teacherScheduleMap,
          groups
        );
        filename = `Расписание_${teacherName}_${
          selectedWeekType === 'ch' ? 'Числитель' : 'Знаменатель'
        }_${timestamp}.xlsx`;
      } else {
        // Старый экспорт для объединённого вида
        wb = await generateTeacherExcelWorkbook(
          teacherName,
          teacherScheduleMap,
          groups
        );
        filename = `Расписание_${teacherName}_${timestamp}.xlsx`;
      }

      await downloadExcel(wb, filename);
      message.success('Расписание успешно экспортировано');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Не удалось экспортировать расписание');
    }
  }, [
    selectedTeacher,
    teachers,
    teacherScheduleMap,
    groups,
    displayMode,
    selectedWeekType,
  ]);

  // Обновить преподавателей и сбросить их кэш
  const handleRefreshTeachers = useCallback(async () => {
    CacheService.remove('teachers');
    await fetchTeachers();
    message.success('Преподаватели обновлены');
  }, [fetchTeachers]);

  return (
    <div className="teacher-schedule-viewer-root">
      <AdminControls
        isModalOpen={isAdminModalOpen}
        onModalOpen={() => setIsAdminModalOpen(true)}
        onModalClose={() => setIsAdminModalOpen(false)}
        onDatabaseUpdated={() => {
          fetchTeachers();
          scheduleService
            .getAllGroups()
            .then(setGroups)
            .catch(() => {});
        }}
        onDatabaseCleared={() => {
          fetchTeachers();
          scheduleService
            .getAllGroups()
            .then(setGroups)
            .catch(() => {});
        }}
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
                  className={
                    displayMode === 'separate' ? 'view-mode-btn-active' : ''
                  }
                >
                  Раздельный вид
                </Button>
                <Button
                  type="default"
                  onClick={() => setDisplayMode('combined')}
                  className={
                    displayMode === 'combined' ? 'view-mode-btn-active' : ''
                  }
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
                disabled={!selectedTeacher}
              >
                Экспорт в Excel
              </Button>
            </Space>
            <Button icon={<ReloadOutlined />} onClick={handleRefreshTeachers}>
              Обновить
            </Button>
          </Space>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space align="center">
              <Title level={4} style={{ margin: 0, paddingBottom: 4 }}>
                Расписание преподавателя
              </Title>
              <Tooltip title="Выберите преподавателя для просмотра его расписания">
                <InfoCircleOutlined style={{ color: '#1677ff' }} />
              </Tooltip>
            </Space>

            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder="Выберите преподавателя"
              optionFilterProp="label"
              value={selectedTeacher}
              onChange={setSelectedTeacher}
              filterOption={filterTeacher}
              notFoundContent="Ничего не нашлось"
              loading={loading}
              options={getTeacherOptions()}
            />
          </Space>
        </Space>
      </Card>

      <Spin spinning={loading}>
        {selectedTeacher ? (
          <div
            className={`schedule-container ${
              useShortNames ? 'use-short-names' : ''
            }`}
          >
            {displayMode === 'separate' ? (
              <Tabs
                activeKey={selectedWeekType}
                onChange={(key) => setSelectedWeekType(key as 'ch' | 'zn')}
                type="card"
                items={[
                  {
                    key: 'ch',
                    label: 'Числитель',
                    children: renderScheduleTable('ch'),
                  },
                  {
                    key: 'zn',
                    label: 'Знаменатель',
                    children: renderScheduleTable('zn'),
                  },
                ]}
                style={{
                  marginBottom: '-1px',
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
          <Empty
            style={{ marginTop: 16 }}
            description="Выберите преподавателя для отображения расписания"
          />
        )}
      </Spin>
    </div>
  );
};

export default TeacherScheduleViewer;
