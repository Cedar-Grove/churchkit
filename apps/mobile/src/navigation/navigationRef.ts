import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside the component tree (e.g. a push-notification click
// handler in notifications.ts) navigate once AppNavigator's
// NavigationContainer has mounted. Kept in its own module, rather than in
// AppNavigator.tsx or notifications.ts, so neither has to import the other.
export const navigationRef = createNavigationContainerRef();
