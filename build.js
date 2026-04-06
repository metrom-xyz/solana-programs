import { execSync } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function getJsonAsTypescript(json) {
    if (json instanceof Array) {
        return `[${json.map(getJsonAsTypescript).join(", ")}]`;
    } else if (typeof json === "object" && json !== null) {
        const properties = Object.keys(json)
            .map((key) => `${key}: ${getJsonAsTypescript(json[key])}`)
            .join(", ");
        return `{ ${properties} }`;
    } else if (typeof json === "string") {
        return `"${json}"`;
    } else {
        return json;
    }
}

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

console.log("Building programs...");
execSync("anchor build", { stdio: "inherit" });

const idl = JSON.parse(
    readFileSync(join(CURRENT_DIR, "./target/idl/metrom.json"))
);

console.log("Generating IDL TypeScript file...");
if (!existsSync(join(CURRENT_DIR, "./gen")))
    mkdirSync(join(CURRENT_DIR, "./gen"));
writeFileSync(
    join(CURRENT_DIR, "./gen/idl.ts"),
    `export const metromIdl = ${getJsonAsTypescript(idl)} as const;\n`
);

if (existsSync(join(CURRENT_DIR, "./dist"))) {
    console.log("Removing previous dist folder...");
    rmSync(join(CURRENT_DIR, "./dist"), { recursive: true });
}

console.log("Building library...");
execSync("pnpm tsc --project tsconfig.lib.json", { stdio: "inherit" });

console.log("Bundling IDLs...");
mkdirSync(join(CURRENT_DIR, "./dist/idls"));
writeFileSync(
    join(CURRENT_DIR, "./dist/idls/Metrom.json"),
    JSON.stringify(idl, undefined, 4)
);
