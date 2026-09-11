import React from 'react';
import { StyleSheet, Platform, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Colors, Fonts, FontSizes } from '../constants/theme';
import { navigationRef } from './navigationRef';
import { flushPendingNotificationRoute } from '../notifications';
import { flushPendingAttendanceLink } from '../attendanceLink';

import HomeScreen from '../screens/HomeScreen';
import EventsScreen from '../screens/EventsScreen';
import MediaScreen from '../screens/MediaScreen';
import BibleScreen from '../screens/BibleScreen';
import AccountScreen from '../screens/AccountScreen';
import NotificationHistoryScreen from '../screens/NotificationHistoryScreen';
import NotificationDetailScreen from '../screens/NotificationDetailScreen';
import CheckInScreen from '../screens/CheckInScreen';

const CHURCH_CENTER_URL =
  (Constants.expoConfig?.extra?.churchCenterUrl as string | undefined) ?? null;

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  Home:    { active: 'home',           inactive: 'home-outline' },
  Events:  { active: 'calendar',       inactive: 'calendar-outline' },
  Watch:   { active: 'play-circle',    inactive: 'play-circle-outline' },
  Bible:   { active: 'book',           inactive: 'book-outline' },
  Account: { active: 'person-circle',  inactive: 'person-circle-outline' },
};

function TabsNavigator() {
  const insets = useSafeAreaInsets();

  const tabBarHeight = Platform.OS === 'ios' ? 60 : 56;
  const tabBarPaddingBottom = Platform.OS === 'ios' ? 16 : 8;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          ...styles.tabBar,
          height: tabBarHeight + insets.bottom,
          paddingBottom: tabBarPaddingBottom + insets.bottom,
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <Ionicons
              name={focused ? icons?.active : icons?.inactive}
              size={22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Watch" component={MediaScreen} />
      <Tab.Screen name="Bible" component={BibleScreen} />
      {/*
        The Account tab is entirely Church Center. A church that does not use
        Church Center has no account surface to show, so the tab is omitted
        rather than left in place opening nothing.
      */}
      {CHURCH_CENTER_URL && (
        <Tab.Screen
          name="Account"
          component={AccountScreen}
          listeners={{
            // Church Center's login doesn't allow being embedded in an
            // in-app webview, so open it in the system browser instead of
            // navigating to the tab.
            tabPress: (e) => {
              e.preventDefault();
              Linking.openURL(CHURCH_CENTER_URL);
            },
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        flushPendingNotificationRoute();
        flushPendingAttendanceLink();
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Tabs" component={TabsNavigator} />
        <RootStack.Screen
          name="NotificationHistory"
          component={NotificationHistoryScreen}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen
          name="NotificationDetail"
          component={NotificationDetailScreen}
          options={{ presentation: 'modal' }}
        />
        <RootStack.Screen
          name="CheckIn"
          component={CheckInScreen}
          options={{ presentation: 'modal' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.cedar,
    borderTopWidth: 0,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  tabLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    letterSpacing: 0.3,
  },
});
