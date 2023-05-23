const RELEASE_PATTERN = "release/";
const fs = require("fs");

const falsyEntries = (a) => !!a;
const removeLeadingTrailingSpaces = (a) => a.trim();

module.exports = async ({ github, context }) => {
  const branchNameActionTrigger = context.ref.replace("refs/heads/", "");
  const mergedBranchName = context.payload.pull_request?.head?.ref;

  console.log(
    `Detected merge from ${mergedBranchName} to ${branchNameActionTrigger}`
  );

  if (!mergedBranchName) {
    console.log("No merge detected");
    return;
  }

  const unmergedReleases = fs
    .readFileSync("no-merged-releases.txt", "utf-8")
    .split("\n")
    .filter(falsyEntries)
    .map(removeLeadingTrailingSpaces);

  if (mergedBranchName) {
    const mergeActions = unmergedReleases.map((unmergedRelease) =>
      createMergeBackPullRequest(
        { github, context },
        mergedBranchName,
        unmergedRelease
      )
    );
    await Promise.all(mergeActions);
    console.log("Finished creating pull requests");
  }
};

async function createMergeBackPullRequest(
  { github, context },
  sourceBranch,
  targetBranch
) {
  try {
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
      title: `[BOT] Merge back: ${sourceBranch}/main into ${targetBranch} 🤖`,
      body: `Automatic merging back ${sourceBranch}/main into ${targetBranch}! @${context.payload.pull_request.user.login} Please verify that the merge is correct.`,
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
  } catch (error) {
    console.log(
      `Pull request not created ${sourceBranch}/main into ${targetBranch}`,
      error
    );
  }
}
