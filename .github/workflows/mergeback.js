const RELEASE_PATTERN = "release/";
const fs = require("fs");

const falsyEntries = (a) => !!a;
const removeLeadingTrailingSpaces = (a) => a.trim();

const ciUser = "";

module.exports = async ({ github, context }) => {
  const branchNameActionTrigger = context.ref.replace("refs/heads/", "");
  const action = context.payload.pull_request ? "merge" : "push";
  const branchToMerge =
    action === "merge"
      ? context.payload.pull_request?.base?.ref
      : branchNameActionTrigger;

  const detectedAction =
    action === "merge"
      ? `Detected merge from ${branchToMerge} to ${branchNameActionTrigger}`
      : `Detected push to ${branchNameActionTrigger}`;

  console.log(detectedAction);

  if (!branchToMerge) {
    console.log("No merge detected");
    return;
  }

  const unmergedReleases = fs
    .readFileSync("no-merged-releases.txt", "utf-8")
    .split("\n")
    .filter(falsyEntries)
    .map(removeLeadingTrailingSpaces);

  if (branchToMerge) {
    const mergeActions = unmergedReleases.map((unmergedRelease) =>
      createMergeBackPullRequest(
        { github, context },
        branchToMerge,
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

    const user = context.payload.sender.login;
    const assignees = [];
    // Exclude CI account from tagging
    if (user !== ciUser) {
      assignees.push(user);
    }

    // Create pull request to merge
    const createdPR = await github.rest.pulls.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: `[BOT] Merge back: ${sourceBranch}/main into ${targetBranch} 🤖`,
      body: `Automatic merging back ${sourceBranch}/main into ${targetBranch}! ${assignees
        .map((assignee) => `@${assignee}`)
        .join(" ")} Please verify that the merge is correct.`,
      head: newMergeBranch.data.ref,
      base: targetBranch,
    });

    // Add responsible author as an assignee
    await github.rest.issues.addAssignees({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: createdPR.data.number,
      assignees,
    });
  } catch (error) {
    console.log(
      `Pull request not created ${sourceBranch}/main into ${targetBranch}`,
      error
    );
  }
}
