import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SubscriptionSection from './SubscriptionSection';
import type { ProfileConfig } from './types';

const mockT = (key: string): string => key;

function renderSubscriptionSection(config: ProfileConfig = {}) {
  const changes: Array<{ name: string; value: string }> = [];
  const handleChange = vi.fn((event: { target: { name: string; value: string } }) => {
    changes.push({ name: event.target.name, value: event.target.value });
  });

  render(
    <SubscriptionSection
      localConfig={{
        theme: 'dark',
        entriesPerPage: '10',
        language: 'en',
        ...config,
      }}
      handleChange={handleChange}
      isDark={true}
      t={mockT}
    />
  );

  return { changes, handleChange };
}

describe('SubscriptionSection', () => {
  it('renders the free plan, payment method fallback, and billing history', () => {
    renderSubscriptionSection({ subscriptionPlan: 'free' });

    expect(screen.getByText('subscriptionManagement')).toBeInTheDocument();
    expect(screen.getByText('subscriptionCurrentPlan')).toBeInTheDocument();
    expect(screen.getAllByText('subscriptionPlanFree')[0]).toBeInTheDocument();
    expect(screen.getByPlaceholderText('subscriptionNoPaymentMethod')).toBeInTheDocument();
    expect(screen.getByText('billingHistory')).toBeInTheDocument();
    expect(screen.getAllByText('$0')).toHaveLength(3);
  });

  it('emits plan and payment method changes', () => {
    const { changes } = renderSubscriptionSection({ subscriptionPlan: 'plus' });

    fireEvent.change(screen.getByLabelText('subscriptionPlan'), { target: { value: 'pro' } });
    fireEvent.change(screen.getByLabelText('subscriptionPaymentMethod'), { target: { value: 'Visa ending 1111' } });

    expect(changes).toContainEqual({ name: 'subscriptionPlan', value: 'pro' });
    expect(changes).toContainEqual({ name: 'paymentMethodLabel', value: 'Visa ending 1111' });
  });

  it('renders a configured pro plan and payment method label', () => {
    renderSubscriptionSection({
      subscriptionPlan: 'pro',
      paymentMethodLabel: 'Amex ending 3000',
    });

    expect(screen.getAllByText('subscriptionPlanPro')[0]).toBeInTheDocument();
    expect(screen.getAllByText('$12')).toHaveLength(3);
    expect(screen.getByDisplayValue('Amex ending 3000')).toBeInTheDocument();
    expect(screen.getAllByText('subscriptionPaid')[0]).toBeInTheDocument();
  });
});
