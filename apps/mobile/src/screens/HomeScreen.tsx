import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Fonts, FontSizes, Spacing, Radius, Shadow } from '../constants/theme';
import { GoldButton, LoadingView, ErrorView } from '../components/shared';
import { SermonNotesModal } from '../components/SermonNotesModal';
import { api } from '../api/client';
import { getUnreadCount } from '../notificationHistory';
import type { HomeData, Settings } from '../types';
import {
  isServiceDayMode,
  minutesUntilNextService,
  summarizeServiceTimes,
  serviceTimesOf,
} from '../lib/serviceTimes';

// Service-day handling lives in lib/serviceTimes.ts, derived from whatever
// days this church published rather than assuming Sunday and Wednesday.

/**
 * The church's own short name, supplied by its brand file at build time.
 * No name is hardcoded anywhere in this app.
 */
const CHURCH_SHORT_NAME: string =
  (Constants.expoConfig?.extra?.shortName as string | undefined) ??
  (Constants.expoConfig?.extra?.churchName as string | undefined) ??
  '';

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const TODAY_LABEL = WEEKDAY_NAMES[new Date().getDay()];

/** Opens a configured URL, and does nothing when there isn't one. */
function openIfSet(url: string | null | undefined): void {
  if (url) Linking.openURL(url);
}

const PRIVACY_POLICY_URL =
  (Constants.expoConfig?.extra?.privacyPolicyUrl as string | undefined) ?? null;
const TERMS_URL =
  (Constants.expoConfig?.extra?.termsUrl as string | undefined) ?? null;

/**
 * The API stores birthdates in Planning Center, which only accepts
 * YYYY-MM-DD. This field is free text, so convert here and treat anything
 * unparseable as invalid rather than sending it on to be rejected.
 */
function toIsoDate(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match.map(Number) as unknown as [string, number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > new Date().getFullYear()) return null;
  const asDate = new Date(Date.UTC(year, month - 1, day));
  if (asDate.getUTCMonth() !== month - 1 || asDate.getUTCDate() !== day) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * The API explains why it rejected a submission (a missing field, a rate
 * limit); show that rather than a generic retry prompt the user can't act on.
 */
function submitErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message.trim() : '';
  // A bare status line is noise to a member — fall back to plain language.
  if (!message || /^API .* returned \d+$/.test(message)) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }
  return message;
}

// ── Big action card ───────────────────────────────────────────────────────────

const CARD_BACKGROUNDS = {
  cedar: Colors.cedar,
  cedarMid: Colors.cedarMid,
  gold: Colors.gold,
} as const;

