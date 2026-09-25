import { Pressable, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import './svgInterop';

/** The v1 tabs (docs/design/README.md: Today + Settings only). */
export type TabName = 'today' | 'settings';

export interface TabItem {
  name: TabName;
  focused: boolean;
  onPress: () => void;
}

const LABEL: Record<TabName, string> = { today: 'Today', settings: 'Settings' };

interface TabBarProps {
  tabs: TabItem[];
  /** Bottom safe-area inset in px (home indicator). */
  bottomInset: number;
}

/** Bottom tab bar (settings.png): icon over label, ink when active, muted otherwise. */
export function TabBar({ tabs, bottomInset }: TabBarProps) {
  return (
    <View
      role="tablist"
      className="flex-row border-t border-line bg-surface pt-2"
      style={{ paddingBottom: Math.max(bottomInset, 8) }}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.name}
          role="tab"
          aria-selected={tab.focused}
          aria-label={LABEL[tab.name]}
          onPress={tab.onPress}
          className="min-h-[44px] flex-1 items-center justify-center gap-0.5"
        >
          <TabIcon name={tab.name} focused={tab.focused} />
          <Text
            className={`text-caption ${tab.focused ? 'font-semibold text-ink' : 'font-medium text-ink-muted'}`}
          >
            {LABEL[tab.name]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function TabIcon({ name, focused }: { name: TabName; focused: boolean }) {
  const stroke = focused ? 'stroke-ink' : 'stroke-ink-muted';
  const common = { className: stroke, strokeWidth: 2, strokeLinecap: 'round' as const };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
      {name === 'today' ? (
        <>
          <Rect x={4} y={5} width={16} height={15} rx={2} fill="none" {...common} />
          <Path d="M4 10 H20 M8 3 V7 M16 3 V7" {...common} />
          <Rect x={8} y={13} width={4} height={4} rx={0.5} fill="none" {...common} />
        </>
      ) : (
        <Path
          d="M4 6 H13 M17 6 H20 M15 4 V8 M4 12 H7 M11 12 H20 M9 10 V14 M4 18 H13 M17 18 H20 M15 16 V20"
          {...common}
        />
      )}
    </Svg>
  );
}
