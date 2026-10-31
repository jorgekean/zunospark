import { Capacitor, registerPlugin } from '@capacitor/core';

export const IAP_STORAGE_KEY = 'zunospark.iap.unlocked.v1';
export const FULL_ADVENTURE_PRODUCT_ID = 'zunospark_full_adventure_19';

interface ZunoBillingPlugin {
  getProductDetails: () => Promise<{
    id: string;
    title: string;
    description: string;
    formattedPrice: string;
  }>;
  checkPurchaseStatus: () => Promise<{ purchased: boolean }>;
  purchase: () => Promise<{
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
   * Check if the user has purchased the one-time $19 full adventure pass.
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
   * Get product pricing & details (e.g. "$19.00")
   */
  async getProductDetails(): Promise<{ id: string; price: string; title: string }> {
    if (this.isNative()) {
      try {
        const details = await NativeBilling.getProductDetails();
        return {
          id: details.id || FULL_ADVENTURE_PRODUCT_ID,
          price: details.formattedPrice || '$19.00',
          title: details.title || 'ZunoSpark Full Adventure Pass',
        };
      } catch (err) {
        console.warn('getProductDetails native error:', err);
      }
    }
    return {
      id: FULL_ADVENTURE_PRODUCT_ID,
      price: '$19.00',
      title: 'ZunoSpark Full Adventure Pass',
    };
  }

  /**
   * Launch the one-time $19 purchase flow.
   */
  async purchaseFullAdventure(): Promise<{ success: boolean; message?: string }> {
    if (this.isNative()) {
      try {
        const res = await NativeBilling.purchase();
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
   * Restore purchases (required for non-consumable in-app purchases)
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
