import { Capacitor, registerPlugin } from '@capacitor/core';

export const IAP_STORAGE_KEY = 'zunospark.iap.unlocked.v1';

export type PlanId = 'yearly' | 'monthly' | 'lifetime';

export interface PlanDetails {
  id: string;
  type: 'subs' | 'inapp';
  title: string;
  price: string;
  period: string;
  badge?: string;
  savings?: string;
  description: string;
}

export const PRODUCT_IDS = {
  MONTHLY: 'zunospark_pass_monthly_499',
  YEARLY: 'zunospark_pass_yearly_2999',
  LIFETIME: 'zunospark_pass_lifetime_4999',
  LEGACY_19: 'zunospark_full_adventure_19',
  LEGACY_9: 'zunospark_full_adventure_9',
} as const;

export const DEFAULT_PLANS: Record<PlanId, PlanDetails> = {
  yearly: {
    id: PRODUCT_IDS.YEARLY,
    type: 'subs',
    title: 'Yearly Adventure Pass',
    price: '$29.99',
    period: '/year',
    badge: 'BEST VALUE · SAVE 50%',
    savings: 'Only $2.50 / month · Billed annually',
    description: 'Unlock all 15 Spots across all zones for the entire year.',
  },
  monthly: {
    id: PRODUCT_IDS.MONTHLY,
    type: 'subs',
    title: 'Monthly Adventure Pass',
    price: '$4.99',
    period: '/month',
    savings: 'Flexible family plan · Cancel anytime',
    description: 'Unlock all 15 Spots month by month.',
  },
  lifetime: {
    id: PRODUCT_IDS.LIFETIME,
    type: 'inapp',
    title: 'Early Lifetime Pass',
    price: '$49.99',
    period: 'one-time',
    badge: 'EARLY PASS · PAY ONCE',
    savings: 'Pay once, keep forever on this device',
    description: 'Permanent access to all 15 Spots + all future training clearings.',
  },
};

interface NativeProductPayload {
  id: string;
  type: string;
  title: string;
  price: string;
  period: string;
}

interface ZunoBillingPlugin {
  getProductDetails: () => Promise<{
    monthly?: NativeProductPayload;
    yearly?: NativeProductPayload;
    lifetime?: NativeProductPayload;
    formattedPrice?: string;
  }>;
  checkPurchaseStatus: () => Promise<{ purchased: boolean }>;
  purchase: (options?: { productId?: string }) => Promise<{
    success: boolean;
    purchased?: boolean;
    cancelled?: boolean;
    message?: string;
  }>;
  restorePurchases: () => Promise<{
    restored: boolean;
    purchased: boolean;
    message?: string;
  }>;
}

const NativeBilling = registerPlugin<ZunoBillingPlugin>('ZunoBilling');

class IAPService {
  private static instance: IAPService | null = null;

  static getInstance(): IAPService {
    if (!IAPService.instance) {
      IAPService.instance = new IAPService();
    }
    return IAPService.instance;
  }

  private constructor() {}

  private readLocalStorage(): boolean {
    try {
      return window.localStorage.getItem(IAP_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private writeLocalStorage(unlocked: boolean): void {
    try {
      if (unlocked) {
        window.localStorage.setItem(IAP_STORAGE_KEY, '1');
      } else {
        window.localStorage.removeItem(IAP_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }

  public isNative(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Check if the user has unlocked the full adventure.
   * On Android, queries Google Play Billing and updates local cache.
   */
  async checkUnlocked(): Promise<boolean> {
    if (this.isNative()) {
      try {
        const res = await NativeBilling.checkPurchaseStatus();
        if (typeof res?.purchased === 'boolean') {
          this.writeLocalStorage(res.purchased);
          return res.purchased;
        }
      } catch (err) {
        console.warn('Native checkPurchaseStatus error, falling back to cached state:', err);
      }
    }
    return this.readLocalStorage();
  }

  /**
   * Get all available pricing tiers & details from Google Play Billing
   */
  async getPlans(): Promise<Record<PlanId, PlanDetails>> {
    const plans: Record<PlanId, PlanDetails> = {
      yearly: { ...DEFAULT_PLANS.yearly },
      monthly: { ...DEFAULT_PLANS.monthly },
      lifetime: { ...DEFAULT_PLANS.lifetime },
    };

    if (this.isNative()) {
      try {
        const details = await NativeBilling.getProductDetails();
        if (details.yearly?.price) plans.yearly.price = details.yearly.price;
        if (details.monthly?.price) plans.monthly.price = details.monthly.price;
        if (details.lifetime?.price) plans.lifetime.price = details.lifetime.price;
      } catch (err) {
        console.warn('getProductDetails native error, using default prices:', err);
      }
    }

    return plans;
  }

  /**
   * Launch purchase flow for a specific plan tier
   */
  async purchasePlan(planId: PlanId = 'yearly'): Promise<{ success: boolean; message?: string }> {
    const plan = DEFAULT_PLANS[planId];
    const productId = plan ? plan.id : PRODUCT_IDS.YEARLY;

    if (this.isNative()) {
      try {
        const res = await NativeBilling.purchase({ productId });
        if (res.success && res.purchased) {
          this.writeLocalStorage(true);
          return { success: true };
        }
        return {
          success: false,
          message: res.cancelled ? 'Purchase cancelled.' : res.message || 'Could not complete purchase.',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, message: msg };
      }
    }

    // Web / Sandbox fallback (for testing in browser)
    this.writeLocalStorage(true);
    return { success: true };
  }

  /**
   * Legacy wrapper for compatibility
   */
  async purchaseFullAdventure(planId: PlanId = 'yearly'): Promise<{ success: boolean; message?: string }> {
    return this.purchasePlan(planId);
  }

  /**
   * Restore purchases (handles both subscriptions & lifetime in-app purchases)
   */
  async restorePurchases(): Promise<{ restored: boolean; purchased: boolean; message?: string }> {
    if (this.isNative()) {
      try {
        const res = await NativeBilling.restorePurchases();
        if (res.purchased) {
          this.writeLocalStorage(true);
        }
        return res;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { restored: false, purchased: this.readLocalStorage(), message: msg };
      }
    }

    const current = this.readLocalStorage();
    return {
      restored: true,
      purchased: current,
      message: current ? 'Purchases restored!' : 'No previous purchases found on this device.',
    };
  }

  /**
   * Development sandbox helper to toggle purchase status on web
   */
  setSandboxPurchase(unlocked: boolean): void {
    this.writeLocalStorage(unlocked);
  }
}

export const iapService = IAPService.getInstance();
