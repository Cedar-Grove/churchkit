import { OneSignal, NotificationClickEvent, NotificationWillDisplayEvent, OSNotification } from 'react-native-onesignal';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api/client';
import { navigationRef } from './navigation/navigationRef';
import { recordNotification, NotificationRecord } from './notificationHistory';

const ONESIGNAL_APP_ID = (Constants.expoConfig?.extra?.onesignalAppId as string | undefined) ?? '';

let initialized = false;

function registerPushToken(playerId: string) {
  api.registerPush({
    player_id: playerId,
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version,
  }).catch(() => {});
}

let pendingParams: { screen: string; params?: object } | null = null;

function navigate(screen: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate({ name: screen, params } as never);
  } else {
    // Cold start: the notification click can fire before NavigationContainer
    // has mounted. Stash it and flush once AppNavigator's onReady fires.
    pendingParams = { screen, params };
  }
}

export function flushPendingNotificationRoute() {
  if (pendingParams && navigationRef.isReady()) {
    navigationRef.navigate({ name: pendingParams.screen, params: pendingParams.params } as never);
    pendingParams = null;
  }
}

function toRecordInput(notification: OSNotification): Omit<NotificationRecord, 'read'> {
  return {
    id: notification.notificationId,
    title: notification.title ?? '',
    body: notification.body,
    data: notification.additionalData as Record<string, unknown> | undefined,
    receivedAt: Date.now(),
  };
}

export async function initPushNotifications() {
  if (!ONESIGNAL_APP_ID || initialized) return;
  initialized = true;

  OneSignal.initialize(ONESIGNAL_APP_ID);
  OneSignal.Notifications.requestPermission(true);

  // Notification arrives while the app is open — save it so it shows up in
  // the in-app history even if the user never taps the system notification.
  OneSignal.Notifications.addEventListener(
    'foregroundWillDisplay',
    (event: NotificationWillDisplayEvent) => {
      recordNotification(toRecordInput(event.getNotification())).catch(() => {});
    }
  );

  // Tapping a notification (foreground, background, or cold start) opens
  // its full message in-app instead of just navigating to a tab.
  OneSignal.Notifications.addEventListener('click', (event: NotificationClickEvent) => {
    recordNotification(toRecordInput(event.notification))
      .then(record => navigate('NotificationDetail', { record }))
      .catch(() => {});
  });

  OneSignal.User.pushSubscription.addEventListener('change', event => {
    if (event.current.id) registerPushToken(event.current.id);
  });

  const existingId = await OneSignal.User.pushSubscription.getIdAsync();
  if (existingId) registerPushToken(existingId);
}
