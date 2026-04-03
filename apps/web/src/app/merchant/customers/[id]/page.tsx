"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, MapPin, Save, Trash2, UserRound } from "lucide-react";
import { Button, Card, EmptyStateCard, Input, PageHeader, PageShell, useLocale } from "@tayyar/ui";
import type { CustomerDetail, CustomerUpdatePayload } from "@tayyar/types";
import { apiFetch } from "@/lib/api";

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function formatDate(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function MerchantCustomerDetailPage() {
  const { locale } = useLocale();
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = React.useState<CustomerDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    phone: "",
    addresses: [] as Array<{
      id: string;
      branchId: string;
      name: string;
      addressLabel: string;
      lat: number;
      lng: number;
      remove?: boolean;
    }>,
  });

  const loadCustomer = React.useCallback(async () => {
    if (!params?.id) return;
    const data = await apiFetch<CustomerDetail>(`/v1/merchants/customers/${params.id}`);
    setCustomer(data);
    setForm({
      name: data.name || "",
      phone: data.phone,
      addresses: data.addresses.map((address) => ({
        id: address.id,
        branchId: address.branchId || "",
        name: address.name || "",
        addressLabel: address.addressLabel || "",
        lat: address.lat,
        lng: address.lng,
      })),
    });
  }, [params?.id]);

  React.useEffect(() => {
    loadCustomer()
      .catch((err) => setError(err instanceof Error ? err.message : tx(locale, "تعذر تحميل بيانات العميل.", "Could not load customer details.")))
      .finally(() => setLoading(false));
  }, [loadCustomer, locale]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!params?.id) return;

    setSaving(true);
    setError(null);

    try {
      const payload: CustomerUpdatePayload = {
        name: form.name,
        phone: form.phone,
        addresses: form.addresses.map((address) => ({
          id: address.id,
          branchId: address.branchId,
          name: address.name,
          addressLabel: address.addressLabel,
          lat: address.lat,
          lng: address.lng,
          remove: address.remove,
        })),
      };

      const data = await apiFetch<CustomerDetail>(
        `/v1/merchants/customers/${params.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      setCustomer(data);
      setForm({
        name: data.name || "",
        phone: data.phone,
        addresses: data.addresses.map((address) => ({
          id: address.id,
          branchId: address.branchId || "",
          name: address.name || "",
          addressLabel: address.addressLabel || "",
          lat: address.lat,
          lng: address.lng,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(locale, "تعذر حفظ التعديلات.", "Could not save changes."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "تفاصيل العميل", en: "Customer details" }}
      pageSubtitle={{ ar: "راجع البيانات الأساسية والعناوين المحفوظة بسرعة.", en: "Review identity and saved addresses quickly." }}
      topbarActions={
        <Link href="/merchant/orders/new">
          <Button variant="gold" size="sm">
            {tx(locale, "طلب جديد", "New order")}
          </Button>
        </Link>
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "بيانات العميل", en: "Customer profile" }}
          title={{ ar: customer?.name || "عميل من غير اسم", en: customer?.name || "Unnamed customer" }}
          subtitle={{ ar: "عدّل الاسم أو الرقم وراجع العناوين اللي التاجر بيستخدمها مع العميل ده.", en: "Update the name or phone and review the saved addresses used for this customer." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/merchant" },
            { label: { ar: "العملا", en: "Customers" }, href: "/merchant/customers" },
            { label: { ar: "تفاصيل العميل", en: "Customer details" } },
          ]}
          chips={customer ? [{ label: { ar: `${customer.totalOrders} طلب`, en: `${customer.totalOrders} orders` }, tone: "primary" }] : undefined}
        />

        {error ? <Card className="border border-danger-500/20 bg-danger-500/10 text-red-100">{error}</Card> : null}

        {loading ? (
          <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
            <Card className="h-72 animate-pulse bg-white/[0.04]" />
            <Card className="h-72 animate-pulse bg-white/[0.04]" />
          </div>
        ) : null}

        {!loading && !customer ? (
          <EmptyStateCard
            title={{ ar: "العميل مش موجود", en: "Customer not found" }}
            description={{ ar: "ممكن يكون السجل اتحذف أو الرابط مش صحيح.", en: "The record may have been removed or the link is invalid." }}
            action={
              <Link href="/merchant/customers">
                <Button variant="gold">{tx(locale, "رجوع للعملا", "Back to customers")}</Button>
              </Link>
            }
          />
        ) : null}

        {!loading && customer ? (
          <form className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]" onSubmit={handleSave}>
            <Card variant="elevated" className="space-y-5">
              <div>
                <p className="subtle-label">{tx(locale, "البيانات الأساسية", "Core details")}</p>
                <h2 className="mt-2 text-2xl font-black">{tx(locale, "خلّي بيانات العميل مرتبة", "Keep customer data clean")}</h2>
              </div>

              <Input
                placeholder={tx(locale, "اسم العميل", "Customer name")}
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
              <Input
                placeholder={tx(locale, "رقم الموبايل", "Mobile number")}
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                required
              />

              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 text-sm text-text-secondary">
                <div className="mb-2 flex items-center gap-2 text-text-primary">
                  <UserRound className="h-4 w-4 text-primary-300" />
                  {tx(locale, "آخر عنوان معروف", "Last known address")}
                </div>
                <div>{customer.lastAddress || tx(locale, "لسه مفيش عنوان واضح", "No known address yet")}</div>
              </div>

              <Button type="submit" variant="gold" size="lg" fullWidth loading={saving} icon={<Save className="h-4 w-4" />}>
                {tx(locale, "حفظ التعديلات", "Save changes")}
              </Button>
            </Card>

            <div className="space-y-6">
              <Card className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="subtle-label">{tx(locale, "العناوين المحفوظة", "Saved addresses")}</p>
                    <h2 className="mt-2 text-2xl font-black">{tx(locale, "اختيارات العميل الجاهزة", "Ready-to-use saved addresses")}</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-text-secondary">
                    {tx(locale, `${form.addresses.filter((item) => !item.remove).length} عنوان`, `${form.addresses.filter((item) => !item.remove).length} addresses`)}
                  </span>
                </div>

                <div className="space-y-4">
                  {form.addresses.map((address, index) => (
                    <div key={address.id} className={`rounded-[24px] border p-4 ${address.remove ? "border-danger-500/20 bg-danger-500/10 opacity-70" : "border-white/8 bg-white/[0.03]"}`}>
                      <div className="grid gap-4 md:grid-cols-[1fr_160px_auto] md:items-start">
                        <Input
                          placeholder={tx(locale, "اسم العنوان أو الوصف", "Address label")}
                          value={address.addressLabel}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              addresses: current.addresses.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, addressLabel: event.target.value, remove: false } : item,
                              ),
                            }))
                          }
                        />
                        <Input
                          placeholder={tx(locale, "اسم العميل على العنوان", "Name on address")}
                          value={address.name}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              addresses: current.addresses.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, name: event.target.value, remove: false } : item,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant={address.remove ? "secondary" : "outline"}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              addresses: current.addresses.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, remove: !item.remove } : item,
                              ),
                            }))
                          }
                        >
                          <span className="inline-flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            {address.remove ? tx(locale, "تراجع", "Undo") : tx(locale, "مسح من القائمة", "Remove")}
                          </span>
                        </Button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary-300" />
                          {customer.addresses[index]?.branchNameAr || customer.addresses[index]?.branchName || tx(locale, "من غير فرع", "No branch")}
                        </span>
                        <span dir="ltr">{address.lat}, {address.lng}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="subtle-label">{tx(locale, "آخر الطلبات", "Recent orders")}</p>
                    <h2 className="mt-2 text-2xl font-black">{tx(locale, "آخر شغل اتعمل مع العميل ده", "Latest activity for this customer")}</h2>
                  </div>
                  <Link href="/merchant/orders" className="text-sm font-bold text-primary-300">
                    <span className="inline-flex items-center gap-2">{tx(locale, "كل الطلبات", "All orders")}<ArrowUpRight className="h-4 w-4" /></span>
                  </Link>
                </div>

                <div className="space-y-3">
                  {customer.recentOrders.map((order) => (
                    <Link key={order.id} href={`/merchant/orders/${order.id}`} className="block rounded-[22px] border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-primary-500/20 hover:bg-primary-500/8">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm text-primary-300">{order.orderNumber}</div>
                          <div className="mt-2 font-bold text-text-primary">{order.branch.nameAr || order.branch.name}</div>
                          <div className="mt-1 text-sm text-text-secondary">{order.deliveryAddress || tx(locale, "من غير عنوان ظاهر", "No visible address")}</div>
                        </div>
                        <div className="text-xs text-text-tertiary">{formatDate(order.requestedAt, locale)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          </form>
        ) : null}
      </div>
    </PageShell>
  );
}
