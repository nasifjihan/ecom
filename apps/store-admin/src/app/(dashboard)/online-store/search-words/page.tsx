"use client";

/**
 * Search words: words shoppers use for the same thing ("panjabi, punjabi", "saree, sari").
 * Searching any word in a group finds products named with the others. One group per line.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button, Card, CardContent, Skeleton, Textarea } from "@/components/ui";
import { PageTitle } from "@/components/content/shared";
import { errorText, useGetSearchWordsQuery, useSaveSearchWordsMutation } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";

/** Spellings Bangladeshi shoppers mix up, offered as a starting point. */
const COMMON = [
  "panjabi, punjabi, panjabee",
  "saree, sari, sharee, শাড়ি",
  "salwar kameez, shalwar kameez, three piece, 3 piece",
  "kurti, kurta, kurtee",
  "lungi, lunghi",
  "t-shirt, tshirt, t shirt, tee",
  "hijab, hejab",
  "borka, burqa, burka, abaya",
  "jeans, denim",
  "sandal, sandle",
  "sneakers, sneaker, keds",
  "watch, ghori, ঘড়ি",
];

const linesOf = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
const wordsOf = (line: string) => [...new Set(line.split(",").map((w) => w.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))];

export default function SearchWordsPage() {
  const { data, isLoading } = useGetSearchWordsQuery();
  const [save, { isLoading: saving }] = useSaveSearchWordsMutation();
  const canEdit = useCan().can("online_store.edit");
  const [text, setText] = useState("");

  useEffect(() => {
    if (data) setText(data.groups.map((g) => g.join(", ")).join("\n"));
  }, [data]);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const lines = linesOf(text);
  const bad = lines.find((l) => wordsOf(l).length < 2);
  const tooLong = lines.some((l) => wordsOf(l).some((w) => w.length > 40));
  const saved = data.groups.map((g) => g.join(", ")).join("\n");

  const addCommon = () => {
    const have = new Set(lines.flatMap(wordsOf));
    const missing = COMMON.filter((l) => !wordsOf(l).some((w) => have.has(w)));
    if (!missing.length) {
      toast.info("All the common words are already here");
      return;
    }
    setText([...lines, ...missing].join("\n"));
  };

  const onSave = async () => {
    try {
      await save({ groups: lines.map(wordsOf) }).unwrap();
      toast.success("Search words saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Search}
        title="Search words"
        description="Words shoppers use for the same thing. Searching any word in a line finds products named with the others."
        actions={
          canEdit && (
            <Button variant="outline" onClick={addCommon}>
              Add common words
            </Button>
          )
        }
      />
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            One group per line, words separated by commas. For example: <span className="font-mono">panjabi, punjabi</span>. Spelling mistakes like
            &quot;panjbi&quot; are found on their own; use this for different words or spellings that aren&apos;t close.
          </p>
          <Textarea
            rows={16}
            className="font-mono text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!canEdit}
            aria-label="Search word groups, one per line"
            placeholder={"panjabi, punjabi\nsaree, sari"}
          />
          {bad && <p className="text-sm text-red-600">&quot;{bad}&quot; needs at least two different words.</p>}
          {tooLong && <p className="text-sm text-red-600">Keep each word under 40 letters.</p>}
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={onSave} disabled={saving || !!bad || tooLong || lines.length > 300 || text.trim() === saved}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
