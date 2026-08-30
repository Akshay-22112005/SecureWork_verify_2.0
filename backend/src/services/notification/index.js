const NotificationAdapter = require('./notification.adapter');
const LocalNotificationAdapter = require('./localNotification.adapter');

const localNotificationAdapter = new LocalNotificationAdapter();
let activeNotificationAdapter = localNotificationAdapter;

function getNotificationAdapter() {
  return activeNotificationAdapter;
}

function setNotificationAdapter(adapter) {
  activeNotificationAdapter = adapter;
}

module.exports = {
  NotificationAdapter,
  LocalNotificationAdapter,
  localNotificationAdapter,
  getNotificationAdapter,
  setNotificationAdapter
};
