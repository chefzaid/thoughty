import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import "react-datepicker/dist/react-datepicker.css";

import AppShell from './AppShell';
import { FeatureFlagsProvider } from './components/FeatureFlags/FeatureFlagsProvider';
import { useAuth } from './contexts/AuthContext';
import { useSessionQueryClient } from './hooks/useSessionQueryClient';

function App() {
  // A session that ends takes its query cache and every piece of the writer's state with it: the
  // tree below starts again from nothing (the router stays, so the address and history do too)
  const { sessionKey } = useAuth();
  const queryClient = useSessionQueryClient(sessionKey);
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <FeatureFlagsProvider key={sessionKey}>
          <AppShell />
        </FeatureFlagsProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
