import React, { useCallback, useState } from 'react';
import { CHURCH_SHORT_NAME } from '../lib/church';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Fonts, FontSizes, Spacing, Radius } from '../constants/theme';
import { getHistory, markNotificationRead, NotificationRecord } from '../notificationHistory';

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [history, setHistory] = useState<NotificationRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      getHistory().then(setHistory);
    }, [])
  );

  const openRecord = (record: NotificationRecord) => {
    markNotificationRead(record.id).then(() => {
      setHistory(current =>
        current.map(item => (item.id === record.id ? { ...item, read: true } : item))
      );
    });
    navigation.navigate({ name: 'NotificationDetail', params: { record } } as never);
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity
          style={s.closeButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color={Colors.cream} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={item => item.id}
        contentContainerStyle={history.length === 0 && s.emptyList}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => openRecord(item)} activeOpacity={0.75}>
            {!item.read ? <View style={s.unreadDot} /> : <View style={s.unreadDotSpacer} />}
            <View style={s.rowContent}>
              <Text style={[s.rowTitle, !item.read && s.rowTitleUnread]} numberOfLines={1}>
                {item.title || CHURCH_SHORT_NAME}
              </Text>
              <Text style={s.rowBody} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={s.rowTime}>{formatTimestamp(item.receivedAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="notifications-outline" size={40} color={Colors.gray400} />
            <Text style={s.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  header: {
    backgroundColor: Colors.cedar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.lg,
    color: Colors.cream,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold,
    marginTop: 6,
  },
  unreadDotSpacer: { width: 8, height: 8, marginTop: 6 },
  rowContent: { flex: 1 },
  rowTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.base,
    color: Colors.black,
  },
  rowTitleUnread: {
    fontFamily: Fonts.bodyBold,
  },
  rowBody: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginTop: 2,
    lineHeight: 18,
  },
  rowTime: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    marginTop: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.gray200,
    marginLeft: Spacing.md,
  },
  emptyList: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing['2xl'],
    gap: Spacing.sm,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    color: Colors.gray400,
  },
});
