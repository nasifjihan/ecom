"use client";

/**
 * Book a parcel with a courier account: Steadfast needs nothing more; Pathao needs its city and
 * zone and RedX its delivery area, pre-filled from the order's address when the names match.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectItem,
  Skeleton,
} from "@/components/ui";
import { apiError } from "@/lib/features/operations/fulfilment-api-slice";
import {
  useActiveCouriersQuery,
  useBookParcelMutation,
  useCourierAreaQuery,
  usePathaoAreasQuery,
  usePathaoCitiesQuery,
  usePathaoZonesQuery,
  useRedxAreasQuery,
} from "@/lib/features/operations/couriers-api-slice";

export function BookCourierDialog({
  parcel,
  onClose,
}: {
  parcel: { id: string; orderId: string | number; code: string; weightKg: number | null };
  onClose: () => void;
}) {
  const { data: accounts, isLoading } = useActiveCouriersQuery();
  const [accountId, setAccountId] = useState("");
  const account = accounts?.find((a) => a.id === accountId);
  useEffect(() => {
    if (!accountId && accounts?.length) setAccountId(accounts[0]!.id);
  }, [accounts, accountId]);

  const { data: hint, isFetching: matching } = useCourierAreaQuery(
    { parcelId: parcel.id, accountId },
    { skip: !account || account.courier === "steadfast" },
  );
  const [cityId, setCityId] = useState<number | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [redxArea, setRedxArea] = useState<{ areaId: number; areaName: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [weight, setWeight] = useState(parcel.weightKg ? String(parcel.weightKg) : "");
  const [book, { isLoading: booking }] = useBookParcelMutation();

  // Start from the matched area whenever the account changes.
  useEffect(() => {
    setCityId(hint?.pathao?.cityId ?? null);
    setZoneId(hint?.pathao?.zoneId ?? null);
    setAreaId(null);
    setRedxArea(hint?.redx ?? null);
  }, [hint, accountId]);

  const pathao = account?.courier === "pathao";
  const redx = account?.courier === "redx";
  const { data: cities } = usePathaoCitiesQuery(accountId, { skip: !pathao });
  const { data: zones } = usePathaoZonesQuery({ id: accountId, cityId: cityId ?? 0 }, { skip: !pathao || !cityId });
  const { data: areas } = usePathaoAreasQuery({ id: accountId, zoneId: zoneId ?? 0 }, { skip: !pathao || !zoneId });
  const { data: redxAreas } = useRedxAreasQuery({ id: accountId }, { skip: !redx });
  const shownRedx = useMemo(
    () => (redxAreas ?? []).filter((a) => !filter || a.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 200),
    [redxAreas, filter],
  );

  const ready = !!account && (!pathao || (!!cityId && !!zoneId)) && (!redx || !!redxArea);

  async function submit() {
    if (!account) return;
    try {
      await book({
        parcelId: parcel.id,
        orderId: parcel.orderId,
        accountId: account.id,
        ...(pathao ? { pathao: { cityId: cityId!, zoneId: zoneId!, ...(areaId ? { areaId } : {}) } } : {}),
        ...(redx ? { redx: redxArea! } : {}),
        ...(Number(weight) > 0 ? { weightKg: Number(weight) } : {}),
      }).unwrap();
      toast.success(`${parcel.code} booked with ${account.courierName}`);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't book the parcel"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book {parcel.code} with a courier</DialogTitle>
          <DialogDescription>The courier gets the address, phone, cash to collect and items, and sends back a tracking number.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : !accounts?.length ? (
          <p className="text-sm text-slate-600">
            No courier account yet. Add your Steadfast, Pathao or RedX API keys in{" "}
            <Link href="/settings/couriers" className="text-indigo-600 hover:underline">Settings → Couriers</Link>.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Courier</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}{a.label !== a.courierName ? ` (${a.courierName})` : ""}{a.mode === "sandbox" ? " · sandbox" : ""}
                  </SelectItem>
                ))}
              </Select>
            </div>
            {pathao && (
              <>
                {matching && <p className="text-xs text-slate-500">Matching the address to Pathao's areas…</p>}
                {!matching && hint && !hint.pathao?.zoneId && (
                  <p className="text-xs text-amber-600">Pathao's areas don't clearly match this address; choose them below.</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Pathao city</Label>
                    <Select value={cityId ? String(cityId) : ""} onValueChange={(v) => { setCityId(Number(v) || null); setZoneId(null); setAreaId(null); }}>
                      <SelectItem value="">Choose…</SelectItem>
                      {cities?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Zone</Label>
                    <Select value={zoneId ? String(zoneId) : ""} onValueChange={(v) => { setZoneId(Number(v) || null); setAreaId(null); }}>
                      <SelectItem value="">Choose…</SelectItem>
                      {zones?.map((z) => <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>)}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs mb-1 block">Area (optional)</Label>
                    <Select value={areaId ? String(areaId) : ""} onValueChange={(v) => setAreaId(Number(v) || null)}>
                      <SelectItem value="">Not needed</SelectItem>
                      {areas?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                    </Select>
                  </div>
                </div>
              </>
            )}
            {redx && (
              <div className="space-y-2">
                {!matching && hint && !hint.redx && <p className="text-xs text-amber-600">RedX's areas don't clearly match this address; choose one.</p>}
                <Label className="text-xs block">RedX delivery area</Label>
                <Input className="h-9" placeholder="Filter areas" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <Select
                  value={redxArea ? String(redxArea.areaId) : ""}
                  onValueChange={(v) => {
                    const a = redxAreas?.find((x) => x.id === Number(v));
                    setRedxArea(a ? { areaId: a.id, areaName: a.name } : null);
                  }}
                >
                  <SelectItem value="">Choose…</SelectItem>
                  {redxArea && !shownRedx.some((a) => a.id === redxArea.areaId) && (
                    <SelectItem value={String(redxArea.areaId)}>{redxArea.areaName}</SelectItem>
                  )}
                  {shownRedx.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}{a.district ? ` (${a.district})` : ""}</SelectItem>)}
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs mb-1 block">Weight (kg)</Label>
              <Input type="number" min={0.1} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Account default" className="h-9" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={booking || !ready}>{booking ? "Booking…" : "Book"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
