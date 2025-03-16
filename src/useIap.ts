import {
  endConnection,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  transactionUpdatedIos,
  getProducts,
  getAvailablePurchases,
  getPurchaseHistory,
  getSubscriptions,
} from './';
import {useCallback, useEffect, useState} from 'react';
import {
  Product,
  ProductPurchase,
  Purchase,
  PurchaseError,
  PurchaseResult,
  SubscriptionProduct,
  SubscriptionPurchase,
} from './ExpoIap.types';
import {TransactionEvent} from './modules/ios';
import {Subscription} from 'expo-modules-core';

type IAP_STATUS = {
  connected: boolean;
  products: Product[];
  promotedProductsIOS: ProductPurchase[];
  subscriptions: SubscriptionProduct[];
  purchaseHistories: ProductPurchase[];
  availablePurchases: ProductPurchase[];
  currentPurchase?: ProductPurchase;
  currentPurchaseError?: PurchaseError;
  finishTransaction: ({
    purchase,
    isConsumable,
    developerPayloadAndroid,
  }: {
    purchase: Purchase;
    isConsumable?: boolean;
    developerPayloadAndroid?: string;
  }) => Promise<string | boolean | PurchaseResult | void>;
  getAvailablePurchases: () => Promise<void>;
  getPurchaseHistories: () => Promise<void>;
  getProducts: (skus: string[]) => Promise<void>;
  getSubscriptions: (skus: string[]) => Promise<void>;
};

let purchaseUpdateSubscription: Subscription;
let purchaseErrorSubscription: Subscription;
let promotedProductsSubscription: Subscription;

export function useIAP(): IAP_STATUS {
  const [connected, setConnected] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotedProductsIOS, setPromotedProductsIOS] = useState<
    ProductPurchase[]
  >([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionProduct[]>([]);
  const [purchaseHistories, setPurchaseHistories] = useState<ProductPurchase[]>(
    [],
  );
  const [availablePurchases, setAvailablePurchases] = useState<
    ProductPurchase[]
  >([]);
  const [currentPurchase, setCurrentPurchase] = useState<ProductPurchase>();
  const [currentPurchaseError, setCurrentPurchaseError] =
    useState<PurchaseError>();

  const requestProducts = useCallback(async (skus: string[]): Promise<void> => {
    setProducts(await getProducts(skus));
  }, []);

  const requestSubscriptions = useCallback(
    async (skus: string[]): Promise<void> => {
      setSubscriptions(await getSubscriptions(skus));
    },
    [],
  );

  const requestAvailablePurchases = useCallback(async (): Promise<void> => {
    setAvailablePurchases(await getAvailablePurchases());
  }, []);

  const requestPurchaseHistories = useCallback(async (): Promise<void> => {
    setPurchaseHistories(await getPurchaseHistory());
  }, []);

  const finishTransaction = useCallback(
    async ({
      purchase,
      isConsumable,
      developerPayloadAndroid,
    }: {
      purchase: ProductPurchase;
      isConsumable?: boolean;
      developerPayloadAndroid?: string;
    }): Promise<string | boolean | PurchaseResult | void> => {
      try {
        return await finishTransaction({
          purchase,
          isConsumable,
          developerPayloadAndroid,
        });
      } catch (err) {
        throw err;
      } finally {
        if (purchase.id === currentPurchase?.id) {
          setCurrentPurchase(undefined);
        }

        if (purchase.id === currentPurchaseError?.productId) {
          // Note that PurchaseError still uses productId
          setCurrentPurchaseError(undefined);
        }
      }
    },
    [
      currentPurchase?.id,
      currentPurchaseError?.productId,
      setCurrentPurchase,
      setCurrentPurchaseError,
    ],
  );

  const initIapWithSubscriptions = useCallback(async (): Promise<void> => {
    const result = await initConnection();

    setConnected(result);

    if (result) {
      purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: Purchase | SubscriptionPurchase) => {
          setCurrentPurchaseError(undefined);
          setCurrentPurchase(purchase);
        },
      );

      purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
          setCurrentPurchase(undefined);
          setCurrentPurchaseError(error);
        },
      );

      promotedProductsSubscription = transactionUpdatedIos(
        (event: TransactionEvent) => {
          setPromotedProductsIOS((prevProducts) =>
            event.transaction
              ? [...prevProducts, event.transaction]
              : prevProducts,
          );
        },
      );
    }
  }, []);

  useEffect(() => {
    initIapWithSubscriptions();

    return (): void => {
      if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
      if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
      if (promotedProductsSubscription) promotedProductsSubscription.remove();

      endConnection();
      setConnected(false);
    };
  }, [initIapWithSubscriptions]);

  return {
    connected,
    products,
    promotedProductsIOS,
    subscriptions,
    purchaseHistories,
    finishTransaction,
    availablePurchases,
    currentPurchase,
    currentPurchaseError,
    getProducts: requestProducts,
    getSubscriptions: requestSubscriptions,
    getAvailablePurchases: requestAvailablePurchases,
    getPurchaseHistories: requestPurchaseHistories,
  };
}
