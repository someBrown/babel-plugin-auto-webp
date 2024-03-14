(async () => {
  const semver = await import("semver");
  const {
    default: { prompt },
  } = await import("inquirer");
  const { readPackage } = await import("read-pkg");

  const { updatePackage } = await import("write-pkg");
  const { execa } = await import("execa");
  const path = await import("path");

  const CURRENT_ROOT = path.resolve(__dirname, "..");

  const { version: currentVersion } = await readPackage({ cwd: CURRENT_ROOT });
  const versionIncrements = ["patch", "minor", "major"];

  const inc = (i) => semver.inc(currentVersion, i);
  const run = (bin, args, opts = {}) =>
    execa(bin, args, { stdio: "inherit", ...opts });

  const gitCommit = async (targetVersion) => {
    const { stdout } = await run("git", ["diff"], { stdio: "pipe" });
    if (stdout) {
      console.log("\nGit Commit...");
      await run("git", ["add", "-A"]);
      await run("git", ["commit", "-m", `release: v${targetVersion}`]);
    }
  };

  const updateVersion = async (targetVersion) => {
    console.log("\nUpdate package.json...");
    await updatePackage(CURRENT_ROOT, {
      version: targetVersion,
    });
  };

  const genChangelog = async () => {
    console.log("\nGenerating changelog...");
    await run(`npm`, ["run", "changelog"]);
  };

  // const publishToNPM = async () => {
  //   console.log("\nPublishing packages...");
  //   await run("npm", ["publish"], {
  //     stdio: "pipe",
  //   });
  // };

  const gitTagAndPush = async (targetVersion) => {
    await run("git", ["tag", `v${targetVersion}`]);
    console.log("\nGit Push...");
    await run("git", ["push", "origin", `refs/tags/v${targetVersion}`]);
    await run("git", ["push"]);
  };

  async function main() {
    const { release } = await prompt({
      name: "release",
      message: "Select release type",
      type: "list",
      choices: versionIncrements.map((i) => `${i} (${inc(i)})`),
    });

    const targetVersion = release.match(/\((.*)\)/)[1];

    const { yes } = await prompt({
      type: "confirm",
      name: "yes",
      message: `Releasing v${targetVersion}. Confirm?`,
    });

    if (!yes) {
      return;
    }
    await updateVersion(targetVersion);
    await genChangelog();
    await gitCommit(targetVersion);
    // await publishToNPM();
    await gitTagAndPush(targetVersion);
  }

  main();
})();