function ActionCard({ icon, title, subtitle, ctaLabel, onPress, background = 'cedar' }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  onPress: () => void;
  background?: keyof typeof CARD_BACKGROUNDS;
}) {
  const onGold = background === 'gold';
  return (
    <TouchableOpacity
      style={[s.bigCard, { backgroundColor: CARD_BACKGROUNDS[background] }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[s.bigCardIconWrap, onGold && s.bigCardIconWrapOnGold]}>
        <Ionicons name={icon} size={18} color={onGold ? Colors.cedar : Colors.cream} />
      </View>
      <Text style={[s.bigCardTitle, onGold && s.bigCardTitleOnGold]}>{title}</Text>
      {subtitle ? <Text style={[s.bigCardSubtitle, onGold && s.bigCardSubtitleOnGold]}>{subtitle}</Text> : null}
      <View style={s.bigCardCtaPill}>
        <Text style={s.bigCardCtaBold}>CLICK HERE</Text>
        <Text style={s.bigCardCtaRest}> {ctaLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectVisible, setConnectVisible] = useState(false);
  const [notesVisible, setNotesVisible] = useState(false);
  const [prayerVisible, setPrayerVisible] = useState(false);
  // Whether to show the service-day layout. Derived from the church's own
  // schedule once settings arrive, not from an assumption about Sunday.
  const [serviceDayMode, setServiceDayMode] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const settings = data?.settings;
  const serviceSummary = settings ? summarizeServiceTimes(settings) : '';
  const hasSchedule = settings ? Object.keys(serviceTimesOf(settings)).length > 0 : false;

  useFocusEffect(
    useCallback(() => {
      getUnreadCount().then(setUnreadNotifications);
    }, [])
  );

  const load = useCallback(async () => {
    try {
      setError(false);
      const home = await api.home();
      setData(home);
      if (home?.settings) setServiceDayMode(isServiceDayMode(home.settings));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView onRetry={load} />;

  const bulletinUrl = data.settings.bulletin_pdf_url || null;
  const newsletterUrl = data.settings.newsletter_pdf_url || null;
  const givingUrl = data.settings.giving_url || null;
  const minsUntil = minutesUntilNextService(data.settings);
  const hasNotes = data.latestSermon?.source === 'pco';

  const openBulletin = () => bulletinUrl ? Linking.openURL(bulletinUrl) : Alert.alert('Coming Soon', 'The bulletin will be available here soon.');
  const openNewsletter = () => newsletterUrl ? Linking.openURL(newsletterUrl) : Alert.alert('Coming Soon', 'The newsletter will be available here soon.');
  const openGiving = () => givingUrl ? Linking.openURL(givingUrl) : Alert.alert('Coming Soon', 'Online giving will be available here soon.');
  const openNotes = () => setNotesVisible(true);

  return (
    <>
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingBottom: Spacing.xl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.gold} colors={[Colors.gold]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[s.hero, { paddingTop: insets.top + Spacing.sm }]}>
          <TouchableOpacity
            style={s.bellButton}
            onPress={() => navigation.navigate('NotificationHistory' as never)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={Colors.cream} />
            {unreadNotifications > 0 ? <View style={s.bellBadge} /> : null}
          </TouchableOpacity>
          <Image source={require('../../assets/icon.png')} style={s.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={s.churchName}>{CHURCH_SHORT_NAME}</Text>
            {!!serviceSummary && <Text style={s.churchSub}>{serviceSummary}</Text>}
          </View>
          {/*
            Only offered when this church has a schedule to be in the middle
            of; the label names the actual day rather than assuming Sunday.
          */}
          {hasSchedule && (
            <TouchableOpacity style={s.dayToggle} onPress={() => setServiceDayMode(v => !v)} activeOpacity={0.7}>
              <Ionicons name={serviceDayMode ? 'sunny' : 'calendar-outline'} size={12} color={Colors.cream} />
              <Text style={s.dayToggleText}>{serviceDayMode ? TODAY_LABEL : 'Weekday'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.cardStack}>
          {(serviceDayMode || data.liveStream?.isLive) && (
            <ActionCard
              icon="radio"
              title="Live Now"
              subtitle={
                data.liveStream?.isLive
                  ? 'We are live right now'
                  : minsUntil > 0 ? `Next service in ${minsUntil} minutes` : 'Service in progress'
              }
              ctaLabel="to watch the live stream."
              background="gold"
              onPress={() => data.liveStream?.isLive && data.liveStream?.url ? Linking.openURL(data.liveStream.url) : Alert.alert('Not Live Yet', 'The stream will start soon.')}
            />
          )}

          {serviceDayMode && hasNotes && (
            <ActionCard
              icon="document-text"
              title="Sermon Notes"
              subtitle={data.latestSermon?.series_title || undefined}
              ctaLabel="to follow along with this week's notes."
              background="cedarMid"
              onPress={openNotes}
            />
          )}

          <ActionCard
            icon="calendar"
            title="This Sunday"
            subtitle={summarizeServiceTimes(data.settings)}
            ctaLabel="for this week's bulletin."
            background="cedar"
            onPress={openBulletin}
          />

          <ActionCard
            icon="people"
            title="Connect Card"
            subtitle="We'd love to meet you."
            ctaLabel="to introduce yourself."
            background="gold"
            onPress={() => setConnectVisible(true)}
          />

          <ActionCard
            icon="gift"
            title="Giving"
            ctaLabel="to give online."
            background="cedar"
            onPress={openGiving}
          />

          <ActionCard
            icon="mail"
            title="Newsletter"
            ctaLabel="for the latest newsletter."
            background="cedarMid"
            onPress={openNewsletter}
          />

          <ActionCard
            icon="heart"
            title="Prayer Requests"
            subtitle="We'd love to pray for you."
            ctaLabel="to share a prayer request."
            background="cedarMid"
            onPress={() => setPrayerVisible(true)}
          />

          <View style={s.legalRow}>
            <TouchableOpacity onPress={() => openIfSet(PRIVACY_POLICY_URL)}>
              <Text style={s.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={s.legalDivider}>·</Text>
            <TouchableOpacity onPress={() => openIfSet(TERMS_URL)}>
              <Text style={s.legalLink}>Terms of Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Prayer request modal */}
      <Modal visible={prayerVisible} animationType="slide" onRequestClose={() => setPrayerVisible(false)}>
        <PrayerRequestModal onClose={() => setPrayerVisible(false)} />
      </Modal>

      {/* Connect card modal */}
      <Modal visible={connectVisible} animationType="slide" onRequestClose={() => setConnectVisible(false)}>
        <ConnectCardModal onClose={() => setConnectVisible(false)} />
      </Modal>

      <SermonNotesModal
        visible={notesVisible}
        sermon={data.latestSermon}
        onClose={() => setNotesVisible(false)}
      />
    </>
  );
}

// ── Prayer Request Modal ──────────────────────────────────────────────────────

function PrayerRequestModal({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [request, setRequest] = useState('');
  const [replyRequested, setReplyRequested] = useState(false);
  const [onPrayerList, setOnPrayerList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!firstName.trim() || !request.trim()) {
      Alert.alert('Required', "Please enter your first name and your prayer request.");
      return;
    }
    if (replyRequested && !email.trim() && !phone.trim()) {
      Alert.alert('Contact Info Needed', 'Please provide an email or phone number so we can follow up with you.');
      return;
    }
    setLoading(true);
    try {
      await api.submitPrayerRequest({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        request: request.trim(),
        reply_requested: replyRequested,
        prayer_list: onPrayerList,
      });
      setSubmitted(true);
    } catch (e) {
      Alert.alert('Could Not Submit', submitErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: Colors.cream }}>
      <View style={[cm.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={cm.title}>Prayer Request</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={22} color={Colors.cream} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={cm.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {submitted ? (
          <View style={cm.successWrap}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.cedarMid} />
            <Text style={cm.successTitle}>Thank You!</Text>
            <Text style={cm.successText}>Your prayer request has been received.</Text>
          </View>
        ) : (
          <>
            <CSection title="Your Name">
              <View style={cm.row}>
                <CField label="First Name *" value={firstName} onChangeText={setFirstName} placeholder="Jane" style={{ flex: 1 }} />
                <CField label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Smith" style={{ flex: 1 }} />
              </View>
            </CSection>

            <CSection title="Contact Info" subtitle="Optional, unless you'd like a reply.">
              <View style={cm.row}>
                <CField label="Email" value={email} onChangeText={setEmail} placeholder="jane@example.com" keyboardType="email-address" autoCapitalize="none" style={{ flex: 1 }} />
                <CField label="Phone" value={phone} onChangeText={setPhone} placeholder="(205) 555-0100" keyboardType="phone-pad" style={{ flex: 1 }} />
              </View>
            </CSection>

            <CSection title="Your Request">
              <Text style={cm.fieldLabel}>Prayer Request *</Text>
              <TextInput
                style={[cm.fieldInput, cm.textarea]}
                value={request}
                onChangeText={setRequest}
                placeholder="Share what's on your heart…"
                placeholderTextColor={Colors.gray400}
                multiline
                textAlignVertical="top"
              />
            </CSection>

            <CSection title="Options">
              <TouchableOpacity style={cm.checkRow} onPress={() => setReplyRequested(v => !v)} activeOpacity={0.7}>
                <View style={[cm.checkbox, replyRequested && cm.checkboxChecked]}>
                  {replyRequested && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                </View>
                <Text style={cm.checkLabel}>I would like someone to follow up with me</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cm.checkRow} onPress={() => setOnPrayerList(v => !v)} activeOpacity={0.7}>
                <View style={[cm.checkbox, onPrayerList && cm.checkboxChecked]}>
                  {onPrayerList && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                </View>
                <Text style={cm.checkLabel}>Add this to the church prayer list</Text>
              </TouchableOpacity>
            </CSection>

            <Text style={cm.legalHint}>
              By submitting, you agree to our{' '}
              <Text style={cm.legalHintLink} onPress={() => openIfSet(PRIVACY_POLICY_URL)}>
                Privacy Policy
              </Text>.
            </Text>

            <GoldButton label="Submit Prayer Request" onPress={submit} loading={loading} style={cm.submitBtn} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Connect Card Modal ────────────────────────────────────────────────────────

const SPIRITUAL_OPTIONS = [
  'I am a Christian',
  'I have been baptized',
  `I am a member of ${CHURCH_SHORT_NAME}`,
  'I would like to become a member',
  'I recently gave my life to Christ',
  'I made a rededication of faith',
  'I would like to be baptized',
  'I am exploring Christianity',
];

const HOW_FOUND_OPTIONS = [
  'Friend or family member',
  'Drove by the church',
  'Facebook / Instagram',
  'Google search',
  'Community event',
  'Other',
];

interface Child { name: string; grade: string }

function ConnectCardModal({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [spouseName, setSpouseName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('AL');
  const [zip, setZip] = useState('');
  const [children, setChildren] = useState<Child[]>([]);
  const [spiritual, setSpiritual] = useState<Set<string>>(new Set());
  const [howFound, setHowFound] = useState('');
  const [notes, setNotes] = useState('');
  const [prayer, setPrayer] = useState('');
  const [prayerPrivacy, setPrayerPrivacy] = useState<'congregation' | 'pastoral'>('congregation');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleSpiritual = (opt: string) => {
    setSpiritual(prev => {
      const next = new Set(prev);
      next.has(opt) ? next.delete(opt) : next.add(opt);
      return next;
    });
  };

  const addChild = () => setChildren(c => [...c, { name: '', grade: '' }]);
  const updateChild = (i: number, field: keyof Child, val: string) =>
    setChildren(c => c.map((ch, idx) => idx === i ? { ...ch, [field]: val } : ch));
  const removeChild = (i: number) => setChildren(c => c.filter((_, idx) => idx !== i));

  const submit = async () => {
    // Last name is required by the API too. Validating only first name and
    // email here meant anyone who left it blank got a generic "could not
    // submit" with no way to work out what was wrong.
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Required', 'Please enter your first name, last name, and email.');
      return;
    }
    if (birthdate.trim() && !toIsoDate(birthdate)) {
      Alert.alert('Check Birthdate', 'Please enter your birthdate as MM/DD/YYYY, or leave it blank.');
      return;
    }
    setLoading(true);
    try {
      await api.submitConnectCard({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        birthdate: toIsoDate(birthdate) ?? undefined,
        spouse_name: spouseName.trim() || undefined,
        address: street.trim() ? { street: street.trim(), city: city.trim(), state: stateVal.trim(), zip: zip.trim() } : undefined,
        children: children.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), grade: c.grade.trim() })),
        spiritual_journey: Array.from(spiritual),
        how_found: howFound || undefined,
        notes: notes.trim() || undefined,
        prayer_request: prayer.trim() || undefined,
        prayer_privacy: prayer.trim() ? prayerPrivacy : undefined,
      });
      setSubmitted(true);
    } catch (e) {
      Alert.alert('Could Not Submit', submitErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: Colors.cream }}>
      <View style={[cm.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={cm.title}>Connect Card</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={22} color={Colors.cream} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={cm.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {submitted ? (
          <View style={cm.successWrap}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.cedarMid} />
            <Text style={cm.successTitle}>Thank You!</Text>
            <Text style={cm.successText}>We'll be in touch soon. We're so glad you were here.</Text>
          </View>
        ) : (
          <>
            <CSection title="Personal Information">
              <View style={cm.row}>
                <CField label="First Name *" value={firstName} onChangeText={setFirstName} placeholder="Jane" style={{ flex: 1 }} />
                <CField label="Last Name *" value={lastName} onChangeText={setLastName} placeholder="Smith" style={{ flex: 1 }} />
              </View>
              <View style={cm.row}>
                <CField label="Email *" value={email} onChangeText={setEmail} placeholder="jane@example.com" keyboardType="email-address" autoCapitalize="none" style={{ flex: 1 }} />
                <CField label="Phone" value={phone} onChangeText={setPhone} placeholder="(205) 555-0100" keyboardType="phone-pad" style={{ flex: 1 }} />
              </View>
              <View style={cm.row}>
                <CField label="Birthdate" value={birthdate} onChangeText={setBirthdate} placeholder="MM/DD/YYYY" keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
                <CField label="Spouse's Name" value={spouseName} onChangeText={setSpouseName} placeholder="John" style={{ flex: 1 }} />
              </View>
            </CSection>

            <CSection title="Home Address">
              <CField label="Street Address" value={street} onChangeText={setStreet} placeholder="123 Main St" />
              <View style={cm.row}>
                <CField label="City" value={city} onChangeText={setCity} placeholder="City" style={{ flex: 2 }} />
                <CField label="State" value={stateVal} onChangeText={setStateVal} placeholder="AL" style={{ flex: 1 }} />
                <CField label="ZIP" value={zip} onChangeText={setZip} placeholder="35094" keyboardType="number-pad" style={{ flex: 1 }} />
              </View>
            </CSection>

            <CSection title="Children at Home" subtitle="Name and grade or age.">
              {children.map((ch, i) => (
                <View key={i} style={cm.childRow}>
                  <CField label="Name" value={ch.name} onChangeText={v => updateChild(i, 'name', v)} placeholder="Child's name" style={{ flex: 2 }} />
                  <CField label="Grade / Age" value={ch.grade} onChangeText={v => updateChild(i, 'grade', v)} placeholder="3rd" style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => removeChild(i)} style={cm.removeChild} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={Colors.gray400} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={cm.addChildBtn} onPress={addChild} activeOpacity={0.75}>
                <Ionicons name="add" size={16} color={Colors.cedar} />
                <Text style={cm.addChildText}>Add Child</Text>
              </TouchableOpacity>
            </CSection>

            <CSection title="Spiritual Journey" subtitle="Check all that apply.">
              <View style={cm.checkGrid}>
                {SPIRITUAL_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt} style={cm.checkRow} onPress={() => toggleSpiritual(opt)} activeOpacity={0.7}>
                    <View style={[cm.checkbox, spiritual.has(opt) && cm.checkboxChecked]}>
                      {spiritual.has(opt) && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                    </View>
                    <Text style={cm.checkLabel}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </CSection>

            <CSection title="How You Found Us">
              <View style={cm.selectWrap}>
                {HOW_FOUND_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt} style={[cm.selectOption, howFound === opt && cm.selectOptionActive]} onPress={() => setHowFound(opt)} activeOpacity={0.7}>
                    <Text style={[cm.selectOptionText, howFound === opt && cm.selectOptionTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </CSection>

            <CSection title="Notes & Prayer Requests">
              <Text style={cm.fieldLabel}>General Notes or Questions</Text>
              <TextInput style={[cm.fieldInput, cm.textarea]} value={notes} onChangeText={setNotes} placeholder="Anything you'd like us to know…" placeholderTextColor={Colors.gray400} multiline textAlignVertical="top" />
              <Text style={[cm.fieldLabel, { marginTop: Spacing.sm }]}>Prayer Request</Text>
              <TextInput style={[cm.fieldInput, cm.textarea]} value={prayer} onChangeText={setPrayer} placeholder="Share a prayer request…" placeholderTextColor={Colors.gray400} multiline textAlignVertical="top" />
              {prayer.trim().length > 0 && (
                <>
                  <Text style={[cm.fieldLabel, { marginTop: Spacing.sm }]}>Prayer Request Privacy</Text>
                  {(['congregation', 'pastoral'] as const).map(opt => (
                    <TouchableOpacity key={opt} style={cm.radioRow} onPress={() => setPrayerPrivacy(opt)} activeOpacity={0.7}>
                      <View style={[cm.radio, prayerPrivacy === opt && cm.radioActive]} />
                      <Text style={cm.radioLabel}>{opt === 'congregation' ? 'Share with the congregation' : 'Share with the pastoral team only'}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </CSection>

            <Text style={cm.legalHint}>
              By submitting, you agree to our{' '}
              <Text style={cm.legalHintLink} onPress={() => openIfSet(PRIVACY_POLICY_URL)}>
                Privacy Policy
              </Text>.
            </Text>

            <GoldButton label="Submit Connect Card" onPress={submit} loading={loading} style={cm.submitBtn} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={cm.section}>
      <Text style={cm.sectionTitle}>{title}</Text>
      {subtitle && <Text style={cm.sectionSub}>{subtitle}</Text>}
      {children}
    </View>
  );
}

function CField({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, style }: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: any; autoCapitalize?: any; style?: any;
}) {
  return (
    <View style={[cm.fieldWrap, style]}>
      <Text style={cm.fieldLabel}>{label}</Text>
      <TextInput
        style={cm.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.gray400}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
        returnKeyType="next"
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },

  // Hero
  hero: {
    backgroundColor: Colors.cedar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  logo: { width: 46, height: 46, borderRadius: Radius.sm },
  bellButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold,
    borderWidth: 1,
    borderColor: Colors.cedar,
  },
  churchName: { fontFamily: Fonts.heading, fontSize: FontSizes.xl, color: Colors.cream },
  churchSub: { fontFamily: Fonts.body, fontSize: FontSizes.sm, color: 'rgba(250,248,243,0.6)', marginTop: 1 },
  dayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  dayToggleText: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.xs, color: Colors.cream },

  // Big action cards
  cardStack: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  bigCard: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  bigCardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  bigCardIconWrapOnGold: { backgroundColor: 'rgba(39,57,32,0.12)' },
  bigCardTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.cream,
  },
  bigCardTitleOnGold: { color: Colors.cedar },
  bigCardSubtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: 'rgba(250,248,243,0.75)',
    marginTop: 4,
  },
  bigCardSubtitleOnGold: { color: 'rgba(39,57,32,0.75)' },
  bigCardCtaPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: Colors.cream,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    marginTop: Spacing.md,
  },
  bigCardCtaBold: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.sm,
    color: Colors.cedar,
    textDecorationLine: 'underline',
  },
  bigCardCtaRest: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.cedar,
  },

  // Legal row
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  legalLink: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    textDecorationLine: 'underline',
  },
  legalDivider: { fontSize: FontSizes.xs, color: Colors.gray400 },

});

const cm = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.cedar, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
  },
  title: { fontFamily: Fonts.heading, fontSize: FontSizes['2xl'], color: Colors.cream },
  scroll: { paddingBottom: Spacing.xl * 2 },

  section: {
    backgroundColor: Colors.white, marginTop: Spacing.md,
    marginHorizontal: Spacing.md, borderRadius: Radius.md,
    padding: Spacing.md, ...Shadow.sm,
  },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.lg, color: Colors.cedar, marginBottom: 4 },
  sectionSub: { fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.gray400, marginBottom: Spacing.sm },

  row: { flexDirection: 'row', gap: Spacing.sm },
  fieldWrap: { marginBottom: Spacing.sm },
  fieldLabel: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.sm, color: Colors.cedar, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1, borderColor: Colors.gray200, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 4,
    fontFamily: Fonts.body, fontSize: FontSizes.base, color: Colors.black,
    backgroundColor: Colors.cream,
  },
  textarea: { height: 88, paddingTop: Spacing.xs + 4 },

  childRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginBottom: Spacing.sm },
  removeChild: { paddingBottom: Spacing.xs + 2 },
  addChildBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: Spacing.xs, alignSelf: 'flex-start' },
  addChildText: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.sm, color: Colors.cedar },

  checkGrid: { gap: Spacing.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5 },
  checkbox: { width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.gray400, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.cedar, borderColor: Colors.cedar },
  checkLabel: { fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.black, flex: 1 },

  selectWrap: { gap: Spacing.xs },
  selectOption: { paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.gray200, backgroundColor: Colors.cream },
  selectOptionActive: { borderColor: Colors.cedar, backgroundColor: 'rgba(39,57,32,0.06)' },
  selectOptionText: { fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.gray600 },
  selectOptionTextActive: { color: Colors.cedar, fontFamily: Fonts.bodyMedium },

  radioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 5 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.gray400 },
  radioActive: { borderColor: Colors.cedar, borderWidth: 5 },
  radioLabel: { fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.black },

  legalHint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.gray400,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  legalHintLink: { textDecorationLine: 'underline', color: Colors.gray600 },

  submitBtn: { marginHorizontal: Spacing.md, marginTop: Spacing.sm },

  successWrap: { alignItems: 'center', paddingVertical: Spacing.xl * 2, paddingHorizontal: Spacing.xl },
  successTitle: { fontFamily: Fonts.heading, fontSize: FontSizes['2xl'], color: Colors.cedar, marginBottom: Spacing.sm, marginTop: Spacing.md },
  successText: { fontFamily: Fonts.body, fontSize: FontSizes.base, color: Colors.gray600, textAlign: 'center', lineHeight: 22 },
});
