import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Placeholder home screen (F001). The real Today list arrives with F005.
export function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1 justify-center gap-2 px-4">
        <Text className="text-display text-ink">Today</Text>
        <Text className="text-body text-ink-muted">Nothing to nag you about yet.</Text>
        <View className="mt-4 flex-row items-center gap-2 rounded-card border border-line bg-surface p-4">
          <View className="h-3 w-3 rounded-full bg-tone-polite" />
          <Text className="text-label text-ink-muted">Reminders app scaffold is running.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
