import { ReplitConnectors } from "@replit/connectors-sdk";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const connectors = new ReplitConnectors();
const OWNER = "becky-cmyk";
const REPO = "city-hub";
const MAX_FILE_SIZE = 500 * 1024;
const PROGRESS_FILE = "/tmp/github-push-progress.json";

async function ghApi(endpoint, options = {}) {
  const resp = await connectors.proxy("github", endpoint, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${text}`);
  }
  return resp.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createBlob(content) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await ghApi(`/repos/${OWNER}/${REPO}/git/blobs`, {
        method: "POST",
        body: { content, encoding: "base64" },
      });
    } catch (e) {
      if ((e.message.includes("429") || e.message.includes("413")) && attempt < 4) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { entries: {}, phase: "upload" };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

async function run() {
  const ref = await ghApi(`/repos/${OWNER}/${REPO}/git/ref/heads/main`);
  const baseCommitSha = ref.object.sha;

  const allFiles = execSync("git ls-files", { encoding: "utf-8" }).trim().split("\n");
  const files = [];
  for (const f of allFiles) {
    const fullPath = path.resolve(f);
    if (!fs.existsSync(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (stat.size > MAX_FILE_SIZE) continue;
    files.push(f);
  }

  const progress = loadProgress();

  if (progress.phase === "upload") {
    const alreadyDone = Object.keys(progress.entries).length;
    console.log(`Files: ${files.length} total, ${alreadyDone} already uploaded, ${files.length - alreadyDone} remaining`);

    const BATCH = 3;
    const remaining = files.filter(f => !progress.entries[f]);

    for (let i = 0; i < remaining.length; i += BATCH) {
      const batch = remaining.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (filePath) => {
          const content = fs.readFileSync(path.resolve(filePath)).toString("base64");
          const blob = await createBlob(content);
          return { filePath, sha: blob.sha };
        })
      );
      for (const r of results) {
        progress.entries[r.filePath] = r.sha;
      }
      saveProgress(progress);

      const done = alreadyDone + i + batch.length;
      if (done % 30 === 0 || i + BATCH >= remaining.length) {
        console.log(`  ${done}/${files.length} uploaded`);
      }
      await sleep(350);
    }

    progress.phase = "commit";
    saveProgress(progress);
    console.log("All blobs uploaded!");
  }

  if (progress.phase === "commit") {
    const treeEntries = Object.entries(progress.entries).map(([p, sha]) => ({
      path: p, mode: "100644", type: "blob", sha,
    }));

    console.log(`Creating tree with ${treeEntries.length} entries...`);
    const tree = await ghApi(`/repos/${OWNER}/${REPO}/git/trees`, {
      method: "POST",
      body: { tree: treeEntries },
    });

    console.log("Creating commit...");
    const commit = await ghApi(`/repos/${OWNER}/${REPO}/git/commits`, {
      method: "POST",
      body: {
        message: "CLT Hub - full codebase sync from Replit",
        tree: tree.sha,
        parents: [baseCommitSha],
      },
    });

    console.log("Updating main branch...");
    await ghApi(`/repos/${OWNER}/${REPO}/git/refs/heads/main`, {
      method: "PATCH",
      body: { sha: commit.sha, force: true },
    });

    fs.unlinkSync(PROGRESS_FILE);
    console.log(`\nDone! Pushed ${treeEntries.length} files to https://github.com/${OWNER}/${REPO}`);
  }
}

run().catch((e) => {
  console.error("Error:", e.message);
  console.log("Run again to resume from where it left off.");
  process.exit(1);
});
