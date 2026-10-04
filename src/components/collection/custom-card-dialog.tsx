"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const Markdown = dynamic(() => import("./markdown"), {
  loading: () => <Skeleton className="h-24 w-full" />,
});

export interface CustomCardValues {
  title: string;
  subtitle?: string;
  body: string;
}

/** Create or edit a homebrew card: title, optional subtitle, markdown body with preview. */
export function CustomCardDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  stacks,
  defaultStackId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: CustomCardValues;
  onSubmit: (values: CustomCardValues, stackId?: string) => void;
  /** When creating, which stack to add to. */
  stacks?: { id: string; name: string }[];
  defaultStackId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && (
          <CustomCardForm
            initial={initial}
            onSubmit={onSubmit}
            stacks={stacks}
            defaultStackId={defaultStackId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CustomCardForm({
  initial,
  onSubmit,
  stacks,
  defaultStackId,
}: {
  initial?: CustomCardValues;
  onSubmit: (values: CustomCardValues, stackId?: string) => void;
  stacks?: { id: string; name: string }[];
  defaultStackId?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [stackId, setStackId] = useState(defaultStackId ?? stacks?.[0]?.id);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          {
            title: title.trim() || "Untitled card",
            subtitle: subtitle.trim() || undefined,
            body,
          },
          stackId,
        );
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {initial ? "Edit custom card" : "New custom card"}
        </DialogTitle>
        <DialogDescription>
          Homebrew rules, NPCs, loot, or anything else. The text supports
          Markdown.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="custom-title">Title</Label>
          <Input
            id="custom-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="custom-subtitle">Subtitle</Label>
          <Input
            id="custom-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Optional, e.g. “NPC · Innkeeper”"
            maxLength={200}
          />
        </div>
      </div>
      {stacks && stacks.length > 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="custom-stack">Stack</Label>
          <select
            id="custom-stack"
            value={stackId}
            onChange={(e) => setStackId(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            {stacks.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || "Untitled stack"}
              </option>
            ))}
          </select>
        </div>
      )}
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            maxLength={20000}
            aria-label="Card text"
            placeholder={
              "**Bold**, *italic*, lists, and tables work.\n\n- Like this"
            }
            className="font-mono text-sm"
          />
        </TabsContent>
        <TabsContent value="preview" className="min-h-48 rounded-md border p-3">
          {body.trim() ? (
            <Markdown>{body}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button type="submit">{initial ? "Save" : "Add card"}</Button>
      </DialogFooter>
    </form>
  );
}
