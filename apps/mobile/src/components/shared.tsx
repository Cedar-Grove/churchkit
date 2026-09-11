import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHURCH_SHORT_NAME } from '../lib/church';
import { Colors, Fonts, FontSizes, Spacing, Radius, Shadow } from '../constants/theme';
import type { Sermon, ChurchEvent } from '../types';

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── App Header ────────────────────────────────────────────────

export function AppHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      <Text style={styles.headerTitle}>{title ?? CHURCH_SHORT_NAME}</Text>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ── Screen Header (used inside scrollable screens) ────────────

export function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={styles.screenHeaderWrap}>
      <Text style={styles.screenHeaderText}>{title}</Text>
      <View style={styles.screenHeaderAccent} />
    </View>
  );
}

// ── Gold Button ───────────────────────────────────────────────

export function GoldButton({
  label,
  onPress,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  style?: object;
}) {
  return (
    <TouchableOpacity
      style={[styles.goldBtn, style]}
      onPress={onPress}
      activeOpacity={0.82}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={Colors.cedar} size="small" />
      ) : (
        <Text style={styles.goldBtnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

// ── Ghost Button ──────────────────────────────────────────────

export function GhostButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity
      style={[styles.ghostBtn, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.ghostBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Sermon Row ────────────────────────────────────────────────

export function SermonRow({
  sermon,
  onPress,
}: {
  sermon: Sermon;
  onPress: () => void;
}) {
  const dateStr = sermon.date
    ? new Date(sermon.date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <TouchableOpacity style={styles.sermonRow} onPress={onPress} activeOpacity={0.75}>
      {sermon.thumbnail ? (
        <Image source={{ uri: sermon.thumbnail }} style={styles.sermonThumb} />
      ) : (
        <View style={[styles.sermonThumb, styles.sermonThumbPlaceholder]}>
          <Text style={styles.sermonThumbIcon}>✝</Text>
        </View>
      )}
      <View style={styles.sermonInfo}>
        {sermon.series_title ? (
          <Text style={styles.sermonSeries} numberOfLines={1}>
            {sermon.series_title}
          </Text>
        ) : null}
        <Text style={styles.sermonTitle} numberOfLines={2}>
          {sermon.title ?? 'Untitled'}
        </Text>
        <Text style={styles.sermonDate}>{dateStr}</Text>
      </View>
      <Text style={styles.sermonChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Event Card ────────────────────────────────────────────────

export function EventCard({
  event,
  onPress,
}: {
  event: ChurchEvent;
  onPress: () => void;
}) {
  const dateStr = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;
  const timeStr = event.starts_at
    ? new Date(event.starts_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <TouchableOpacity style={styles.eventCard} onPress={onPress} activeOpacity={0.8}>
      {event.logo_url ? (
        <Image source={{ uri: event.logo_url }} style={styles.eventLogo} />
      ) : (
        <View style={[styles.eventLogo, styles.eventLogoPlaceholder]}>
          <Text style={styles.eventLogoIcon}>★</Text>
        </View>
      )}
      <View style={styles.eventContent}>
        <Text style={styles.eventName} numberOfLines={2}>
          {event.name}
        </Text>
        {dateStr ? (
          <Text style={styles.eventDate}>
            {dateStr}{timeStr ? ` · ${timeStr}` : ''}
          </Text>
        ) : null}
        {event.description ? (
          <Text style={styles.eventDesc} numberOfLines={2}>
            {stripHtml(event.description)}
          </Text>
        ) : null}
        {event.registration_url ? (
          <Text style={styles.eventRegLabel}>Register →</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── Section Label ─────────────────────────────────────────────

export function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>;
}

// ── Divider ───────────────────────────────────────────────────

export function Divider() {
  return <View style={styles.divider} />;
}

// ── Loading Overlay ───────────────────────────────────────────

export function LoadingView() {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={Colors.cedar} size="large" />
    </View>
  );
}

// ── Error View ────────────────────────────────────────────────

export function ErrorView({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorWrap}>
      <Text style={styles.errorText}>{message ?? 'Something went wrong.'}</Text>
      {onRetry ? (
        <GhostButton label="Try Again" onPress={onRetry} style={{ marginTop: Spacing.md }} />
      ) : null}
    </View>
  );
}

// ── Ministry Tile ─────────────────────────────────────────────

export function MinistryTile({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.ministryTile} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.ministryTileAccent} />
      <View style={styles.ministryTileContent}>
        <Text style={styles.ministryTileTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.ministryTileSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={styles.ministryChevron}>›</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    backgroundColor: Colors.cedar,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.cream,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.gold,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  // Screen Header
  screenHeaderWrap: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  screenHeaderText: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.cedar,
  },
  screenHeaderAccent: {
    marginTop: 4,
    width: 40,
    height: 3,
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
  },

  // Gold Button
  goldBtn: {
    backgroundColor: Colors.gold,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  goldBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.sm,
    color: Colors.cedar,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Ghost Button
  ghostBtn: {
    borderWidth: 1.5,
    borderColor: Colors.cedar,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  ghostBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.cedar,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Sermon Row
  sermonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  sermonThumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    marginRight: Spacing.md,
  },
  sermonThumbPlaceholder: {
    backgroundColor: Colors.cedar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sermonThumbIcon: {
    fontSize: 22,
    color: Colors.gold,
  },
  sermonInfo: {
    flex: 1,
  },
  sermonSeries: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  sermonTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.md,
    color: Colors.black,
    lineHeight: 22,
  },
  sermonDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    marginTop: 3,
  },
  sermonChevron: {
    fontSize: 22,
    color: Colors.gray400,
    marginLeft: Spacing.sm,
  },

  // Event Card
  eventCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  eventLogo: {
    width: 80,
    height: 80,
  },
  eventLogoPlaceholder: {
    backgroundColor: Colors.cedarMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventLogoIcon: {
    fontSize: 28,
    color: Colors.gold,
  },
  eventContent: {
    flex: 1,
    padding: Spacing.sm,
  },
  eventName: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.md,
    color: Colors.cedar,
  },
  eventDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gray600,
    marginTop: 2,
  },
  eventDesc: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gray600,
    marginTop: 4,
    lineHeight: 16,
  },
  eventRegLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.xs,
    color: Colors.gold,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Section Label
  sectionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.xs,
    color: Colors.cedarMid,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.gray200,
    marginHorizontal: Spacing.md,
  },

  // Loading & Error
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cream,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.cream,
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    color: Colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Ministry Tile
  ministryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  ministryTileAccent: {
    width: 5,
    alignSelf: 'stretch',
    backgroundColor: Colors.cedarMid,
  },
  ministryTileContent: {
    flex: 1,
    padding: Spacing.md,
  },
  ministryTileTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.lg,
    color: Colors.cedar,
  },
  ministryTileSub: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginTop: 2,
    lineHeight: 18,
  },
  ministryChevron: {
    fontSize: 22,
    color: Colors.gray400,
    marginRight: Spacing.md,
  },
});
