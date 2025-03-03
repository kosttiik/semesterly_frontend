import React from 'react';
import { Layout, Typography } from 'antd';
import ScheduleViewer from './components/ScheduleViewer';
import CurrentWeekIndicator from './components/CurrentWeekIndicator';
import './App.css';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px' }}>
        <Title level={3} style={{ margin: '16px 0' }}>
          University Schedule Viewer
        </Title>
      </Header>
      <Content style={{ padding: '24px' }}>
        <CurrentWeekIndicator />
        <ScheduleViewer />
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        Schedule Viewer ©{new Date().getFullYear()}
      </Footer>
    </Layout>
  );
};

export default App;
