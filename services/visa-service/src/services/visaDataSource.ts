import { PassportIndexSource } from './passportIndexSource';
import type { VisaDataSource } from '../types/visa';

let instance: VisaDataSource | null = null;

export function getDataSource(): VisaDataSource {
  if (!instance) {
    instance = new PassportIndexSource();
  }
  return instance;
}

export function setDataSource(next: VisaDataSource): void {
  instance = next;
}
