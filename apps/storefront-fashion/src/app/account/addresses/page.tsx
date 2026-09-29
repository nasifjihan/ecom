"use client";

import * as React from "react";
import { MapPin, Plus } from "lucide-react";
import { Badge, Button, Card, CardContent, Skeleton, apiErrorMessage, msg, toast, useT } from "@ecom/storefront-base";
import {
  useAddMyAddressMutation,
  useDeleteMyAddressMutation,
  useGetMyAddressesQuery,
  useSetMyDefaultAddressMutation,
  useUpdateMyAddressMutation,
  type AddressInput,
  type CustomerAddress,
} from "@/lib/account";
import { AccountShell, AddressForm, emptyAddress, toAddressInput } from "../_components";

export default function AddressesPage() {
  return (
    <AccountShell title={msg("Addresses")} description={msg("Your default address fills in automatically at checkout.")}>
      <AddressBook />
    </AccountShell>
  );
}

function AddressBook() {
  const { data: addresses, isLoading, isError } = useGetMyAddressesQuery();
  const [add, { isLoading: adding }] = useAddMyAddressMutation();
  const [update, { isLoading: updating }] = useUpdateMyAddressMutation();
  const [remove] = useDeleteMyAddressMutation();
  const [setDefault] = useSetMyDefaultAddressMutation();
  const [editing, setEditing] = React.useState<CustomerAddress | "new" | null>(null);
  const t = useT();

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    try {
      await fn();
      toast.success(t(ok));
      return true;
    } catch (err) {
      toast.error(t(fail), { description: apiErrorMessage(err) });
      return false;
    }
  };

  const save = async (a: AddressInput) => {
    const done =
      editing === "new"
        ? await run(() => add(a).unwrap(), msg("Address added"), msg("Couldn't add the address"))
        : await run(() => update({ id: (editing as CustomerAddress).id, ...a }).unwrap(), msg("Address updated"), msg("Couldn't update the address"));
    if (done) setEditing(null);
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (isError || !addresses) return <p className="text-sm text-destructive">{t("Couldn't load your addresses. Please refresh the page.")}</p>;

  if (editing) {
    return (
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-4">{editing === "new" ? t("New address") : t("Edit address")}</h2>
          <AddressForm
            initial={editing === "new" ? { ...emptyAddress(), isDefault: addresses.length === 0 } : toAddressInput(editing)}
            submitLabel={editing === "new" ? msg("Add address") : msg("Save address")}
            busy={adding || updating}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing("new")}>
        <Plus className="h-4 w-4 mr-2" /> {t("Add address")}
      </Button>
      {addresses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">{t("No saved addresses yet.")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">
                    {a.firstName} {a.lastName}
                  </p>
                  {a.label && <Badge variant="outline">{a.label}</Badge>}
                  {a.isDefault && <Badge className="border-0 bg-primary/10 text-primary">{t("Default")}</Badge>}
                </div>
                <div className="text-muted-foreground">
                  <p>{[a.address1, a.address2].filter(Boolean).join(", ")}</p>
                  <p>{[a.upazila, a.city, a.state, a.postcode].filter(Boolean).join(", ")}</p>
                  {a.phone && <p>{a.phone}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                    {t("Edit")}
                  </Button>
                  {!a.isDefault && (
                    <Button size="sm" variant="outline" onClick={() => run(() => setDefault({ id: a.id, type: a.type }).unwrap(), msg("Default address updated"), msg("Couldn't change the default"))}>
                      {t("Make default")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => window.confirm(t("Delete this address?")) && run(() => remove(a.id).unwrap(), msg("Address deleted"), msg("Couldn't delete the address"))}
                  >
                    {t("Delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
