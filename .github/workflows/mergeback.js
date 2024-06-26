const fs = require("fs");

const falsyEntries = (a) => !!a;
const removeLeadingTrailingSpaces = (a) => a.trim();

let ciUser;

module.exports = async ({ github, context }, env = {}) => {
  const branchToMerge = context.ref.replace("refs/heads/", "");
  ciUser = env.CI_USER ?? "";

  console.log(`Detected push to ${branchToMerge}`);

  const unmergedReleases = fs
    .readFileSync("no-merged-releases.txt", "utf-8")
    .split("\n")
    .filter(falsyEntries)
    .map(removeLeadingTrailingSpaces);

  const mergeActions = unmergedReleases.map((unmergedRelease) =>
    createMergeBackPullRequest(
      { github, context },
      branchToMerge,
      unmergedRelease
    )
  );
  await Promise.all(mergeActions);
  console.log("Finished creating pull requests");
};

async function createMergeBackPullRequest(
  { github, context },
  sourceBranch,
  targetBranch
) {
  try {
    const sourceBranchWithSha = `${context.sha.substring(
      0,
      7
    )}/${sourceBranch}`;
    const newBranchName = `merge-back-${sourceBranchWithSha}-into-${targetBranch}`;
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
      title: `[BOT] Merge back: ${sourceBranchWithSha} into ${targetBranch} 🤖`,
      body: `Automatic merging back ${sourceBranchWithSha} into ${targetBranch}! ${assignees
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
      `Pull request not created ${sourceBranchWithSha} into ${targetBranch}`,
      error
    );
  }
}
