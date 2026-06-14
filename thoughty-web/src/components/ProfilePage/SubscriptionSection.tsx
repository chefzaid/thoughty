import type { ChangeEvent } from 'react';
import type { ProfileConfig, TranslationFunction } from './types';

type SubscriptionPlan = NonNullable<ProfileConfig['subscriptionPlan']>;

interface SubscriptionSectionProps {
  readonly localConfig: ProfileConfig;
  readonly handleChange: (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string; value: string } }
  ) => void;
  readonly isDark: boolean;
  readonly t: TranslationFunction;
}

const PLAN_DETAILS: Record<SubscriptionPlan, { price: string; renewal: string; historyStatus: string }> = {
  free: { price: '$0', renewal: 'subscriptionNoRenewal', historyStatus: 'subscriptionIncluded' },
  plus: { price: '$6', renewal: 'subscriptionMonthly', historyStatus: 'subscriptionPaid' },
  pro: { price: '$12', renewal: 'subscriptionMonthly', historyStatus: 'subscriptionPaid' },
};

const PLAN_OPTIONS: SubscriptionPlan[] = ['free', 'plus', 'pro'];

const PLAN_LABEL_KEYS: Record<SubscriptionPlan, string> = {
  free: 'subscriptionPlanFree',
  plus: 'subscriptionPlanPlus',
  pro: 'subscriptionPlanPro',
};

function getSubscriptionPlan(value: ProfileConfig['subscriptionPlan']): SubscriptionPlan {
  return value === 'plus' || value === 'pro' ? value : 'free';
}

function getBillingRows(plan: SubscriptionPlan, t: TranslationFunction) {
  const details = PLAN_DETAILS[plan];
  const currentDate = new Date();
  const previousDate = new Date(currentDate);
  previousDate.setMonth(previousDate.getMonth() - 1);

  return [
    {
      date: currentDate.toISOString().slice(0, 10),
      description: t(PLAN_LABEL_KEYS[plan]),
      amount: details.price,
      status: t(details.historyStatus),
    },
    {
      date: previousDate.toISOString().slice(0, 10),
      description: t('subscriptionPreviousCycle'),
      amount: details.price,
      status: t(details.historyStatus),
    },
  ];
}

function SubscriptionSection({ localConfig, handleChange, isDark, t }: SubscriptionSectionProps) {
  const plan = getSubscriptionPlan(localConfig.subscriptionPlan);
  const details = PLAN_DETAILS[plan];
  const billingRows = getBillingRows(plan, t);
  const paymentMethod = localConfig.paymentMethodLabel || (plan === 'free' ? t('subscriptionNoPaymentMethod') : 'Card ending 4242');

  return (
    <div className="profile-section subscription-section">
      <div className="section-header">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h.01M11 15h2M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
        </svg>
        <h3 className="section-title">{t('subscriptionManagement')}</h3>
      </div>

      <div className="section-content">
        <div className="subscription-overview">
          <div>
            <span className="setting-description">{t('subscriptionCurrentPlan')}</span>
            <strong>{t(PLAN_LABEL_KEYS[plan])}</strong>
          </div>
          <div>
            <span className="setting-description">{t('subscriptionPrice')}</span>
            <strong>{details.price}</strong>
          </div>
          <div>
            <span className="setting-description">{t('subscriptionRenewal')}</span>
            <strong>{t(details.renewal)}</strong>
          </div>
        </div>

        <div className="settings-row-pair">
          <div className="setting-row">
            <div className="setting-info">
              <label className="setting-label" htmlFor="subscriptionPlan">{t('subscriptionPlan')}</label>
              <span className="setting-description">{t('subscriptionPlanDescription')}</span>
            </div>
            <select
              id="subscriptionPlan"
              name="subscriptionPlan"
              value={plan}
              onChange={handleChange}
              className={`setting-select ${isDark ? 'dark' : 'light'}`}
            >
              {PLAN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(PLAN_LABEL_KEYS[option])}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <label className="setting-label" htmlFor="paymentMethodLabel">{t('subscriptionPaymentMethod')}</label>
              <span className="setting-description">{t('subscriptionPaymentMethodDescription')}</span>
            </div>
            <input
              id="paymentMethodLabel"
              type="text"
              name="paymentMethodLabel"
              value={localConfig.paymentMethodLabel || ''}
              onChange={handleChange}
              placeholder={paymentMethod}
              className={`setting-input ${isDark ? 'dark' : 'light'}`}
            />
          </div>
        </div>

        <div className="billing-history">
          <div className="billing-history-header">
            <h4>{t('billingHistory')}</h4>
            <span>{t('billingHistoryDescription')}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t('billingDate')}</th>
                <th>{t('billingDescription')}</th>
                <th>{t('billingAmount')}</th>
                <th>{t('billingStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {billingRows.map((row) => (
                <tr key={`${row.date}-${row.description}`}>
                  <td>{row.date}</td>
                  <td>{row.description}</td>
                  <td>{row.amount}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionSection;
