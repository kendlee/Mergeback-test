module.exports = async ({ github, context }) => {
  console.log(data);
  console.log(JSON.stringify(context, null, 2));
  console.log("PR ref", context.payload.pull_request?.head?.ref ?? "none");

  const branches = await github.rest.repos.listBranches({
    owner: context.repo.owner,
    repo: context.repo.repo,
    protected: true,
    per_page: 100,
  });

  const branchesNames = branches.data
    .map(({ name }) => name)
    .filter((name) => name.startsWith("release"));
  // .sort(sortBranchName);

  const branchNameActionTrigger = context.ref.replace("refs/heads/", "");

  console.log(branches);
  console.log(branchNameActionTrigger);
  console.log(branches.map(getNormalizedSemverVersion));
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
