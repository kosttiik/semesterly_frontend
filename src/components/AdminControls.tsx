import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, Progress, Typography, Space, Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import './AdminControls.css';
import { getPortal3Cookies, setPortalCookies } from '../services/authService';

const { Text, Paragraph } = Typography;

interface ProgressData {
  type: string;
  currentItem?: number;
  totalItems?: number;
  percentage: number;
  eta?: string;
  message?: string;
}

interface AdminControlsProps {
  isModalOpen: boolean;
  onModalOpen: () => void;
  onModalClose: () => void;
  showExternalLoginAlert?: boolean;
}

const formatEta = (eta: string): string => {
  if (!eta || eta === 'Вычисление...') return 'Вычисление...';

  const minutes = eta.match(/(\d+)m/)?.[1];
  const seconds = eta.match(/(\d+)s/)?.[1];

  if (!minutes && !seconds) return 'Вычисление...';

  const parts = [];
  if (minutes) {
    parts.push(`${minutes} ${getMinutesForm(Number(minutes))}`);
  }
  if (seconds) {
    parts.push(`${seconds} ${getSecondsForm(Number(seconds))}`);
  }

  return parts.join(' ');
};

const getMinutesForm = (minutes: number): string => {
  if (minutes >= 11 && minutes <= 14) return 'минут';
  const lastDigit = minutes % 10;
  if (lastDigit === 1) return 'минута';
  if (lastDigit >= 2 && lastDigit <= 4) return 'минуты';
  return 'минут';
};

const getSecondsForm = (seconds: number): string => {
  if (seconds >= 11 && seconds <= 14) return 'секунд';
  const lastDigit = seconds % 10;
  if (lastDigit === 1) return 'секунда';
  if (lastDigit >= 2 && lastDigit <= 4) return 'секунды';
  return 'секунд';
};

