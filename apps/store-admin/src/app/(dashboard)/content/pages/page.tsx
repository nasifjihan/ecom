"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { EmptyState, PageTitle, STOREFRONT_URL, formatDate } from "@/components/content/shared";
import { errorText, useDeleteCmsPageMutation, useGetCmsPagesQuery } from "@/lib/features/content/content-api-slice";

export default function CmsPagesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useGetCmsPagesQuery({ perPage: 100, search: search.trim() || undefined });
  const [remove] = useDeleteCmsPageMutation();
  const pages = data?.items ?? [];

  const onDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? Links to it on your store will stop working.`)) return;
    try {
      await remove(id).unwrap();
      toast.success("Page deleted");
    } catch (e) {
      toast.error(errorText(e, "Couldn't delete the page."));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={FileText}
        title="Pages"
        description="Policy, contact and other information pages. Each page lives at your-store.com/slug."
        actions={
          <Button asChild>
            <Link href="/content/pages/new">
              <Plus className="mr-2 h-4 w-4" /> New page
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search pages" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : pages.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={search ? "No pages match your search" : "No pages yet"}
              text="Add pages like Shipping Policy, Returns or Contact Us, then link them from a menu."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link href={`/content/pages/${p.id}`} className="hover:underline">
                          {p.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">/{p.slug}</TableCell>
                      <TableCell>
                        {p.isPublished ? <Badge variant="success">Published</Badge> : <Badge variant="secondary">Hidden</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{formatDate(p.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {p.isPublished && (
                            <Button variant="ghost" size="icon" asChild title="View on store">
                              <a href={`${STOREFRONT_URL}/${p.slug}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" asChild title="Edit">
                            <Link href={`/content/pages/${p.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => onDelete(p.id, p.title)}>
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
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
