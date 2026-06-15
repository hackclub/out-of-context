export enum SubmissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED_NOT_OOC = 'REJECTED_NOT_OOC',
  REJECTED_EXPLICIT = 'REJECTED_EXPLICIT',
}

export interface SubmissionProps {
  id?: string;
  slackLink: string;
  status: SubmissionStatus;
  submitterId: string;
  moderatorNotes?: string;
  originalText?: string;
  originalAuthorId?: string;
  originalImageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export class Submission {
  private props: SubmissionProps;

  constructor(props: SubmissionProps) {
    this.validateLink(props.slackLink);
    this.props = { ...props };
  }

  get id(): string | undefined {
    return this.props.id;
  }
  get slackLink(): string {
    return this.props.slackLink;
  }
  get status(): SubmissionStatus {
    return this.props.status;
  }
  get submitterId(): string {
    return this.props.submitterId;
  }
  get originalText(): string | undefined {
    return this.props.originalText;
  }
  get originalAuthorId(): string | undefined {
    return this.props.originalAuthorId;
  }
  get originalImageUrl(): string | undefined {
    return this.props.originalImageUrl;
  }
  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }
  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  private validateLink(link: string) {
    const slackLinkRegex =
      /https:\/\/[a-zA-Z0-9-]+\.slack\.com\/(archives\/[A-Z0-9]+\/p[0-9]+|files\/[A-Z0-9]+\/[A-Z0-9]+)/;
    if (!slackLinkRegex.test(link)) {
      throw new Error('Invalid Slack message link');
    }
  }

  approve(moderatorNotes?: string) {
    this.props.status = SubmissionStatus.APPROVED;
    this.props.moderatorNotes = moderatorNotes;
  }

  reject(explicit: boolean, moderatorNotes?: string) {
    this.props.status = explicit ? SubmissionStatus.REJECTED_EXPLICIT : SubmissionStatus.REJECTED_NOT_OOC;
    this.props.moderatorNotes = moderatorNotes;
  }

  toJSON() {
    return { ...this.props };
  }
}
