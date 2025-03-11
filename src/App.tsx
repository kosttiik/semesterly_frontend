import React, { ErrorInfo, memo, useState } from 'react';
import { Layout, ConfigProvider, theme, Alert, Button } from 'antd';
import ScheduleViewer from './components/ScheduleViewer';
import CurrentWeekIndicator from './components/CurrentWeekIndicator';
import BlurText from './components/BlurText';
import AppBreadcrumbs from './components/AppBreadcrumbs';
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
              Перезагрузить страницу
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

const { Header, Content, Footer } = Layout;

const CurrentWeekIndicatorMemo = memo(CurrentWeekIndicator);
const ScheduleViewerMemo = memo(ScheduleViewer);

type ScheduleDisplayMode = 'separate' | 'combined';
type ViewType = 'groups' | 'teachers';

const App: React.FC = () => {
  const [displayMode, setDisplayMode] =
    useState<ScheduleDisplayMode>('separate');
  const [currentView, setCurrentView] = useState<ViewType>('groups');

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
            <div className="header-content">
              <BlurText
                text="Semesterly"
                delay={100}
                animateBy="letters"
                direction="top"
                className="app-title"
              />
              <AppBreadcrumbs
                currentView={currentView}
                onViewChange={setCurrentView}
              />
            </div>
          </Header>
          <Content style={{ padding: '24px', backgroundColor: '#f5f5f5' }}>
            <CurrentWeekIndicatorMemo />
            {currentView === 'groups' ? (
              <ScheduleViewerMemo
                displayMode={displayMode}
                setDisplayMode={setDisplayMode}
              />
            ) : (
              <div style={{ textAlign: 'center', margin: '48px 0' }}>
                <Alert
                  message="В разработке"
                  description="Функционал просмотра расписания преподавателей находится в разработке"
                  type="info"
                  showIcon
                />
              </div>
            )}
          </Content>
          <Footer style={{ textAlign: 'center', backgroundColor: '#fff' }}>
            Semesterly © Konstantin Samoylov, {new Date().getFullYear()}
          </Footer>
        </Layout>
      </ErrorBoundary>
    </ConfigProvider>
  );
};

export default App;
