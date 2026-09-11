import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Fonts, FontSizes, Spacing, Radius, Shadow } from '../constants/theme';
import { sermonNotesUrl } from '../api/client';
import { getPersonalNote, savePersonalNote } from '../personalNotes';
import type { Sermon } from '../types';

/**
 * The sermon notes sheet: the church's notes for a message alongside the
 * listener's own. Shared by the Home screen's "Sermon Notes" card and the
 * Media screen's per-message notes button so both stay in step — the
 * personal note is keyed by sermon id, so opening the same message from
 * either place shows the same text.
 */
export function SermonNotesModal({
  visible,
  sermon,
  onClose,
}: {
  visible: boolean;
  sermon: Sermon | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'sermon' | 'mine'>('sermon');
  const [notesError, setNotesError] = useState(false);
  const [myNote, setMyNote] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sermonId = sermon?.id ?? null;

  // Only PCO plans have a notes document; a YouTube-only upload has no plan
  // to look one up by.
  const notesUrl = sermon && sermon.source === 'pco' ? sermonNotesUrl(sermon.id) : null;

  useEffect(() => {
    if (!visible) return;
    setTab(notesUrl ? 'sermon' : 'mine');
    setNotesError(false);
    setMyNote('');
    if (sermonId) getPersonalNote(sermonId).then(setMyNote);
    // notesUrl is derived from the sermon, so sermonId covers it.
  }, [visible, sermonId]);

  const changeMyNote = (text: string) => {
    setMyNote(text);
    if (!sermonId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePersonalNote(sermonId, text), 500);
  };

  // A pending debounce would be lost with the modal, so flush it on the way out.
  const close = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (sermonId) savePersonalNote(sermonId, myNote);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[s.modal, { paddingTop: insets.top }]}>
        <View style={s.modalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.modalTitle}>{sermon?.title || 'Sermon Notes'}</Text>
            {sermon ? (
              <Text style={s.modalSub}>
                {sermon.series_title ? `${sermon.series_title}  ·  ` : ''}
                {new Date(sermon.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color={Colors.cream} />
          </TouchableOpacity>
        </View>

        <View style={s.notesTabs}>
          <TouchableOpacity
            style={[s.notesTab, tab === 'sermon' && s.notesTabActive]}
            onPress={() => setTab('sermon')}
            activeOpacity={0.7}
          >
            <Text style={[s.notesTabText, tab === 'sermon' && s.notesTabTextActive]}>Sermon Notes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.notesTab, tab === 'mine' && s.notesTabActive]}
            onPress={() => setTab('mine')}
            activeOpacity={0.7}
          >
            <Text style={[s.notesTabText, tab === 'mine' && s.notesTabTextActive]}>My Notes</Text>
          </TouchableOpacity>
        </View>

        {tab === 'sermon' ? (
          notesUrl && !notesError ? (
            <WebView source={{ uri: notesUrl }} style={{ flex: 1 }} startInLoadingState
              onError={() => setNotesError(true)}
              onHttpError={({ nativeEvent }) => { if (nativeEvent.statusCode >= 400) setNotesError(true); }} />
          ) : (
            <View style={s.noNotes}>
              <Ionicons name="document-text-outline" size={48} color={Colors.gray200} style={{ marginBottom: Spacing.md }} />
              <Text style={s.noNotesText}>Notes aren't available for this message yet. Check back after the service.</Text>
            </View>
          )
        ) : (
          <KeyboardAvoidingView
            style={s.myNotesWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <TextInput
              style={s.myNotesInput}
              value={myNote}
              onChangeText={changeMyNote}
              placeholder="Jot down anything that stands out during this message…"
              placeholderTextColor={Colors.gray400}
              multiline
              textAlignVertical="top"
            />
            <Text style={s.myNotesHint}>Saved on this device only</Text>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modal: { flex: 1, backgroundColor: Colors.white },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.cedar, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  modalTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.lg, color: Colors.cream },
  modalSub: { fontFamily: Fonts.body, fontSize: FontSizes.xs, color: 'rgba(250,248,243,0.65)', marginTop: 2 },
  noNotes: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  noNotesText: { fontFamily: Fonts.body, fontSize: FontSizes.base, color: Colors.gray400, textAlign: 'center' },
  notesTabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.cedar,
  },
  notesTab: {
    flex: 1,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  notesTabActive: { backgroundColor: Colors.gold },
  notesTabText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.cream,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  notesTabTextActive: { color: Colors.cedar },
  myNotesWrap: { flex: 1, padding: Spacing.md, backgroundColor: Colors.cream },
  myNotesInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    color: Colors.black,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  myNotesHint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
});
