import React, { ErrorInfo } from 'react';
import { Layout, Typography, ConfigProvider, theme, Alert, Button } from 'antd';
import ScheduleViewer from './components/ScheduleViewer';
import CurrentWeekIndicator from './components/CurrentWeekIndicator';
import './App.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          message="Error"
          description={this.state.error?.message || 'Something went wrong'}
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  console.log('App rendering');
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
        },
      }}
    >
      <ErrorBoundary>
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
      </ErrorBoundary>
    </ConfigProvider>
  );
};

export default App;
