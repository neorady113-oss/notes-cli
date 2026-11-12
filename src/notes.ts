// Notes kept in a JSON file. Pure functions take and return note lists; only load/save touch disk.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface Note {
  id: number;
  text: string;
  created: string; // ISO date, YYYY-MM-DD
  tags?: string[];
}

export class NotesError extends Error {}

export function loadNotes(file: string): Note[] {
  if (!existsSync(file)) return [];
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(data)) throw new NotesError(`${file} does not hold a list of notes`);
  return data as Note[];
}

export function saveNotes(file: string, notes: Note[]): void {
  writeFileSync(file, JSON.stringify(notes, null, 2) + "\n");
}

export function normalizeTags(tags: string[]): string[] {
  const clean = tags.map((t) => t.trim().toLowerCase());
  if (clean.some((t) => !t)) throw new NotesError("a tag cannot be empty");
  return [...new Set(clean)];
}

export function addNote(notes: Note[], text: string, today: string, tags: string[] = []): Note[] {
  const clean = text.trim();
  if (!clean) throw new NotesError("a note needs some text");
  const normalized = normalizeTags(tags);
  const id = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  return [...notes, { id, text: clean, created: today, tags: normalized }];
}

export function filterByTag(notes: Note[], tag: string): Note[] {
  const wanted = tag.trim().toLowerCase();
  return notes.filter((n) => (n.tags ?? []).includes(wanted));
}

export function deleteNote(notes: Note[], id: number): Note[] {
  if (!notes.some((n) => n.id === id)) throw new NotesError(`no note with id ${id}`);
  return notes.filter((n) => n.id !== id);
}

export function searchNotes(notes: Note[], query: string): Note[] {
  const needle = query.trim().toLowerCase();
  if (!needle) throw new NotesError("search needs some text");
  return notes.filter((n) => n.text.toLowerCase().includes(needle));
}

export function formatMatches(notes: Note[]): string {
  if (notes.length === 0) return "No matching notes.";
  return formatList(notes);
}

const gray = (s: string): string => `\x1b[90m${s}\x1b[39m`;
const green = (s: string): string => `\x1b[32m${s}\x1b[39m`;

export function formatList(notes: Note[], color = false): string {
  if (notes.length === 0) return "No notes yet.";
  const id = (n: Note): string => (color ? gray(String(n.id)) : String(n.id));
  const text = (n: Note): string => (color ? green(n.text) : n.text);
  const tags = (n: Note): string => (n.tags?.length ? ` [${n.tags.join(", ")}]` : "");
  return notes.map((n) => `${id(n)}. ${text(n)} (${n.created})${tags(n)}`).join("\n");
}
