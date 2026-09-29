"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Home, Loader2, RotateCcw } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { PageTitle } from "@/components/content/shared";
import { StorefrontPicker, useStorefrontChoice } from "@/components/storefront-picker";
import { SectionsEditor, sectionProblem, withIds, withoutIds, type Section } from "@/components/content/sections-editor";
import { errorText, useGetHomepageQuery, useResetHomepageMutation, useSaveHomepageMutation } from "@/lib/features/content/content-api-slice";

export default function HomepageEditorPage() {
  const sf = useStorefrontChoice();
  // currentData: empty while another storefront loads, kept while this one refetches after a save.
  const { currentData: data, isLoading } = useGetHomepageQuery(sf.storefrontId);
  const [save, { isLoading: saving }] = useSaveHomepageMutation();
  const [reset, { isLoading: resetting }] = useResetHomepageMutation();
  const [sections, setSections] = useState<Section[] | null>(null);

  useEffect(() => {
    if (data) setSections(withIds(data.sections));
  }, [data]);

  if (isLoading || !data || !sections) return <Skeleton className="h-[32rem] w-full" />;

  const dirty = JSON.stringify(withoutIds(sections)) !== JSON.stringify(withoutIds(data?.sections ?? []));
  const valid = sections.every((s) => !sectionProblem(s));

  const onSave = async () => {
    try {
      await save({ sections: withoutIds(sections), storefrontId: sf.storefrontId }).unwrap();
      toast.success("Homepage saved", { description: "Your store shows the changes within a minute." });
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the homepage."));
    }
  };

  const onReset = async () => {
    const question = sf.storefrontId
      ? `Show the default storefront's homepage on ${sf.current?.name ?? "this storefront"} again? Its own sections will be lost.`
      : "Go back to the default homepage? Your section changes will be lost.";
    if (!window.confirm(question)) return;
    try {
      await reset(sf.storefrontId).unwrap();
      toast.success(sf.storefrontId ? "This storefront shows the default homepage again" : "Homepage reset to the default layout");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Home}
        title="Homepage"
        description="Drag blocks to reorder them, switch them on or off, and click one to edit what it says."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={sf.viewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> View store
              </a>
            </Button>
            {data?.customised && (
              <Button variant="outline" onClick={onReset} disabled={resetting}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
            )}
            <Button onClick={onSave} disabled={!dirty || !valid || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save homepage
            </Button>
          </>
        }
      />
      <StorefrontPicker
        choice={sf}
        note={
          data?.inherited
            ? "Shows the default storefront's homepage. Save to give it its own."
            : sf.storefrontId
              ? "Has its own homepage."
              : sf.several
                ? "Other storefronts show this homepage until they get their own."
                : null
        }
      />
      <SectionsEditor sections={sections} onChange={setSections} palette="side" />
    </div>
  );
}
