import React, { ErrorInfo, memo, useState, useEffect } from 'react';
import {
  Layout,
  ConfigProvider,
  theme,
  Alert,
  Button,
  Modal,
  Form,
  Input,
  message,
} from 'antd';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import ScheduleViewer from './components/ScheduleViewer';
import TeacherScheduleViewer from './components/TeacherScheduleViewer';
import CurrentWeekIndicator from './components/CurrentWeekIndicator';
import BlurText from './components/BlurText';
import AppBreadcrumbs from './components/AppBreadcrumbs';
import './App.css';
import { AuthResponse } from './types/auth';
import {
  saveAuthToStorage,
  clearAuthStorage,
  clearPortalCookies,
} from './services/authService';

// Компонент для обработки ошибок в приложении
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
    console.error('Поймана ошибка:', error);
    console.error('Информация об ошибке:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          message="Ошибка"
          description={this.state.error?.message || 'Что-то пошло не так'}
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

// Мемоизация компонентов для оптимизации производительности
const CurrentWeekIndicatorMemo = memo(CurrentWeekIndicator);
const ScheduleViewerMemo = memo(ScheduleViewer);

type ScheduleDisplayMode = 'separate' | 'combined';

const App: React.FC = () => {
  const [displayMode, setDisplayMode] =
    useState<ScheduleDisplayMode>('separate');

  const [externalLoginVisible, setExternalLoginVisible] = useState(false);
  const [externalLoggedIn, setExternalLoggedIn] = useState<boolean>(() => {
    return !!localStorage.getItem('external_login');
  });
  const [loginLoading, setLoginLoading] = useState(false);

  const handleExternalLogin = async (values: {
    username: string;
    password: string;
  }) => {
    setLoginLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/v1/login-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Ошибка входа');
      const data: AuthResponse = await res.json();

      if (data.cookies) {
        saveAuthToStorage(data);
        setExternalLoggedIn(true);
        setExternalLoginVisible(false);

        window.dispatchEvent(new Event('storage'));

        message.success('Вход на портал выполнен');
      } else {
        throw new Error('Неверные данные');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthStorage();
    clearPortalCookies();
    setExternalLoggedIn(false);
  };

  useEffect(() => {
    const handler = () => setExternalLoginVisible(true);
    window.addEventListener('open-external-login', handler);
    return () => window.removeEventListener('open-external-login', handler);
  }, []);

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
        <Router>
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
                <Routes>
                  <Route
                    path="/:view?"
                    element={
                      <AppBreadcrumbs
                        showExternalLoginButton={!externalLoggedIn}
                        onExternalLoginClick={() =>
                          setExternalLoginVisible(true)
                        }
                        onLogout={handleLogout}
                      />
                    }
                  />
                </Routes>
              </div>
            </Header>
            <Content style={{ padding: '24px', backgroundColor: '#f5f5f5' }}>
              <Modal
                open={externalLoginVisible}
                title="Вход на внешний портал"
                onCancel={() => setExternalLoginVisible(false)}
                footer={null}
                destroyOnClose
                centered
              >
                <Form
                  layout="vertical"
                  onFinish={handleExternalLogin}
                  autoComplete="off"
                >
                  <Form.Item
                    label="Логин"
                    name="username"
                    rules={[{ required: true, message: 'Введите логин' }]}
                  >
                    <Input autoFocus />
                  </Form.Item>
                  <Form.Item
                    label="Пароль"
                    name="password"
                    rules={[{ required: true, message: 'Введите пароль' }]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loginLoading}
                      block
                    >
                      Войти
                    </Button>
                  </Form.Item>
                </Form>
                <div style={{ fontSize: 12, color: '#888' }}>
                  Ваши данные не сохраняются и используются только для
                  авторизации на портале.
                </div>
              </Modal>
              <CurrentWeekIndicatorMemo />
              <Routes>
                <Route path="/" element={<Navigate to="/groups" replace />} />
                <Route
                  path="/groups"
                  element={
                    <ScheduleViewerMemo
                      displayMode={displayMode}
                      setDisplayMode={setDisplayMode}
                    />
                  }
                />
                <Route
                  path="/teachers"
                  element={
                    <TeacherScheduleViewer
                      displayMode={displayMode}
                      setDisplayMode={setDisplayMode}
                    />
                  }
                />
              </Routes>
            </Content>
            <Footer style={{ textAlign: 'center', backgroundColor: '#fff' }}>
              Semesterly © Konstantin Samoylov, {new Date().getFullYear()}
            </Footer>
          </Layout>
        </Router>
      </ErrorBoundary>
    </ConfigProvider>
  );
};

export default App;
