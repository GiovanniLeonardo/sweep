import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/theme';

import CameraScanScreen from '../screens/CameraScanScreen';
import BleTrackerScreen from '../screens/BleTrackerScreen';
import WifiAuditScreen from '../screens/WifiAuditScreen';
import DashboardScreen from '../screens/DashboardScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomColor: colors.surfaceBorder,
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceBorder,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Optical Scan') iconName = 'camera';
          else if (route.name === 'BLE Trackers') iconName = 'bluetooth';
          else if (route.name === 'Wi-Fi Audit') iconName = 'wifi';
          else if (route.name === 'Dashboard') iconName = 'shield-checkmark';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Optical Scan" component={CameraScanScreen} />
      <Tab.Screen name="BLE Trackers" component={BleTrackerScreen} />
      <Tab.Screen name="Wi-Fi Audit" component={WifiAuditScreen} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
    </Tab.Navigator>
  );
}
