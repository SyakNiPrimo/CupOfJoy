export type AttendanceEventType = 'time_in' | 'time_out';

export type AttendanceResponse = {
  success: boolean;
  message: string;
  employeeId?: string;
  employeeNumber?: string;
  employeeName?: string;
  eventType?: AttendanceEventType;
  locationName?: string;
  distanceM?: number;
  scannedAt?: string;
  status?: 'allowed' | 'outside_radius' | 'already_timed_in' | 'no_active_session';
  lateMinutes?: number;
  payrollDeduction?: number;
  shiftName?: string;
  overtimeQualified?: boolean;
  overtimeMinutes?: number;
  overtimeHours?: number;
  overtimePay?: number;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
};

export type CartItem = {
  item: MenuItem;
  quantity: number;
};
