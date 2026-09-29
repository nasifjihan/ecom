"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, Shield, Trash2 } from "lucide-react";
import { hasPermission, perm, type PermissionAction, type PermissionArea } from "@ecom/shared-types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Input, Skeleton, cn } from "@/components/ui";
import { Field } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useMeQuery } from "@/lib/features/auth/auth-api-slice";
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useGetPermissionCatalogueQuery,
  useGetRolesQuery,
  useUpdateRoleMutation,
  type Role,
} from "@/lib/features/team/team-api-slice";

const ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete"];

export default function RolesPage() {
  const { data: roles = [], isLoading } = useGetRolesQuery();
  const { data: areas = [] } = useGetPermissionCatalogueQuery();
  const { data: me } = useMeQuery();
  const { can } = useCan();
  const [create, { isLoading: creating }] = useCreateRoleMutation();
  const [update, { isLoading: saving }] = useUpdateRoleMutation();
  const [remove] = useDeleteRoleMutation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0];
  const [name, setName] = useState("");
  const [cap, setCap] = useState("0");
  const [held, setHeld] = useState<Set<string>>(new Set());

  const reset = () => {
    if (!selected) return;
    setName(selected.name);
    setCap(String(selected.maxManualDiscountPct));
    setHeld(new Set(selected.permissions));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reset, [selected]);

  const myPerms = me?.permissions ?? [];
  const mine = !!selected && !!me?.user?.roleId && String(me.user.roleId) === selected.id;
  const locked = !selected || selected.isOwner || !can("roles.edit") || !!mine;
  const groups = useMemo(() => {
    const m = new Map<string, PermissionArea[]>();
    for (const a of areas) m.set(a.group, [...(m.get(a.group) ?? []), a]);
    return [...m.entries()];
  }, [areas]);
  const dirty =
    !!selected &&
    (name !== selected.name ||
      Number(cap) !== selected.maxManualDiscountPct ||
      held.size !== selected.permissions.length ||
      selected.permissions.some((p) => !held.has(p)));

  /** Ticking create/edit/delete also gives view; taking view away takes the rest. */
  const toggle = (area: PermissionArea, action: PermissionAction, on: boolean) => {
    setHeld((prev) => {
      const next = new Set(prev);
      const code = perm(area.key, action);
      if (on) {
        next.add(code);
        if (action !== "view" && area.actions.includes("view")) next.add(perm(area.key, "view"));
      } else {
        next.delete(code);
        if (action === "view") area.actions.forEach((a) => next.delete(perm(area.key, a)));
      }
      return next;
    });
  };
  const toggleArea = (area: PermissionArea, on: boolean) =>
    setHeld((prev) => {
      const next = new Set(prev);
      area.actions.forEach((a) => (on ? next.add(perm(area.key, a)) : next.delete(perm(area.key, a))));
      return next;
    });
  /** Non-owners can only hand out what they hold themselves (the API refuses the rest). */
  const grantable = (code: string) => hasPermission(myPerms, code);

  const save = async () => {
    if (!selected) return;
    try {
      await update({
        id: selected.id,
        ...(selected.isSystem ? {} : { name: name.trim() }),
        permissions: [...held],
        maxManualDiscountPct: Number(cap) || 0,
      }).unwrap();
      toast.success("Role saved");
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the role."));
    }
  };

  const add = async (from?: Role) => {
    const base = from ? `${from.name} (copy)` : "New role";
    let n = base;
    for (let i = 2; roles.some((r) => r.name.toLowerCase() === n.toLowerCase()); i++) n = `${base} ${i}`;
    try {
      const r = await create(from ? { name: n, copyFromRoleId: from.id } : { name: n, permissions: ["dashboard.view"] }).unwrap();
      setSelectedId(r.id);
      toast.success(from ? `Copied ${from.name}` : "Role added — choose what it can do");
    } catch (err) {
      toast.error(errorText(err, "Couldn't add the role."));
    }
  };

  const del = async () => {
    if (!selected || !window.confirm(`Delete the role "${selected.name}"?`)) return;
    try {
      await remove(selected.id).unwrap();
      setSelectedId(null);
      toast.success("Role deleted");
    } catch (err) {
      toast.error(errorText(err, "Couldn't delete the role."));
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
      <Card className="self-start">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Roles</CardTitle>
          {can("roles.create") && (
            <Button size="sm" variant="outline" onClick={() => add()} disabled={creating}>
              <Plus className="mr-1 h-4 w-4" /> New
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-2">
          <ul className="space-y-0.5">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                    selected?.id === r.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-slate-100 dark:hover:bg-slate-800",
                  )}
                >
                  <span className="truncate">{r.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-slate-500">{r.memberCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                <Shield className="h-5 w-5" /> {selected.name}
                {selected.isSystem && <Badge variant="outline">Built-in</Badge>}
                {mine && <Badge variant="secondary">Your role</Badge>}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {selected.memberCount} staff member{selected.memberCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex gap-2">
              {can("roles.create") && !selected.isOwner && (
                <Button variant="outline" size="sm" onClick={() => add(selected)} disabled={creating}>
                  <Copy className="mr-1 h-4 w-4" /> Copy
                </Button>
              )}
              {can("roles.delete") && !selected.isSystem && (
                <Button variant="outline" size="sm" onClick={del} disabled={selected.memberCount > 0} title={selected.memberCount ? "Give its staff another role first" : undefined}>
                  <Trash2 className="mr-1 h-4 w-4 text-rose-600" /> Delete
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {selected.isOwner ? (
              <p className="rounded-md bg-slate-50 p-4 text-sm dark:bg-slate-900">
                Owners can do everything, including managing staff and roles. This role can&apos;t be changed.
              </p>
            ) : (
              <>
                {mine && (
                  <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    This is your own role, so you can&apos;t change it. Ask an owner.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" htmlFor="role-name" hint={selected.isSystem ? "Built-in roles keep their names. Copy it to make a renamed version." : undefined}>
                    <Input id="role-name" value={name} disabled={locked || selected.isSystem} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Largest discount on manual orders (%)" htmlFor="role-cap" hint="Of the items total, when staff enter an order by hand.">
                    <Input id="role-cap" type="number" min={0} max={100} step="0.5" value={cap} disabled={locked} onChange={(e) => setCap(e.target.value)} />
                  </Field>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Area</th>
                        <th className="w-14 px-2 py-2 font-semibold">All</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="w-16 px-2 py-2 font-semibold capitalize">
                            {a}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map(([group, list]) => [
                        <tr key={group} className="bg-slate-50/60 dark:bg-slate-900/60">
                          <td colSpan={6} className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {group}
                          </td>
                        </tr>,
                        ...list.map((area) => {
                          const codes = area.actions.map((a) => perm(area.key, a));
                          const all = codes.every((c) => held.has(c));
                          return (
                            <tr key={area.key} className="border-t">
                              <td className="px-3 py-2">
                                <div className="font-medium">{area.label}</div>
                                {area.help && <div className="text-xs text-slate-500">{area.help}</div>}
                              </td>
                              <td className="px-2 py-2 text-center">
                                <Checkbox
                                  checked={all}
                                  disabled={locked || !codes.every(grantable)}
                                  onCheckedChange={(v) => toggleArea(area, v)}
                                  aria-label={`All ${area.label}`}
                                />
                              </td>
                              {ACTIONS.map((a) => {
                                if (!area.actions.includes(a)) {
                                  return (
                                    <td key={a} className="px-2 py-2 text-center text-slate-300">
                                      —
                                    </td>
                                  );
                                }
                                const code = perm(area.key, a);
                                return (
                                  <td key={a} className="px-2 py-2 text-center">
                                    <Checkbox
                                      checked={held.has(code)}
                                      disabled={locked || (!held.has(code) && !grantable(code))}
                                      onCheckedChange={(v) => toggle(area, a, v)}
                                      aria-label={`${area.label}: ${a}`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        }),
                      ])}
                    </tbody>
                  </table>
                </div>

                {!locked && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" disabled={!dirty} onClick={reset}>
                      Undo changes
                    </Button>
                    <Button onClick={save} disabled={!dirty || saving || name.trim().length < 2}>
                      Save role
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
