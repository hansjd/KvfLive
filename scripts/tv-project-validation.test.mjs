import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { sharedConfigPaths, syncSharedConfig } from "./sync-shared-config.mjs";
import { validateTvProjects } from "./validate-tv-web-projects.mjs";

async function createProjectFixture() {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "kvflive-tv-validation-"));
  const sourceConfigPath = path.join(projectRoot, "packages", "shared", "app-config.json");
  const appInfoPath = path.join(projectRoot, "webos", "appinfo.json");
  const tizenConfigPath = path.join(projectRoot, "tizen", "config.xml");

  await mkdir(path.dirname(sourceConfigPath), { recursive: true });
  await mkdir(path.dirname(appInfoPath), { recursive: true });
  await mkdir(path.dirname(tizenConfigPath), { recursive: true });
  await writeFile(sourceConfigPath, `${JSON.stringify({ streamUrl: "https://example.com/live.m3u8" })}\n`);
  await writeFile(appInfoPath, `${JSON.stringify({ id: "com.example.tv", main: "index.html" })}\n`);
  await writeFile(
    tizenConfigPath,
    '<widget><tizen:profile name="tv-samsung"/><content src="index.html"/></widget>\n'
  );
  await syncSharedConfig(projectRoot);

  return { projectRoot, appInfoPath, tizenConfigPath };
}

async function withProjectFixture(run) {
  const fixture = await createProjectFixture();
  try {
    await run(fixture);
  } finally {
    await rm(fixture.projectRoot, { recursive: true, force: true });
  }
}

test("validateTvProjects accepts valid webOS, Tizen, and shared configuration", async () => {
  await withProjectFixture(async ({ projectRoot }) => {
    await assert.doesNotReject(() => validateTvProjects(projectRoot));
  });
});

test("validateTvProjects rejects webOS metadata without an app id", async () => {
  await withProjectFixture(async ({ projectRoot, appInfoPath }) => {
    await writeFile(appInfoPath, JSON.stringify({ main: "index.html" }));
    await assert.rejects(() => validateTvProjects(projectRoot), /webOS: app id is required/);
  });
});

test("validateTvProjects rejects webOS metadata with a different entry point", async () => {
  await withProjectFixture(async ({ projectRoot, appInfoPath }) => {
    await writeFile(appInfoPath, JSON.stringify({ id: "com.example.tv", main: "app.html" }));
    await assert.rejects(() => validateTvProjects(projectRoot), /webOS: main must be index\.html/);
  });
});

test("validateTvProjects rejects a Tizen project without the TV profile", async () => {
  await withProjectFixture(async ({ projectRoot, tizenConfigPath }) => {
    await writeFile(tizenConfigPath, '<widget><content src="index.html"/></widget>');
    await assert.rejects(() => validateTvProjects(projectRoot), /Tizen: tv-samsung profile is required/);
  });
});

test("validateTvProjects rejects a Tizen project with a different entry point", async () => {
  await withProjectFixture(async ({ projectRoot, tizenConfigPath }) => {
    await writeFile(tizenConfigPath, '<widget><tizen:profile name="tv-samsung"/><content src="app.html"/></widget>');
    await assert.rejects(() => validateTvProjects(projectRoot), /Tizen: content source must be index\.html/);
  });
});

test("validateTvProjects rejects malformed webOS JSON and missing shared copies", async () => {
  await withProjectFixture(async ({ projectRoot, appInfoPath }) => {
    await writeFile(appInfoPath, "{");
    await assert.rejects(() => validateTvProjects(projectRoot), SyntaxError);
  });

  await withProjectFixture(async ({ projectRoot }) => {
    await rm(path.join(projectRoot, sharedConfigPaths[0]));
    await assert.rejects(() => validateTvProjects(projectRoot), /ENOENT/);
  });
});

test("validateTvProjects identifies a malformed shared config copy", async () => {
  await withProjectFixture(async ({ projectRoot }) => {
    const copyPath = path.join(projectRoot, sharedConfigPaths[0]);
    const original = await readFile(copyPath, "utf8");
    await writeFile(copyPath, `${original.trim()} trailing`);
    await assert.rejects(() => validateTvProjects(projectRoot), SyntaxError);
  });
});
