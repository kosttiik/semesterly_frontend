import React from 'react';
import { Layout, Typography, ConfigProvider, theme } from 'antd';
import ScheduleViewer from './components/ScheduleViewer';
import CurrentWeekIndicator from './components/CurrentWeekIndicator';
import './App.css';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
        },
      }}
    >
      <Layout className="layout" style={{ minHeight: '100vh' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', height: '100%' }}
          >
            <Title level={3} style={{ margin: '0', color: '#1677ff' }}>
              Расписание занятий
            </Title>
          </div>
        </Header>
        <Content style={{ padding: '24px', backgroundColor: '#f5f5f5' }}>
          <CurrentWeekIndicator />
          <ScheduleViewer />
        </Content>
        <Footer style={{ textAlign: 'center', backgroundColor: '#fff' }}>
          Schedule Viewer ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </ConfigProvider>
  );
};

export default App;
