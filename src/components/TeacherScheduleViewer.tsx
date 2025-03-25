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
} from '@ant-design/icons';
import { ScheduleItem, Teacher } from '../types/schedule';
import { scheduleService } from '../services/scheduleService';
import AdminControls from './AdminControls';
import { DAYS, TIME_SLOTS } from '../utils/constants';

const { Title } = Typography;

// Цвета для типов занятий
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
    зачет: 'gold', // Вариант без буквы ё
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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [useShortNames, setUseShortNames] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Add this helper function after the existing TeacherScheduleViewer interface
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

  // Replace the existing organizedSchedule useMemo with this updated version
  const organizedSchedule = useMemo(() => {
    const organized: Record<
      string,
      Record<number, Record<number, ScheduleItem[]>>
    > = {
      ch: {},
      zn: {},
    };

    // First, deduplicate lessons using a Map
    const uniqueLessons = new Map<string, ScheduleItem>();

    scheduleData.forEach((item) => {
      const key = getLessonKey(item);
      if (!uniqueLessons.has(key)) {
        // For the first occurrence, store the item
        uniqueLessons.set(key, {
          ...item,
          groups: [...item.groups], // Keep groups from the first occurrence
        });
      } else {
        // For subsequent occurrences, merge the groups
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

    // Now organize the deduplicated lessons
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
  }, [fetchTeachers]);

  useEffect(() => {
    if (selectedTeacher) {
      fetchTeacherSchedule(selectedTeacher);
    }
  }, [selectedTeacher, fetchTeacherSchedule]);

  // Add search filter function
  const filterTeacher = (
    input: string,
    option?: { label: string; value: string }
  ) => {
    if (!option) return false;

    const searchTerms = input.toLowerCase().split(' ');
    const teacherName = option.label.toLowerCase();

    // Check if all search terms are found in the teacher name
    return searchTerms.every((term) => teacherName.includes(term));
  };

  // Format teacher name helper
  const formatTeacherName = (teacher: Teacher) => {
    return `${teacher.lastName} ${teacher.firstName} ${teacher.middleName}`.trim();
  };

  // Add search options with additional searchable fields
  const getTeacherOptions = () => {
    return teachers.map((teacher) => ({
      label: formatTeacherName(teacher),
      value: teacher.uuid,
      searchValue:
        `${teacher.lastName} ${teacher.firstName} ${teacher.middleName} ${teacher.lastName}`.toLowerCase(),
    }));
  };

  const renderLessonContent = (lesson: ScheduleItem) => {
    if (!lesson) return null;

    const discipline = lesson.disciplines[0];
    const shortName = discipline?.abbr || discipline?.shortName;
    const fullName = discipline?.fullName;

    return (
      <div className="lesson-card">
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
        {lesson.groups.length === 1 ? (
          <div
            className="lesson-groups"
            style={{ color: '#000', cursor: 'default' }}
          >
            {lesson.groups[0].name}
          </div>
        ) : (
          <Tooltip
            title={lesson.groups.map((g) => g.name).join('\n')}
            mouseEnterDelay={0.1}
            mouseLeaveDelay={0.15}
            placement="topLeft"
            styles={{
              root: {
                maxWidth: '100%',
                whiteSpace: 'pre-line',
              },
            }}
          >
            <div className="lesson-groups">{lesson.groups.length} групп(ы)</div>
          </Tooltip>
        )}
        <div className="lesson-location">
          {lesson.audiences.map((a) => `${a.building} ${a.name}`).join(', ')}
        </div>
      </div>
    );
  };

  const renderScheduleTable = (weekType?: 'ch' | 'zn') => (
    <div className="schedule-table-container teacher-schedule">
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
                      organizedSchedule[weekType][day.id]?.[timeSlot.slot]?.map(
                        (lesson) => renderLessonContent(lesson)
                      )}
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

    if (!numeratorLessons.length && !denominatorLessons.length) return null;

    return (
      <div className="combined-lesson-card">
        <div className="lesson-half numerator">
          {numeratorLessons.map((lesson) => renderLessonContent(lesson))}
          {numeratorLessons.length > 0 && <WeekLabel isNumerator={true} />}
        </div>
        <div className="lesson-half denominator">
          {denominatorLessons.map((lesson) => renderLessonContent(lesson))}
          {denominatorLessons.length > 0 && <WeekLabel isNumerator={false} />}
        </div>
      </div>
    );
  };

  const WeekLabel: React.FC<{ isNumerator: boolean }> = ({ isNumerator }) => (
    <Tag className="week-label" color={isNumerator ? 'blue' : 'green'}>
      {isNumerator ? 'чс' : 'зн'}
    </Tag>
  );

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
            </Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() =>
                selectedTeacher && fetchTeacherSchedule(selectedTeacher, true)
              }
              disabled={!selectedTeacher}
            >
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
              optionFilterProp="searchValue"
              value={selectedTeacher}
              onChange={setSelectedTeacher}
              searchValue={searchTerm}
              onSearch={setSearchTerm}
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
