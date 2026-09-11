import React, { useEffect } from 'react';
import { CHURCH_SHORT_NAME } from '../lib/church';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Fonts, FontSizes, Spacing, Radius } from '../constants/theme';
import { markNotificationRead, NotificationRecord } from '../notificationHistory';

type Params = { NotificationDetail: { record: NotificationRecord } };

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function NotificationDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<Params, 'NotificationDetail'>>();
  const { record } = params;

  useEffect(() => {
    markNotificationRead(record.id).catch(() => {});
  }, [record.id]);

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
        <Text style={s.headerTitle}>Notification</Text>
      </View>

      <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
        <Text style={s.date}>{formatDate(record.receivedAt)}</Text>
        <Text style={s.title}>{record.title || CHURCH_SHORT_NAME}</Text>
        <Text style={s.message}>{record.body}</Text>
      </ScrollView>
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
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  date: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.cedarMid,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.xl,
    color: Colors.cedar,
    marginBottom: Spacing.sm,
  },
  message: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    color: Colors.black,
    lineHeight: 22,
  },
});
