import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { sharedConfigPaths, syncSharedConfig } from "./sync-shared-config.mjs";
import { validateSharedConfigCopies } from "./validate-tv-web-projects.mjs";

async function createProjectFixture() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "kvflive-shared-config-"));
  const sourcePath = path.join(projectRoot, "packages", "shared", "app-config.json");
  const sourceConfig = {
    appName: "Test App",
    streamUrl: "https://example.com/live.m3u8",
    features: { liveChannels: true }
  };

  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, `${JSON.stringify(sourceConfig, null, 2)}\n`);

  return { projectRoot, sourcePath, sourceConfig };
}

test("syncSharedConfig copies the source config to every platform", async () => {
  const { projectRoot, sourcePath } = await createProjectFixture();

  try {
    await syncSharedConfig(projectRoot);
    const source = await readFile(sourcePath, "utf8");

    for (const relativePath of sharedConfigPaths) {
      assert.equal(await readFile(path.join(projectRoot, relativePath), "utf8"), source);
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("validateSharedConfigCopies accepts matching platform configs", async () => {
  const { projectRoot } = await createProjectFixture();

  try {
    await syncSharedConfig(projectRoot);
    await assert.doesNotReject(() => validateSharedConfigCopies(projectRoot));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("validateSharedConfigCopies rejects a platform config that differs from the source", async () => {
  const { projectRoot, sourceConfig } = await createProjectFixture();

  try {
    await syncSharedConfig(projectRoot);
    const divergentConfig = { ...sourceConfig, appName: "Different App" };
    await writeFile(
      path.join(projectRoot, sharedConfigPaths[0]),
      JSON.stringify(divergentConfig, null, 2)
    );

    await assert.rejects(
      () => validateSharedConfigCopies(projectRoot),
      /does not match packages\/shared\/app-config\.json/
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
