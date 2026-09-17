import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TestComponent } from './TestComponent';

describe('TestComponent', () => {
  describe('happy path', () => {
    it('renders the given text inside an h1', () => {
      render(<TestComponent text="Hello Lobo" />);

      const heading = screen.getByRole('heading', { level: 1, name: 'Hello Lobo' });

      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H1');
    });

    it('renders the given text inside an h3', () => {
      render(<TestComponent text="Hello Lobo" />);

      const heading = screen.getByRole('heading', { level: 3, name: 'Hello Lobo' });

      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H3');
    });

    it('renders the h1 before the h3', () => {
      render(<TestComponent text="Order" />);

      const headings = screen.getAllByRole('heading');

      expect(headings.map((heading) => heading.tagName)).toEqual(['H1', 'H3']);
    });
  });

  describe('edge cases', () => {
    it('renders empty headings when text is an empty string', () => {
      const { container } = render(<TestComponent text="" />);

      const h1 = container.querySelector('h1');
      const h3 = container.querySelector('h3');

      expect(h1).toBeInTheDocument();
      expect(h1).toBeEmptyDOMElement();
      expect(h3).toBeInTheDocument();
      expect(h3).toBeEmptyDOMElement();
    });

    it('preserves whitespace-only text', () => {
      const { container } = render(<TestComponent text="   " />);

      expect(container.querySelector('h1')?.textContent).toBe('   ');
      expect(container.querySelector('h3')?.textContent).toBe('   ');
    });

    it('escapes HTML instead of injecting it into the DOM', () => {
      const malicious = '<script>alert("xss")</script>';
      const { container } = render(<TestComponent text={malicious} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(malicious);
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(malicious);
      expect(container.querySelector('script')).not.toBeInTheDocument();
    });

    it('supports special characters, accents and emojis', () => {
      const text = 'Ñandú & café — 🐺 «lobo»';
      render(<TestComponent text={text} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(text);
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(text);
    });

    it('renders very long text without truncating it', () => {
      const longText = 'lobo '.repeat(1_000).trim();
      render(<TestComponent text={longText} />);

      expect(screen.getByRole('heading', { level: 1 }).textContent).toHaveLength(longText.length);
      expect(screen.getByRole('heading', { level: 3 }).textContent).toHaveLength(longText.length);
    });

    it('updates the content when the text prop changes', () => {
      const { rerender } = render(<TestComponent text="Initial" />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Initial');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Initial');

      rerender(<TestComponent text="Updated" />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Updated');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Updated');
      expect(screen.queryByText('Initial')).not.toBeInTheDocument();
    });

    it('renders exactly two headings', () => {
      render(<TestComponent text="Double" />);

      expect(screen.getAllByRole('heading')).toHaveLength(2);
    });
  });
});
