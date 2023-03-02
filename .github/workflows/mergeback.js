module.exports = async ({ github, context }) => {
  const branchNameActionTrigger = context.ref.replace("refs/heads/", "");
  const mergedBranchName = context.payload.pull_request?.head?.ref;

  // if (!mergedBranchName) {
  //   github.log.info("No merge detected");
  //   return;
  // }
  const releasePrefix = getReleasePrefix(mergedBranchName);

  console.log(
    `Detected merge from ${mergedBranchName} to ${branchNameActionTrigger}`
  );

  const protectedBranches = await github.rest.repos.listBranches({
    owner: context.repo.owner,
    repo: context.repo.repo,
    protected: true,
    per_page: 100,
  });

  const releaseBranches = protectedBranches.data
    .map(({ name }) => ({
      name,
      releasePrefix: getReleasePrefix(name),
    }))
    .filter((branch) => branch.name.startsWith("release"))
    .sort(sortBranchName);

  console.log(releaseBranches);

  // const otherReleases = releaseBranches.filter((name) => name.startsWith());
};

/**
 * Get the release prefix based on the provided branch name:
 * Some examples:
 * - For `release/projectA-1.2.3`, release prefix is `release/projectA`
 * - For `release/1.2.3`, release prefix is `release/`
 * - For `non-release-branch`, release prefix is `` (empty string)
 *
 * @param {string} branchName where release prefix is extracted
 * @returns
 */
function getReleasePrefix(branchName = "") {
  const releasePattern = "release/";
  if (!branchName.startsWith(releasePattern)) {
    return "";
  }

  const semanticVersionStartIndex = branchName.lastIndexOf("-");
  return semanticVersionStartIndex === -1
    ? releasePattern
    : branchName.substring(0, semanticVersionStartIndex);
}

function getNormalizedSemverVersion(string) {
  const number = string.split("/")[1];
  let versions = number.split(".");

  return versions.map((version) => version.padStart(2, "0")).join("");
}

function sortBranchName(branch1, branch2) {
  const version1 = getNormalizedSemverVersion(branch1.name);
  const version2 = getNormalizedSemverVersion(branch2.name);

  return Number(version1) - Number(version2);
}
