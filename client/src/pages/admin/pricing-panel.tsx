import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DollarSign, AlertTriangle, CheckCircle, Loader2, RefreshCw, Globe,
  ShieldCheck, ExternalLink,
} from "lucide-react";

interface PlatformPrice {
  id: string;
  productId: string;
  billingInterval: string;
  priceAmount: number;
  currency: string;
  stripePriceId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface PlatformProduct {
  id: string;
  name: string;
  productKey: string;
  category: string;
  billingType: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  active: boolean;
  prices: PlatformPrice[];
}

interface StripeMismatch {
  type: string;
  productKey: string;
  productName: string;
  billingInterval?: string;
  dbValue?: string | number | null;
  stripeValue?: string | number | null;
  details: string;
}

interface AuditResult {
  checkedAt: string;
  totalProducts: number;
  totalPrices: number;
  mismatches: StripeMismatch[];
  healthy: boolean;
}

interface MetroPricingOverride {
  id: string;
  metroId: string;
  productId: string;
  billingInterval: string;
  overrideType: string;
  overrideValue: number;
  isActive: boolean;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function categoryBadge(category: string) {
  const colors: Record<string, string> = {
    listing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    hub: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    addon: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    capability: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    crown: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    contributor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    promo: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  };
  return <Badge className={colors[category] || ""} data-testid={`badge-category-${category}`}>{category}</Badge>;
}

function ProductsTab() {
  const { data, isLoading } = useQuery<{ products: PlatformProduct[] }>({
    queryKey: ["/api/admin/pricing/summary"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="loading-products">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const products = data?.products || [];

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center" data-testid="text-no-products">
            No platform products configured yet. Products are seeded from existing pricing data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-products">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold" data-testid="text-total-products">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-active-products">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold" data-testid="text-active-products">
                  {products.filter(p => p.active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stripe-linked">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Stripe Linked</p>
                <p className="text-2xl font-bold" data-testid="text-stripe-linked">
                  {products.filter(p => p.stripeProductId).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {products.map((product) => (
          <Card key={product.id} data-testid={`card-product-${product.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  {categoryBadge(product.category)}
                  <Badge variant={product.active ? "default" : "secondary"} data-testid={`badge-active-${product.id}`}>
                    {product.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <code className="text-xs text-muted-foreground" data-testid={`text-product-key-${product.id}`}>
                  {product.productKey}
                </code>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Stripe Product:</span>
                  {product.stripeProductId ? (
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded" data-testid={`text-stripe-product-${product.id}`}>
                      {product.stripeProductId}
                    </code>
                  ) : (
                    <span className="text-yellow-600 text-xs" data-testid={`text-no-stripe-product-${product.id}`}>
                      Not linked
                    </span>
                  )}
                </div>

                {product.prices.length > 0 ? (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-1">Prices:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {product.prices.map((price) => (
                        <div
                          key={price.id}
                          className={`border rounded-md p-2 text-sm ${price.isActive ? "border-border" : "border-dashed border-muted opacity-60"}`}
                          data-testid={`price-row-${price.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">{price.billingInterval}</span>
                            <span className="font-bold" data-testid={`text-price-amount-${price.id}`}>
                              {formatCents(price.priceAmount)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {price.stripePriceId ? (
                              <span data-testid={`text-stripe-price-${price.id}`}>
                                Stripe: {price.stripePriceId.slice(0, 20)}...
                              </span>
                            ) : (
                              <span className="text-yellow-600">No Stripe Price ID</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">No prices configured in platform_prices table</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AuditTab() {
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const { toast } = useToast();

  const auditMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/admin/pricing/audit");
      return res.json();
    },
    onSuccess: (data: AuditResult) => {
      setAuditResult(data);
      toast({
        title: data.healthy ? "Audit Passed" : "Mismatches Found",
        description: data.healthy
          ? "All platform prices are aligned with Stripe."
          : `Found ${data.mismatches.length} mismatch(es).`,
      });
    },
    onError: () => {
      toast({ title: "Audit Failed", description: "Could not complete Stripe sync audit.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Stripe Sync Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Validates that platform_products and platform_prices records match actual Stripe products and prices.
            Detects missing IDs, price drift, and inactive products.
          </p>
          <Button
            onClick={() => auditMutation.mutate()}
            disabled={auditMutation.isPending}
            data-testid="button-run-audit"
          >
            {auditMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Stripe Audit
          </Button>
        </CardContent>
      </Card>

      {auditResult && (
        <Card data-testid="card-audit-result">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {auditResult.healthy ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
              Audit Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold" data-testid="text-audit-products">{auditResult.totalProducts}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" data-testid="text-audit-prices">{auditResult.totalPrices}</p>
                <p className="text-xs text-muted-foreground">Prices</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" data-testid="text-audit-mismatches">{auditResult.mismatches.length}</p>
                <p className="text-xs text-muted-foreground">Mismatches</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Checked at: {new Date(auditResult.checkedAt).toLocaleString()}
            </p>

            {auditResult.mismatches.length > 0 && (
              <div className="space-y-2">
                {auditResult.mismatches.map((m, i) => (
                  <div
                    key={i}
                    className="border border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 rounded-md p-3"
                    data-testid={`mismatch-row-${i}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{m.type}</Badge>
                      <span className="font-medium text-sm">{m.productName}</span>
                      {m.billingInterval && (
                        <span className="text-xs text-muted-foreground">({m.billingInterval})</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.details}</p>
                  </div>
                ))}
              </div>
            )}

            {auditResult.healthy && (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-green-700 dark:text-green-400" data-testid="text-audit-healthy">
                  All platform prices are aligned with Stripe
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <p>
              Stripe sync is read-only. To create or modify Stripe products/prices, use the plan/approve workflow
              or contact the platform admin. No automatic Stripe changes are made.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetroPricingTab() {
  const { data: overrides, isLoading } = useQuery<MetroPricingOverride[]>({
    queryKey: ["/api/admin/pricing/overrides"],
  });

  const { data: productsData } = useQuery<{ products: PlatformProduct[] }>({
    queryKey: ["/api/admin/pricing/summary"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const products = productsData?.products || [];
  const overrideList = overrides || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Metro Pricing Inheritance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            All metros inherit platform pricing by default. Overrides are disabled unless explicitly activated.
            Currently, all metros use the same platform pricing — no per-metro drift.
          </p>

          {overrideList.length === 0 ? (
            <div className="text-center py-8 border rounded-md bg-muted/20" data-testid="text-no-overrides">
              <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="font-medium">No Metro Overrides</p>
              <p className="text-sm text-muted-foreground">All metros use platform pricing (inheritance ON)</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overrideList.map((override) => {
                const product = products.find(p => p.id === override.productId);
                return (
                  <div
                    key={override.id}
                    className="border rounded-md p-3 flex items-center justify-between"
                    data-testid={`override-row-${override.id}`}
                  >
                    <div>
                      <p className="font-medium text-sm">{product?.name || override.productId}</p>
                      <p className="text-xs text-muted-foreground">
                        Metro: {override.metroId} | {override.billingInterval} |
                        {override.overrideType === "fixed"
                          ? ` ${formatCents(override.overrideValue)}`
                          : ` ${override.overrideValue}% ${override.overrideType.replace("percentage_", "")}`
                        }
                      </p>
                    </div>
                    <Badge variant={override.isActive ? "default" : "secondary"}>
                      {override.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <p>
              Metro pricing overrides are managed through the Cora plan/approve workflow.
              Ask Cora about pricing to create a pricing change plan.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PricingPanel({ cityId }: { cityId?: string }) {
  return (
    <div className="space-y-6 p-1" data-testid="pricing-panel">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-pricing-title">Platform Pricing</h2>
        <p className="text-muted-foreground">
          Centralized pricing control — platform products, prices, Stripe sync, and metro inheritance.
        </p>
      </div>

      <Tabs defaultValue="products">
        <TabsList data-testid="pricing-tabs">
          <TabsTrigger value="products" data-testid="tab-products">Products & Prices</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Stripe Audit</TabsTrigger>
          <TabsTrigger value="metro" data-testid="tab-metro">Metro Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>

        <TabsContent value="metro">
          <MetroPricingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
