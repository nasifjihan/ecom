"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RotateCcw, Save, Send } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { Field, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useMeQuery } from "@/lib/features/auth/auth-api-slice";
import {
  useGetEmailTemplateQuery,
  usePreviewEmailMutation,
  useResetEmailTemplateMutation,
  useSaveEmailTemplateMutation,
  useSendTestEmailMutation,
  type EmailTemplate,
} from "@/lib/features/settings/emails-api-slice";
import { EmailFrame, VARIABLE_LABELS } from "../_components";

type FieldName = "subject" | "message";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const splitEmails = (s: string) =>
  s
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export default function EmailTemplatePage() {
  const { key } = useParams<{ key: string }>();
  const { data: template, isLoading, isError } = useGetEmailTemplateQuery(key);

  if (isLoading) return <Skeleton className="h-[40rem] w-full" />;
  if (isError || !template) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-slate-500">
          That email doesn&apos;t exist.{" "}
          <Link href="/settings/emails" className="font-medium text-blue-600 hover:underline">
            See all emails
          </Link>
        </CardContent>
      </Card>
    );
  }
  return <Editor key={template.key} template={template} />;
}

function Editor({ template }: { template: EmailTemplate }) {
  const [enabled, setEnabled] = useState(template.enabled);
  const [subject, setSubject] = useState(template.subject);
  const [message, setMessage] = useState(template.message);
  const [recipients, setRecipients] = useState(template.recipients.join("\n"));
  const [saved, setSaved] = useState(template);
  const [testing, setTesting] = useState(false);

  const [save, { isLoading: saving }] = useSaveEmailTemplateMutation();
  const [reset, { isLoading: resetting }] = useResetEmailTemplateMutation();
  const [preview, { data: previewData, isLoading: previewing }] = usePreviewEmailMutation();

  const subjectRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<FieldName>("message");

  const staff = template.audience === "staff";
  const recipientList = useMemo(() => splitEmails(recipients), [recipients]);
  const badRecipient = recipientList.find((e) => !EMAIL_RE.test(e));
  const dirty =
    enabled !== saved.enabled ||
    subject.trim() !== saved.subject ||
    message.trim() !== saved.message ||
    (staff && recipientList.join(",") !== saved.recipients.join(","));
  const isDefault = subject.trim() === template.defaultSubject && message.trim() === template.defaultMessage;

  // Refresh the preview shortly after the wording stops changing.
  useEffect(() => {
    if (!subject.trim() || !message.trim()) return;
    const t = setTimeout(() => {
      preview({ key: template.key, draft: { subject: subject.trim(), message: message.trim() } });
    }, 400);
    return () => clearTimeout(t);
  }, [subject, message, template.key, preview]);

  /** Puts {{name}} where the cursor was in the subject or message. */
  const insertVariable = (name: string) => {
    const token = `{{${name}}}`;
    const field = lastField.current;
    const el = field === "subject" ? subjectRef.current : messageRef.current;
    const value = field === "subject" ? subject : message;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    (field === "subject" ? setSubject : setMessage)(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const onSave = async () => {
    const problem = !subject.trim()
      ? "Add a subject."
      : !message.trim()
        ? "Add a message."
        : staff && badRecipient
          ? `"${badRecipient}" isn't an email address.`
          : null;
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      const out = await save({
        key: template.key,
        enabled,
        subject: subject.trim(),
        message: message.trim(),
        ...(staff ? { recipients: recipientList } : {}),
      }).unwrap();
      setSaved(out);
      setSubject(out.subject);
      setMessage(out.message);
      setRecipients(out.recipients.join("\n"));
      toast.success(`${template.label} saved`);
    } catch (e) {
      toast.error(errorText(e, "Couldn't save the email."));
    }
  };

  const onReset = async () => {
    if (!window.confirm("Go back to the built-in subject and message? Your wording for this email will be lost.")) return;
    try {
      const out = await reset(template.key).unwrap();
      setSaved(out);
      setSubject(out.subject);
      setMessage(out.message);
      toast.success("Back to the built-in wording");
    } catch (e) {
      toast.error(errorText(e, "Couldn't reset the email."));
    }
  };

  const extras = [
    template.blocks.includes("tracking") && "the courier and tracking number",
    template.buttonLabel && `a "${template.buttonLabel}" button`,
    template.blocks.includes("order_summary") && "the items, totals and delivery address",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/settings/emails" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All emails
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{template.label}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {template.description} {staff ? "Goes to your team." : "Goes to the customer."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <Button variant="outline" onClick={() => setTesting(true)}>
            <Send className="mr-2 h-4 w-4" /> Send test
          </Button>
          <Button onClick={onSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <Toggle
                id="enabled"
                checked={enabled}
                onChange={setEnabled}
                label="Send this email"
                hint={enabled ? "On: sent automatically." : "Off: this email isn't sent. Test sends still work."}
              />

              <Field label="Subject" htmlFor="subject">
                <Input
                  id="subject"
                  ref={subjectRef}
                  value={subject}
                  maxLength={200}
                  onFocus={() => (lastField.current = "subject")}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>

              <Field
                label="Message"
                htmlFor="message"
                hint={
                  <>
                    A blank line starts a new paragraph, and a line starting with <code className="rounded bg-slate-100 px-1 dark:bg-slate-800"># </code> is a heading.
                    {extras.length > 0 && <> Below your message the email adds {joinList(extras)}.</>}
                    {template.attachesInvoice && <> The order&apos;s invoice is attached as a PDF.</>}
                  </>
                }
              >
                <Textarea
                  id="message"
                  ref={messageRef}
                  rows={12}
                  value={message}
                  maxLength={10_000}
                  onFocus={() => (lastField.current = "message")}
                  onChange={(e) => setMessage(e.target.value)}
                  className="font-mono text-sm"
                />
              </Field>

              {staff && (
                <Field
                  label="Send to"
                  htmlFor="recipients"
                  error={badRecipient ? `"${badRecipient}" isn't an email address.` : null}
                  hint="One email address per line, up to 10. Leave it empty to send to the store owner."
                >
                  <Textarea
                    id="recipients"
                    rows={3}
                    value={recipients}
                    placeholder={"orders@yourstore.com\nmanager@yourstore.com"}
                    onChange={(e) => setRecipients(e.target.value)}
                  />
                </Field>
              )}

              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-xs text-slate-500">{isDefault ? "Using the built-in wording." : "Using your own wording."}</span>
                {saved.customised && (
                  <Button variant="ghost" size="sm" onClick={onReset} disabled={resetting}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to default
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Variables</CardTitle>
              <CardDescription>Click one to add it where your cursor is. It&apos;s replaced with the real value when the email is sent.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {template.variables.map((v) => (
                  <li key={v}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertVariable(v)}
                      className="w-full rounded-md border px-2.5 py-1.5 text-left hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10"
                    >
                      <code className="block truncate text-xs text-blue-700 dark:text-blue-300">{`{{${v}}}`}</code>
                      <span className="block truncate text-xs text-slate-500">{VARIABLE_LABELS[v] ?? v}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-6 xl:self-start">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Preview {previewing && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
            </CardTitle>
            <CardDescription>With example order and customer details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {previewData ? (
              <>
                <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                  <span className="text-slate-500">Subject: </span>
                  <span className="font-medium">{previewData.subject}</span>
                </div>
                <EmailFrame html={previewData.html} />
              </>
            ) : (
              <Skeleton className="h-96 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      <TestDialog
        open={testing}
        onClose={() => setTesting(false)}
        templateKey={template.key}
        draft={subject.trim() && message.trim() ? { subject: subject.trim(), message: message.trim() } : undefined}
      />
    </div>
  );
}

function TestDialog({
  open,
  onClose,
  templateKey,
  draft,
}: {
  open: boolean;
  onClose: () => void;
  templateKey: string;
  draft?: { subject: string; message: string };
}) {
  const { data: me } = useMeQuery();
  const [to, setTo] = useState("");
  const [send, { isLoading }] = useSendTestEmailMutation();

  useEffect(() => {
    if (open && !to && me?.user.email) setTo(me.user.email);
  }, [open, me, to]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(to.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    try {
      const out = await send({ key: templateKey, to: to.trim(), draft }).unwrap();
      if (out.status === "failed") toast.error("The test couldn't be sent", { description: out.error ?? undefined });
      else toast.success(`Test sent to ${to.trim()}`, { description: "It uses example order details. See it under Sent emails." });
      onClose();
    } catch (err) {
      toast.error(errorText(err, "Couldn't send the test."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Send a test email</DialogTitle>
            <DialogDescription>We&apos;ll send this email as it looks now, including unsaved changes, with example details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="test-to">Send to</Label>
            <Input id="test-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} autoFocus />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send test
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "a", "a and b", "a, b and c" */
function joinList(items: string[]) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
