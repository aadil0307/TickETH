import { Redirect } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';

export default function Index() {
  const { hydrated, isAuthenticated } = useAuth();

  if (!hydrated) {
    return <LoadingSpinner fullScreen message="Loading TickETH..." />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  return <Redirect href="/(tabs)/events" />;
}
