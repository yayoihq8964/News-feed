export interface NewsItem {
  id: number;
  source: string;
  title: string;
  summary: string;
  url: string;
  image_url: string | null;
  published_at: string;
  fetched_at: string;
  analysis_status?: 'pending' | 'processing' | 'completed' | 'failed';
  analysis_attempts?: number;
  analysis_error?: string;
  analysis?: Analysis;
  is_pinned?: boolean;
}

export interface CalendarEvent {
  date: string;
  title: string;
  country_code: string;
  country: string;
  impact: 'high' | 'medium' | 'low' | 'holiday' | string;
  impact_zh: string;
  forecast: string;
  previous: string;
  actual: string;
  title_zh?: string;
  stock_impact?: 'bullish' | 'bearish' | 'neutral';
  commodity_impact?: 'bullish' | 'bearish' | 'neutral';
  explanation?: string;
}

export interface Analysis {
  id: number;
  news_id: number;
  title_zh: string;
  headline_summary: string;
  overall_sentiment: number; // -100 to 100
  classification: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  affected_stocks: AffectedStock[];
  affected_sectors: string[];
  affected_commodities: AffectedCommodity[];
  logic_chain: string;
  key_factors: string[];
  llm_provider: string;
  llm_model: string;
  analyzed_at: string;
  news?: NewsItem;
}

export interface AffectedStock {
  ticker: string;
  company: string;
  impact_score: number;
  reason: string;
}

export interface AffectedCommodity {
  name: string;
  impact_score: number;
  reason: string;
}

export interface XSentiment {
  id: number;
  trending_tickers: TrendingTicker[];
  retail_sentiment_score: number;
  key_narratives: string[];
  meme_stocks: MemeStockAlert[];
  fear_greed_estimate?: number;
  analyzed_at: string;
}

export interface TrendingTicker {
  ticker: string;
  mention_sentiment: 'bullish' | 'bearish' | 'mixed';
  buzz_level: 'high' | 'medium' | 'low';
  narrative: string;
}

export interface MemeStockAlert {
  ticker: string;
  risk_level: 'high' | 'medium' | 'low';
  description: string;
}

export interface AppSettings {
  default_llm_provider: string;
  default_llm_model: string;
  news_poll_interval: number;
  analysis_batch_size: number;
  finnhub_configured: boolean;
  newsapi_configured: boolean;
  gnews_configured: boolean;
  grok_configured: boolean;
  available_providers: ProviderInfo[];
}

export interface ProviderInfo {
  name: string;
  configured: boolean;
  models: string[];
}

export interface AnalysisStats {
  total_analyzed: number;
  avg_sentiment: number;
  bullish_count: number;
  bearish_count: number;
  neutral_count: number;
  pending_count?: number;
  sector_breakdown?: Record<string, number>;
  top_affected_stocks?: AffectedStock[];
}

export interface NewsListResponse {
  items: NewsItem[];
  total: number;
}

export interface AnalysisListResponse {
  items: Analysis[];
  total: number;
}