const AdminControls: React.FC<AdminControlsProps> = ({
  isModalOpen,
  onModalClose,
  showExternalLoginAlert,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressData, setProgressData] = useState<ProgressData>({
    type: '',
    currentItem: 0,
    totalItems: 0,
    percentage: 0,
    eta: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearProgress, setClearProgress] = useState<ProgressData | null>(null);
  const [clearSuccess, setClearSuccess] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const clearWs = useRef<WebSocket | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      if (clearWs.current) {
        clearWs.current.close();
        clearWs.current = null;
      }
    };
  }, []);

  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as ProgressData;

      if (data.type === 'insertProgress') {
        const percentage = Math.round(
          ((data.currentItem ?? 0) / (data.totalItems ?? 1)) * 100
        );
        setProgressData({
          type: data.type,
          currentItem: data.currentItem ?? 0,
          totalItems: data.totalItems ?? 0,
          percentage: percentage,
          eta: data.eta || 'Вычисление...',
        });

        if (percentage >= 100) {
          setTimeout(() => {
            setIsProcessing(false);
            if (ws.current) {
              ws.current.close();
              ws.current = null;
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      setError('Ошибка при получении данных о прогрессе');
    }
  };

  const startProcess = async () => {
    try {
      setError(null);
      setProgressData({
        type: 'insertProgress',
        currentItem: 0,
        totalItems: 100,
        percentage: 0,
        eta: 'Вычисление...',
      });
      setIsProcessing(true);

      const socket = new WebSocket('ws://localhost:8080/ws');

      socket.onopen = async () => {
        console.log('WebSocket connected');
        try {
          const controller = new AbortController();
          setAbortController(controller);

          const portalCookies = getPortal3Cookies();
          setPortalCookies(portalCookies);

          const response = await fetch(
            'http://localhost:8080/api/v1/insert-data',
            {
              method: 'POST',
              credentials: 'include',
              signal: controller.signal,
            }
          );

          if (!response.ok) {
            throw new Error('Failed to start process');
          }
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
            setError('Обновление отменено пользователем');
          } else {
            console.error('Failed to start process:', error);
            setError('Не удалось начать процесс обновления данных');
          }
          setIsProcessing(false);
          socket.close();
        }
      };

      socket.onmessage = handleWebSocketMessage;
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Ошибка подключения к серверу');
        setIsProcessing(false);
      };

      socket.onclose = () => {
        console.log('WebSocket closed');
        if (isProcessing && progressData.percentage < 100) {
          setError('Соединение с сервером было прервано');
          setIsProcessing(false);
        }
      };

      ws.current = socket;
    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
      setError('Не удалось установить соединение с сервером');
      setIsProcessing(false);
    }
  };

  const cancelProcess = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setIsProcessing(false);
  };

  const handleClearDatabase = async () => {
    setClearLoading(true);
    setClearProgress({
      type: 'clearProgress',
      percentage: 0,
      message: 'Начало очистки базы данных...',
    });
    setClearSuccess(false);
    setError(null);

    try {
      const socket = new WebSocket('ws://localhost:8080/ws');
      clearWs.current = socket;

      socket.onopen = async () => {
        try {
          const response = await fetch(
            'http://localhost:8080/api/v1/clear-data',
            {
              method: 'POST',
            }
          );
          if (!response.ok) {
            throw new Error('Failed to clear database');
          }
        } catch {
          setError('Не удалось очистить базу данных');
          setClearLoading(false);
          socket.close();
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ProgressData;
          if (data.type === 'clearProgress') {
            setClearProgress({
              type: data.type,
              currentItem: data.currentItem ?? 0,
              totalItems: data.totalItems ?? 0,
              percentage: data.percentage ?? 0,
              message: data.message || '',
            });
            if ((data.percentage ?? 0) >= 100) {
              setClearSuccess(true);
              setTimeout(() => {
                setClearLoading(false);
                setClearProgress(null);
                setClearSuccess(false);
                if (clearWs.current) {
                  clearWs.current.close();
                  clearWs.current = null;
                }
              }, 1200);
            }
          }
        } catch {
          setError('Ошибка при получении прогресса очистки');
        }
      };

      socket.onerror = () => {
        setError('Ошибка при очистке базы данных');
        setClearLoading(false);
      };

      socket.onclose = () => {
        if (!clearSuccess && clearLoading) {
          setError('Соединение с сервером было прервано');
          setClearLoading(false);
        }
      };
    } catch {
      setError('Не удалось установить соединение с сервером');
      setClearLoading(false);
    }
  };

  const handleModalClose = () => {
    if (!isProcessing && !clearLoading) {
      onModalClose();
    } else {
      Modal.confirm({
        title: 'Прервать процесс?',
        content: 'Процесс обновления данных будет остановлен. Продолжить?',
        okText: 'Да',
        cancelText: 'Нет',
        onOk: () => {
          if (ws.current) {
            ws.current.close();
            ws.current = null;
          }
          if (abortController) {
            abortController.abort();
            setAbortController(null);
          }
          if (clearWs.current) {
            clearWs.current.close();
            clearWs.current = null;
          }
          setIsProcessing(false);
          setClearLoading(false);
          onModalClose();
        },
      });
    }
  };

  return (
    <Modal
      title="Панель управления"
      open={isModalOpen}
      onCancel={handleModalClose}
      footer={null}
      closable={!isProcessing && !clearLoading}
      maskClosable={!isProcessing && !clearLoading}
      destroyOnClose
      centered
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {showExternalLoginAlert && (
          <Alert
            type="info"
            icon={<InfoCircleOutlined />}
            message={
              <span>
                <b>Вход на внешний портал</b> необходим для отображения полного
                расписания.
                <br />
                <span style={{ color: '#888', fontSize: 12 }}>
                  Без входа доступны только базовые данные.
                </span>
              </span>
            }
            style={{
              padding: '6px 14px',
              fontSize: 13,
              borderRadius: 6,
              margin: 0,
              background: '#e6f4ff',
              border: 'none',
              color: '#1677ff',
              fontWeight: 500,
              minWidth: 180,
              maxWidth: 340,
              boxShadow: '0 2px 8px rgba(22,119,255,0.06)',
              lineHeight: 1.4,
            }}
            banner
            showIcon
          />
        )}
        {error && (
          <Alert
            message="Ошибка"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            className="admin-control-alert"
          />
        )}

        <Paragraph>
          Эта функция обновляет базу данных расписания, загружая актуальную
          информацию из LKS BMSTU. Процесс может занять несколько минут.
        </Paragraph>

        <Button
          type="primary"
          onClick={startProcess}
          loading={isProcessing}
          disabled={isProcessing || clearLoading}
          block
        >
          {isProcessing ? 'Обновление данных...' : 'Обновить данные расписания'}
        </Button>

        {isProcessing && (
          <Button
            danger
            type="default"
            onClick={cancelProcess}
            disabled={!isProcessing}
            block
            style={{ marginBottom: 8 }}
          >
            Отменить обновление
          </Button>
        )}

        <Button
          danger
          type="default"
          onClick={handleClearDatabase}
          loading={clearLoading}
          disabled={isProcessing || clearLoading}
          block
        >
          Очистить базу данных
        </Button>

        {isProcessing && (
          <div className="admin-control-progress">
            <Progress
              percent={progressData.percentage}
              status={progressData.percentage >= 100 ? 'success' : 'active'}
              style={{ marginBottom: 16 }}
            />
            <Space direction="vertical" size="small">
              <Text>
                Прогресс: {progressData.currentItem ?? 0}/
                {progressData.totalItems ?? 0}
              </Text>
              <Text type="secondary">
                Осталось времени: {formatEta(progressData.eta ?? '')}
              </Text>
            </Space>
          </div>
        )}

        {clearLoading && clearProgress && (
          <div className="admin-control-progress">
            <Progress
              percent={Math.round(clearProgress.percentage)}
              status={clearSuccess ? 'success' : 'active'}
              style={{ marginBottom: 16 }}
            />
            <Space direction="vertical" size="small">
              <Text>
                Прогресс: {clearProgress.currentItem ?? 0}/
                {clearProgress.totalItems ?? 0}
              </Text>
              <Text type="secondary">
                {clearProgress.message ||
                  (clearSuccess
                    ? 'База данных успешно очищена'
                    : 'Очистка базы данных...')}
              </Text>
            </Space>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default AdminControls;
