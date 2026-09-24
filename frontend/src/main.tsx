import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './App';
import { createAppStore } from './app/store';
import './index.css';
import { loadRuntimeConfig } from './runtimeConfig';

void loadRuntimeConfig().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Provider store={createAppStore()}>
        <App />
      </Provider>
    </StrictMode>,
  );
});
