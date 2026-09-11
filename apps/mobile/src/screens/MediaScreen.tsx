import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Fonts, FontSizes, Spacing, Radius, Shadow } from '../constants/theme';
import { LoadingView, ErrorView, SectionLabel } from '../components/shared';
import { SermonNotesModal } from '../components/SermonNotesModal';
import { api } from '../api/client';
import type { Sermon } from '../types';

export default function MediaScreen() {
  const insets = useSafeAreaInsets();
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [notesSermon, setNotesSermon] = useState<Sermon | null>(null);

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await api.sermons();
      setSermons(res.data);
    } catch {
      // Never substitute placeholder sermons here. This screen used to fall
      // back to fixtures, which meant an API outage showed the congregation
      // invented messages that were never preached.
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

  const videos = sermons.filter(s => !!s.youtube_url);

  // Group by series
  const seriesMap = new Map<string, Sermon[]>();
  videos.forEach(s => {
    const key = s.series_title ?? 'Other Messages';
    if (!seriesMap.has(key)) seriesMap.set(key, []);
    seriesMap.get(key)!.push(s);
  });
  const seriesList = Array.from(seriesMap.entries());

  const latestSeries = seriesList[0];

  if (loading) return <LoadingView />;
  if (error) return <ErrorView onRetry={load} />;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>Watch & Listen</Text>
      </View>

      <FlatList
        data={videos}
        keyExtractor={s => s.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.cedar}
            colors={[Colors.cedar]}
          />
        }
        ListHeaderComponent={
          latestSeries ? (
            <SeriesHero
              seriesTitle={latestSeries[0]}
              sermons={latestSeries[1]}
            />
          ) : null
        }
        contentContainerStyle={{ paddingBottom: Spacing.xl }}
        renderItem={({ item }) => (
          <SermonItem sermon={item} onOpenNotes={() => setNotesSermon(item)} />
        )}
      />

      <SermonNotesModal
        visible={!!notesSermon}
        sermon={notesSermon}
        onClose={() => setNotesSermon(null)}
      />
    </View>
  );
}

function SeriesHero({
  seriesTitle,
  sermons,
}: {
  seriesTitle: string;
  sermons: Sermon[];
}) {
  const hero = sermons[0];
  return (
    <View style={heroStyles.wrap}>
      {hero?.thumbnail ? (
        <Image source={{ uri: hero.thumbnail }} style={heroStyles.image} />
      ) : (
        <View style={[heroStyles.image, heroStyles.imageFallback]} />
      )}
      <View style={heroStyles.overlay}>
        <Text style={heroStyles.seriesLabel}>Current Series</Text>
        <Text style={heroStyles.seriesTitle}>{seriesTitle}</Text>
        <Text style={heroStyles.count}>
          {sermons.length} message{sermons.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

function SermonItem({ sermon, onOpenNotes }: { sermon: Sermon; onOpenNotes: () => void }) {
  const dateStr = sermon.date
    ? new Date(sermon.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const openYouTube = () => {
    if (sermon.youtube_url) Linking.openURL(sermon.youtube_url);
  };

  return (
    <TouchableOpacity
      style={itemStyles.row}
      onPress={openYouTube}
      activeOpacity={sermon.youtube_url ? 0.75 : 1}
    >
      {sermon.thumbnail ? (
        <Image source={{ uri: sermon.thumbnail }} style={itemStyles.thumb} />
      ) : (
        <View style={[itemStyles.thumb, itemStyles.thumbFallback]}>
          <Text style={itemStyles.thumbIcon}>✝</Text>
        </View>
      )}
      <View style={itemStyles.info}>
        {sermon.series_title ? (
          <Text style={itemStyles.series} numberOfLines={1}>
            {sermon.series_title}
          </Text>
        ) : null}
        <Text style={itemStyles.title} numberOfLines={2}>
          {sermon.title ?? 'Untitled'}
        </Text>
        <Text style={itemStyles.date}>{dateStr}</Text>
      </View>
      {/* Its own touchable so tapping notes doesn't also open YouTube. */}
      <TouchableOpacity
        style={itemStyles.notesWrap}
        onPress={onOpenNotes}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Notes for ${sermon.title ?? 'this message'}`}
      >
        <Ionicons name="document-text-outline" size={16} color={Colors.cedar} />
        <Text style={itemStyles.notesLabel}>Notes</Text>
      </TouchableOpacity>
      {sermon.youtube_url ? (
        <View style={itemStyles.playWrap}>
          <Text style={itemStyles.playIcon}>▶</Text>
        </View>
      ) : (
        <View style={itemStyles.noVideoWrap}>
          <Text style={itemStyles.noVideoLabel}>No video</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  header: {
    backgroundColor: Colors.cedar,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.cream,
  },
});

const heroStyles = StyleSheet.create({
  wrap: {
    height: 220,
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFallback: {
    backgroundColor: Colors.cedarMid,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(39,57,32,0.70)',
    padding: Spacing.md,
    justifyContent: 'flex-end',
  },
  seriesLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  seriesTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.cream,
  },
  count: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.gray200,
    marginTop: 4,
  },
});

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray200,
  },
  thumb: {
    width: 72,
    height: 52,
    borderRadius: Radius.sm,
    marginRight: Spacing.sm,
  },
  thumbFallback: {
    backgroundColor: Colors.cedar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    fontSize: 20,
    color: Colors.gold,
  },
  info: { flex: 1 },
  series: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.md,
    color: Colors.black,
    lineHeight: 21,
  },
  date: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    marginTop: 3,
  },
  notesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.gray200,
    backgroundColor: Colors.cream,
    marginLeft: Spacing.sm,
  },
  notesLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.cedar,
  },
  playWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  playIcon: {
    fontSize: 12,
    color: Colors.cedar,
    marginLeft: 2,
  },
  noVideoWrap: {
    marginLeft: Spacing.sm,
  },
  noVideoLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gray400,
  },
});
