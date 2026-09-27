"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Newspaper, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import { EmptyState, Field, PageTitle, STOREFRONT_URL, Toggle, formatDate, toSlug } from "@/components/content/shared";
import {
  errorText,
  useCreateBlogCategoryMutation,
  useDeleteBlogCategoryMutation,
  useDeleteBlogPostMutation,
  useGetBlogCategoriesQuery,
  useGetBlogPostsQuery,
  useUpdateBlogCategoryMutation,
  type BlogCategory,
  type PostStatus,
} from "@/lib/features/content/content-api-slice";

type View = "posts" | "categories";

export default function BlogPage() {
  const [view, setView] = useState<View>("posts");
  return (
    <div className="space-y-6">
      <PageTitle
        icon={Newspaper}
        title="Blog"
        description="Write articles for your store's blog at your-store.com/blog."
        actions={
          <Button asChild>
            <Link href="/content/blog/new">
              <Plus className="mr-2 h-4 w-4" /> New post
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader className="pb-3">
          <Tabs defaultValue="posts">
            <TabsList>
              <TabsTrigger value="posts" onClick={() => setView("posts")}>
                Posts
              </TabsTrigger>
              <TabsTrigger value="categories" onClick={() => setView("categories")}>
                Categories
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>{view === "posts" ? <PostsTable /> : <CategoriesTable />}</CardContent>
      </Card>
    </div>
  );
}

function PostsTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PostStatus | "">("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useGetBlogPostsQuery({ page, perPage: 20, search: search.trim() || undefined, status: status || undefined });
  const [remove] = useDeleteBlogPostMutation();
  const posts = data?.items ?? [];

  const onDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    try {
      await remove(id).unwrap();
      toast.success("Post deleted");
    } catch (e) {
      toast.error(errorText(e, "Couldn't delete the post."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search posts"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PostStatus | "");
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-44"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : posts.length === 0 ? (
        <EmptyState icon={Newspaper} title="No posts found" text="Write your first post to share news, guides and offers with customers." />
      ) : (
        <div className={`overflow-x-auto rounded-lg border ${isFetching ? "opacity-70" : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-md">
                    <Link href={`/content/blog/${p.id}`} className="font-medium hover:underline line-clamp-1">
                      {p.title}
                    </Link>
                    {p.author && <p className="text-xs text-slate-500">by {p.author.name}</p>}
                  </TableCell>
                  <TableCell className="text-sm">{p.category?.name ?? <span className="text-slate-400">None</span>}</TableCell>
                  <TableCell>{p.status === "published" ? <Badge variant="success">Published</Badge> : <Badge variant="secondary">Draft</Badge>}</TableCell>
                  <TableCell className="text-sm text-slate-500">{formatDate(p.publishedAt ?? p.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.status === "published" && (
                        <Button variant="ghost" size="icon" asChild title="View on store">
                          <a href={`${STOREFRONT_URL}/blog/${p.slug}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" asChild title="Edit">
                        <Link href={`/content/blog/${p.id}`}>
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

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-slate-500">
            Page {data.page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

const EMPTY_CAT = { name: "", slug: "", description: "", isActive: true };

function CategoriesTable() {
  const { data: categories = [], isLoading } = useGetBlogCategoriesQuery();
  const [create, { isLoading: creating }] = useCreateBlogCategoryMutation();
  const [update, { isLoading: updating }] = useUpdateBlogCategoryMutation();
  const [remove] = useDeleteBlogCategoryMutation();
  const [editing, setEditing] = useState<BlogCategory | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_CAT);

  const open = (c: BlogCategory | "new") => {
    setEditing(c);
    setForm(c === "new" ? EMPTY_CAT : { name: c.name, slug: c.slug, description: c.description ?? "", isActive: c.isActive });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: form.name.trim(), slug: form.slug || toSlug(form.name), description: form.description.trim() || null, isActive: form.isActive };
    try {
      if (editing === "new") await create(body).unwrap();
      else if (editing) await update({ id: editing.id, ...body }).unwrap();
      toast.success("Category saved");
      setEditing(null);
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the category."));
    }
  };

  const onDelete = async (c: BlogCategory) => {
    if (!window.confirm(`Delete "${c.name}"? Its posts stay, without a category.`)) return;
    try {
      await remove(c.id).unwrap();
      toast.success("Category deleted");
    } catch (err) {
      toast.error(errorText(err, "Couldn't delete the category."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => open("new")}>
          <Plus className="mr-2 h-4 w-4" /> New category
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : categories.length === 0 ? (
        <EmptyState icon={Tag} title="No categories yet" text="Group posts into topics like Style Guide or News." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-slate-500">{c.slug}</TableCell>
                  <TableCell>{c._count?.posts ?? 0}</TableCell>
                  <TableCell>{c.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Hidden</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => open(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => onDelete(c)}>
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

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing === "new" ? "New category" : "Edit category"}</DialogTitle>
            </DialogHeader>
            <Field label="Name" htmlFor="cat-name">
              <Input
                id="cat-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editing === "new" ? toSlug(e.target.value) : f.slug }))}
              />
            </Field>
            <Field label="Slug" htmlFor="cat-slug" hint={`Posts list: /blog?category=${form.slug || "slug"}`}>
              <Input id="cat-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: toSlug(e.target.value) }))} />
            </Field>
            <Field label="Description" htmlFor="cat-desc">
              <Textarea id="cat-desc" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <Toggle checked={form.isActive} onChange={(v) => setForm((f) => ({ ...f, isActive: v }))} label="Show on the blog" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || updating || !form.name.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
