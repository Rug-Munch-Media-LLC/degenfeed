'use client';

/**
 * Accordion-style FAQ item using native <details>/<summary>.
 * Works without JavaScript, fully keyboard accessible.
 */
export function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="faq-item">
      <summary className="faq-question">
        <span>{question}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="faq-answer open">
        <p>{answer}</p>
      </div>
    </details>
  );
}
