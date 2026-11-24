/**
 * validate — every structural check a story needs before any expensive work.
 *
 *   npx tsx scripts/validate.ts <story.json>
 *
 * Checks the schema, that every actor id exists in the cast, that every prop is either a
 * 2D prop in the catalog or a 3D object that the shot's location actually provides, that
 * quote actors exist, and that every 3D location the story names is in locations/.
 * Exits 1 with one line per problem, naming the shot.
 */
import fs from "node:fs";
import path from "node:path";
import { StorySchema } from "../src/schema";
import { PROPS } from "../src/catalog";
import { loadLibrary } from "./location-lib";
import { resolveStory, resolvePaths } from "./paths";

const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!arg) {
  console.error("usage: npx tsx scripts/validate.ts <story.json>");
  process.exit(2);
}
const storyPath = resolveStory(arg, resolvePaths());
const parsed = StorySchema.safeParse(JSON.parse(fs.readFileSync(storyPath, "utf8")));
if (!parsed.success) {
  console.error(`invalid story: ${path.relative(process.cwd(), storyPath)}`);
  for (const i of parsed.error.issues) console.error(`  • ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}
const story = parsed.data;
const errors: string[] = [];

const usedLocations = [...new Set(story.shots.flatMap((s) => (s.location ? [s.location] : [])))];
const library = usedLocations.length ? loadLibrary() : null;
if (library?.errors.length) errors.push(...library.errors);
for (const name of usedLocations) {
  if (!library?.locations.some((l) => l.name === name)) {
    errors.push(`no 3D location called "${name}" — have: ${library?.locations.map((l) => l.name).join(", ")}`);
  }
}

for (const [i, s] of story.shots.entries()) {
  for (const a of s.actors) {
    if (!story.cast[a.id]) errors.push(`shot ${i}: actor "${a.id}" is not in cast`);
    if (a.action !== "none") {
      if (!a.on) errors.push(`shot ${i}: actor "${a.id}" has action "${a.action}" but no "on" prop`);
      else if (a.on.startsWith("prop:")) {
        const idx = Number.parseInt(a.on.slice(5), 10);
        if (!s.props[idx]) errors.push(`shot ${i}: actor "${a.id}" points at prop:${idx} but the shot has ${s.props.length} prop(s)`);
      } else if (!s.props.some((p) => p.type === a.on)) {
        // the background may supply it, but the anchor needs an explicit declaration
        errors.push(`shot ${i}: actor "${a.id}" uses action "${a.action}" on "${a.on}" but that prop is not declared in this shot's "props" — declare it (a bg prop of the same type/place is then replaced, not doubled)`);
      }
    }
  }
  if (s.quote && !story.cast[s.quote]) errors.push(`shot ${i}: quote "${s.quote}" is not in cast`);
  if (s.quote && !s.actors.some((a) => a.id === s.quote)) errors.push(`shot ${i}: quote "${s.quote}" has no actor in this shot`);
  for (const p of s.props) {
    const is2d = (PROPS as readonly string[]).includes(p.type);
    const is3d = s.location ? Boolean(library?.objects[p.type]) : false;
    if (!is2d && !is3d) {
      errors.push(`shot ${i}: no prop or object called "${p.type}"${!s.location && library?.objects[p.type] ? ' (it is a 3D object, so this shot needs a "location")' : ""}`);
    }
  }
  if (!s.say) errors.push(`shot ${i}: empty narration`);
}

if (errors.length) {
  console.error(`${errors.length} problem(s) in ${story.title}:`);
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}
console.log(`OK — ${story.title}: ${story.shots.length} shots, ${Object.keys(story.cast).length} characters, ${usedLocations.length} 3D location(s)`);
