import { router } from 'expo-router';

import { HomeScreen } from '@/ui/HomeScreen';

export default function Index() {
  return (
    <HomeScreen
      onAdd={() => router.push('/appointment/new')}
      onOpen={(id) => router.push({ pathname: '/appointment/[id]', params: { id } })}
    />
  );
}
