import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import Constants from 'expo-constants';
import { Colors, Fonts, FontSizes, Spacing, Radius } from '../constants/theme';

const CHURCH_CENTER_URL =
  (Constants.expoConfig?.extra?.churchCenterUrl as string | undefined) ?? null;

// The Account tab's `tabPress` listener (see AppNavigator) opens Church Center
// in the system browser and prevents this screen from ever being shown —
// logging into Church Center inside an embedded webview isn't allowed by its
// terms of service. This component only renders if the tab is ever reached
// directly (e.g. a deep link bypassing the listener), so it opens the browser
// itself and offers a manual retry.
export default function AccountScreen() {
  useEffect(() => {
    if (CHURCH_CENTER_URL) Linking.openURL(CHURCH_CENTER_URL);
  }, []);

  // Reachable only by deep link on a deployment with no Church Center
  // configured — the tab itself is hidden in that case.
  if (!CHURCH_CENTER_URL) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.body}>Online accounts aren't set up for this church.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.body}>Opening your account in the browser…</Text>
      <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(CHURCH_CENTER_URL)}>
        <Text style={styles.buttonText}>Open in Browser</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.cedar,
    marginBottom: Spacing.sm,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    color: Colors.gray600,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.cedar,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
  },
  buttonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.md,
    color: Colors.cream,
  },
});
