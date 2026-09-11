import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Fonts, FontSizes, Spacing, Radius } from '../constants/theme';
import { attendanceApi, AttendanceStatus, CheckInOutcome, SearchResult } from '../attendance/api';
import { clearStoredPersonId, getStoredPersonId, setStoredPersonId } from '../attendance/storage';

type Screen = 'loading' | 'search' | 'results' | 'register' | 'success';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [screen, setScreen] = useState<Screen>('loading');
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthdate, setBirthdate] = useState('');

  const [outcome, setOutcome] = useState<CheckInOutcome | null>(null);

  useEffect(() => {
    attendanceApi.status().then(setStatus).catch(() => {});

    getStoredPersonId().then((personId) => {
      if (personId) {
        checkIn(personId);
      } else {
        setScreen('search');
      }
    });
    // Only ever run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkIn(personId: string) {
    setScreen('loading');
    setMessage('');
    try {
      const result = await attendanceApi.checkIn(personId);
      if (result.success) {
        await setStoredPersonId(personId);
        setOutcome(result);
        setScreen('success');
      } else {
        setMessage(result.message || 'We could not check you in.');
        setScreen('search');
      }
    } catch {
      setMessage('We could not check you in. Please try again.');
      setScreen('search');
    }
  }

  async function handleSearch() {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMessage('Please enter your phone number or name.');
      return;
    }

    setMessage('');
    setSubmitting(true);
    try {
      const data = await attendanceApi.search(trimmed);
      if (!data.success) {
        setMessage(data.message || 'Search failed. Please try again.');
      } else if (data.results.length === 0) {
        goToRegister(trimmed);
      } else {
        setResults(data.results);
        setScreen('results');
      }
    } catch {
      setMessage('Search failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function goToRegister(typed: string) {
    setMessage('');
    const digits = digitsOnly(typed);
    const looksLikePhone = /^[0-9+()\-.\s]+$/.test(typed) && digits.length >= 7;
    if (looksLikePhone) {
      setPhone(typed);
      setFirstName('');
      setLastName('');
    } else {
      const parts = typed.split(/\s+/);
      setFirstName(parts[0] ?? '');
      setLastName(parts.slice(1).join(' '));
      setPhone('');
    }
    setEmail('');
    setBirthdate('');
    setScreen('register');
  }

  async function handlePickResult(person: SearchResult) {
    setMessage('');
    setSubmitting(true);
    try {
      const result = await attendanceApi.checkIn(person.id);
      if (result.success) {
        await setStoredPersonId(person.id);
        setOutcome(result);
        setScreen('success');
      } else {
        setMessage(result.message || 'We could not check you in.');
      }
    } catch {
      setMessage('We could not check you in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister() {
    if (!firstName.trim() || !lastName.trim()) {
      setMessage('Please enter your first and last name.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setMessage('Please enter a phone number or an email address.');
      return;
    }
    if (phone.trim() && digitsOnly(phone).length < 10) {
      setMessage('Please enter a full phone number, including the area code.');
      return;
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setMessage('Please enter a valid email address.');
      return;
    }

    setMessage('');
    setSubmitting(true);
    try {
      const result = await attendanceApi.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        birthdate: birthdate.trim(),
      });
      if (result.success) {
        if (result.personId) await setStoredPersonId(result.personId);
        setOutcome(result);
        setScreen('success');
      } else {
        setMessage(result.message || 'We could not add you.');
      }
    } catch {
      setMessage('We could not add you. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setMessage('');
    setQuery('');
    setResults([]);
    setOutcome(null);
    setScreen('search');
  }

  async function notYou() {
    await clearStoredPersonId();
    reset();
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity style={s.closeButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color={Colors.cream} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Check In</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent} keyboardShouldPersistTaps="handled">
          {status?.eventName ? (
            <View style={s.eventInfo}>
              <Text style={s.eventName}>{status.eventName}</Text>
              {status.eventDate ? <Text style={s.eventDate}>{status.eventDate}</Text> : null}
            </View>
          ) : null}

          {status?.message ? <Text style={s.notice}>{status.message}</Text> : null}
          {message ? <Text style={s.error}>{message}</Text> : null}

          {screen === 'loading' && (
            <View style={s.centered}>
              <ActivityIndicator color={Colors.cedar} size="large" />
            </View>
          )}

          {screen === 'search' && (
            <View>
              <Text style={s.label}>Phone number or name</Text>
              <TextInput
                style={s.input}
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. 615 555 0134 or Jane Smith"
                placeholderTextColor={Colors.gray400}
                autoCapitalize="words"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                editable={status?.canCheckIn !== false}
              />
              {status?.ageRange ? <Text style={s.hint}>Check-in is for ages {status.ageRange}.</Text> : null}
              <TouchableOpacity
                style={[s.primaryButton, (submitting || status?.canCheckIn === false) && s.buttonDisabled]}
                onPress={handleSearch}
                disabled={submitting || status?.canCheckIn === false}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={s.primaryButtonText}>Find me</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {screen === 'results' && (
            <View>
              <Text style={s.hint}>Tap your name to check in.</Text>
              {results.map((person) => (
                <TouchableOpacity
                  key={person.id}
                  style={s.result}
                  onPress={() => handlePickResult(person)}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultName}>{person.name}</Text>
                    <Text style={s.resultDetail}>
                      {[person.phoneHint, person.emailHint].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.cedar} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.secondaryButton} onPress={() => goToRegister(query)} activeOpacity={0.8}>
                <Text style={s.secondaryButtonText}>I'm not on this list</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryButton} onPress={reset} activeOpacity={0.8}>
                <Text style={s.secondaryButtonText}>Search again</Text>
              </TouchableOpacity>
            </View>
          )}

          {screen === 'register' && (
            <View>
              <Text style={s.hint}>We could not find you, so let's add you.</Text>

              <Text style={s.label}>First name *</Text>
              <TextInput style={s.input} value={firstName} onChangeText={setFirstName} autoCapitalize="words" />

              <Text style={s.label}>Last name *</Text>
              <TextInput style={s.input} value={lastName} onChangeText={setLastName} autoCapitalize="words" />

              {status?.ageRange ? (
                <>
                  <Text style={s.label}>Date of birth (YYYY-MM-DD)</Text>
                  <TextInput
                    style={s.input}
                    value={birthdate}
                    onChangeText={setBirthdate}
                    placeholder="2011-04-30"
                    placeholderTextColor={Colors.gray400}
                  />
                </>
              ) : null}

              <Text style={s.label}>Mobile number</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor={Colors.gray400}
              />

              <Text style={s.label}>Email address</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={Colors.gray400}
              />

              <Text style={s.hint}>Please give us a phone number or an email address.</Text>

              <TouchableOpacity
                style={[s.primaryButton, submitting && s.buttonDisabled]}
                onPress={handleRegister}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={s.primaryButtonText}>Add me &amp; check in</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.secondaryButton} onPress={reset} activeOpacity={0.8}>
                <Text style={s.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {screen === 'success' && outcome && (
            <View style={s.success}>
              <View style={s.tick}>
                <Ionicons name="checkmark" size={42} color={Colors.white} />
              </View>
              <Text style={s.successTitle}>
                {outcome.alreadyCheckedIn
                  ? `Thanks${outcome.personName ? `, ${outcome.personName.split(' ')[0]}` : ''}!`
                  : `You're checked in${outcome.personName ? `, ${outcome.personName.split(' ')[0]}` : ''}!`}
              </Text>
              <Text style={s.successDetail}>
                {outcome.alreadyCheckedIn
                  ? `You're already checked in${outcome.eventName ? ` for ${outcome.eventName}` : ''}.`
                  : outcome.eventName || ''}
              </Text>
              <TouchableOpacity style={s.notYouLink} onPress={notYou}>
                <Text style={s.notYouLinkText}>Not you? Switch profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerTitle: { fontFamily: Fonts.heading, fontSize: FontSizes.lg, color: Colors.cream },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  centered: { paddingVertical: Spacing['2xl'], alignItems: 'center' },
  eventInfo: {
    backgroundColor: Colors.gray100,
    borderLeftWidth: 4,
    borderLeftColor: Colors.cedar,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  eventName: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.md, color: Colors.cedar },
  eventDate: { fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.gray600, marginTop: 2 },
  notice: {
    backgroundColor: '#fff3cd',
    color: '#856404',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
  },
  error: {
    backgroundColor: '#fdecea',
    color: Colors.error,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: 2,
    borderColor: Colors.gray200,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    color: Colors.black,
  },
  hint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.gray600,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.cedar,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.base, color: Colors.white },
  secondaryButton: {
    backgroundColor: Colors.gray100,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  secondaryButtonText: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.base, color: Colors.cedar },
  result: {
    borderWidth: 2,
    borderColor: Colors.gray200,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resultName: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.md, color: Colors.black },
  resultDetail: { fontFamily: Fonts.body, fontSize: FontSizes.sm, color: Colors.gray600, marginTop: 2 },
  success: { alignItems: 'center', paddingTop: Spacing.xl },
  tick: {
    width: 84,
    height: 84,
    borderRadius: Radius.full,
    backgroundColor: Colors.cedar,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: { fontFamily: Fonts.heading, fontSize: FontSizes['2xl'], color: Colors.cedar, marginBottom: Spacing.xs },
  successDetail: { fontFamily: Fonts.body, fontSize: FontSizes.base, color: Colors.gray600, textAlign: 'center' },
  notYouLink: { marginTop: Spacing.xl, padding: Spacing.sm },
  notYouLinkText: { fontFamily: Fonts.bodyMedium, fontSize: FontSizes.sm, color: Colors.cedarMid },
});
