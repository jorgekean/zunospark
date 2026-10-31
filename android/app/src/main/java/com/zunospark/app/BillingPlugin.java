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
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "ZunoBilling")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {

    public static final String PRODUCT_ID_FULL_ADVENTURE = "zunospark_full_adventure_19";
    public static final String PRODUCT_ID_LEGACY = "zunospark_full_adventure_9";
    private static final String PREF_NAME = "zunospark_iap_prefs";
    private static final String KEY_PURCHASED = "full_adventure_unlocked";

    private BillingClient billingClient;
    private ProductDetails cachedProductDetails = null;
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
                    queryProductDetailsInternal(null);
                    queryPurchasesInternal();
                    if (onConnected != null) onConnected.run();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Retry connection automatically on next user action
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

    private void queryPurchasesInternal() {
        if (billingClient == null || !billingClient.isReady()) return;

        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();

        billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                boolean hasFullAdventure = false;
                for (Purchase p : purchases) {
                    if ((p.getProducts().contains(PRODUCT_ID_FULL_ADVENTURE) || p.getProducts().contains(PRODUCT_ID_LEGACY)) &&
                        p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        hasFullAdventure = true;
                        if (!p.isAcknowledged()) {
                            acknowledge(p);
                        }
                    }
                }
                savePurchaseState(hasFullAdventure);
            }
        });
    }

    private void queryProductDetailsInternal(Runnable onDone) {
        if (billingClient == null || !billingClient.isReady()) {
            if (onDone != null) onDone.run();
            return;
        }

        List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
        productList.add(
                QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(PRODUCT_ID_FULL_ADVENTURE)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
        );

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                for (ProductDetails details : productDetailsList) {
                    if (details.getProductId().equals(PRODUCT_ID_FULL_ADVENTURE)) {
                        cachedProductDetails = details;
                    }
                }
            }
            if (onDone != null) onDone.run();
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

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        if (activePurchaseCall == null) return;

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            boolean purchased = false;
            for (Purchase p : purchases) {
                if (p.getProducts().contains(PRODUCT_ID_FULL_ADVENTURE) &&
                    p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    purchased = true;
                    savePurchaseState(true);
                    if (!p.isAcknowledged()) {
                        acknowledge(p);
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
            if (cachedProductDetails != null) {
                ProductDetails.OneTimePurchaseOfferDetails offer = cachedProductDetails.getOneTimePurchaseOfferDetails();
                String price = offer != null ? offer.getFormattedPrice() : "$19.00";

                JSObject ret = new JSObject();
                ret.put("id", PRODUCT_ID_FULL_ADVENTURE);
                ret.put("title", cachedProductDetails.getTitle());
                ret.put("description", cachedProductDetails.getDescription());
                ret.put("formattedPrice", price);
                call.resolve(ret);
            } else {
                queryProductDetailsInternal(() -> {
                    JSObject ret = new JSObject();
                    ret.put("id", PRODUCT_ID_FULL_ADVENTURE);
                    if (cachedProductDetails != null) {
                        ProductDetails.OneTimePurchaseOfferDetails offer = cachedProductDetails.getOneTimePurchaseOfferDetails();
                        ret.put("title", cachedProductDetails.getTitle());
                        ret.put("description", cachedProductDetails.getDescription());
                        ret.put("formattedPrice", offer != null ? offer.getFormattedPrice() : "$19.00");
                    } else {
                        ret.put("title", "ZunoSpark Full Adventure Pass");
                        ret.put("description", "Unlock all 15 Spots across all zones.");
                        ret.put("formattedPrice", "$19.00");
                    }
                    call.resolve(ret);
                });
            }
        });
    }

    @PluginMethod
    public void checkPurchaseStatus(PluginCall call) {
        boolean localState = getSavedPurchaseState();
        connectBilling(() -> {
            if (billingClient != null && billingClient.isReady()) {
                QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build();

                billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
                    boolean isPurchased = localState;
                    if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        for (Purchase p : purchases) {
                            if (p.getProducts().contains(PRODUCT_ID_FULL_ADVENTURE) &&
                                p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                isPurchased = true;
                                break;
                            }
                        }
                        savePurchaseState(isPurchased);
                    }
                    JSObject ret = new JSObject();
                    ret.put("purchased", isPurchased);
                    call.resolve(ret);
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

        connectBilling(() -> {
            if (cachedProductDetails == null) {
                queryProductDetailsInternal(() -> {
                    launchFlow(call);
                });
            } else {
                launchFlow(call);
            }
        });
    }

    private void launchFlow(PluginCall call) {
        if (cachedProductDetails == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", "Product details not available from Google Play. Please ensure product ID zunospark_full_adventure_19 is configured in Play Console.");
            call.resolve(ret);
            activePurchaseCall = null;
            return;
        }

        List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList = new ArrayList<>();
        productDetailsParamsList.add(
                BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(cachedProductDetails)
                        .build()
        );

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

            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build();

            billingClient.queryPurchasesAsync(params, (billingResult, purchases) -> {
                boolean hasFullAdventure = false;
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                    for (Purchase p : purchases) {
                        if ((p.getProducts().contains(PRODUCT_ID_FULL_ADVENTURE) || p.getProducts().contains(PRODUCT_ID_LEGACY)) &&
                            p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                            hasFullAdventure = true;
                            if (!p.isAcknowledged()) {
                                acknowledge(p);
                            }
                        }
                    }
                    savePurchaseState(hasFullAdventure);
                    JSObject ret = new JSObject();
                    ret.put("restored", true);
                    ret.put("purchased", hasFullAdventure);
                    call.resolve(ret);
                } else {
                    JSObject ret = new JSObject();
                    ret.put("restored", false);
                    ret.put("purchased", getSavedPurchaseState());
                    ret.put("message", billingResult.getDebugMessage());
                    call.resolve(ret);
                }
            });
        });
    }
}
