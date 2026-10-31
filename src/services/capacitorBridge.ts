import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { useZunoStore } from '../store/useZunoStore';

export const isNativeAndroid = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/** Trigger haptic feedback with graceful fallback on web */
export const triggerHaptic = async (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' = 'light',
) => {
  try {
    if (!Capacitor.isPluginAvailable('Haptics')) return;
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
    }
  } catch {
    // Ignore errors on non-supported devices
  }
};

/** Initialize native Android status bar, splash screen, and hardware back button */
export const initCapacitorBridge = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Configure Status Bar
    if (Capacitor.isPluginAvailable('StatusBar')) {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0f0a2c' });
    }
  } catch (err) {
    console.warn('Capacitor StatusBar setup:', err);
  }

  try {
    // 2. Hide Splash Screen smoothly once UI is mounted
    if (Capacitor.isPluginAvailable('SplashScreen')) {
      await SplashScreen.hide({ fadeOutDuration: 400 });
    }
  } catch (err) {
    console.warn('Capacitor SplashScreen hide:', err);
  }

  try {
    // 3. Android Hardware Back Button listener
    if (Capacitor.isPluginAvailable('App')) {
      await CapApp.addListener('backButton', () => {
        const state = useZunoStore.getState();

        if (state.showParentDashboard) {
          state.toggleParentDashboard(false);
          return;
        }

        if (state.showPaywallModal) {
          state.closePaywall();
          return;
        }

        if (state.activeZone) {
          state.exitZone();
          return;
        }

        if (state.activeTrailZone) {
          state.closeZoneTrail();
          return;
        }

        // At Hub root: exit the application gracefully
        CapApp.exitApp();
      });
    }
  } catch (err) {
    console.warn('Capacitor App backButton setup:', err);
  }
};
