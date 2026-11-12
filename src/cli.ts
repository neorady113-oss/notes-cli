// notes add [--tag <t>]... <text> | notes list [--tag <t>] | notes search <text> | notes delete <id>. Run with: node src/cli.ts <command>
import { addNote, deleteNote, filterByTag, formatList, formatMatches, loadNotes, normalizeTags, NotesError, saveNotes, searchNotes } from "./notes.ts";

export interface Result {
  code: number;
  out: string;
}

const USAGE = "usage: notes add [--tag <t>]... <text> | notes list [--tag <t>] | notes search <text> | notes delete <id>";

function parseTagArgs(rest: string[]): { tags: string[]; words: string[] } {
  const tags: string[] = [];
  const words: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] !== "--tag") {
      words.push(rest[i]);
      continue;
    }
    if (i + 1 >= rest.length) throw new NotesError("--tag needs a value");
    tags.push(rest[++i]);
  }
  return { tags, words };
}

export function run(argv: string[], file: string, today: string, color = false): Result {
  const [command, ...rest] = argv;
  try {
    const notes = loadNotes(file);
    if (command === "add") {
      const { tags, words } = parseTagArgs(rest);
      const next = addNote(notes, words.join(" "), today, tags);
      saveNotes(file, next);
      return { code: 0, out: `Added note ${next[next.length - 1].id}.` };
    }
    if (command === "list") {
      const { tags } = parseTagArgs(rest);
      return { code: 0, out: formatList(tags.length ? filterByTag(notes, normalizeTags(tags)[0]) : notes, color) };
    }
    if (command === "search") return { code: 0, out: formatMatches(searchNotes(notes, rest.join(" "))) };
    if (command === "delete") {
      saveNotes(file, deleteNote(notes, Number(rest[0])));
      return { code: 0, out: `Deleted note ${rest[0]}.` };
    }
    return { code: 2, out: USAGE };
  } catch (err) {
    if (err instanceof NotesError || err instanceof SyntaxError) return { code: 1, out: `error: ${err.message}` };
    throw err;
  }
}

if (import.meta.main) {
  const file = process.env.NOTES_FILE ?? "notes.json";
  const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
  const result = run(process.argv.slice(2), file, new Date().toISOString().slice(0, 10), color);
  console.log(result.out);
  process.exitCode = result.code;
}
