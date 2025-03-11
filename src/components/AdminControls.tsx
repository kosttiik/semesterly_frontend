import React, { useState, useEffect, useRef } from 'react';
import { Button, Modal, Progress, Typography, Space, Alert } from 'antd';
import './AdminControls.css';

const { Text, Paragraph } = Typography;

interface ProgressData {
  type: string;
  currentItem: number;
  totalItems: number;
  percentage: number;
  eta: string;
}

interface AdminControlsProps {
  isModalOpen: boolean;
  onModalOpen: () => void;
  onModalClose: () => void;
}

const formatEta = (eta: string): string => {
  // Handle empty or invalid eta
  if (!eta || eta === 'Вычисление...') return 'Вычисление...';

  // Parse the eta string (format: "1m23s" or "45s")
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
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, []);

  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as ProgressData;

      if (data.type === 'insertProgress') {
        const percentage = Math.round(
          (data.currentItem / data.totalItems) * 100
        );
        setProgressData({
          type: data.type,
          currentItem: data.currentItem,
          totalItems: data.totalItems,
          percentage: percentage,
          eta: data.eta || 'Вычисление...',
        });

        if (percentage >= 100) {
          setTimeout(() => {
            setIsProcessing(false);
            // setIsModalOpen(false);
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
          const response = await fetch(
            'http://localhost:8080/api/v1/insert-data',
            {
              method: 'POST',
            }
          );

          if (!response.ok) {
            throw new Error('Failed to start process');
          }
        } catch (error) {
          console.error('Failed to start process:', error);
          setError('Не удалось начать процесс обновления данных');
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

  const handleModalClose = () => {
    if (!isProcessing) {
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
          setIsProcessing(false);
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
      closable={!isProcessing}
      maskClosable={!isProcessing}
      destroyOnClose
      centered
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
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
          disabled={isProcessing}
          block
        >
          {isProcessing ? 'Обновление данных...' : 'Обновить данные расписания'}
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
                Прогресс: {progressData.currentItem}/{progressData.totalItems}
              </Text>
              <Text type="secondary">
                Осталось времени: {formatEta(progressData.eta)}
              </Text>
            </Space>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default AdminControls;
