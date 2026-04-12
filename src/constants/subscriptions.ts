export const SUBSCRIPTION_LIMITS = {
  free: {
    maxChats: 3,
    maxDocsPerChat: 2,
    name: 'Free',
  },
  pro: {
    maxChats: 10,
    maxDocsPerChat: 10,
    name: 'Pro',
  },
  enterprise: {
    maxChats: Infinity,
    maxDocsPerChat: Infinity,
    name: 'Enterprise',
  },
};

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_LIMITS;
