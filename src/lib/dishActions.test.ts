import { describe, expect, it } from "vitest";
import { addUnique, remove, updateListsByAction } from "./dishActions";

describe("list helpers", () => {
  it("remove filters out the target without mutating the source", () => {
    const source = ["a", "b", "c"];
    const result = remove(source, "b");
    expect(result).toEqual(["a", "c"]);
    expect(source).toEqual(["a", "b", "c"]);
  });

  it("addUnique appends only when missing", () => {
    expect(addUnique(["a"], "b")).toEqual(["a", "b"]);
    expect(addUnique(["a", "b"], "b")).toEqual(["a", "b"]);
  });
});

describe("updateListsByAction", () => {
  const base = { selectedDishIds: [], pendingDishIds: [], skippedDishIds: [] };

  it("adds the dish to the selected list on 'like'", () => {
    const next = updateListsByAction(base, "d1", "like");
    expect(next.selectedDishIds).toEqual(["d1"]);
    expect(next.pendingDishIds).toEqual([]);
    expect(next.skippedDishIds).toEqual([]);
  });

  it("moves the dish between lists instead of duplicating", () => {
    const liked = updateListsByAction(base, "d1", "like");
    const movedToPending = updateListsByAction(liked, "d1", "pending");
    expect(movedToPending.selectedDishIds).toEqual([]);
    expect(movedToPending.pendingDishIds).toEqual(["d1"]);
  });

  it("removes the dish from every list when action is null (undo)", () => {
    const liked = updateListsByAction(base, "d1", "like");
    const undone = updateListsByAction(liked, "d1", null);
    expect(undone.selectedDishIds).toEqual([]);
    expect(undone.pendingDishIds).toEqual([]);
    expect(undone.skippedDishIds).toEqual([]);
  });
});
