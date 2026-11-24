import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  NotificationModal,
  type NotificationModalPayload,
} from '../components/NotificationModal';

interface NotificationContextValue {
  showNotification: (payload: Omit<NotificationModalPayload, 'id'>) => void;
  closeNotification: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<NotificationModalPayload | null>(null);

  const showNotification = useCallback((payload: Omit<NotificationModalPayload, 'id'>) => {
    setNotice({
      ...payload,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    });
  }, []);

  const closeNotification = useCallback(() => {
    setNotice(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, closeNotification }}>
      {children}
      <NotificationModal notice={notice} onClose={closeNotification} />
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification harus digunakan di dalam NotificationProvider.');
  }
  return ctx;
}
