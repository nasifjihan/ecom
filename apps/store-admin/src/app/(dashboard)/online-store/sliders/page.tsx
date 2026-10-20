"use client";

/**
 * Sliders: saved sets of hero slides. A hero block on the homepage, a page or a landing page can
 * use one ("Saved slider"), so a banner is changed in one place for every page that shows it.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GalleryHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
} from "@/components/ui";
import { Field, PageTitle } from "@/components/content/shared";
import { HeroForm, sectionProblem } from "@/components/content/sections-editor";
import { errorText, type HeroSlide } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useCreateSliderMutation,
  useDeleteSliderMutation,
  useSlidersQuery,
  useUpdateSliderMutation,
  type Slider,
} from "@/lib/features/content/sliders-api-slice";

const FIRST_SLIDE: HeroSlide = {
  badge: "",
  title: "New banner",
  subtitle: "",
  ctaText: "Shop Now",
  ctaHref: "/products",
  imageUrl: null,
  gradient: "violet",
  alignment: "left",
};

function SliderDialog({ open, onOpenChange, slider }: { open: boolean; onOpenChange: (v: boolean) => void; slider: Slider | null }) {
  const [name, setName] = useState("");
  const [slides, setSlides] = useState<HeroSlide[]>([FIRST_SLIDE]);
  const [create, c] = useCreateSliderMutation();
  const [update, u] = useUpdateSliderMutation();
  useEffect(() => {
    if (!open) return;
    setName(slider?.name ?? "");
    setSlides(slider?.slides.length ? slider.slides : [FIRST_SLIDE]);
  }, [open, slider]);
  const problem = !name.trim() ? "Give the slider a name" : sectionProblem({ type: "hero", enabled: true, config: { slides } });

  const save = async () => {
    try {
      if (slider) await update({ id: slider.id, name: name.trim(), slides }).unwrap();
      else await create({ name: name.trim(), slides }).unwrap();
      toast.success(slider ? "Slider saved" : "Slider added", {
        description: slider?.usedOn.length ? `Updated on ${slider.usedOn.join(", ")}.` : "Choose it in a hero block as \"Saved slider\".",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{slider ? "Edit slider" : "Add slider"}</DialogTitle>
          <DialogDescription>
            {slider?.usedOn.length ? `Used on ${slider.usedOn.join(", ")}: changes show there straight away.` : "Up to 8 slides."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name" htmlFor="slider-name" hint="Only you see it, e.g. “Eid banner”.">
            <Input id="slider-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <HeroForm uid="slider" slides={slides} onChange={setSlides} />
        </div>
        <DialogFooter className="gap-2">
          {problem && <p className="mr-auto self-center text-sm text-rose-600">{problem}</p>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!!problem || c.isLoading || u.isLoading}>
            {c.isLoading || u.isLoading ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SlidersPage() {
  const { data: sliders, isLoading } = useSlidersQuery(undefined, { refetchOnMountOrArgChange: true });
  const [remove] = useDeleteSliderMutation();
  const { can } = useCan();
  const canEdit = can("online_store.edit");
  const [editing, setEditing] = useState<Slider | null>(null);
  const [open, setOpen] = useState(false);

  const del = async (s: Slider) => {
    if (!window.confirm(`Delete the slider "${s.name}"?`)) return;
    try {
      await remove(s.id).unwrap();
      toast.success("Slider deleted");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={GalleryHorizontal}
        title="Sliders"
        description="Banners you can use in hero blocks on the homepage, pages and landing pages. Edit one here and every page using it changes."
        actions={
          canEdit ? (
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add slider
            </Button>
          ) : undefined
        }
      />
      {isLoading || !sliders ? (
        <Skeleton className="h-40" />
      ) : sliders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            No sliders yet. Add one here, or use &quot;Save these slides as a slider&quot; in any hero block.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sliders.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex gap-1">
                  {s.slides.map((x, i) => (
                    <span
                      key={i}
                      title={x.title}
                      className="h-10 flex-1 rounded bg-slate-200 bg-cover bg-center dark:bg-slate-700"
                      style={x.imageUrl ? { backgroundImage: `url("${x.imageUrl}")` } : undefined}
                    />
                  ))}
                </div>
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {s.slides.length} slide{s.slides.length === 1 ? "" : "s"}: {s.slides.map((x) => x.title).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{s.usedOn.length ? `Used on ${s.usedOn.join(", ")}` : "Not used yet"}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(s);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={s.usedOn.length > 0}
                      title={s.usedOn.length ? "Used on a page: change those blocks first" : undefined}
                      onClick={() => void del(s)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <SliderDialog open={open} onOpenChange={setOpen} slider={editing} />
    </div>
  );
}
