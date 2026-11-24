// One place that answers "where is the engine?" from any working directory and any
// install layout (.claude/skills, .agent/skills, a repo clone, a copied engine).
//
//   import { resolvePaths } from "./paths";
//   const { engine, stories, out, publicDir } = resolvePaths();
//
// Override with --engine <dir> on any script, or STUDIO_ENGINE=<dir> in the environment.
import fs from "node:fs";
import path from "node:path";

export type EnginePaths = {
  engine: string;
  stories: string;
  out: string;
  publicDir: string;
  locations: string;
  scripts: string;
};

const isEngine = (dir: string) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    return pkg?.name === "stickman-studio-engine";
  } catch {
    return false;
  }
};

const fromArgv = (argv: string[] = process.argv.slice(2)) => {
  const i = argv.indexOf("--engine");
  return i >= 0 ? argv[i + 1] : undefined;
};

/** Walk up from `start` looking for a directory whose package.json names the engine. */
const walkUp = (start: string): string | undefined => {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    if (isEngine(dir)) return dir;
    const nested = path.join(dir, "engine");
    if (isEngine(nested)) return nested;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
};

export function resolvePaths(opts: { engine?: string; cwd?: string } = {}): EnginePaths {
  const explicit = opts.engine ?? fromArgv() ?? process.env.STUDIO_ENGINE;
  let engine: string | undefined;
  if (explicit) {
    engine = path.resolve(explicit);
    if (!isEngine(engine)) {
      throw new Error(
        `--engine ${explicit} is not a stickman-studio-engine directory (its package.json must be named "stickman-studio-engine")`,
      );
    }
  }
  // import.meta.dirname is <engine>/scripts, which is the most reliable starting point
  engine ??= walkUp(import.meta.dirname) ?? walkUp(opts.cwd ?? process.cwd());
  if (!engine) {
    throw new Error(
      "Could not find the engine. Run from the engine directory, pass --engine <dir>, or set STUDIO_ENGINE.",
    );
  }
  return {
    engine,
    stories: path.join(engine, "stories"),
    out: path.join(engine, "out"),
    publicDir: path.join(engine, "public"),
    locations: path.join(engine, "locations"),
    scripts: path.join(engine, "scripts"),
  };
}

/** Story path as given by a user: relative to cwd, or to stories/, with or without .json. */
export function resolveStory(arg: string, paths: EnginePaths): string {
  const candidates = [
    path.resolve(arg),
    path.resolve(paths.stories, arg),
    path.resolve(paths.stories, `${arg}.json`),
    path.resolve(paths.stories, "tests", arg),
    path.resolve(paths.stories, "tests", `${arg}.json`),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(
    `No story called "${arg}". Looked in:\n  ${candidates.join("\n  ")}\nPass a path to a story JSON file.`,
  );
}

export const slugOf = (title: string) => {
  const ascii = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  if (ascii) return ascii;
  let h = 2166136261;
  for (let i = 0; i < title.length; i++) h = Math.imul(h ^ title.charCodeAt(i), 16777619);
  return `story-${(h >>> 0).toString(36).slice(0, 8)}`;
};
