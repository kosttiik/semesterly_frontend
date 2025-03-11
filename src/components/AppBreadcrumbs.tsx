import React from 'react';
import { Breadcrumb } from 'antd';
import { TeamOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const AppBreadcrumbs: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = location.pathname.split('/')[1] || 'groups';

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

  return (
    <Breadcrumb
      items={[
        {
          title: (
            <span
              role="button"
              tabIndex={0}
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
      }}
      separator=""
    />
  );
};

export default AppBreadcrumbs;
