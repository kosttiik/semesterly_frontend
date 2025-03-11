import React from 'react';
import { Breadcrumb } from 'antd';
import { TeamOutlined, UserOutlined } from '@ant-design/icons';

interface AppBreadcrumbsProps {
  currentView: 'groups' | 'teachers';
  onViewChange: (view: 'groups' | 'teachers') => void;
}

const AppBreadcrumbs: React.FC<AppBreadcrumbsProps> = ({
  currentView,
  onViewChange,
}) => {
  const handleKeyDown = (
    event: React.KeyboardEvent,
    view: 'groups' | 'teachers'
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onViewChange(view);
    }
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
          onClick: () => onViewChange('groups'),
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
          onClick: () => onViewChange('teachers'),
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
