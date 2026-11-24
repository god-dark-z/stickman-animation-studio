// Renders one real three.js frame through Chromium so `doctor` can prove that software
// WebGL works on this machine. Prints one JSON line: { ok, gl, path, width, height }.
//
//   npx tsx scripts/doctor_gl.ts [--json] [--gl angle|swiftshader|swangle]
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { loadLibrary } from "./location-lib";
import { resolvePaths } from "./paths";

const paths = resolvePaths();
const args = process.argv.slice(2);
const glArg = args.includes("--gl") ? args[args.indexOf("--gl") + 1] : process.env.REMOTION_GL || "angle";
const gl = (glArg as "angle" | "swiftshader" | "swangle") ?? "angle";

const outDir = path.join(paths.out, "doctor");
fs.mkdirSync(outDir, { recursive: true });
const output = path.join(outDir, `gl-${gl}.png`);

const lib = loadLibrary();
if (lib.errors.length) {
  console.error(lib.errors.join("\n"));
  process.exit(1);
}
const location = lib.locations[0];
if (!location) {
  console.error("no locations in locations/ — cannot probe WebGL");
  process.exit(1);
}

try {
  const serveUrl = await bundle({ entryPoint: path.join(paths.engine, "src/index.ts"), publicDir: paths.publicDir });
  const inputProps = { locations: [location], objects: lib.objects };
  const composition = await selectComposition({ serveUrl, id: "LocationsPreview", inputProps, chromiumOptions: { gl } });
  await renderStill({ composition, serveUrl, frame: 0, output, inputProps, scale: 0.25, chromiumOptions: { gl } });
  console.log(JSON.stringify({ ok: true, gl, path: output, width: composition.width, height: composition.height }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, gl, error: (e as Error).message.slice(0, 500) }));
  process.exit(1);
}
