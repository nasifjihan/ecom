"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CornerDownRight, ListTree, Loader2, Plus, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  cn,
} from "@/components/ui";
import { EmptyState, Field, PageTitle } from "@/components/content/shared";
import { StorefrontPicker, useStorefrontChoice } from "@/components/storefront-picker";
import {
  errorText,
  useCreateMenuMutation,
  useDeleteMenuMutation,
  useGetCmsPagesQuery,
  useGetMenusQuery,
  useSaveMenuItemsMutation,
  useUpdateMenuMutation,
  type Menu,
  type MenuItem,
  type MenuLink,
  type MenuLocation,
} from "@/lib/features/content/content-api-slice";

const LOCATION_LABEL: Record<MenuLocation, string> = { header: "Header", footer: "Footer column" };
const QUICK_LINKS: MenuLink[] = [
  { title: "Home", url: "/", openInNewTab: false },
  { title: "Shop", url: "/products", openInNewTab: false },
  { title: "Categories", url: "/categories", openInNewTab: false },
  { title: "New In", url: "/products?sort=newest", openInNewTab: false },
  { title: "Blog", url: "/blog", openInNewTab: false },
  { title: "FAQ", url: "/faq", openInNewTab: false },
  { title: "My Account", url: "/account", openInNewTab: false },
];

const validUrl = (u: string) => u.startsWith("/") || /^https?:\/\//i.test(u);

export default function MenusPage() {
  const { data: all = [], isLoading } = useGetMenusQuery();
  const sf = useStorefrontChoice();
  // The chosen storefront's own menus (the default storefront's have no storefront set).
  const menus = all.filter((m) => (m.storefrontId ?? undefined) === sf.storefrontId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const selected = menus.find((m) => m.id === selectedId) ?? menus[0] ?? null;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={ListTree}
        title="Menus"
        description="The links in your store's header and footer. Each footer menu becomes one column."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> New menu
          </Button>
        }
      />

      <StorefrontPicker
        choice={sf}
        note={
          sf.storefrontId
            ? "Header or footer: where it has no menu of its own, it uses the default storefront's."
            : sf.several
              ? "Storefronts without their own header or footer menus use these."
              : null
        }
      />

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : menus.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={ListTree}
              title="No menus yet"
              text={
                sf.storefrontId
                  ? "This storefront uses the default storefront's menus until you create its own."
                  : "Your store uses a default header until you create a header menu."
              }
              action={<Button onClick={() => setCreating(true)}>Create a menu</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit">
            <CardContent className="p-2">
              {menus.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm",
                    selected?.id === m.id ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  )}
                >
                  <span className="font-medium truncate">{m.name}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {LOCATION_LABEL[m.location] ?? m.location}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>
          {selected && <MenuEditor key={selected.id + selected.items.length} menu={selected} onDeleted={() => setSelectedId(null)} />}
        </div>
      )}

      <NewMenuDialog
        open={creating}
        onClose={() => setCreating(false)}
        hasHeader={menus.some((m) => m.location === "header")}
        storefrontId={sf.storefrontId}
        onCreated={setSelectedId}
      />
    </div>
  );
}

