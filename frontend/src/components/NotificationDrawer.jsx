import React from 'react';
import { X, CheckCheck, Bell, AlertTriangle, AlertOctagon, CheckCircle2, Info, Clock } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationDrawer() {
  const { isDrawerOpen, closeDrawer, notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();

  if (!isDrawerOpen) return null;

  function getSeverityIcon(severity) {
    switch (severity) {
      case 'CRITICAL':
        return <AlertOctagon size={16} className="text-danger" />;
      case 'WARNING':
        return <AlertTriangle size={16} className="text-warning" />;
      case 'SUCCESS':
        return <CheckCircle2 size={16} className="text-success" />;
      default:
        return <Info size={16} className="text-cyan" />;
    }
  }

  return (
    <div className="drawer-overlay" onClick={closeDrawer}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-title-row">
            <div className="drawer-title">
              <Bell size={18} />
              <h3>In-App Notifications</h3>
              {unreadCount > 0 && <span className="unread-pill">{unreadCount} new</span>}
            </div>
            <button className="close-btn" onClick={closeDrawer} title="Close">
              <X size={18} />
            </button>
          </div>
          {notifications.length > 0 && (
            <div className="drawer-actions">
              <button 
                className="action-btn secondary text-xs" 
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck size={14} /> Mark All as Read
              </button>
            </div>
          )}
        </div>

        {/* Content List */}
        <div className="drawer-content">
          {loading && notifications.length === 0 ? (
            <div className="drawer-empty">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="drawer-empty">
              <Bell size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No notifications yet.</p>
              <span className="text-muted text-xs">Lifecycle state changes will appear here in real time.</span>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map((notif) => (
                <div 
                  key={notif.notificationId} 
                  className={`notif-item ${notif.read ? 'notif-read' : 'notif-unread'}`}
                  onClick={() => !notif.read && markAsRead(notif.notificationId)}
                >
                  <div className="notif-header">
                    <div className="notif-severity-row">
                      {getSeverityIcon(notif.severity)}
                      <span className="notif-title">{notif.title}</span>
                    </div>
                    {!notif.read && <span className="unread-dot" title="Unread"></span>}
                  </div>
                  <p className="notif-message">{notif.message}</p>
                  <div className="notif-meta">
                    <span className="notif-time">
                      <Clock size={11} /> {new Date(notif.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="notif-type">{notif.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
