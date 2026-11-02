package com.zunospark.app;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "ZunoBilling")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {

    // Monthly & Yearly Subscriptions
    public static final String PRODUCT_ID_MONTHLY = "zunospark_pass_monthly_499";
    public static final String PRODUCT_ID_YEARLY = "zunospark_pass_yearly_2999";

    // Early Lifetime One-Time Non-Consumable
    public static final String PRODUCT_ID_LIFETIME = "zunospark_pass_lifetime_4999";

    // Legacy products for restore compatibility
    public static final String PRODUCT_ID_LEGACY_19 = "zunospark_full_adventure_19";
    public static final String PRODUCT_ID_LEGACY_9 = "zunospark_full_adventure_9";

    private static final String PREF_NAME = "zunospark_iap_prefs";
    private static final String KEY_PURCHASED = "full_adventure_unlocked";

    private BillingClient billingClient;
    private final Map<String, ProductDetails> cachedDetailsMap = new ConcurrentHashMap<>();
    private PluginCall activePurchaseCall = null;

    @Override
    public void load() {
        super.load();
        initBillingClient();
    }

    private void initBillingClient() {
        PendingPurchasesParams pendingParams = PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build();

        billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(pendingParams)
                .build();

        connectBilling(null);
    }

    private void connectBilling(Runnable onConnected) {
        if (billingClient == null) return;
        if (billingClient.isReady()) {
            if (onConnected != null) onConnected.run();
            return;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    queryAllProductDetails(null);
                    queryAllPurchases();
                    if (onConnected != null) onConnected.run();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Reconnect will happen on next action
            }
        });
    }

    private void savePurchaseState(boolean unlocked) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_PURCHASED, unlocked).apply();
    }

    private boolean getSavedPurchaseState() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        return prefs.getBoolean(KEY_PURCHASED, false);
    }

    private boolean isSupportedProduct(String productId) {
        return PRODUCT_ID_MONTHLY.equals(productId) ||
               PRODUCT_ID_YEARLY.equals(productId) ||
               PRODUCT_ID_LIFETIME.equals(productId) ||
               PRODUCT_ID_LEGACY_19.equals(productId) ||
               PRODUCT_ID_LEGACY_9.equals(productId);
    }

    private void queryAllPurchases() {
        if (billingClient == null || !billingClient.isReady()) return;

        // Query INAPP purchases
        QueryPurchasesParams inAppParams = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();

        billingClient.queryPurchasesAsync(inAppParams, (inAppResult, inAppPurchases) -> {
            boolean hasActive = false;
            if (inAppResult.getResponseCode() == BillingClient.BillingResponseCode.OK && inAppPurchases != null) {
                for (Purchase p : inAppPurchases) {
                    for (String id : p.getProducts()) {
                        if (isSupportedProduct(id) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                            hasActive = true;
                            if (!p.isAcknowledged()) acknowledge(p);
                        }
                    }
                }
            }

            // Query SUBS purchases
            final boolean finalHasInApp = hasActive;
            QueryPurchasesParams subsParams = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build();

            billingClient.queryPurchasesAsync(subsParams, (subsResult, subsPurchases) -> {
                boolean hasSubscription = false;
                if (subsResult.getResponseCode() == BillingClient.BillingResponseCode.OK && subsPurchases != null) {
                    for (Purchase p : subsPurchases) {
                        for (String id : p.getProducts()) {
                            if (isSupportedProduct(id) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                hasSubscription = true;
                                if (!p.isAcknowledged()) acknowledge(p);
                            }
                        }
                    }
                }
                savePurchaseState(finalHasInApp || hasSubscription);
            });
        });
    }

    private void queryAllProductDetails(Runnable onDone) {
        if (billingClient == null || !billingClient.isReady()) {
            if (onDone != null) onDone.run();
            return;
        }

        // 1. INAPP products (Lifetime & Legacy)
        List<QueryProductDetailsParams.Product> inAppList = new ArrayList<>();
        inAppList.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_ID_LIFETIME)
                .setProductType(BillingClient.ProductType.INAPP)
                .build());
        inAppList.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT_ID_LEGACY_19)
                .setProductType(BillingClient.ProductType.INAPP)
                .build());

        QueryProductDetailsParams inAppParams = QueryProductDetailsParams.newBuilder()
                .setProductList(inAppList)
                .build();

        billingClient.queryProductDetailsAsync(inAppParams, (inAppResult, inAppDetailsResult) -> {
            if (inAppResult.getResponseCode() == BillingClient.BillingResponseCode.OK && inAppDetailsResult != null) {
                List<ProductDetails> list = inAppDetailsResult.getProductDetailsList();
                if (list != null) {
                    for (ProductDetails pd : list) {
                        cachedDetailsMap.put(pd.getProductId(), pd);
                    }
                }
            }

            // 2. SUBS products (Monthly & Yearly)
            List<QueryProductDetailsParams.Product> subsList = new ArrayList<>();
            subsList.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(PRODUCT_ID_MONTHLY)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build());
            subsList.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(PRODUCT_ID_YEARLY)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build());

            QueryProductDetailsParams subsParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(subsList)
                    .build();

            billingClient.queryProductDetailsAsync(subsParams, (subsResult, subsDetailsResult) -> {
                if (subsResult.getResponseCode() == BillingClient.BillingResponseCode.OK && subsDetailsResult != null) {
                    List<ProductDetails> list = subsDetailsResult.getProductDetailsList();
                    if (list != null) {
                        for (ProductDetails pd : list) {
                            cachedDetailsMap.put(pd.getProductId(), pd);
                        }
                    }
                }
                if (onDone != null) onDone.run();
            });
        });
    }

    private void acknowledge(Purchase purchase) {
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.getPurchaseToken())
                .build();
        billingClient.acknowledgePurchase(params, billingResult -> {
            // Acknowledged
        });
    }

    private String getFormattedPrice(String productId, String fallback) {
        ProductDetails pd = cachedDetailsMap.get(productId);
        if (pd == null) return fallback;

        // Try one-time purchase
        ProductDetails.OneTimePurchaseOfferDetails oneTime = pd.getOneTimePurchaseOfferDetails();
        if (oneTime != null && oneTime.getFormattedPrice() != null) {
            return oneTime.getFormattedPrice();
        }

        // Try subscription offers
        List<ProductDetails.SubscriptionOfferDetails> subOffers = pd.getSubscriptionOfferDetails();
        if (subOffers != null && !subOffers.isEmpty()) {
            ProductDetails.PricingPhases phases = subOffers.get(0).getPricingPhases();
            if (phases != null && phases.getPricingPhaseList() != null && !phases.getPricingPhaseList().isEmpty()) {
                String p = phases.getPricingPhaseList().get(0).getFormattedPrice();
                if (p != null) return p;
            }
        }

        return fallback;
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        if (activePurchaseCall == null) return;

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            boolean purchased = false;
            for (Purchase p : purchases) {
                for (String id : p.getProducts()) {
                    if (isSupportedProduct(id) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        purchased = true;
                        savePurchaseState(true);
                        if (!p.isAcknowledged()) {
                            acknowledge(p);
                        }
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("purchased", purchased);
            activePurchaseCall.resolve(ret);
        } else if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("cancelled", true);
            ret.put("message", "Purchase cancelled by user.");
            activePurchaseCall.resolve(ret);
        } else {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("cancelled", false);
            ret.put("message", "Google Play billing error: " + billingResult.getDebugMessage());
            activePurchaseCall.resolve(ret);
        }
        activePurchaseCall = null;
    }

    @PluginMethod
    public void getProductDetails(PluginCall call) {
        connectBilling(() -> {
            queryAllProductDetails(() -> {
                JSObject ret = new JSObject();

                // Monthly
                JSObject monthly = new JSObject();
                monthly.put("id", PRODUCT_ID_MONTHLY);
                monthly.put("type", "subs");
                monthly.put("title", "Monthly Adventure Pass");
                monthly.put("price", getFormattedPrice(PRODUCT_ID_MONTHLY, "$4.99"));
                monthly.put("period", "/month");
                ret.put("monthly", monthly);

                // Yearly (Best Value)
                JSObject yearly = new JSObject();
                yearly.put("id", PRODUCT_ID_YEARLY);
                yearly.put("type", "subs");
                yearly.put("title", "Yearly Adventure Pass");
                yearly.put("price", getFormattedPrice(PRODUCT_ID_YEARLY, "$29.99"));
                yearly.put("period", "/year");
                ret.put("yearly", yearly);

                // Early Lifetime
                JSObject lifetime = new JSObject();
                lifetime.put("id", PRODUCT_ID_LIFETIME);
                lifetime.put("type", "inapp");
                lifetime.put("title", "Early Lifetime Pass");
                lifetime.put("price", getFormattedPrice(PRODUCT_ID_LIFETIME, "$49.99"));
                lifetime.put("period", "one-time");
                ret.put("lifetime", lifetime);

                // Default legacy compatibility field
                ret.put("formattedPrice", getFormattedPrice(PRODUCT_ID_YEARLY, "$29.99"));

                call.resolve(ret);
            });
        });
    }

    @PluginMethod
    public void checkPurchaseStatus(PluginCall call) {
        boolean localState = getSavedPurchaseState();
        connectBilling(() -> {
            if (billingClient != null && billingClient.isReady()) {
                // Check INAPP
                QueryPurchasesParams inAppParams = QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build();

                billingClient.queryPurchasesAsync(inAppParams, (inAppResult, inAppPurchases) -> {
                    boolean isPurchased = localState;
                    if (inAppResult.getResponseCode() == BillingClient.BillingResponseCode.OK && inAppPurchases != null) {
                        for (Purchase p : inAppPurchases) {
                            for (String id : p.getProducts()) {
                                if (isSupportedProduct(id) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                    isPurchased = true;
                                    break;
                                }
                            }
                        }
                    }

                    final boolean foundInApp = isPurchased;

                    // Check SUBS
                    QueryPurchasesParams subsParams = QueryPurchasesParams.newBuilder()
                            .setProductType(BillingClient.ProductType.SUBS)
                            .build();

                    billingClient.queryPurchasesAsync(subsParams, (subsResult, subsPurchases) -> {
                        boolean foundSubs = false;
                        if (subsResult.getResponseCode() == BillingClient.BillingResponseCode.OK && subsPurchases != null) {
                            for (Purchase p : subsPurchases) {
                                for (String id : p.getProducts()) {
                                    if (isSupportedProduct(id) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                        foundSubs = true;
                                        break;
                                    }
                                }
                            }
                        }

                        boolean finalUnlocked = foundInApp || foundSubs;
                        savePurchaseState(finalUnlocked);

                        JSObject ret = new JSObject();
                        ret.put("purchased", finalUnlocked);
                        call.resolve(ret);
                    });
                });
            } else {
                JSObject ret = new JSObject();
                ret.put("purchased", localState);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        activePurchaseCall = call;
        String requestedProductId = call.getString("productId", PRODUCT_ID_YEARLY);

        connectBilling(() -> {
            if (!cachedDetailsMap.containsKey(requestedProductId)) {
                queryAllProductDetails(() -> launchFlow(call, requestedProductId));
            } else {
                launchFlow(call, requestedProductId);
            }
        });
    }

    private void launchFlow(PluginCall call, String productId) {
        ProductDetails details = cachedDetailsMap.get(productId);

        if (details == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", "Product details not available from Google Play for " + productId + ". Please verify Google Play Console configuration.");
            call.resolve(ret);
            activePurchaseCall = null;
            return;
        }

        BillingFlowParams.ProductDetailsParams.Builder pBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details);

        // If it is a subscription, Google Play requires an offerToken
        if (BillingClient.ProductType.SUBS.equals(details.getProductType())) {
            List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                pBuilder.setOfferToken(offers.get(0).getOfferToken());
            }
        }

        List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList = new ArrayList<>();
        productDetailsParamsList.add(pBuilder.build());

        BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(productDetailsParamsList)
                .build();

        getActivity().runOnUiThread(() -> {
            BillingResult result = billingClient.launchBillingFlow(getActivity(), billingFlowParams);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("message", result.getDebugMessage());
                call.resolve(ret);
                activePurchaseCall = null;
            }
        });
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        connectBilling(() -> {
            if (billingClient == null || !billingClient.isReady()) {
                JSObject ret = new JSObject();
                ret.put("restored", false);
                ret.put("purchased", getSavedPurchaseState());
                ret.put("message", "Google Play Store unavailable.");
                call.resolve(ret);
                return;
            }

            // 1. Query INAPP purchases
            QueryPurchasesParams inAppParams = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build();

            billingClient.queryPurchasesAsync(inAppParams, (inAppResult, inAppPurchases) -> {
                boolean hasActiveInApp = false;
                if (inAppResult.getResponseCode() == BillingClient.BillingResponseCode.OK && inAppPurchases != null) {
                    for (Purchase p : inAppPurchases) {
                        for (String id : p.getProducts()) {
                            if (isSupportedProduct(id) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                hasActiveInApp = true;
                                if (!p.isAcknowledged()) acknowledge(p);
                            }
                        }
                    }
                }

                final boolean finalInApp = hasActiveInApp;

                // 2. Query SUBS purchases
                QueryPurchasesParams subsParams = QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build();

                billingClient.queryPurchasesAsync(subsParams, (subsResult, subsPurchases) -> {
                    boolean hasActiveSubs = false;
                    if (subsResult.getResponseCode() == BillingClient.BillingResponseCode.OK && subsPurchases != null) {
                        for (Purchase p : subsPurchases) {
                            for (String id : p.getProducts()) {
                                if (isSupportedProduct(id) && p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                    hasActiveSubs = true;
                                    if (!p.isAcknowledged()) acknowledge(p);
                                }
                            }
                        }
                    }

                    boolean isUnlocked = finalInApp || hasActiveSubs;
                    savePurchaseState(isUnlocked);

                    JSObject ret = new JSObject();
                    ret.put("restored", true);
                    ret.put("purchased", isUnlocked);
                    call.resolve(ret);
                });
            });
        });
    }
}
