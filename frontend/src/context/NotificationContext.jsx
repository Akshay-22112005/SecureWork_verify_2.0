import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      setLoading(true);
      const res = await api.notifications.list({ limit: 30 });
      if (res && res.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchNotifications();
    // Periodic refresh every 30s when active
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAsRead(notificationId) {
    try {
      await api.notifications.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, read: true, readAt: new Date() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  }

  async function markAllAsRead() {
    try {
      await api.notifications.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date() })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  }

  function toggleDrawer() {
    setIsDrawerOpen((prev) => !prev);
  }

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        isDrawerOpen,
        openDrawer: () => setIsDrawerOpen(true),
        closeDrawer: () => setIsDrawerOpen(false),
        toggleDrawer,
        fetchNotifications,
        markAsRead,
        markAllAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}

export default NotificationContext;
