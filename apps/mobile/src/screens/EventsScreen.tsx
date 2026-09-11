import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Linking,
  RefreshControl,
  Modal,
  SafeAreaView,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, FontSizes, Spacing, Radius } from '../constants/theme';
import { EventCard, LoadingView, ErrorView } from '../components/shared';
import { api } from '../api/client';
import type { ChurchEvent } from '../types';

type Filter = 'all' | 'upcoming' | 'registration';

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<ChurchEvent | null>(null);

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await api.events();
      setEvents(res.data);
    } catch {
      // Showing a retry beats showing fixtures: this screen used to fall
      // back to placeholder events, so an API outage advertised a VBS
      // registration and a men's breakfast that don't exist.
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filtered = events.filter(e => {
    if (filter === 'upcoming') return !!e.starts_at;
    if (filter === 'registration') return !!e.registration_url;
    return true;
  });

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'registration', label: 'Register' },
  ];

  if (loading) return <LoadingView />;
  if (error) return <ErrorView onRetry={load} />;

  return (
    <View style={[styles.container]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>Events</Text>
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                filter === f.key && styles.filterChipActive,
              ]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.filterChipLabel,
                  filter === f.key && styles.filterChipLabelActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {error ? (
        <ErrorView onRetry={load} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No events to show.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id}
          contentContainerStyle={{ paddingTop: Spacing.md, paddingBottom: Spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.cedar}
              colors={[Colors.cedar]}
            />
          }
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => setSelected(item)} />
          )}
        />
      )}

      <EventDetailModal event={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const HEIGHT_REPORTER = `
  function reportHeight() {
    window.ReactNativeWebView.postMessage(String(document.body.scrollHeight));
  }
  reportHeight();
  new ResizeObserver(reportHeight).observe(document.body);
  true;
`;

function descriptionHtml(description: string): string {
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; font-family: -apple-system, Roboto, sans-serif; color: ${Colors.gray600}; font-size: 16px; line-height: 1.6; }
          h1, h2, h3 { color: ${Colors.cedar}; }
          a { color: ${Colors.cedarMid}; }
        </style>
      </head>
      <body>${description}</body>
    </html>
  `;
}

function EventDetailModal({ event, onClose }: { event: ChurchEvent | null; onClose: () => void }) {
  const [webviewHeight, setWebviewHeight] = useState(0);

  useEffect(() => { setWebviewHeight(0); }, [event?.id]);

  const dateStr = event?.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;
  const timeStr = event?.starts_at
    ? new Date(event.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <Modal visible={!!event} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.headerTitle} numberOfLines={1}>{event?.name ?? ''}</Text>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.cream} />
          </TouchableOpacity>
        </View>
        {event ? (
          <ScrollView style={modalStyles.body} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            {event.logo_url ? (
              <Image source={{ uri: event.logo_url }} style={modalStyles.image} />
            ) : null}
            <Text style={modalStyles.title}>{event.name}</Text>
            {dateStr ? (
              <Text style={modalStyles.when}>{dateStr}{timeStr ? ` at ${timeStr}` : ''}</Text>
            ) : null}
            {event.description ? (
              <WebView
                source={{ html: descriptionHtml(event.description) }}
                originWhitelist={['*']}
                style={[modalStyles.webview, { height: webviewHeight }]}
                scrollEnabled={false}
                injectedJavaScript={HEIGHT_REPORTER}
                onMessage={(e) => setWebviewHeight(Number(e.nativeEvent.data) || 0)}
              />
            ) : null}
            {event.registration_url ? (
              <TouchableOpacity
                style={modalStyles.registerBtn}
                onPress={() => Linking.openURL(event.registration_url!)}
                activeOpacity={0.85}
              >
                <Text style={modalStyles.registerBtnLabel}>Register →</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  header: {
    backgroundColor: Colors.cedar,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.cream,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  filterChipLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.gray200,
  },
  filterChipLabelActive: {
    color: Colors.cedar,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    color: Colors.gray400,
  },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.cedar,
  },
  headerTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.lg, color: Colors.cream, flex: 1 },
  closeBtn: { padding: 4, marginLeft: Spacing.sm },
  body: { flex: 1, padding: Spacing.md },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.md, marginBottom: Spacing.md },
  title: { fontFamily: Fonts.heading, fontSize: FontSizes.xl, color: Colors.cedar, marginBottom: Spacing.xs },
  when: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.sm, color: Colors.gray600, marginBottom: Spacing.md },
  webview: { backgroundColor: 'transparent' },
  registerBtn: {
    marginTop: Spacing.lg, backgroundColor: Colors.cedar, borderRadius: Radius.full,
    paddingVertical: Spacing.sm + 2, alignItems: 'center',
  },
  registerBtnLabel: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.base, color: Colors.cream },
});
