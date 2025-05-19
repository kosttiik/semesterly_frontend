import React from 'react';
import { Breadcrumb, Button, Alert, Avatar, Dropdown } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  LoginOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getAuthFromStorage,
  clearAuthStorage,
  clearPortalCookies,
} from '../services/authService';
import './AppBreadcrumbs.css';

interface AppBreadcrumbsProps {
  showExternalLoginButton?: boolean;
  onExternalLoginClick?: () => void;
  onLogout?: () => void;
}

const loginButtonHoverStyle: React.CSSProperties = {
  background: '#e6f4ff',
  color: '#1677ff',
  borderRadius: 6,
  textDecoration: 'none',
  transition: 'background 0.2s',
};

const formatNameRussian = (
  lastName: string,
  firstName: string,
  middleName?: string
): string => {
  if (!lastName && !firstName) return 'Гость';
  return `${lastName || ''} ${firstName ? firstName[0] + '.' : ''}${
    middleName ? middleName[0] + '.' : ''
  }`.trim();
};

const AppBreadcrumbs: React.FC<AppBreadcrumbsProps> = ({
  showExternalLoginButton,
  onExternalLoginClick,
  onLogout,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = location.pathname.split('/')[1] || 'groups';

  const [isLoginHovered, setIsLoginHovered] = React.useState(false);
  const [user, setUser] = React.useState<null | {
    firstName: string;
    lastName: string;
    middleName?: string;
    photo?: string;
  }>(null);

  React.useEffect(() => {
    const check = () => {
      const auth = getAuthFromStorage();
      if (auth) {
        setUser({
          firstName: auth.firstName,
          lastName: auth.lastName,
          middleName: auth.middleName,
          photo: auth.photo,
        });
      } else {
        setUser(null);
      }
    };
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const auth = getAuthFromStorage();
    if (!auth || !auth.expires) return;
    const timeout = setTimeout(() => {
      clearAuthStorage();
      setUser(null);
    }, auth.expires - Date.now());
    return () => clearTimeout(timeout);
  }, [user]);

  const handleKeyDown = (
    event: React.KeyboardEvent,
    view: 'groups' | 'teachers'
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(`/${view}`);
    }
  };

  const handleViewChange = (view: 'groups' | 'teachers') => {
    navigate(`/${view}`);
  };

  const handleLogout = () => {
    clearAuthStorage();
    clearPortalCookies();
    setUser(null);
    onLogout?.();
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Выйти',
      onClick: handleLogout,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        flexWrap: 'wrap',
        gap: 16,
        minHeight: 40,
      }}
    >
      <Breadcrumb
        items={[
          {
            title: (
              <span
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 32,
                }}
                onKeyDown={(e) => handleKeyDown(e, 'groups')}
              >
                <TeamOutlined style={{ marginRight: 8 }} />
                Группы
              </span>
            ),
            className: currentView === 'groups' ? 'breadcrumb-active' : '',
            onClick: () => handleViewChange('groups'),
          },
          {
            title: (
              <span
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 32,
                }}
                onKeyDown={(e) => handleKeyDown(e, 'teachers')}
              >
                <UserOutlined style={{ marginRight: 8 }} />
                Преподаватели
              </span>
            ),
            className: currentView === 'teachers' ? 'breadcrumb-active' : '',
            onClick: () => handleViewChange('teachers'),
          },
        ]}
        style={{
          fontSize: '15px',
          alignItems: 'center',
          display: 'flex',
          height: 36,
        }}
        separator=""
      />
      {user ? (
        <Dropdown
          menu={{ items: userMenuItems }}
          placement="bottomRight"
          mouseEnterDelay={0.1}
          destroyPopupOnHide
        >
          <div className="user-info-dropdown">
            <span
              style={{
                fontWeight: 500,
                fontSize: 15,
                whiteSpace: 'nowrap',
                color: '#262626',
                letterSpacing: '-0.01em',
              }}
            >
              {formatNameRussian(
                user.lastName,
                user.firstName,
                user.middleName
              )}
            </span>
            <Avatar
              src={
                user.photo ? `data:image/jpeg;base64,${user.photo}` : undefined
              }
              icon={<UserOutlined />}
              size={28}
              style={{
                flexShrink: 0,
                backgroundColor: '#fff',
                color: '#1677ff',
              }}
            />
          </div>
        </Dropdown>
      ) : (
        showExternalLoginButton && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
              maxWidth: 420,
            }}
          >
            <Alert
              type="info"
              icon={<InfoCircleOutlined />}
              message={
                <span>
                  <b>
                    Вход в Бауманский аккаунт необходим для отображения полного
                    расписания
                  </b>
                  <br />
                  <span style={{ color: '#888', fontSize: 12 }}>
                    Без входа доступны только неполные данные
                  </span>
                </span>
              }
              style={{
                padding: '2px 10px',
                fontSize: 12,
                borderRadius: 6,
                margin: 0,
                background: '#e6f4ff',
                border: 'none',
                color: '#1677ff',
                fontWeight: 500,
                minWidth: 180,
                maxWidth: 340,
                boxShadow: '0 2px 8px rgba(22,119,255,0.06)',
                lineHeight: 1.3,
              }}
              banner
              showIcon
            />
            <Button
              type="link"
              icon={<LoginOutlined />}
              onClick={onExternalLoginClick}
              style={{
                fontWeight: 600,
                fontSize: 15,
                padding: '0 4px',
                minWidth: 0,
                height: 28,
                color: '#1677ff',
                whiteSpace: 'nowrap',
                ...(isLoginHovered ? loginButtonHoverStyle : {}),
              }}
              onMouseEnter={() => setIsLoginHovered(true)}
              onMouseLeave={() => setIsLoginHovered(false)}
            >
              Войти
            </Button>
          </div>
        )
      )}
    </div>
  );
};

export default AppBreadcrumbs;
