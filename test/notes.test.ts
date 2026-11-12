import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.ts";
import { addNote, deleteNote, filterByTag, formatList, formatMatches, NotesError, searchNotes, type Note } from "../src/notes.ts";

const DAY = "2026-11-06";
const tmpFile = () => join(mkdtempSync(join(tmpdir(), "notes-")), "notes.json");

describe("notes", () => {
  it("adds a note with the next id", () => {
    const notes = addNote(addNote([], "first", DAY), "second", DAY);
    expect(notes.map((n) => n.id)).toEqual([1, 2]);
  });

  it("trims text and refuses empty notes", () => {
    expect(addNote([], "  hi  ", DAY)[0].text).toBe("hi");
    expect(() => addNote([], "   ", DAY)).toThrow(NotesError);
  });

  it("deletes by id and refuses unknown ids", () => {
    const notes: Note[] = addNote([], "a", DAY);
    expect(deleteNote(notes, 1)).toEqual([]);
    expect(() => deleteNote(notes, 9)).toThrow("no note with id 9");
  });

  it("formats a list", () => {
    expect(formatList([])).toBe("No notes yet.");
    expect(formatList(addNote([], "milk", DAY))).toBe("1. milk (2026-11-06)");
  });
});

describe("tags", () => {
  it("stores normalized tags", () => {
    expect(addNote([], "a", DAY, [" Home ", "home", "Food"])[0].tags).toEqual(["home", "food"]);
    expect(addNote([], "a", DAY)[0].tags).toEqual([]);
  });

  it("rejects blank tags", () => {
    expect(() => addNote([], "a", DAY, ["  "])).toThrow(NotesError);
  });

  it("filters by tag", () => {
    const old: Note = { id: 1, text: "old", created: DAY };
    const notes = addNote(addNote([old], "a", DAY, ["Home"]), "b", DAY, ["work"]);
    expect(filterByTag(notes, "HOME").map((n) => n.text)).toEqual(["a"]);
    expect(filterByTag(notes, "none")).toEqual([]);
  });

  it("formats tagged notes", () => {
    expect(formatList(addNote([], "milk", DAY, ["home", "food"]))).toBe("1. milk (2026-11-06) [home, food]");
    expect(formatList([{ id: 1, text: "x", created: DAY }])).toBe("1. x (2026-11-06)");
  });
});

describe("cli tags", () => {
  it("adds tags before or after the text", () => {
    const file = tmpFile();
    expect(run(["add", "--tag", "home", "--tag", "food", "buy", "milk"], file, DAY)).toEqual({ code: 0, out: "Added note 1." });
    run(["add", "buy", "eggs", "--tag", "home"], file, DAY);
    expect(run(["list"], file, DAY).out).toBe("1. buy milk (2026-11-06) [home, food]\n2. buy eggs (2026-11-06) [home]");
  });

  it("filters the list by tag", () => {
    const file = tmpFile();
    run(["add", "a", "--tag", "home"], file, DAY);
    run(["add", "b"], file, DAY);
    expect(run(["list", "--tag", "home"], file, DAY).out).toBe("1. a (2026-11-06) [home]");
  });

  it("fails on missing values", () => {
    const file = tmpFile();
    expect(run(["list", "--tag"], file, DAY).code).toBe(1);
    expect(run(["add", "--tag", "home"], file, DAY).code).toBe(1);
  });

  it("handles old files without tags", () => {
    const file = tmpFile();
    writeFileSync(file, JSON.stringify([{ id: 1, text: "old", created: DAY }]));
    expect(run(["list"], file, DAY).out).toBe("1. old (2026-11-06)");
    expect(run(["list", "--tag", "x"], file, DAY).out).toBe("No notes yet.");
  });
});

describe("colour", () => {
  const notes = addNote([], "buy milk", DAY);
  const strip = (s: string) => s.replace(/\x1b\[\d+m/g, "");

  it("wraps id in gray and text in green", () => {
    const out = formatList(notes, true);
    expect(out).toContain("\x1b[90m1\x1b[39m");
    expect(out).toContain("\x1b[32mbuy milk\x1b[39m");
  });

  it("stays plain by default", () => {
    expect(formatList(notes)).toBe("1. buy milk (2026-11-06)");
    expect(formatList(notes, false)).toBe("1. buy milk (2026-11-06)");
  });

  it("strips back to the plain output", () => {
    expect(strip(formatList(notes, true))).toBe(formatList(notes));
  });

  it("does not colour an empty list", () => {
    expect(formatList([], true)).toBe("No notes yet.");
  });

  it("run colours only when asked", () => {
    const file = tmpFile();
    run(["add", "buy milk"], file, DAY);
    expect(run(["list"], file, DAY, true).out).toContain("\x1b[32mbuy milk\x1b[39m");
    expect(run(["list"], file, DAY).out).toBe("1. buy milk (2026-11-06)");
  });
});

describe("cli", () => {
  it("adds and lists notes in the file", () => {
    const file = tmpFile();
    expect(run(["add", "buy", "milk"], file, DAY)).toEqual({ code: 0, out: "Added note 1." });
    expect(run(["list"], file, DAY).out).toBe("1. buy milk (2026-11-06)");
  });

  it("deletes a note", () => {
    const file = tmpFile();
    run(["add", "x"], file, DAY);
    expect(run(["delete", "1"], file, DAY).code).toBe(0);
    expect(run(["list"], file, DAY).out).toBe("No notes yet.");
  });

  it("reports errors with exit code 1", () => {
    const file = tmpFile();
    writeFileSync(file, "{ not json");
    expect(run(["list"], file, DAY).code).toBe(1);
    expect(run(["delete", "3"], tmpFile(), DAY)).toEqual({ code: 1, out: "error: no note with id 3" });
  });

  it("prints usage for unknown commands", () => {
    expect(run(["fly"], tmpFile(), DAY).code).toBe(2);
  });
});

const sample = (): Note[] => addNote(addNote(addNote([], "buy milk", DAY), "call bob", DAY), "Milk run", DAY);

describe("search", () => {
  it("returns only matching notes, case-insensitively, keeping ids", () => {
    expect(searchNotes(sample(), "MILK").map((n) => n.id)).toEqual([1, 3]);
    expect(searchNotes(sample(), "bob").map((n) => n.id)).toEqual([2]);
  });

  it("returns [] when nothing matches", () => {
    expect(searchNotes(sample(), "zzz")).toEqual([]);
  });

  it("refuses empty queries", () => {
    expect(() => searchNotes(sample(), "")).toThrow(NotesError);
    expect(() => searchNotes(sample(), "   ")).toThrow(NotesError);
  });

  it("formats matches", () => {
    expect(formatMatches([])).toBe("No matching notes.");
    expect(formatMatches(sample())).toBe(formatList(sample()));
  });

  it("cli search finds notes", () => {
    const file = tmpFile();
    run(["add", "buy", "milk"], file, DAY);
    run(["add", "call bob"], file, DAY);
    expect(run(["search", "MILK"], file, DAY)).toEqual({ code: 0, out: "1. buy milk (2026-11-06)" });
    expect(run(["search", "buy", "milk"], file, DAY).out).toBe("1. buy milk (2026-11-06)");
    expect(run(["search", "zzz"], file, DAY)).toEqual({ code: 0, out: "No matching notes." });
    expect(run(["search"], file, DAY).code).toBe(1);
    expect(run(["list"], file, DAY).out).toBe("1. buy milk (2026-11-06)\n2. call bob (2026-11-06)");
  });
});
