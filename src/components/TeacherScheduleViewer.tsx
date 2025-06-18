import React, { useState, useEffect, FC, useMemo, useCallback } from 'react';
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
import {
  ScheduleItem as OrigScheduleItem,
  Teacher,
  Group,
} from '../types/schedule';
import { scheduleService } from '../services/scheduleService';
import AdminControls from './AdminControls';
import { DAYS, TIME_SLOTS } from '../utils/constants';
import {
  generateTeacherExcelWorkbook,
  downloadExcel,
  generateMultiTeacherExcelWorkbook,
  exportTeacherPivotTable,
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

type ScheduleItem = OrigScheduleItem & { __teacherUuid?: string };

const TEACHER_COLORS = [
  '#1677ff', // синий
  '#f5222d', // красный
  '#722ed1', // фиолетовый
  '#52c41a', // зеленый
  '#fa8c16', // оранжевый
] as const;

type TeacherExportMode = 'default' | 'list' | 'pivot';

const TeacherScheduleViewer: FC<TeacherScheduleViewerProps> = ({
  displayMode,
  setDisplayMode,
}) => {
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [useShortNames, setUseShortNames] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedWeekType, setSelectedWeekType] = useState<'ch' | 'zn'>('ch');
  const [exportMode, setExportMode] = useState<TeacherExportMode>('pivot');

  // Для одного или нескольких преподавателей: группируем по ключу занятия, фильтруем по выбранным преподавателям если их несколько
  const organizedSchedule = useMemo(() => {
    function groupLessonsByKey(
      lessons: ScheduleItem[],
      filterTeacherUuids?: string[]
    ): Record<string, Record<number, Record<number, ScheduleItem[]>>> {
      const organized: Record<
        string,
        Record<number, Record<number, ScheduleItem[]>>
      > = {
        ch: {},
        zn: {},
      };
      const uniqueLessons = new Map<string, ScheduleItem>();

      lessons.forEach((item) => {
        if (
          filterTeacherUuids &&
          !filterTeacherUuids.includes(item.__teacherUuid ?? '')
        ) {
          return;
        }
        const key = [
          item.day,
          item.time,
          item.startTime,
          item.endTime,
          item.disciplines[0]?.fullName,
          item.disciplines[0]?.actType,
          item.audiences.map((a) => `${a.building}${a.name}`).join(','),
          item.__teacherUuid ?? '',
        ].join('_');
        if (!uniqueLessons.has(key)) {
          uniqueLessons.set(key, {
            ...item,
            groups: [...item.groups],
          });
        } else {
          const existingItem = uniqueLessons.get(key)!;
          // Добавить только уникальные группы
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
    }

    if (selectedTeachers.length <= 1) {
      return groupLessonsByKey(scheduleData);
    } else {
      return groupLessonsByKey(scheduleData, selectedTeachers);
    }
  }, [scheduleData, selectedTeachers]);

  const getTeacherColor = useCallback(
    (teacherUuid: string) => {
      const idx = selectedTeachers.indexOf(teacherUuid);
      return TEACHER_COLORS[idx % TEACHER_COLORS.length];
    },
    [selectedTeachers]
  );

  const fetchTeachers = useCallback(async () => {
    try {
      const fetchedTeachers = await scheduleService.getAllTeachers();
      setTeachers(fetchedTeachers);
    } catch (err) {
      console.error('Failed to fetch teachers:', err);
      message.error('Не удалось загрузить список преподавателей');
    }
  }, []);

  // Получить все занятия для выбранных преподавателей
  const fetchTeacherSchedules = useCallback(
    async (uuids: string[], forceRefresh = false) => {
      if (!uuids.length) {
        setScheduleData([]);
        return;
      }
      setLoading(true);
      try {
        if (forceRefresh) {
          uuids.forEach((uuid) =>
            scheduleService.clearScheduleCache(`teacher_${uuid}`)
          );
        }
        const allSchedules = await Promise.all(
          uuids.map((uuid) => scheduleService.getTeacherSchedule(uuid))
        );
        const merged = allSchedules.flat().map((item) => ({
          ...item,
          __teacherUuid: item.teachers[0]?.uuid || '',
        }));
        setScheduleData(merged);
      } catch {
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
    if (selectedTeachers.length === 1) {
      fetchTeacherSchedules(selectedTeachers);
    } else if (selectedTeachers.length > 1) {
      fetchTeacherSchedules(selectedTeachers);
    }
  }, [selectedTeachers, fetchTeacherSchedules]);

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

  // Получаем опции для Select
  const getTeacherOptions = useCallback(() => {
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
          minWidth: 0,
          wordBreak: 'break-word',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: maxContentWidth,
            minWidth: 0,
            overflow: 'hidden',
            wordBreak: 'break-word',
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
            maxWidth: 90,
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
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {lesson.startTime}–{lesson.endTime}
        </div>
      </div>
    );
  };

  const renderColoredLessonCard = (
    lesson: ScheduleItem,
    weekLabel?: React.ReactNode
  ) => {
    const teacherUuid: string =
      typeof lesson.__teacherUuid === 'string' ? lesson.__teacherUuid : '';
    const teacher = teachers.find((t) => t.uuid === teacherUuid);
    const color = getTeacherColor(teacherUuid);
    const discipline = lesson.disciplines[0];
    const shortName = discipline?.abbr || discipline?.shortName;
    const fullName = discipline?.fullName;
    return (
      <div
        className="lesson-card"
        style={{
          position: 'relative',
          borderLeft: `4px solid ${color}`,
          backgroundColor: `${color}10`,
          marginBottom: 0,
          marginTop: 0,
          marginLeft: 0,
          marginRight: 0,
          borderRadius: 8,
          boxShadow: 'none',
          width: '100%',
          minWidth: 0,
          padding: '12px 10px 10px 10px',
          overflow: 'hidden',
          wordBreak: 'break-word',
        }}
      >
        {weekLabel && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              left: 8,
              zIndex: 2,
            }}
          >
            {weekLabel}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: 6,
            color: '#888',
            fontSize: 13,
            fontWeight: 400,
            textAlign: 'right',
            background: 'transparent',
            paddingLeft: 4,
            paddingRight: 2,
            zIndex: 2,
            borderRadius: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {lesson.startTime}–{lesson.endTime}
        </div>
        <div
          style={{
            fontWeight: 500,
            color: color,
            marginBottom: 2,
            minWidth: 0,
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {teacher
            ? `${teacher.lastName} ${teacher.firstName[0]}.${teacher.middleName[0]}.`
            : ''}
        </div>
        <div
          style={{
            minWidth: 0,
            overflow: 'hidden',
            wordBreak: 'break-word',
            display: 'flex',
            alignItems: 'center',
          }}
        >
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
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  textAlign: 'left',
                  minWidth: 0,
                  fontSize: 14,
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
                maxWidth: 250,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                textAlign: 'left',
                minWidth: 0,
                fontSize: 14,
              }}
            >
              {fullName || 'Нет названия'}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#444',
            minWidth: 0,
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {lesson.audiences.map((a) => `${a.building} ${a.name}`).join(', ')}
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#1677ff',
            minWidth: 0,
            overflow: 'hidden',
            wordBreak: 'break-word',
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
      </div>
    );
  };

  const renderCombinedCell = (dayId: number, timeSlot: number) => {
    const numeratorLessons = organizedSchedule.ch[dayId]?.[timeSlot] || [];
    const denominatorLessons = organizedSchedule.zn[dayId]?.[timeSlot] || [];

    // Если нет занятий ни у одного преподавателя ни в одной из половин показываем прочерк
    if (
      selectedTeachers.length <= 1 &&
      !numeratorLessons.length &&
      !denominatorLessons.length
    ) {
      return (
        <div className="combined-lesson-card no-lesson">
          <div className="lesson-half no-lesson-cell">
            <span className="no-lesson-text">—</span>
          </div>
        </div>
      );
    }

    // Для одного преподавателя: обычная карточка с синим ободком
    if (selectedTeachers.length <= 1) {
      return (
        <div className="combined-lesson-card teacher-combined-highlight">
          <div className="lesson-half numerator">
            {numeratorLessons.length > 0
              ? numeratorLessons.map((lesson, idx) => (
                  <div
                    key={`num-${idx}`}
                    style={{ marginBottom: 2, width: '100%' }}
                  >
                    {renderLessonContent(lesson)}
                  </div>
                ))
              : null}
            <WeekLabel isNumerator={true} />
          </div>
          <div className="lesson-half denominator">
            {denominatorLessons.length > 0
              ? denominatorLessons.map((lesson, idx) => (
                  <div
                    key={`den-${idx}`}
                    style={{ marginBottom: 2, width: '100%' }}
                  >
                    {renderLessonContent(lesson)}
                  </div>
                ))
              : null}
            <WeekLabel isNumerator={false} />
          </div>
        </div>
      );
    }

    // Для нескольких преподавателей: цветные карточки на всю ширину
    const renderLessons = (lessons: ScheduleItem[], isNumerator: boolean) => {
      // Группируем по преподавателю
      const lessonsByTeacher: Record<string, ScheduleItem[]> = {};
      lessons.forEach((lesson) => {
        const uuid = lesson.__teacherUuid ?? '';
        if (!lessonsByTeacher[uuid]) lessonsByTeacher[uuid] = [];
        lessonsByTeacher[uuid].push(lesson);
      });

      // Если нет ни одной пары ничего не рендерим
      const hasAny = selectedTeachers.some(
        (teacherUuid) => (lessonsByTeacher[teacherUuid] || []).length > 0
      );
      if (!hasAny) return null;

      // Индикатор недели для карточки
      const weekLabel = <WeekLabel isNumerator={isNumerator} />;

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            width: '100%',
            padding: 0,
            margin: 0,
          }}
        >
          {selectedTeachers.map((teacherUuid) =>
            (lessonsByTeacher[teacherUuid] || []).map((lesson, idx) => (
              <div
                key={`${teacherUuid}-${idx}`}
                style={{
                  margin: 0,
                  width: '100%',
                  padding: 0,
                  position: 'relative',
                }}
              >
                {renderColoredLessonCard(
                  lesson,
                  idx === 0 &&
                    Object.values(lessonsByTeacher)
                      .flat()
                      .findIndex((l) => l === lesson) === 0
                    ? weekLabel
                    : undefined
                )}
              </div>
            ))
          )}
        </div>
      );
    };

    // Если обе половины пустые ничего не показываем
    const hasNumerator =
      numeratorLessons.length > 0 &&
      selectedTeachers.some(
        (teacherUuid) =>
          numeratorLessons.filter((l) => l.__teacherUuid === teacherUuid)
            .length > 0
      );
    const hasDenominator =
      denominatorLessons.length > 0 &&
      selectedTeachers.some(
        (teacherUuid) =>
          denominatorLessons.filter((l) => l.__teacherUuid === teacherUuid)
            .length > 0
      );
    if (!hasNumerator && !hasDenominator) {
      return null;
    }

    return (
      <div className="combined-lesson-card">
        <div className="lesson-half numerator">
          {hasNumerator ? renderLessons(numeratorLessons, true) : null}
        </div>
        <div className="lesson-half denominator">
          {hasDenominator ? renderLessons(denominatorLessons, false) : null}
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
                  {selectedTeachers.length <= 1
                    ? displayMode === 'combined'
                      ? renderCombinedCell(day.id, timeSlot.slot)
                      : weekType &&
                        organizedSchedule[weekType as 'ch' | 'zn'][day.id]?.[
                          timeSlot.slot
                        ]?.map((lesson, idx) => (
                          <React.Fragment
                            key={`${weekType}-${day.id}-${
                              timeSlot.slot
                            }-${idx}-${lesson.id || 'noid'}`}
                          >
                            {renderLessonContent(lesson)}
                          </React.Fragment>
                        ))
                    : displayMode === 'combined'
                    ? renderCombinedCell(day.id, timeSlot.slot)
                    : weekType &&
                      organizedSchedule[weekType][day.id]?.[timeSlot.slot]?.map(
                        (lesson, idx) => (
                          <React.Fragment
                            key={`${weekType}-${day.id}-${
                              timeSlot.slot
                            }-${idx}-${lesson.id || 'noid'}`}
                          >
                            {renderColoredLessonCard(lesson)}
                          </React.Fragment>
                        )
                      )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

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
    if (selectedTeachers.length === 0) {
      message.warning('Выберите хотя бы одного преподавателя для экспорта');
      return;
    }
    try {
      let wb;
      let filename;
      const teacherNames = selectedTeachers
        .map(
          (uuid) =>
            teachers.find((t) => t.uuid === uuid)?.lastName +
            ' ' +
            teachers.find((t) => t.uuid === uuid)?.firstName +
            ' ' +
            teachers.find((t) => t.uuid === uuid)?.middleName
        )
        .filter(Boolean)
        .join('_');
      const timestamp = dayjs().format('DD-MM-YYYY');

      if (exportMode === 'pivot') {
        // Режим сводной таблицы
        wb = await exportTeacherPivotTable({
          teachers: teachers.filter((t) => selectedTeachers.includes(t.uuid)),
          scheduleMap: teacherScheduleMap,
          groups,
          weekType: displayMode === 'separate' ? selectedWeekType : undefined,
        });
        filename = `Расписание_Сводная_${teacherNames}_${
          displayMode === 'separate'
            ? (selectedWeekType === 'ch' ? 'Числитель' : 'Знаменатель') + '_'
            : ''
        }${timestamp}.xlsx`;
      } else if (selectedTeachers.length === 1) {
        const teacherObj = teachers.find((t) => t.uuid === selectedTeachers[0]);
        const teacherName = teacherObj
          ? `${teacherObj.lastName} ${teacherObj.firstName} ${teacherObj.middleName}`.replace(
              /\s+/g,
              ' '
            )
          : 'Преподаватель';

        if (displayMode === 'separate') {
          // Для одного преподавателя в раздельном режиме экспортировать только одну неделю
          wb = await generateMultiTeacherExcelWorkbook(
            [selectedTeachers[0]],
            teachers,
            {
              ...teacherScheduleMap,
              ch: selectedWeekType === 'ch' ? teacherScheduleMap.ch : {},
              zn: selectedWeekType === 'zn' ? teacherScheduleMap.zn : {},
            },
            groups
          );
          filename = `Расписание_${teacherName}_${
            selectedWeekType === 'ch' ? 'Числитель' : 'Знаменатель'
          }_${timestamp}.xlsx`;
        } else {
          wb = await generateTeacherExcelWorkbook(
            teacherName,
            teacherScheduleMap,
            groups
          );
          filename = `Расписание_${teacherName}_${timestamp}.xlsx`;
        }
      } else {
        if (displayMode === 'separate') {
          wb = await generateMultiTeacherExcelWorkbook(
            selectedTeachers,
            teachers,
            {
              ...teacherScheduleMap,
              ch: selectedWeekType === 'ch' ? teacherScheduleMap.ch : {},
              zn: selectedWeekType === 'zn' ? teacherScheduleMap.zn : {},
            },
            groups
          );
          filename = `Расписание_${teacherNames}_${
            selectedWeekType === 'ch' ? 'Числитель' : 'Знаменатель'
          }_${timestamp}.xlsx`;
        } else {
          wb = await generateMultiTeacherExcelWorkbook(
            selectedTeachers,
            teachers,
            teacherScheduleMap,
            groups
          );
          filename = `Расписание_${teacherNames}_${timestamp}.xlsx`;
        }
      }

      await downloadExcel(wb, filename);
      message.success('Расписание успешно экспортировано');
    } catch {
      message.error('Не удалось экспортировать расписание');
    }
  }, [
    selectedTeachers,
    teachers,
    teacherScheduleMap,
    groups,
    displayMode,
    selectedWeekType,
    exportMode,
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
          CacheService.remove('teachers');
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
                disabled={selectedTeachers.length === 0}
              >
                Экспорт в Excel
              </Button>
              <Select
                value={exportMode}
                onChange={setExportMode}
                style={{ width: 160 }}
                options={[
                  // { label: 'Обычный экспорт', value: 'default' }, // УБРАНО
                  { label: 'Список', value: 'list' },
                  { label: 'Сводная таблица', value: 'pivot' },
                ]}
              />
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
              mode="multiple"
              showSearch
              style={{ width: '100%' }}
              placeholder="Выберите преподавателя"
              optionFilterProp="label"
              value={selectedTeachers}
              onChange={setSelectedTeachers}
              filterOption={filterTeacher}
              notFoundContent="Ничего не нашлось"
              loading={loading}
              options={getTeacherOptions()}
              tagRender={(props) => {
                const { value, label, closable, onClose } = props;
                const color = getTeacherColor((value as string) ?? '');
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
              className="teacher-select-multiline"
            />
          </Space>
        </Space>
      </Card>
      <Spin spinning={loading}>
        {selectedTeachers.length > 0 ? (
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
