export type AttendanceStatus = "参加" | "欠席" | "遅刻" | "未回答";
export type EventType = "練習" | "試合" | "遠征";
export type AllocationStatus = "draft" | "confirmed";

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
  email: string;
  phone: string | null;
  can_drive_default: boolean;
  car_capacity_default: number;
  created_at: string;
  updated_at: string;
};

export type PlayerRow = {
  id: string;
  guardian_id: string | null;
  name: string;
  grade: number;
  family_group: string;
  parent_name: string;
  created_at: string;
  updated_at: string;
};

export type AttendanceRow = {
  id: string;
  event_id: string;
  player_id: string;
  guardian_id: string | null;
  status: AttendanceStatus;
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
  sort_order: number;
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
    };
  };
};