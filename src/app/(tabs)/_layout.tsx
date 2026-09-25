import Tabs from 'expo-router/js-tabs';

import { TabBar, type TabName } from '@/ui/components/TabBar';

// Route file name → tab. The v1 tabs are Today and Settings (docs/design/README.md).
const TAB_OF: Record<string, TabName> = { index: 'today', settings: 'settings' };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation, insets }) => (
        <TabBar
          bottomInset={insets.bottom}
          tabs={state.routes.flatMap((route, index) => {
            const name = TAB_OF[route.name];
            if (!name) return [];
            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (state.index !== index && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };
            return [{ name, focused: state.index === index, onPress }];
          })}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
