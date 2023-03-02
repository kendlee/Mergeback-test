const RELEASE_PATTERN = "release/";

module.exports = async ({ github, context }) => {
  const branchNameActionTrigger = context.ref.replace("refs/heads/", "");
  const mergedBranchName = context.payload.pull_request?.head?.ref;

  // if (!mergedBranchName) {
  //   github.log.info("No merge detected");
  //   return;
  // }

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
    .filter((branch) => branch.name.startsWith(RELEASE_PATTERN))
    .sort(sortBranchName);

  const newerReleaseBranches = filterNewerReleaseBranches(
    releaseBranches,
    mergedBranchName
  );

  const otherReleaseBranches = releaseBranches.filter(
    (branch) => branch.releasePrefix !== getReleasePrefix(mergedBranchName)
  );

  console.log(newerReleaseBranches);
  console.log(otherReleaseBranches);

  // TODO: change to map > 3rd param will be the targeted branches
  if (mergedBranchName) {
    await createMergeBackPullRequest(
      { github, context },
      mergedBranchName,
      otherReleaseBranches[0].name
    );
  }
};

/**
 * Filter release branches that has a similar release prefix and newer than comparison branch
 *
 * @param {object[]} releaseBranchesToFilter - array of branch objects queried from git api
 * @param {string} branchForComparison
 * @returns
 */
function filterNewerReleaseBranches(
  releaseBranchesToFilter,
  branchForComparison
) {
  const releasePrefix = getReleasePrefix(branchForComparison);
  const associatedReleaseBranches = releaseBranchesToFilter.filter(
    (branch) => branch.releasePrefix === releasePrefix
  );
  const currentReleaseIndex = associatedReleaseBranches.findIndex(
    ({ name }) => name === branchForComparison
  );
  return associatedReleaseBranches.slice(currentReleaseIndex + 1);
}

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
  if (!branchName.startsWith(RELEASE_PATTERN)) {
    return "";
  }

  const semanticVersionStartIndex = branchName.lastIndexOf("-");
  return semanticVersionStartIndex === -1
    ? RELEASE_PATTERN
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

async function createMergeBackPullRequest(
  { github, context },
  sourceBranch,
  targetBranch
) {
  const newBranchName = `merge-back-${context.sha.substring(
    0,
    7
  )}/${sourceBranch}-into-${targetBranch}`;
  console.log(`Creating mergeback: ${newBranchName}`);

  // Create new branch from base branch
  const newMergeBranch = await github.rest.git.createRef({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: `refs/heads/${newBranchName}`,
    sha: context.sha,
  });

  // Create pull request to merge
  const createdPR = await github.rest.pulls.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: `[BOT] Merge back: ${sourceBranch} into ${targetBranch} 🤖`,
    body: `Automatic merging back ${sourceBranch} into ${targetBranch}! @${context.payload.pull_request.user.login} Please verify that the merge is correct.`,
    head: newMergeBranch.data.ref,
    base: targetBranch,
  });

  // Add responsible author as an assignee
  await github.rest.issues.addAssignees({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: createdPR.data.number,
    assignees: [context.payload.pull_request.user.login],
  });
}
