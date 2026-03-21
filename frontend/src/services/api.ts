import type {
  NewsItem,
  NewsListResponse,
  Analysis,
  AnalysisListResponse,
  AnalysisStats,
  XSentiment,
  AppSettings,
  CalendarEvent,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

// News
export const getNews = (params?: { page?: number; page_size?: number }) => {
  const qs = new URLSearchParams();
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.page_size != null) qs.set('page_size', String(params.page_size));
  const query = qs.toString() ? `?${qs}` : '';
  return request<NewsListResponse>(`/api/news${query}`);
};

export const getNewsById = (id: number) =>
  request<NewsItem>(`/api/news/${id}`);

export const fetchNews = () =>
  request<{ status: string; new_items: number }>('/api/news/fetch', { method: 'POST' });

// Analysis
export const getAnalyses = (params?: { page?: number; page_size?: number }) => {
  const qs = new URLSearchParams();
  if (params?.page != null) qs.set('page', String(params.page));
  if (params?.page_size != null) qs.set('page_size', String(params.page_size));
  const query = qs.toString() ? `?${qs}` : '';
  return request<AnalysisListResponse>(`/api/analysis${query}`);
};

export const getLatestAnalyses = (n = 20) =>
  request<Analysis[]>(`/api/analysis/latest?n=${n}`);

export const getAnalysisByNewsId = (newsId: number) =>
  request<{ analysis: Analysis; news: NewsItem | null }>(`/api/analysis/by-news/${newsId}`);

export const triggerAnalysis = () =>
  request<{ triggered: number }>('/api/analysis/trigger', { method: 'POST' });

export const getAnalysisStats = () =>
  request<AnalysisStats>('/api/analysis/stats');

// X Sentiment
export const getXSentiment = async (): Promise<XSentiment | null> => {
  const res = await request<{ data: XSentiment | null }>('/api/x-sentiment');
  return res.data;
};

export const refreshXSentiment = () =>
  request<XSentiment>('/api/x-sentiment/refresh', { method: 'POST' });

export const getXSentimentHistory = async (): Promise<XSentiment[]> => {
  const res = await request<{ items: XSentiment[]; total: number }>('/api/x-sentiment/history');
  return res.items ?? [];
};

// Settings
export const getSettings = () =>
  request<AppSettings>('/api/settings');

export interface SettingsUpdateResponse {
  updated: Record<string, unknown>;
  message: string;
}

export const updateSettings = (settings: Partial<AppSettings>) =>
  request<SettingsUpdateResponse>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

export const getProviders = () =>
  request<{ providers: import('../types').ProviderInfo[] }>('/api/settings/providers');

export const testLlm = (provider: string, model: string, apiKey?: string) =>
  request<{ provider: string; model: string; available: boolean; status: string }>('/api/settings/test-llm', {
    method: 'POST',
    body: JSON.stringify({ provider, model, api_key: apiKey }),
  });

// Market Quotes
export interface MarketQuote {
  symbol: string
  name: string
  label: string
  price: number | null
  change: number | null
  changePercent: number | null
  previousClose: number | null
}

export const getMarketQuotes = () =>
  request<{ quotes: MarketQuote[] }>('/api/quotes')

// Calendar
export const getCalendar = () =>
  request<{ events: CalendarEvent[]; count: number }>('/api/calendar');

export const analyzeCalendar = () =>
  request<{ events: CalendarEvent[]; count: number; analyzed: number }>('/api/calendar/analyze', { method: 'POST' });
