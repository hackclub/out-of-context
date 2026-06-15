import type { Submission } from '../entities/Submission.js';

export interface ISubmissionRepository {
  findById(id: string): Promise<Submission | null>;
  save(submission: Submission): Promise<Submission>;
  findBySubmitterId(submitterId: string): Promise<Submission[]>;
  getPendingQueue(): Promise<Submission[]>;
  delete(id: string): Promise<void>;
  assignNextNumber(id: string): Promise<number>;
}
