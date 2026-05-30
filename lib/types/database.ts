export type AttendanceStatus = "参加" | "欠席" | "遅刻" | "未回答";
export type EventType = "練習" | "試合" | "遠征";
export type AllocationStatus = "draft" | "confirmed";
export type StaffRole = "監督" | "コーチ" | "その他スタッフ";
export type VehicleType = "regular" | "staff" | "cargo";

export type EventRow = {
  id: string;
  title: string;
  event_type: EventType;
  starts_at: string;
  place: string;
  share_note: string | null;
  allocation_status: AllocationStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GuardianRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  can_drive_default: boolean;
  car_capacity_default: number;
  created_at: string;
  updated_at: string;
};

export type PlayerRow = {
  id: string;
  guardian_id: string | null;
  name: string;
  grade: string;
  family_group: string;
  parent_name: string;
  created_at: string;
  updated_at: string;
};

export type PlayerGuardianRow = {
  id: string;
  player_id: string;
  guardian_id: string;
  relationship_label: string | null;
  display_order: 1 | 2;
  created_at: string;
  updated_at: string;
};

export type PlayerSiblingLinkRow = {
  id: string;
  player_id: string;
  sibling_player_id: string;
  created_at: string;
};

export type AttendanceRow = {
  id: string;
  event_id: string;
  player_id: string;
  guardian_id: string | null;
  status: AttendanceStatus;
  guardian_status: AttendanceStatus;
  guardian_can_drive: boolean;
  driver_name: string | null;
  car_capacity: number;
  note: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AllocationRow = {
  id: string;
  event_id: string;
  guardian_id: string | null;
  driver_name: string;
  car_name: string;
  capacity: number;
  player_ids: string[];
  staff_ids: string[];
  passenger_guardian_ids: string[];
  vehicle_type: VehicleType;
  cargo_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StaffRow = {
  id: string;
  name: string;
  role: StaffRole;
  phone: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffAttendanceRow = {
  id: string;
  event_id: string;
  staff_id: string;
  attendance_status: AttendanceStatus;
  can_drive: boolean;
  capacity: number;
  driver_name: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      events: {
        Row: EventRow;
        Insert: Partial<EventRow>;
        Update: Partial<EventRow>;
      };
      guardians: {
        Row: GuardianRow;
        Insert: Partial<GuardianRow>;
        Update: Partial<GuardianRow>;
      };
      players: {
        Row: PlayerRow;
        Insert: Partial<PlayerRow>;
        Update: Partial<PlayerRow>;
      };
      player_guardians: {
        Row: PlayerGuardianRow;
        Insert: Partial<PlayerGuardianRow>;
        Update: Partial<PlayerGuardianRow>;
      };
      player_sibling_links: {
        Row: PlayerSiblingLinkRow;
        Insert: Partial<PlayerSiblingLinkRow>;
        Update: Partial<PlayerSiblingLinkRow>;
      };
      attendance: {
        Row: AttendanceRow;
        Insert: Partial<AttendanceRow>;
        Update: Partial<AttendanceRow>;
      };
      allocations: {
        Row: AllocationRow;
        Insert: Partial<AllocationRow>;
        Update: Partial<AllocationRow>;
      };
      staff: {
        Row: StaffRow;
        Insert: Partial<StaffRow>;
        Update: Partial<StaffRow>;
      };
      staff_attendance: {
        Row: StaffAttendanceRow;
        Insert: Partial<StaffAttendanceRow>;
        Update: Partial<StaffAttendanceRow>;
      };
    };
  };
};
