import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('gives the page one level-one title with its description', () => {
    render(<PageHeader title="Recycle bin" subtitle="Deleted entries stay here for 30 days." />);

    expect(screen.getByRole('heading', { level: 1, name: 'Recycle bin' })).toHaveClass('page-title');
    expect(screen.getByText('Deleted entries stay here for 30 days.')).toHaveClass('page-subtitle');
  });

  it('puts the back button above the title and calls it on click', () => {
    const onBack = vi.fn();
    render(<PageHeader title="Profile" back={{ label: 'Back', onClick: onBack }} />);

    const back = screen.getByRole('button', { name: 'Back' });
    expect(back.compareDocumentPosition(screen.getByRole('heading', { level: 1 }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows the page controls beside the title and leaves them out when there are none', () => {
    const { rerender } = render(<PageHeader title="Tags" actions={<button type="button">Save</button>} />);
    expect(screen.getByRole('button', { name: 'Save' }).parentElement).toHaveClass('page-header-actions');

    rerender(<PageHeader title="Tags" />);
    expect(document.querySelector('.page-header-actions')).toBeNull();
  });

  it('follows the theme and keeps the page class for page-specific styles', () => {
    const { container } = render(<PageHeader title="Tags" theme="light" className="tag-manager-header" />);

    expect(container.querySelector('header')).toHaveClass('page-header', 'light', 'tag-manager-header');
  });

  it('makes a title that receives focus focusable from script only', () => {
    const titleRef = createRef<HTMLHeadingElement>();
    const { rerender } = render(<PageHeader title="People" titleRef={titleRef} titleId="people-title" />);

    expect(titleRef.current).toBe(screen.getByRole('heading', { level: 1 }));
    expect(titleRef.current).toHaveAttribute('tabindex', '-1');
    expect(titleRef.current).toHaveAttribute('id', 'people-title');

    rerender(<PageHeader title="People" />);
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveAttribute('tabindex');
  });
});
