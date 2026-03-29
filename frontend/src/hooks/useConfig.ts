import { useCallback, useEffect, useState } from 'react';
import type { ConfigPayload } from '../types';
import { Api } from '../utils/Api';

export function useConfig() {
  const [config, setConfig] = useState<ConfigPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const url = '/api/config';
      const data = await Api.get<ConfigPayload>(url);
      setConfig(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const updateConfig = useCallback(async (next: ConfigPayload) => {
    setConfig(next);
    try {
      const url = '/api/config';
      await Api.put<ConfigPayload>(url, next);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  return { config, loading, error, updateConfig, refetch: fetchConfig };
}
