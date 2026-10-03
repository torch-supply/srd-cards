"use client";

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
import { Textarea } from "@/components/ui/textarea";

/** Create or edit a collection's name and description. */
export function CollectionDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  initial?: { name: string; description: string };
  onSubmit: (values: { name: string; description: string }) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <CollectionForm title={title} submitLabel={submitLabel} initial={initial} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}

function CollectionForm({
  title,
  submitLabel,
  initial,
  onSubmit,
}: {
  title: string;
  submitLabel: string;
  initial?: { name: string; description: string };
  onSubmit: (values: { name: string; description: string }) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({ name: name.trim() || "Untitled collection", description: description.trim() });
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>A collection can be a campaign, an encounter, or any group of cards.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="collection-name">Name</Label>
        <Input
          id="collection-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Curse of the Crimson Keep"
          maxLength={200}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="collection-description">Description</Label>
        <Textarea
          id="collection-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional"
          rows={3}
          maxLength={5000}
        />
      </div>
      <DialogFooter>
        <Button type="submit">{submitLabel}</Button>
      </DialogFooter>
    </form>
  );
}
