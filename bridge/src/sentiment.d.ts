/**
 * Minimal type declarations for the zero-dependency AFINN sentiment package.
 * The package ships CommonJS without bundled types (v5.0.2).
 */
declare module 'sentiment' {
  interface SentimentAnalysisResult {
    /** Sum of all scored word values. */
    score: number;
    /** Score divided by number of scored words. */
    comparative: number;
    /** Per-token word → value contribution. */
    calculation: Record<string, number>;
    /** All tokens examined. */
    tokens: string[];
    /** Scored words (with non-zero AFINN values). */
    words: string[];
    /** Words that scored positively. */
    positive: string[];
    /** Words that scored negatively. */
    negative: string[];
  }

  interface SentimentOptions {
    /** Input language code (2 digits), defaults to 'en'. */
    language?: string;
    /** Extra sentiment word → value pairs merged over the AFINN list. */
    extras?: Record<string, number>;
  }

  interface SentimentInstanceOptions {
    language?: string;
  }

  class Sentiment {
    constructor(options?: SentimentInstanceOptions);
    analyze(
      phrase: string,
      opts?: SentimentOptions,
      callback?: (err: unknown, result: SentimentAnalysisResult) => void,
    ): SentimentAnalysisResult;
    registerLanguage(languageCode: string, language: Record<string, number>): void;
  }

  export = Sentiment;
}
