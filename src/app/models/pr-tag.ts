export type PrTagEnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CUT_FREELANCE';

export interface MstPrTag {
  id: number;
  shopId: number;
  name: string;
  requiredWorkingDays: number;
  allowedOffDays: number;
  targetDrinks: number;
  guaranteeAmount: number;
  dropoutPayoutAmount: number;
  isActive: boolean;
  createdAt: string;
}

export interface MstPrTagWritePayload {
  name: string;
  requiredWorkingDays: number;
  allowedOffDays: number;
  targetDrinks: number;
  guaranteeAmount: number;
  dropoutPayoutAmount: number;
  isActive?: boolean;
  changeReason?: string;
}

export interface PrTagEnrollmentView {
  id: number;
  status: PrTagEnrollmentStatus;
  statusLabelTh: string;
  workingDaysCount: number;
  offDaysCount: number;
  requiredWorkingDays: number;
  allowedOffDays: number;
  accumulatedDrinks: number;
  targetDrinks: number;
  guaranteeAmount: number;
  dropoutPayoutAmount: number;
  tagId: number;
  tagName: string;
  startedAt: string;
  endedAt: string | null;
  canCheckIn: boolean;
  canRecordOffDay: boolean;
  canForceCut: boolean;
  canCompleteTag: boolean;
  canChangeTag: boolean;
}

export interface PrTagOperationsRow {
  employeeId: string;
  nickname: string;
  roleName: string;
  roleDisplayNameTh: string | null;
  enrollment: PrTagEnrollmentView | null;
}

export interface PrTagAssignableEmployee {
  employeeId: string;
  nickname: string;
  roleName: string;
  roleDisplayNameTh: string | null;
}

export interface PrTagOperationsDashboard {
  rows: PrTagOperationsRow[];
  assignableEmployees: PrTagAssignableEmployee[];
  activeTags: Pick<
    MstPrTag,
    | 'id'
    | 'name'
    | 'requiredWorkingDays'
    | 'allowedOffDays'
    | 'targetDrinks'
    | 'guaranteeAmount'
    | 'dropoutPayoutAmount'
  >[];
}
