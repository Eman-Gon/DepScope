const axios = require('axios');

function cleanRepoName(repo) {
  return repo.replace(/\.git$/, '').replace(/[?#].*$/, '');
}

async function parseInput(input) {
  const trimmed = input.trim();

  const ghMatch = trimmed.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
  if (ghMatch) {
    const repo = cleanRepoName(ghMatch[2]);
    return {
      type: 'github',
      owner: ghMatch[1],
      repo,
      url: `https://github.com/${ghMatch[1]}/${repo}`,
      packageName: repo,
    };
  }

  const slashMatch = trimmed.match(/^([^\/\s]+)\/([^\/\s]+)$/);
  if (slashMatch) {
    return {
      type: 'github',
      owner: slashMatch[1],
      repo: slashMatch[2],
      url: `https://github.com/${slashMatch[1]}/${slashMatch[2]}`,
      packageName: slashMatch[2],
    };
  }

  return {
    type: 'package',
    packageName: trimmed,
  };
}

async function resolvePackageToGitHub(parsed) {
  if (parsed.type === 'github') return parsed;

  try {
    const packagePath = encodeURIComponent(parsed.packageName);
    const response = await axios.get(`https://registry.npmjs.org/${packagePath}`, { timeout: 5000 });
    const repoUrl = response.data.repository?.url || '';
    const ghMatch = repoUrl.match(/github\.com[:\/]([^\/]+)\/([^\/\s.]+)/);
    if (ghMatch) {
      parsed.owner = ghMatch[1];
      parsed.repo = cleanRepoName(ghMatch[2]);
      parsed.url = `https://github.com/${parsed.owner}/${parsed.repo}`;
      parsed.type = 'github';
      return parsed;
    }
  } catch (err) {
    console.warn(`npm registry lookup failed for ${parsed.packageName}: ${err.message}`);
  }

  parsed.owner = parsed.packageName;
  parsed.repo = parsed.packageName;
  parsed.url = `https://github.com/${parsed.packageName}/${parsed.packageName}`;
  parsed.type = 'github';
  return parsed;
}

module.exports = {
  parseInput,
  resolvePackageToGitHub,
};
