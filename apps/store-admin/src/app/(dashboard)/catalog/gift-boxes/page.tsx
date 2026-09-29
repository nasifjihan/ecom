"use client";

/** Gift boxes shoppers fill themselves at /gift-boxes: the list, with how many were sold. */
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { EmptyState, PageTitle, STOREFRONT_URL } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useDeleteGiftBoxMutation, useGiftBoxesQuery, type GiftBox } from "@/lib/features/giftboxes/giftboxes-api-slice";

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function Status({ b }: { b: GiftBox }) {
  if (!b.isActive) return <Badge variant="secondary">Off</Badge>;
  if (!b.boxProduct.published)
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300" title="The box product isn't published, so shoppers can't see this box">
        Box product hidden
      </Badge>
    );
  return <Badge variant="success">On sale</Badge>;
}

export default function GiftBoxesPage() {
  const { can } = useCan();
  const { data = [], isLoading } = useGiftBoxesQuery();
  const [remove] = useDeleteGiftBoxMutation();

  const onDelete = async (b: GiftBox) => {
    if (!window.confirm(`Delete "${b.name}"? Orders already placed keep their boxes; boxes still in shoppers' carts can't be ordered.`)) return;
    try {
      await remove(b.id).unwrap();
      toast.success("Gift box deleted");
    } catch (e) {
      toast.error(errorText(e, "Couldn't delete the gift box."));
    }
  };

  const newButton = can("products.create") && (
    <Button asChild>
      <Link href="/catalog/gift-boxes/new">
        <Plus className="mr-2 h-4 w-4" /> New gift box
      </Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Gift}
        title="Gift boxes"
        description="Boxes shoppers fill themselves: they pick a box, the products that go in it and a message card. Each box is sold as its products plus the box itself."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`${STOREFRONT_URL}/gift-boxes`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View on store
              </a>
            </Button>
            {newButton}
          </>
        }
      />
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : data.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="No gift boxes yet"
              text="First add a product for the box itself (its price, stock and styles as options), then make a gift box that uses it."
              action={newButton || undefined}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gift box</TableHead>
                    <TableHead>Box product</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>What it takes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link href={`/catalog/gift-boxes/${b.id}`} className="font-medium hover:underline">
                          {b.name}
                        </Link>
                        <div className="text-xs text-slate-500">/gift-boxes/{b.slug}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.boxProduct.name}
                        {b.boxProduct.price !== null && <span className="text-slate-500"> · {taka(b.boxProduct.price)}</span>}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {b.minItems}–{b.maxItems}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                        {!b.productIds.length && !b.categoryIds.length
                          ? "Any product"
                          : [b.categoryIds.length && `${b.categoryIds.length} categories`, b.productIds.length && `${b.productIds.length} products`].filter(Boolean).join(" + ")}
                      </TableCell>
                      <TableCell>
                        <Status b={b} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{b.sold}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild title="Edit">
                            <Link href={`/catalog/gift-boxes/${b.id}`} aria-label={`Edit ${b.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          {can("products.delete") && (
                            <Button variant="ghost" size="icon" title="Delete" aria-label={`Delete ${b.name}`} onClick={() => onDelete(b)}>
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
