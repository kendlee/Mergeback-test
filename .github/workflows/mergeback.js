module.exports = async ({ github, context }) => {
  console.log(JSON.stringify(context, null, 2));
  console.log("PR ref", context.payload.pull_request?.head?.ref ?? "none");

  const protectedBranches = await github.rest.repos.listBranches({
    owner: context.repo.owner,
    repo: context.repo.repo,
    protected: true,
    per_page: 100,
  });

  const branchNameActionTrigger = context.ref.replace("refs/heads/", "");
  const mergedBranch = context.payload?.head?.ref;
  const releaseBranches = protectedBranches.data
    .map(({ name }) => name)
    .filter((name) => name.startsWith("release"))
    .sort(sortBranchName);

  console.log(protectedBranches);
  console.log(mergedBranch, ">", branchNameActionTrigger);
  console.log(releaseBranches.map(getNormalizedSemverVersion));
};

function getNormalizedSemverVersion(string) {
  const number = string.split("/")[1];
  let versions = number.split(".");

  return versions.map((version) => version.padStart(2, "0")).join("");
}

function sortBranchName(branchName1, branchName2) {
  const version1 = getNormalizedSemverVersion(branchName1);
  const version2 = getNormalizedSemverVersion(branchName2);

  return Number(versionNumber1) - Number(versionNumber2);
}
