import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

function job(name) {
  const section = workflow.match(new RegExp(`^  ${name}:\\n[\\s\\S]*?(?=^  [\\w-]+:|$(?![\\s\\S]))`, "m"));
  assert.ok(section, `Missing CI job: ${name}`);
  return section[0];
}

test("path filtering uses event-aware defaults and retains Android helper coverage", () => {
  const changes = job("changes");
  assert.match(changes, /uses: dorny\/paths-filter@v4/);
  assert.doesNotMatch(changes, /^\s+base:/m);
  assert.match(changes, /'scripts\/ci-workflow\.test\.mjs'/);
  assert.match(changes, /android_tv:[\s\S]*?'scripts\/android-tv\.mjs'/);
});

test("Android CI sets up Node and syncs shared config before building", () => {
  const android = job("android-tv-build");
  assert.match(
    android,
    /uses: actions\/setup-node@v4[\s\S]*?node-version: "20"[\s\S]*?run: npm run sync:shared[\s\S]*?run: \.\/gradlew :app:assembleDebug/
  );
});

test("Android CI builds and tests with the executable, version-pinned wrapper", async () => {
  const android = job("android-tv-build");
  assert.match(android, /working-directory: android-tv\n\s+run: \.\/gradlew :app:assembleDebug/);
  assert.match(android, /working-directory: android-tv\n\s+run: \.\/gradlew :app:testDebugUnitTest/);
  assert.doesNotMatch(android, /gradle-version:/);

  const wrapper = new URL("../android-tv/gradlew", import.meta.url);
  if (process.platform !== "win32") {
    assert.ok((await stat(wrapper)).mode & 0o111, "Gradle wrapper must be executable");
  }
  const properties = await readFile(
    new URL("../android-tv/gradle/wrapper/gradle-wrapper.properties", import.meta.url),
    "utf8"
  );
  assert.match(properties, /^distributionUrl=.*gradle-[\d.]+-bin\.zip$/m);
});