function NewMenuDialog({
  open,
  onClose,
  hasHeader,
  storefrontId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  hasHeader: boolean;
  storefrontId: string | undefined;
  onCreated: (id: string) => void;
}) {
  const [create, { isLoading }] = useCreateMenuMutation();
  const [name, setName] = useState("");
  const [location, setLocation] = useState<MenuLocation>(hasHeader ? "footer" : "header");
  useEffect(() => {
    if (open) {
      setName("");
      setLocation(hasHeader ? "footer" : "header");
    }
  }, [open, hasHeader]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const m = await create({ name: name.trim(), location, storefrontId: storefrontId ?? null }).unwrap();
      toast.success("Menu created");
      onCreated(m.id);
      onClose();
    } catch (err) {
      toast.error(errorText(err, "Couldn't create the menu."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New menu</DialogTitle>
          </DialogHeader>
          <Field label="Name" htmlFor="menu-name" hint="For footer menus this is the column heading.">
            <Input id="menu-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer Care" />
          </Field>
          <Field label="Where it shows" htmlFor="menu-location" hint={hasHeader ? "This storefront already has a header menu." : undefined}>
            <select
              id="menu-location"
              value={location}
              onChange={(e) => setLocation(e.target.value as MenuLocation)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="header" disabled={hasHeader}>
                Header
              </option>
              <option value="footer">Footer column</option>
            </select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MenuEditor({ menu, onDeleted }: { menu: Menu; onDeleted: () => void }) {
  const [name, setName] = useState(menu.name);
  const [items, setItems] = useState<MenuItem[]>(menu.items);
  const [updateMenu, { isLoading: savingMenu }] = useUpdateMenuMutation();
  const [saveItems, { isLoading: savingItems }] = useSaveMenuItemsMutation();
  const [remove] = useDeleteMenuMutation();
  const { data: pages } = useGetCmsPagesQuery({ perPage: 100 });
  const dirty = name !== menu.name || JSON.stringify(items) !== JSON.stringify(menu.items);

  const quickLinks = useMemo(
    () => [...QUICK_LINKS, ...(pages?.items ?? []).filter((p) => p.isPublished).map((p) => ({ title: p.title, url: `/${p.slug}`, openInNewTab: false }))],
    [pages],
  );

  const problems = items.flatMap((it, i) =>
    [it, ...it.children].filter((l) => !l.title.trim() || !validUrl(l.url.trim())).map(() => i),
  );

  /** Edit helpers work on a path: [rootIndex] or [rootIndex, childIndex]. */
  const patch = (path: number[], p: Partial<MenuLink>) =>
    setItems((list) =>
      list.map((it, i) =>
        i !== path[0] ? it : path.length === 1 ? { ...it, ...p } : { ...it, children: it.children.map((c, j) => (j === path[1] ? { ...c, ...p } : c)) },
      ),
    );
  const moveIn = <T,>(arr: T[], i: number, d: number) => {
    const next = [...arr];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    return next;
  };
  const move = (path: number[], d: -1 | 1) =>
    setItems((list) =>
      path.length === 1 ? moveIn(list, path[0]!, d) : list.map((it, i) => (i === path[0] ? { ...it, children: moveIn(it.children, path[1]!, d) } : it)),
    );
  const drop = (path: number[]) =>
    setItems((list) => (path.length === 1 ? list.filter((_, i) => i !== path[0]) : list.map((it, i) => (i === path[0] ? { ...it, children: it.children.filter((_, j) => j !== path[1]) } : it))));
  const addChild = (i: number) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, children: [...it.children, { title: "", url: "/", openInNewTab: false }] } : it)));
  const addLink = (l: MenuLink = { title: "", url: "/", openInNewTab: false }) => setItems((list) => [...list, { ...l, children: [] }]);

  const save = async () => {
    if (problems.length) {
      toast.error("Every link needs a label and an address starting with / or https://");
      return;
    }
    try {
      if (name.trim() !== menu.name) await updateMenu({ id: menu.id, name: name.trim() }).unwrap();
      await saveItems({
        id: menu.id,
        items: items.map((it) => ({
          title: it.title.trim(),
          titleBn: it.titleBn?.trim() ?? "",
          url: it.url.trim(),
          openInNewTab: it.openInNewTab,
          children: it.children.map((c) => ({ title: c.title.trim(), titleBn: c.titleBn?.trim() ?? "", url: c.url.trim(), openInNewTab: c.openInNewTab })),
        })),
      }).unwrap();
      toast.success("Menu saved");
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the menu."));
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete the "${menu.name}" menu?${menu.location === "header" ? " Your store will go back to its default header links." : ""}`)) return;
    try {
      await remove(menu.id).unwrap();
      toast.success("Menu deleted");
      onDeleted();
    } catch (err) {
      toast.error(errorText(err, "Couldn't delete the menu."));
    }
  };

  const row = (l: MenuLink, path: number[], count: number) => {
    const bad = !l.title.trim() || !validUrl(l.url.trim());
    return (
      <div className={cn("flex flex-wrap items-center gap-2 rounded-md border bg-background p-2", path.length === 2 && "ml-8", bad && "border-rose-300")}>
        {path.length === 2 && <CornerDownRight className="h-4 w-4 text-slate-400" />}
        <Input aria-label="Label" className="h-9 w-40 flex-1 min-w-[8rem]" placeholder="Label" value={l.title} onChange={(e) => patch(path, { title: e.target.value })} />
        <Input
          aria-label="Label in Bangla"
          lang="bn"
          className="h-9 w-32 flex-1 min-w-[7rem]"
          placeholder="বাংলা (optional)"
          value={l.titleBn ?? ""}
          onChange={(e) => patch(path, { titleBn: e.target.value })}
        />
        <Input aria-label="Address" className="h-9 w-56 flex-[2] min-w-[10rem]" placeholder="/products or https://..." value={l.url} onChange={(e) => patch(path, { url: e.target.value })} />
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <Checkbox checked={l.openInNewTab} onCheckedChange={(v) => patch(path, { openInNewTab: v })} /> New tab
        </label>
        <div className="flex">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={path[path.length - 1] === 0} onClick={() => move(path, -1)} aria-label="Move up">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={path[path.length - 1] === count - 1} onClick={() => move(path, 1)} aria-label="Move down">
            <ArrowDown className="h-4 w-4" />
          </Button>
          {path.length === 1 && menu.location === "header" && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => addChild(path[0]!)} title="Add a dropdown link under this one">
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => drop(path)} aria-label="Remove">
            <X className="h-4 w-4 text-rose-600" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{LOCATION_LABEL[menu.location]} menu</CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="mr-1 h-4 w-4 text-rose-600" /> Delete
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || savingMenu || savingItems}>
            {(savingMenu || savingItems) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save menu
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field label={menu.location === "footer" ? "Column heading" : "Menu name"} htmlFor="menu-name-edit" className="max-w-sm">
          <Input id="menu-name-edit" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-slate-500">No links yet. Add one below.</p>}
          {items.map((it, i) => (
            <div key={i} className="space-y-2">
              {row(it, [i], items.length)}
              {it.children.map((c, j) => (
                <div key={j}>{row(c, [i, j], it.children.length)}</div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button variant="outline" size="sm" onClick={() => addLink()}>
            <Plus className="mr-1 h-4 w-4" /> Add link
          </Button>
          <select
            aria-label="Add a page or common link"
            value=""
            onChange={(e) => {
              const l = quickLinks[Number(e.target.value)];
              if (l) addLink(l);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Add a page or common link…</option>
            {quickLinks.map((l, i) => (
              <option key={`${l.url}-${i}`} value={i}>
                {l.title} ({l.url})
              </option>
            ))}
          </select>
        </div>
        {menu.location === "header" && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tip: a link to /categories with no dropdown links of its own shows your product categories as a dropdown.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
