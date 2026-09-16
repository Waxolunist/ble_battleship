import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const { t } = useTranslation('common');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.tint,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        tabBarStyle: { backgroundColor: Colors.dark.background },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.play'),
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="play.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tab.stats'),
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.bar.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
