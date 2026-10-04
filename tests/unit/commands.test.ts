import { describe, expect, it } from "vitest";
import { apply, type Command, createCollection } from "@/lib/model/commands";
import type { Collection } from "@/lib/model/schema";

const snapshot = (name: string) => ({ name, subtitle: "" });

function run(c: Collection, ...cmds: Command[]) {
  return cmds.reduce(apply, c);
}

function board() {
  return run(
    createCollection({
      name: "Test",
      id: "c1",
      now: "2026-01-01T00:00:00.000Z",
    }),
    { type: "addStack", stackId: "a", name: "A" },
    { type: "addStack", stackId: "b", name: "B" },
    {
      type: "addSrdCard",
      stackId: "a",
      cardId: "1",
      ref: "spell:fireball",
      snapshot: snapshot("Fireball"),
    },
    {
      type: "addSrdCard",
      stackId: "a",
      cardId: "2",
      ref: "spell:shield",
      snapshot: snapshot("Shield"),
    },
    {
      type: "addSrdCard",
      stackId: "a",
      cardId: "3",
      ref: "monster:goblin-warrior",
      snapshot: snapshot("Goblin Warrior"),
    },
  );
}

const ids = (c: Collection, stackId: string) =>
  c.stacks.find((s) => s.id === stackId)!.cards.map((card) => card.id);

describe("commands", () => {
  it("creates a collection with defaults", () => {
    const c = createCollection({ name: "  ", now: "2026-01-01T00:00:00.000Z" });
    expect(c.name).toBe("Untitled collection");
    expect(c.stacks).toEqual([]);
    expect(c.rev).toBe(0);
  });

  it("merges a repeated SRD entry in the same stack into a quantity", () => {
    const c = apply(board(), {
      type: "addSrdCard",
      stackId: "a",
      cardId: "4",
      ref: "monster:goblin-warrior",
      snapshot: snapshot("Goblin Warrior"),
    });
    expect(ids(c, "a")).toEqual(["1", "2", "3"]);
    expect(c.stacks[0].cards[2].quantity).toBe(2);
  });

  it("adds a separate card when asked, at the given index", () => {
    const c = apply(board(), {
      type: "addSrdCard",
      stackId: "a",
      cardId: "4",
      ref: "spell:fireball",
      snapshot: snapshot("Fireball"),
      index: 1,
      separate: true,
    });
    expect(ids(c, "a")).toEqual(["1", "4", "2", "3"]);
  });

  it("reorders a card within a stack", () => {
    expect(
      ids(
        apply(board(), {
          type: "moveCard",
          cardId: "1",
          toStackId: "a",
          toIndex: 2,
        }),
        "a",
      ),
    ).toEqual(["2", "3", "1"]);
    expect(
      ids(
        apply(board(), {
          type: "moveCard",
          cardId: "3",
          toStackId: "a",
          toIndex: 0,
        }),
        "a",
      ),
    ).toEqual(["3", "1", "2"]);
  });

  it("moves a card to another stack at an index", () => {
    const c = run(
      board(),
      { type: "moveCard", cardId: "2", toStackId: "b", toIndex: 0 },
      { type: "moveCard", cardId: "3", toStackId: "b", toIndex: 0 },
    );
    expect(ids(c, "a")).toEqual(["1"]);
    expect(ids(c, "b")).toEqual(["3", "2"]);
  });

  it("returns the same object when nothing changes", () => {
    const c = board();
    expect(
      apply(c, { type: "moveCard", cardId: "1", toStackId: "a", toIndex: 0 }),
    ).toBe(c);
    expect(apply(c, { type: "removeCard", cardId: "missing" })).toBe(c);
    expect(apply(c, { type: "moveStack", stackId: "a", toIndex: 0 })).toBe(c);
  });

  it("reorders stacks", () => {
    const c = apply(board(), { type: "moveStack", stackId: "b", toIndex: 0 });
    expect(c.stacks.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("clamps quantity and clears empty notes", () => {
    let c = apply(board(), {
      type: "updateCard",
      cardId: "1",
      quantity: 5000,
      notes: "prepared",
    });
    expect(c.stacks[0].cards[0]).toMatchObject({
      quantity: 999,
      notes: "prepared",
    });
    c = apply(c, { type: "updateCard", cardId: "1", quantity: 0, notes: "" });
    expect(c.stacks[0].cards[0].quantity).toBe(1);
    expect(c.stacks[0].cards[0].notes).toBeUndefined();
  });

  it("duplicates a card right after the original", () => {
    const c = apply(board(), {
      type: "duplicateCard",
      cardId: "1",
      newCardId: "1b",
    });
    expect(ids(c, "a")).toEqual(["1", "1b", "2", "3"]);
  });

  it("sorts a stack by type then name", () => {
    const c = apply(board(), {
      type: "sortStack",
      stackId: "a",
      by: "type",
      typeOrder: ["monster", "spell"],
    });
    expect(ids(c, "a")).toEqual(["3", "1", "2"]);
  });

  it("converts a missing SRD card into a custom card, keeping its name and notes", () => {
    let c = apply(board(), {
      type: "updateCard",
      cardId: "1",
      notes: "keep me",
    });
    c = apply(c, { type: "convertToCustom", cardId: "1" });
    expect(c.stacks[0].cards[0]).toMatchObject({
      kind: "custom",
      custom: { title: "Fireball" },
      notes: "keep me",
    });
    expect(c.stacks[0].cards[0].ref).toBeUndefined();
  });

  it("removes a stack with its cards", () => {
    const c = apply(board(), { type: "removeStack", stackId: "a" });
    expect(c.stacks.map((s) => s.id)).toEqual(["b"]);
  });
});
