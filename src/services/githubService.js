const axios = require('axios');

const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function parseGithubUrl(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  return { owner: match[1], repo: match[2].replace('.git', '') };
}

async function githubRequest(endpoint) {
  const headers = GITHUB_TOKEN 
    ? { 'Authorization': `token ${GITHUB_TOKEN}` }
    : {};
  
  const response = await axios.get(`${GITHUB_API}${endpoint}`, { headers });
  return response.data;
}

function calculateBusFactor(contributors) {
  if (contributors.length === 0) return 'critical';
  if (contributors.length === 1) return 'critical';
  
  const totalContributions = contributors.reduce((sum, c) => sum + c.contributions, 0);
  const topContributorPct = contributors[0].contributions / totalContributions;
  const activeContributors = contributors.filter(c => c.contributions > 5).length;
  
  if (activeContributors >= 5 && topContributorPct < 0.5) return 'healthy';
  if (activeContributors >= 2) return 'warning';
  return 'critical';
}

async function analyzeRepo(repoUrl) {
  try {
    const { owner, repo } = parseGithubUrl(repoUrl);
    
    const repoData = await githubRequest(`/repos/${owner}/${repo}`);
    let contributors = [];
    try {
      contributors = await githubRequest(`/repos/${owner}/${repo}/contributors?per_page=100`);
    } catch (err) {
      // GitHub returns 403 for repos with too many contributors (e.g. linux)
      console.warn(`[GitHub] Contributors unavailable for ${owner}/${repo}: ${err.message}`);
    }
    
    const maxCommits = parseInt(process.env.GITHUB_MAX_COMMITS, 10) || 100;
    const commits = await githubRequest(
      `/repos/${owner}/${repo}/commits?per_page=${Math.min(maxCommits, 100)}`
    );
    
    const issues = await githubRequest(`/repos/${owner}/${repo}/issues?state=all&per_page=100`);
    const releases = await githubRequest(`/repos/${owner}/${repo}/releases?per_page=20`);
    
    const now = new Date();
    const lastCommitDate = new Date(repoData.pushed_at);
    const lastCommitDaysAgo = Math.floor((now - lastCommitDate) / (1000 * 60 * 60 * 24));
    
    let commitFrequencyPerWeek = 0;
    if (commits.length >= 2) {
      const newest = new Date(commits[0].commit.committer.date);
      const oldest = new Date(commits[commits.length - 1].commit.committer.date);
      const weeks = Math.max((newest - oldest) / (1000 * 60 * 60 * 24 * 7), 1);
      commitFrequencyPerWeek = commits.length / weeks;
    } else if (commits.length === 1) {
      commitFrequencyPerWeek = 0.1;
    }
    
    const topContributorPct = contributors.length > 0 
      ? contributors[0].contributions / contributors.reduce((sum, c) => sum + c.contributions, 0)
      : 0;
    
    const busFactorScore = calculateBusFactor(contributors);
    
    const closedIssues = issues.filter(i => i.state === 'closed' && !i.pull_request);
    const issueCloseRate = closedIssues.length / Math.max(issues.length, 1);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const staleIssueCount = issues.filter(i => 
      i.state === 'open' && new Date(i.updated_at) < thirtyDaysAgo
    ).length;
    
    const lastReleaseDate = releases.length > 0 ? releases[0].created_at : null;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentReleases = releases.filter(r => new Date(r.created_at) > sixMonthsAgo);
    const releaseFrequencyPerMonth = recentReleases.length / 6;
    
    // Check for archived or deprecated status
    const isArchived = repoData.archived === true;
    const isDeprecated = (repoData.description || '').toLowerCase().includes('deprecated') ||
      (repoData.topics || []).some(t => t === 'deprecated' || t === 'unmaintained');

    return {
      name: repoData.name,
      owner: repoData.owner.login,
      url: repoData.html_url,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      license: repoData.license?.spdx_id || 'NONE',
      language: repoData.language,
      createdAt: repoData.created_at,
      lastCommitDate: repoData.pushed_at,
      lastCommitDaysAgo,
      contributorCount: contributors.length,
      topContributorPct: parseFloat(topContributorPct.toFixed(2)),
      busFactorScore,
      commitFrequencyPerWeek: parseFloat(commitFrequencyPerWeek.toFixed(1)),
      avgIssueResponseHours: 24,
      issueCloseRate: parseFloat(issueCloseRate.toFixed(2)),
      staleIssueCount,
      dependencyCount: 0,
      lastReleaseDate,
      releaseFrequencyPerMonth: parseFloat(releaseFrequencyPerMonth.toFixed(2)),
      isArchived,
      isDeprecated,
      topics: repoData.topics || [],
      description: repoData.description || '',
    };
    
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Repository not found');
    }
    if (error.response?.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Add GITHUB_TOKEN to .env');
    }
    throw error;
  }
}

async function githubWriteRequest(endpoint, method, data) {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is required for write operations');
  }
  const response = await axios({
    method,
    url: `${GITHUB_API}${endpoint}`,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    data,
  });
  return response.data;
}

async function checkWriteAccess(owner, repo) {
  if (!GITHUB_TOKEN) {
    return { canWrite: false, reason: 'No GitHub token configured' };
  }
  try {
    const data = await githubRequest(`/repos/${owner}/${repo}`);
    if (data.permissions && data.permissions.push) {
      return { canWrite: true, reason: 'Token has push access' };
    }
    return { canWrite: false, reason: 'Token does not have push access to this repository' };
  } catch (err) {
    if (err.response?.status === 404) {
      return { canWrite: false, reason: 'Repository not found' };
    }
    if (err.response?.status === 403) {
      return { canWrite: false, reason: 'Token lacks sufficient scope' };
    }
    return { canWrite: false, reason: err.message };
  }
}

async function commitReport(owner, repo, markdownContent) {
  const path = 'DEPSCOPE.md';
  const endpoint = `/repos/${owner}/${repo}/contents/${path}`;

  // Check if file already exists to get its SHA
  let existingSha = null;
  try {
    const existing = await githubRequest(endpoint);
    existingSha = existing.sha;
  } catch (err) {
    if (err.response?.status !== 404) throw err;
    // 404 means file doesn't exist yet — that's fine
  }

  const body = {
    message: existingSha
      ? 'Update DEPSCOPE.md — DepScope dependency health report'
      : 'Add DEPSCOPE.md — DepScope dependency health report',
    content: Buffer.from(markdownContent).toString('base64'),
  };
  if (existingSha) body.sha = existingSha;

  try {
    const result = await githubWriteRequest(endpoint, 'PUT', body);
    return {
      success: true,
      sha: result.content.sha,
      url: result.content.html_url,
    };
  } catch (err) {
    // 409 conflict — retry once with fresh SHA
    if (err.response?.status === 409) {
      const fresh = await githubRequest(endpoint);
      body.sha = fresh.sha;
      const retry = await githubWriteRequest(endpoint, 'PUT', body);
      return {
        success: true,
        sha: retry.content.sha,
        url: retry.content.html_url,
      };
    }
    throw err;
  }
}

module.exports = { analyzeRepo, checkWriteAccess, commitReport };
