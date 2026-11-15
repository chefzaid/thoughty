import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import "react-datepicker/dist/react-datepicker.css";

import AppShell from './AppShell';
import { FeatureFlagsProvider } from './components/FeatureFlags/FeatureFlagsProvider';

const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={appQueryClient}>
      <FeatureFlagsProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </FeatureFlagsProvider>
    </QueryClientProvider>
  );
}

export default App;
