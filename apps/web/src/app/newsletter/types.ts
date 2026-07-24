export interface NewsletterEntry {
  name: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'irregular';
  isPaid?: boolean;
  premium?: boolean;
  description?: string;
}

export interface DigestItem {
  id: string;
  protocol: string;
  author: string;
  text: string;
  url: string | null;
  image: string | null;
  niches: string[];
  createdAt: number;
  metrics: { likes: number; reposts: number; replies: number; quotes: number };
}

export interface DigestMeta {
  total: number;
  fetchedAt: number;
  niches: string[];
  protocols: string[];
  trending: Array<{ topic: string; count: number; score: number }>;
}
