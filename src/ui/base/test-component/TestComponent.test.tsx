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
  });

  describe('edge cases', () => {
    it('renders an empty h1 when text is an empty string', () => {
      const { container } = render(<TestComponent text="" />);

      const heading = container.querySelector('h1');

      expect(heading).toBeInTheDocument();
      expect(heading).toBeEmptyDOMElement();
    });

    it('preserves whitespace-only text', () => {
      const { container } = render(<TestComponent text="   " />);

      expect(container.querySelector('h1')?.textContent).toBe('   ');
    });

    it('escapes HTML instead of injecting it into the DOM', () => {
      const malicious = '<script>alert("xss")</script>';
      const { container } = render(<TestComponent text={malicious} />);

      const heading = screen.getByRole('heading', { level: 1 });

      expect(heading).toHaveTextContent(malicious);
      expect(container.querySelector('script')).not.toBeInTheDocument();
    });

    it('supports special characters, accents and emojis', () => {
      const text = 'Ñandú & café — 🐺 «lobo»';
      render(<TestComponent text={text} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(text);
    });

    it('renders very long text without truncating it', () => {
      const longText = 'lobo '.repeat(1_000).trim();
      render(<TestComponent text={longText} />);

      expect(screen.getByRole('heading', { level: 1 }).textContent).toHaveLength(longText.length);
    });

    it('updates the content when the text prop changes', () => {
      const { rerender } = render(<TestComponent text="Initial" />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Initial');

      rerender(<TestComponent text="Updated" />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Updated');
      expect(screen.queryByText('Initial')).not.toBeInTheDocument();
    });

    it('renders a single heading', () => {
      render(<TestComponent text="Single" />);

      expect(screen.getAllByRole('heading')).toHaveLength(1);
    });
  });

  describe('intentional failure', () => {
    // This test FAILS on purpose to verify that the pipeline catches red tests.
    // The component renders an h1, but this test expects an h2.
    it('fails intentionally: expects an h2 instead of an h1', () => {
      render(<TestComponent text="Hello Lobo" />);

      expect(screen.getByRole('heading', { level: 2, name: 'Hello Lobo' })).toBeInTheDocument();
    });
  });
});
