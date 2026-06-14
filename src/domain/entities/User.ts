import type { Config } from '../../config/index.js';

export interface UserProps {
  slackId: string;
  isTrusted: boolean;
  isBanned: boolean;
  approvedCount: number;
  rejectedCount: number;
  explicitRejectionCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  private props: UserProps;

  constructor(props: UserProps) {
    this.props = { ...props };
  }

  get slackId(): string {
    return this.props.slackId;
  }
  get isTrusted(): boolean {
    return this.props.isTrusted;
  }
  get isBanned(): boolean {
    return this.props.isBanned;
  }
  get approvedCount(): number {
    return this.props.approvedCount;
  }
  get rejectedCount(): number {
    return this.props.rejectedCount;
  }
  get explicitRejectionCount(): number {
    return this.props.explicitRejectionCount;
  }

  /**
   * Business Logic: Determine if a user should be promoted to Trusted.
   */
  isEligibleForTrust(config: Config): boolean {
    if (this.props.isTrusted) return true;
    if (this.props.isBanned) return false;

    const meetsApprovalThreshold = this.props.approvedCount >= config.moderation.approvedPostsForTrust;
    const meetsExplicitThreshold = this.props.explicitRejectionCount <= config.moderation.maxExplicitRejectionsForTrust;

    return meetsApprovalThreshold && meetsExplicitThreshold;
  }

  /**
   * Business Logic: Determine if a user should be automatically banned based on explicit rejections.
   * Note: The rolling window logic will be handled at the Repository/Service level by counting
   * recent rejections, but the entity holds the overall count.
   */
  shouldBeBanned(config: Config): boolean {
    if (this.props.isBanned) return true;
    return this.props.explicitRejectionCount >= config.moderation.explicitRejectionsBeforeBan;
  }

  toJSON() {
    return { ...this.props };
  }
}
