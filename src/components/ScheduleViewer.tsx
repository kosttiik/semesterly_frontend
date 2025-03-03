import React, { useState, useEffect } from 'react';
import { Table, Tabs, Select, Card, Tag, Typography, Space, Spin } from 'antd';
import { ScheduleItem } from '../types/schedule';
import { getGroupSchedule } from '../services/scheduleService';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface ScheduleViewerProps {
  initialGroupIds?: string[];
}

const ScheduleViewer: React.FC<ScheduleViewerProps> = ({
  initialGroupIds = [],
}) => {
  const [selectedGroups, setSelectedGroups] =
    useState<string[]>(initialGroupIds);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Days of the week in Russian
  const days = [
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота',
  ];

  // Time slots
  const timeSlots = [
    { slot: 1, time: '08:30-10:00' },
    { slot: 2, time: '10:10-11:40' },
    { slot: 3, time: '11:50-13:20' },
    { slot: 4, time: '14:05-15:35' },
    { slot: 5, time: '15:50-17:20' },
    { slot: 6, time: '17:30-19:00' },
    { slot: 7, time: '19:10-20:40' },
  ];

  const fetchScheduleData = async () => {
    if (selectedGroups.length === 0) return;

    setLoading(true);
    try {
      // Fetch schedule for all selected groups
      const promises = selectedGroups.map((groupId) =>
        getGroupSchedule(groupId)
      );
      const results = await Promise.all(promises);

      // Combine all schedule items
      const combinedData = results.flat();
      setScheduleData(combinedData);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, [selectedGroups]);

  // Filter classes by week type ("ch" for numerator, "zn" for denominator, "all" for both)
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

  // Render class information
  const renderClassInfo = (classes: ScheduleItem[]) => {
    if (classes.length === 0) return null;

    return classes.map((cls) => (
      <Card
        key={cls.id}
        size="small"
        className="class-card"
        style={{ marginBottom: 8 }}
      >
        <div>
          <Text strong>
            {cls.disciplines[0]?.fullName || cls.disciplines[0]?.abbr}
          </Text>
          <Tag color="blue" style={{ marginLeft: 8 }}>
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
            {cls.groups.map((g) => g.name).join(', ')}
          </Text>
        </div>
      </Card>
    ));
  };

  // Generate columns for schedule table
  const generateColumns = (weekType: 'ch' | 'zn') => {
    return [
      {
        title: 'Время',
        dataIndex: 'time',
        key: 'time',
        width: 100,
      },
      ...days.map((day, index) => ({
        title: day,
        dataIndex: `day${index + 1}`,
        key: `day${index + 1}`,
        render: (_: any, record: any) =>
          renderClassInfo(
            getClassesByWeekType(index + 1, record.slot, weekType)
          ),
      })),
    ];
  };

  // Generate data source for the table
  const generateDataSource = () => {
    return timeSlots.map((slot) => ({
      key: slot.slot,
      time: slot.time,
      slot: slot.slot,
    }));
  };

  return (
    <div className="schedule-viewer">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Card>
          <Title level={4}>Расписание</Title>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Выберите группы"
            value={selectedGroups}
            onChange={setSelectedGroups}
          >
            {/* Replace this with your actual group data */}
            <Option value="2022686e-8610-11ea-9007-005056960017">
              ИУ5Ц-101Б
            </Option>
            <Option value="20227214-8610-11ea-925f-005056960017">
              ИУ5Ц-102Б
            </Option>
            <Option value="16093ef2-01f1-11ed-a9b0-d15fad5aaa3d">
              ИУ5Ц-103Б
            </Option>
            <Option value="a55a0f28-01f1-11ed-a9b0-d15fad5aaa3d">
              ИУ5Ц-104Б
            </Option>
          </Select>
        </Card>

        <Spin spinning={loading}>
          <Tabs defaultActiveKey="numerator">
            <TabPane tab="Числитель" key="numerator">
              <Table
                columns={generateColumns('ch')}
                dataSource={generateDataSource()}
                pagination={false}
                bordered
                size="small"
              />
            </TabPane>
            <TabPane tab="Знаменатель" key="denominator">
              <Table
                columns={generateColumns('zn')}
                dataSource={generateDataSource()}
                pagination={false}
                bordered
                size="small"
              />
            </TabPane>
          </Tabs>
        </Spin>
      </Space>
    </div>
  );
};

export default ScheduleViewer;
