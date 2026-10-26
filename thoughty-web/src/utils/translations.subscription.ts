import type { Language } from './translations';

/** The subscription plan, payment method and billing history. */
export type SubscriptionTranslationKey =
  | "subscriptionManagement"
  | "subscriptionCurrentPlan"
  | "subscriptionPlan"
  | "subscriptionPlanDescription"
  | "subscriptionPlanFree"
  | "subscriptionPlanPlus"
  | "subscriptionPlanPro"
  | "subscriptionPrice"
  | "subscriptionRenewal"
  | "subscriptionMonthly"
  | "subscriptionNoRenewal"
  | "subscriptionPaymentMethod"
  | "subscriptionPaymentMethodDescription"
  | "subscriptionNoPaymentMethod"
  | "billingHistory"
  | "billingHistoryDescription"
  | "billingDate"
  | "billingDescription"
  | "billingAmount"
  | "billingStatus"
  | "subscriptionPaid"
  | "subscriptionIncluded"
  | "subscriptionPreviousCycle";

export const subscriptionTranslations: Record<Language, Record<SubscriptionTranslationKey, string>> = {
  en: {
    subscriptionManagement: "Subscription",
    subscriptionCurrentPlan: "Current plan",
    subscriptionPlan: "Plan",
    subscriptionPlanDescription:
      "Choose the subscription tier saved for this account",
    subscriptionPlanFree: "Free",
    subscriptionPlanPlus: "Plus",
    subscriptionPlanPro: "Pro",
    subscriptionPrice: "Price",
    subscriptionRenewal: "Renewal",
    subscriptionMonthly: "Monthly",
    subscriptionNoRenewal: "No renewal",
    subscriptionPaymentMethod: "Payment method",
    subscriptionPaymentMethodDescription:
      "Store the payment method label shown in billing records",
    subscriptionNoPaymentMethod: "No payment method",
    billingHistory: "Billing history",
    billingHistoryDescription: "Recent account billing records",
    billingDate: "Date",
    billingDescription: "Description",
    billingAmount: "Amount",
    billingStatus: "Status",
    subscriptionPaid: "Paid",
    subscriptionIncluded: "Included",
    subscriptionPreviousCycle: "Previous billing cycle",
  },
  fr: {
    subscriptionManagement: "Abonnement",
    subscriptionCurrentPlan: "Offre actuelle",
    subscriptionPlan: "Offre",
    subscriptionPlanDescription:
      "Choisissez le niveau d'abonnement enregistré pour ce compte",
    subscriptionPlanFree: "Gratuit",
    subscriptionPlanPlus: "Plus",
    subscriptionPlanPro: "Pro",
    subscriptionPrice: "Prix",
    subscriptionRenewal: "Renouvellement",
    subscriptionMonthly: "Mensuel",
    subscriptionNoRenewal: "Aucun renouvellement",
    subscriptionPaymentMethod: "Moyen de paiement",
    subscriptionPaymentMethodDescription:
      "Enregistrez le libellé du moyen de paiement affiché dans la facturation",
    subscriptionNoPaymentMethod: "Aucun moyen de paiement",
    billingHistory: "Historique de facturation",
    billingHistoryDescription: "Factures récentes du compte",
    billingDate: "Date",
    billingDescription: "Description",
    billingAmount: "Montant",
    billingStatus: "Statut",
    subscriptionPaid: "Payé",
    subscriptionIncluded: "Inclus",
    subscriptionPreviousCycle: "Cycle de facturation précédent",
  },
};
