import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { env } from '../../env';

interface CreateIssueParams {
  summary: string;
  content: string;
  category: string;
  priority: string;
  tags: string[];
  type: string;
}

interface CreateIssueResult {
  url: string;
  number: number;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly octokit: Octokit | null;
  private readonly owner: string;
  private readonly repo: string;
  private readonly labelCache = new Set<string>();

  constructor() {
    const token = env.GITHUB_TOKEN;
    this.owner = env.GITHUB_REPO_OWNER;
    this.repo = env.GITHUB_REPO_NAME;

    if (token && this.owner && this.repo) {
      this.octokit = new Octokit({ auth: token });
      this.logger.log(
        `GitHub integration configured for ${this.owner}/${this.repo}`,
      );
    } else {
      this.octokit = null;
      this.logger.warn(
        'GitHub integration not configured - missing GITHUB_TOKEN, GITHUB_REPO_OWNER, or GITHUB_REPO_NAME',
      );
    }
  }

  isConfigured(): boolean {
    return this.octokit !== null;
  }

  async createFeedbackIssue(
    params: CreateIssueParams,
  ): Promise<CreateIssueResult | null> {
    if (!this.octokit) {
      this.logger.warn('GitHub not configured, skipping issue creation');
      return null;
    }

    this.logger.debug(
      `[GITHUB] Creating issue: summary="${params.summary}", category=${params.category}, priority=${params.priority}`,
    );

    try {
      // Build labels
      this.logger.debug(`[GITHUB] Building labels for issue`);
      const labels = await this.buildLabels(params);
      this.logger.debug(`[GITHUB] Labels to apply: ${labels.join(', ')}`);

      // Build issue body
      const body = this.buildIssueBody(params);
      this.logger.debug(`[GITHUB] Issue body built (${body.length} chars)`);

      // Create the issue
      this.logger.debug(`[GITHUB] Calling GitHub API to create issue`);
      const response = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title: params.summary,
        body,
        labels,
      });

      this.logger.log(
        `Created GitHub issue #${response.data.number}: ${params.summary}`,
      );
      this.logger.debug(
        `[GITHUB] Issue created successfully: url=${response.data.html_url}`,
      );

      return {
        url: response.data.html_url,
        number: response.data.number,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to create GitHub issue: ${err.message}`);
      this.logger.debug(`[GITHUB] Full error:`, err);
      return null;
    }
  }

  private async buildLabels(params: CreateIssueParams): Promise<string[]> {
    const labels: string[] = ['feedback']; // Always include feedback label

    // Add category label
    const categoryLabel = this.getCategoryLabel(params.category);
    if (categoryLabel) {
      labels.push(categoryLabel);
    }

    // Add priority label
    labels.push(`priority:${params.priority}`);

    // Ensure all labels exist
    await this.ensureLabelsExist(labels);

    return labels;
  }

  private getCategoryLabel(
    category: string,
  ): 'bug' | 'enhancement' | undefined {
    switch (category) {
      case 'bug':
        return 'bug';
      case 'feature':
      case 'balance':
      case 'ux':
        return 'enhancement';
      default:
        return undefined;
    }
  }

  private async ensureLabelsExist(labels: string[]): Promise<void> {
    if (!this.octokit) return;

    for (const label of labels) {
      if (this.labelCache.has(label)) {
        this.logger.debug(`[GITHUB] Label "${label}" in cache, skipping check`);
        continue;
      }

      try {
        this.logger.debug(`[GITHUB] Checking if label "${label}" exists`);
        await this.octokit.issues.getLabel({
          owner: this.owner,
          repo: this.repo,
          name: label,
        });
        this.labelCache.add(label);
        this.logger.debug(`[GITHUB] Label "${label}" exists, added to cache`);
      } catch {
        // Label doesn't exist, create it
        try {
          this.logger.debug(`[GITHUB] Label "${label}" not found, creating`);
          const color = this.getLabelColor(label);
          await this.octokit.issues.createLabel({
            owner: this.owner,
            repo: this.repo,
            name: label,
            color,
            description: this.getLabelDescription(label),
          });
          this.labelCache.add(label);
          this.logger.log(`Created GitHub label: ${label}`);
        } catch {
          // Might already exist due to race condition, that's fine
          this.labelCache.add(label);
          this.logger.debug(
            `[GITHUB] Label "${label}" creation failed (likely exists), added to cache`,
          );
        }
      }
    }
  }

  private getLabelColor(label: string): string {
    if (label === 'feedback') return '7057ff'; // Purple
    if (label === 'bug') return 'd73a4a'; // Red
    if (label === 'enhancement') return 'a2eeef'; // Cyan
    if (label.startsWith('priority:high')) return 'b60205'; // Dark red
    if (label.startsWith('priority:medium')) return 'fbca04'; // Yellow
    if (label.startsWith('priority:low')) return '0e8a16'; // Green
    return 'ededed'; // Gray default
  }

  private getLabelDescription(label: string): string {
    if (label === 'feedback') return 'Player feedback submitted via bot';
    if (label === 'priority:high') return 'High priority issue';
    if (label === 'priority:medium') return 'Medium priority issue';
    if (label === 'priority:low') return 'Low priority issue';
    return '';
  }

  private buildIssueBody(params: CreateIssueParams): string {
    const date = new Date().toISOString().split('T')[0];
    const typeEmoji = this.getTypeEmoji(params.type);

    return `## Player Feedback

**Type**: ${typeEmoji} ${this.capitalizeFirst(params.type)}
**Category**: ${this.capitalizeFirst(params.category)}
**Priority**: ${this.capitalizeFirst(params.priority)}
**Submitted**: ${date}

---

### Feedback

> ${params.content}

### AI Classification

- **Summary**: ${params.summary}
- **Tags**: ${params.tags.length > 0 ? params.tags.join(', ') : 'none'}

---

*This issue was automatically created from player feedback via the game bot.*`;
  }

  private getTypeEmoji(type: string): string {
    switch (type) {
      case 'bug':
        return '🐛';
      case 'suggestion':
        return '💡';
      default:
        return '💬';
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
