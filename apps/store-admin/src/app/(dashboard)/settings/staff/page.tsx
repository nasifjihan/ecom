"use client";

import { useState } from "react";
import { StorefrontMultiSelect } from "@/components/storefront-multi-select";
import { useStorefrontOptionsQuery } from "@/lib/features/storefronts/storefronts-api-slice";
import { toast } from "sonner";
import { KeyRound, Pencil, UserPlus, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
} from "@/components/ui";
import { Field } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useCreateStaffMutation,
  useGetRolesQuery,
  useGetStaffQuery,
  useSetStaffPasswordMutation,
  useUpdateStaffMutation,
  type StaffMember,
} from "@/lib/features/team/team-api-slice";

const SELECT = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50";
const passwordProblem = (p: string) =>
  p.length < 10 ? "Use at least 10 characters" : !/[A-Za-z]/.test(p) || !/\d/.test(p) ? "Use letters and at least one number" : null;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

export default function StaffPage() {
  const { data: staff = [], isLoading } = useGetStaffQuery();
  const { data: roles = [] } = useGetRolesQuery(undefined, { skip: false });
  const { can, isOwner } = useCan();
  const [createStaff, { isLoading: creating }] = useCreateStaffMutation();
  const [updateStaff, { isLoading: updating }] = useUpdateStaffMutation();
  const [setPassword, { isLoading: settingPw }] = useSetStaffPasswordMutation();

  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [pwFor, setPwFor] = useState<StaffMember | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", roleId: "", storefrontIds: [] as string[] });
  const { data: storefronts = [] } = useStorefrontOptionsQuery();
  const isOwnerRole = roles.find((r) => r.id === f.roleId)?.isOwner ?? false;
  const [pw, setPw] = useState("");

  const open = (s: StaffMember | "new") => {
    setEditing(s);
    setF(
      s === "new"
        ? { name: "", email: "", phone: "", password: "", roleId: roles.find((r) => !r.isOwner)?.id ?? "", storefrontIds: [] }
        : { name: s.name, email: s.email, phone: s.phone ?? "", password: "", roleId: s.role.id, storefrontIds: s.storefrontIds },
    );
  };
  // Only owners may make owners.
  const roleChoices = roles.filter((r) => isOwner || !r.isOwner);
  const ownerLocked = (s: StaffMember) => !isOwner && s.role.slug === "owner";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing === "new") {
        await createStaff({
          name: f.name.trim(),
          email: f.email.trim(),
          phone: f.phone.trim() || undefined,
          password: f.password,
          roleId: f.roleId,
          ...(isOwnerRole ? {} : { storefrontIds: f.storefrontIds }),
        }).unwrap();
        toast.success(`${f.name.trim()} can now sign in with ${f.email.trim()}`);
      } else if (editing) {
        await updateStaff({
          id: editing.id,
          name: f.name.trim(),
          phone: f.phone.trim(),
          ...(editing.isYou ? {} : { roleId: f.roleId, ...(isOwnerRole ? {} : { storefrontIds: f.storefrontIds }) }),
        }).unwrap();
        toast.success("Saved");
      }
      setEditing(null);
    } catch (err) {
      toast.error(errorText(err, "Couldn't save."));
    }
  };

  const toggleActive = async (s: StaffMember) => {
    const next = s.status === "active" ? "inactive" : "active";
    if (next === "inactive" && !window.confirm(`Deactivate ${s.name}? They are signed out and can't sign in until you turn their account back on.`)) return;
    try {
      await updateStaff({ id: s.id, status: next }).unwrap();
      toast.success(next === "active" ? `${s.name} can sign in again` : `${s.name} is deactivated`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwFor) return;
    try {
      await setPassword({ id: pwFor.id, password: pw }).unwrap();
      toast.success(`New password set for ${pwFor.name}; their other sessions were signed out`);
      setPwFor(null);
    } catch (err) {
      toast.error(errorText(err, "Couldn't set the password."));
    }
  };

  const newProblem =
    editing === "new" ? (f.name.trim().length < 2 ? "name" : !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? "email" : passwordProblem(f.password) || (!f.roleId ? "role" : null)) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" /> Staff
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">People who can sign in to this admin, and their roles.</p>
          </div>
          {can("staff.create") && (
            <Button onClick={() => open("new")}>
              <UserPlus className="mr-2 h-4 w-4" /> Add staff
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s.id} className={s.status !== "active" ? "opacity-60" : undefined}>
                      <TableCell>
                        <div className="font-medium">
                          {s.name} {s.isYou && <Badge variant="secondary">You</Badge>}
                        </div>
                        <div className="text-xs text-slate-500">{[s.email, s.phone].filter(Boolean).join(" · ")}</div>
                      </TableCell>
                      <TableCell>
                        {s.role.name}
                        {storefronts.length > 1 && s.storefrontIds.length > 0 && (
                          <div className="text-xs text-slate-500">
                            {s.storefrontIds.map((id) => storefronts.find((x) => x.id === id)?.name ?? `#${id}`).join(", ")} only
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "outline"}>{s.status === "active" ? "Active" : "Deactivated"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{when(s.lastLoginAt)}</TableCell>
                      <TableCell>
                        {can("staff.edit") && !ownerLocked(s) && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => open(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Set a new password" onClick={() => { setPwFor(s); setPw(""); }}>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            {!s.isYou && (
                              <Button variant="outline" size="sm" onClick={() => toggleActive(s)} disabled={updating}>
                                {s.status === "active" ? "Deactivate" : "Turn on"}
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing === "new" ? "Add staff" : `Edit ${editing?.name ?? ""}`}</DialogTitle>
            </DialogHeader>
            <Field label="Name" htmlFor="s-name">
              <Input id="s-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="s-email" hint={editing === "new" ? "They sign in with this." : "Email can't be changed."}>
              <Input id="s-email" type="email" value={f.email} disabled={editing !== "new"} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </Field>
            <Field label="Phone (optional)" htmlFor="s-phone">
              <Input id="s-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
            <Field label="Role" htmlFor="s-role" hint={editing && editing !== "new" && editing.isYou ? "You can't change your own role." : undefined}>
              <select id="s-role" className={SELECT} value={f.roleId} disabled={!!editing && editing !== "new" && editing.isYou} onChange={(e) => setF({ ...f, roleId: e.target.value })}>
                {roleChoices.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            {!isOwnerRole && !(editing && editing !== "new" && editing.isYou) && (
              <StorefrontMultiSelect
                value={f.storefrontIds}
                onChange={(ids) => setF({ ...f, storefrontIds: ids })}
                label="Works on"
                hint="They see only these storefronts' orders, reports and content."
              />
            )}
            {editing === "new" && (
              <Field label="Starting password" htmlFor="s-pw" hint="At least 10 characters with a number. Share it with them privately; they can change it under Settings → Password." error={f.password && passwordProblem(f.password)}>
                <Input id="s-pw" type="text" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
              </Field>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || updating || !!newProblem || (editing !== "new" && f.name.trim().length < 2)}>
                {editing === "new" ? "Create account" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pwFor !== null} onOpenChange={(o) => !o && setPwFor(null)}>
        <DialogContent className="max-w-md">
          <form onSubmit={savePassword} className="space-y-4">
            <DialogHeader>
              <DialogTitle>New password for {pwFor?.name}</DialogTitle>
            </DialogHeader>
            <Field label="Password" htmlFor="new-pw" hint="They'll be signed out everywhere and use this next time." error={pw && passwordProblem(pw)}>
              <Input id="new-pw" type="text" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwFor(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={settingPw || !!passwordProblem(pw)}>
                Set password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
