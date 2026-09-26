import { describe, expect, it } from "vitest";
import { groupBounds, layoutOf, makeItem, type Group } from "./tokens";

const button = (id: string) => ({ ...makeItem("button"), id, label: id });

describe("auto layout", () => {
  it("lays out children horizontally with explicit gap and padding", () => {
    const group: Group = {
      id: "g",
      x: 10,
      y: 20,
      axis: "x",
      items: [button("a"), button("b")],
      layout: {
        enabled: true,
        direction: "horizontal",
        gap: 12,
        padding: { top: 8, left: 16, right: 16, bottom: 8 },
      },
    };
    const placed = layoutOf(group, {});
    expect(placed.map(({ x, y }) => [x, y])).toEqual([[26, 28], [94, 28]]);
  });

  it("centers children on the cross axis inside an explicit container", () => {
    const group: Group = {
      id: "g",
      x: 0,
      y: 0,
      axis: "x",
      items: [button("a")],
      layout: {
        enabled: true,
        direction: "horizontal",
        size: { width: 240, height: 100 },
        align: "center",
      },
    };
    const placed = layoutOf(group, {});
    expect(placed[0].y).toBe(22);
    expect(groupBounds(group, {})).toEqual({ l: 0, t: 0, r: 240, b: 100 });
  });

  it("supports space-between when the container is wider than its content", () => {
    const group: Group = {
      id: "g",
      x: 0,
      y: 0,
      axis: "x",
      items: [button("a"), button("b")],
      layout: {
        enabled: true,
        direction: "horizontal",
        gap: 8,
        size: { width: 200 },
        distribution: "spaceBetween",
      },
    };
    const placed = layoutOf(group, {});
    expect(placed[0].x).toBe(0);
    expect(placed[1].x).toBe(144);
  });

  it("preserves legacy layout when auto layout is omitted", () => {
    const group: Group = { id: "g", x: 0, y: 0, axis: "x", items: [button("a"), button("b")] };
    expect(layoutOf(group, {}).map(({ x }) => x)).toEqual([0, 59]);
  });
});
