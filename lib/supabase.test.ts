import { describe, expect, it } from "vitest";
import { describeSupabaseError, getSupabase, isSupabaseConfigured } from "./supabase";

describe("describeSupabaseError", () => {
  it("points a missing table at the schema file", () => {
    const text = describeSupabaseError({ message: "Could not find the table 'public.collab_rooms' in the schema cache", code: "PGRST205" });
    expect(text).toContain("PGRST205");
    expect(text).toContain("supabase/schema.sql");
  });

  it("names the anonymous sign-in switch when it is off", () => {
    expect(describeSupabaseError(new Error("Anonymous sign-ins are disabled"))).toContain("Anonymous sign-ins");
  });

  it("tells the old recursive policies apart from a plain permission error", () => {
    expect(describeSupabaseError({ message: 'infinite recursion detected in policy for relation "collab_room_members"' })).toContain("re-run");
    expect(describeSupabaseError({ message: "Unauthorized: You do not have permissions to read from this Channel topic" })).toContain("Allow public access");
  });

  it("copes with things that are not errors", () => {
    expect(describeSupabaseError(undefined)).toBe("Unknown error");
    expect(describeSupabaseError("boom")).toBe("boom");
  });
});

describe("shared client", () => {
  it("stays off without a browser or configuration", () => {
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabase()).toBeNull();
  });
});
