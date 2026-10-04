import { describe, expect, it, vi } from "vitest";
import { apply, createCollection } from "@/lib/model/commands";
import { SCHEMA_VERSION } from "@/lib/model/core";
import { LocalStorageRepository } from "@/lib/storage/local-storage-repository";
import { StorageError } from "@/lib/storage/repository";

const KEY = (id: string) => `srdcards:v1:collection:${id}`;

function sample(id = "c1") {
  return apply(
    createCollection({ name: "Campaign", id, now: "2026-01-01T00:00:00.000Z" }),
    {
      type: "addStack",
      stackId: "s1",
      name: "Party",
    },
  );
}

describe("LocalStorageRepository", () => {
  it("round-trips a collection and lists its summary", async () => {
    const repo = new LocalStorageRepository();
    const saved = await repo.save(sample());
    expect(saved).toEqual({ rev: 1, conflict: false });
    const loaded = await repo.get("c1");
    expect(loaded.status).toBe("ok");
    if (loaded.status === "ok")
      expect(loaded.collection).toMatchObject({
        name: "Campaign",
        rev: 1,
        stacks: [{ name: "Party" }],
      });
    expect(await repo.list()).toEqual([
      expect.objectContaining({ id: "c1", stackCount: 1, cardCount: 0 }),
    ]);
  });

  it("reports missing collections", async () => {
    expect(await new LocalStorageRepository().get("nope")).toEqual({
      status: "missing",
    });
  });

  it("leaves invalid data untouched and reports it", async () => {
    window.localStorage.setItem(KEY("bad"), '{"schemaVersion":1,"id":"bad"}');
    const result = await new LocalStorageRepository().get("bad");
    expect(result.status).toBe("corrupt");
    expect(window.localStorage.getItem(KEY("bad"))).toBe(
      '{"schemaVersion":1,"id":"bad"}',
    );
  });

  it("opens data from a newer schema version read-only", async () => {
    window.localStorage.setItem(
      KEY("new"),
      JSON.stringify({ ...sample("new"), schemaVersion: SCHEMA_VERSION + 1 }),
    );
    expect((await new LocalStorageRepository().get("new")).status).toBe(
      "newer",
    );
  });

  it("detects a conflicting save from another tab (last write wins)", async () => {
    const repo = new LocalStorageRepository();
    await repo.save(sample()); // rev 1
    await repo.save(sample(), { baseRev: 1 }); // another tab: rev 2
    const result = await repo.save(sample(), { baseRev: 1 }); // stale tab
    expect(result.conflict).toBe(true);
    expect(result.rev).toBe(3);
  });

  it("rebuilds the summary index when it is missing", async () => {
    const repo = new LocalStorageRepository();
    await repo.save(sample("c1"));
    await repo.save(sample("c2"));
    window.localStorage.removeItem("srdcards:v1:index");
    expect((await repo.list()).map((s) => s.id).sort()).toEqual(["c1", "c2"]);
  });

  it("deletes a collection and its view state", async () => {
    const repo = new LocalStorageRepository();
    await repo.save(sample());
    window.localStorage.setItem("srdcards:ui:c1", "{}");
    await repo.delete("c1");
    expect(window.localStorage.getItem(KEY("c1"))).toBeNull();
    expect(window.localStorage.getItem("srdcards:ui:c1")).toBeNull();
    expect(await repo.list()).toEqual([]);
  });

  it("turns a full quota into a StorageError", async () => {
    const repo = new LocalStorageRepository();
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    await expect(repo.save(sample())).rejects.toMatchObject({ kind: "quota" });
    await expect(repo.save(sample())).rejects.toBeInstanceOf(StorageError);
    spy.mockRestore();
  });
});
