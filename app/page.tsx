"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type {
  AllocationRow,
  AttendanceRow,
  AttendanceStatus,
  EventRow,
  EventType,
  GuardianRow,
  PlayerGuardianRow,
  PlayerRow,
  PlayerSiblingLinkRow,
  StaffAttendanceRow,
  StaffRole,
  StaffRow,
  VehicleType
} from "@/lib/types/database";

type Screen =
  | "landing"
  | "adminLogin"
  | "home"
  | "events"
  | "guardians"
  | "players"
  | "staff"
  | "responses"
  | "parent"
  | "carpool"
  | "summary";
type AutoAssignOptions = {
  preferSameGrade: boolean;
  keepSiblingsTogether: boolean;
  rideWithParentDriver: boolean;
};
type GuardianDraft = {
  localId: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  canDrive: boolean;
  capacity: string;
  isNew: boolean;
};
type PlayerDraft = {
  localId: string;
  id: string;
  name: string;
  grade: string;
  guardianId1: string;
  guardianId2: string;
  familyGroup: string;
  siblingId1: string;
  siblingId2: string;
  siblingId3: string;
  isNew: boolean;
};
type StaffDraft = {
  localId: string;
  id: string;
  name: string;
  role: StaffRole;
  phone: string;
  note: string;
  isNew: boolean;
};
type SpreadsheetRow = Record<string, string>;

const statusStyles: Record<AttendanceStatus, string> = {
  "参加": "bg-emerald-100 text-emerald-950 border-emerald-300",
  "欠席": "bg-white text-rose-700 border-rose-200",
  "遅刻": "bg-amber-100 text-amber-900 border-amber-200",
  "未回答": "bg-white text-slate-800 border-slate-300"
};

const attendanceStatuses: AttendanceStatus[] = ["参加", "欠席", "遅刻", "未回答"];
const staffRoleOptions: StaffRole[] = ["監督", "コーチ", "その他スタッフ"];
const tableInputClass =
  "w-full min-w-36 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-night placeholder:text-slate-700 focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20 disabled:bg-slate-100 disabled:text-slate-700";
const tableSelectClass =
  "w-full min-w-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-night focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20 disabled:bg-slate-100 disabled:text-slate-700";
const formFieldClass =
  "rounded-md border border-slate-200 bg-white px-4 py-3 text-night placeholder:text-slate-700 focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20 disabled:bg-slate-100 disabled:text-slate-700";
const tableHeaderClass =
  "whitespace-nowrap border border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-black text-night";
const tableCellClass = "border border-slate-200 bg-white px-2 py-2 align-top";
const actionButtonBaseClass =
  "rounded-md px-3 py-2 text-sm font-black text-night focus:outline-none focus:ring-2 focus:ring-field/30 disabled:bg-slate-200 disabled:text-slate-700";
const secondaryButtonClass =
  `${actionButtonBaseClass} bg-lime-200 hover:bg-lime-300 active:bg-lime-400`;
const primaryButtonClass =
  `${actionButtonBaseClass} bg-emerald-200 hover:bg-emerald-300 active:bg-emerald-400`;
const addButtonClass =
  "inline-flex w-full cursor-pointer items-center justify-center rounded-md bg-sky-200 px-3 py-2 text-sm font-black text-night hover:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300 active:bg-sky-400 disabled:bg-slate-200 disabled:text-slate-700";
const dangerButtonClass =
  "rounded-md border border-rose-300 bg-rose-100 px-3 py-2 text-sm font-black text-rose-900 hover:bg-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-200 active:bg-rose-300 disabled:bg-slate-100 disabled:text-slate-700";
const backButtonClass =
  "rounded-md bg-slate-100 px-4 py-3 font-bold text-night hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-700";
const homeButtonClass =
  "rounded-md bg-yellow-200 px-4 py-3 font-bold text-night hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300 active:bg-yellow-400 disabled:bg-slate-200 disabled:text-slate-700";
const templateButtonClass =
  "w-full rounded-md bg-cyan-100 px-3 py-2 text-sm font-black text-night hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300 active:bg-cyan-300 disabled:bg-slate-200 disabled:text-slate-700";
const carpoolActionButtonClass =
  "rounded-md bg-teal-100 px-4 py-4 font-bold text-night hover:bg-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-300 active:bg-teal-300 disabled:bg-slate-200 disabled:text-slate-700";
const gradeOptions = [
  "年少",
  "年中",
  "年長",
  "小1",
  "小2",
  "小3",
  "小4",
  "小5",
  "小6",
  "中1",
  "中2",
  "中3",
  "高1",
  "高2",
  "高3"
] as const;
const defaultGrade = "小1";
const demoGuardianEmails = new Set([
  "taro-parent@example.com",
  "minato-parent@example.com",
  "haruto-parent@example.com",
  "yuito-parent@example.com"
]);
const demoEventTitles = new Set([
  "春季リーグ 第3戦",
  "県外交流 遠征",
  "練習試合",
  "サンプル遠征"
]);
const demoPlayerSignatures = new Set([
  "太郎|太郎の保護者",
  "蓮|太郎の保護者",
  "湊|湊の保護者",
  "陽翔|陽翔の保護者",
  "結翔|結翔の保護者",
  "大翔|結翔の保護者"
]);

const initialEventForm = {
  title: "",
  eventType: "遠征" as EventType,
  startsAt: "",
  place: ""
};

const initialParentForm = {
  guardianId: "",
  playerId: "",
  status: "参加" as AttendanceStatus,
  guardianStatus: "未回答" as AttendanceStatus,
  playerStatuses: {} as Record<string, AttendanceStatus>,
  canDrive: false,
  driverName: "",
  capacity: "4",
  note: ""
};

const defaultAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

const appBackgroundStyle = {
  backgroundImage:
    "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(247,244,234,0.96)), radial-gradient(circle at top left, rgba(40,116,90,0.12), transparent 32rem)"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toDatetimeLocalValue(value: string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getPlayer(players: PlayerRow[], playerId: string) {
  return players.find((player) => player.id === playerId);
}

function getGuardian(guardians: GuardianRow[], guardianId: string | null) {
  return guardians.find((guardian) => guardian.id === guardianId);
}

function getPlayerGuardianIds(player: PlayerRow, playerGuardians: PlayerGuardianRow[]) {
  const linkedGuardianIds = playerGuardians
    .filter((link) => link.player_id === player.id)
    .sort((a, b) => a.display_order - b.display_order)
    .map((link) => link.guardian_id);

  if (linkedGuardianIds.length > 0) return linkedGuardianIds;
  return player.guardian_id ? [player.guardian_id] : [];
}

function isGuardianLinkedToPlayer(
  player: PlayerRow,
  guardianId: string,
  playerGuardians: PlayerGuardianRow[]
) {
  return getPlayerGuardianIds(player, playerGuardians).includes(guardianId);
}

function getSiblingIds(playerId: string, siblingLinks: PlayerSiblingLinkRow[]) {
  return siblingLinks
    .filter((link) => link.player_id === playerId)
    .map((link) => link.sibling_player_id)
    .slice(0, 3);
}

function createLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function createGuardianDraft(guardian?: GuardianRow): GuardianDraft {
  return {
    localId: createLocalId(),
    id: guardian?.id ?? "",
    name: guardian?.name ?? "",
    email: guardian?.email ?? "",
    phone: guardian?.phone ?? "",
    note: guardian?.note ?? "",
    canDrive: guardian?.can_drive_default ?? false,
    capacity: String(guardian?.car_capacity_default ?? 4),
    isNew: !guardian
  };
}

function createPlayerDraft(
  player?: PlayerRow,
  playerGuardians: PlayerGuardianRow[] = [],
  siblingLinks: PlayerSiblingLinkRow[] = []
): PlayerDraft {
  const guardianIds = player ? getPlayerGuardianIds(player, playerGuardians) : [];
  const siblingIds = player ? getSiblingIds(player.id, siblingLinks) : [];
  return {
    localId: createLocalId(),
    id: player?.id ?? "",
    name: player?.name ?? "",
    grade: player ? normalizeGrade(player.grade) : defaultGrade,
    guardianId1: guardianIds[0] ?? "",
    guardianId2: guardianIds[1] ?? "",
    familyGroup: player?.family_group ?? "",
    siblingId1: siblingIds[0] ?? "",
    siblingId2: siblingIds[1] ?? "",
    siblingId3: siblingIds[2] ?? "",
    isNew: !player
  };
}

function createStaffDraft(staffMember?: StaffRow): StaffDraft {
  return {
    localId: createLocalId(),
    id: staffMember?.id ?? "",
    name: staffMember?.name ?? "",
    role: staffMember?.role ?? "コーチ",
    phone: staffMember?.phone ?? "",
    note: staffMember?.note ?? "",
    isNew: !staffMember
  };
}

function isDemoGuardian(guardian: GuardianRow) {
  return demoGuardianEmails.has((guardian.email ?? "").toLowerCase());
}

function isDemoEvent(event: EventRow) {
  return demoEventTitles.has(event.title);
}

function isDemoPlayer(player: PlayerRow, demoGuardianIds: Set<string>) {
  return (
    demoGuardianIds.has(player.guardian_id ?? "") ||
    demoPlayerSignatures.has(`${player.name}|${player.parent_name}`)
  );
}

function getSpreadsheetCell(row: SpreadsheetRow, names: string[]) {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined) return value.trim();
  }
  return "";
}

function normalizeSpreadsheetRows(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.trim(), String(value ?? "").trim()])
    ) as SpreadsheetRow
  );
}

function parseImportBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  return ["true", "1", "yes", "y", "はい", "可", "可能", "あり", "有", "○", "◯"].includes(
    normalized
  );
}

async function readSpreadsheetRows(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["xlsx", "xls", "csv"].includes(extension)) {
    throw new Error("xlsx、xls、csvファイルを選択してください。");
  }

  const XLSX = await import("xlsx");
  const workbook =
    extension === "csv"
      ? XLSX.read(await file.text(), { type: "string" })
      : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });

  return normalizeSpreadsheetRows(rows);
}

async function downloadTemplateFile(fileName: string, sheetName: string, headers: string[]) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const url = URL.createObjectURL(
    new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeGrade(value: string | number | null | undefined) {
  const raw = String(value ?? "").trim();
  if ((gradeOptions as readonly string[]).includes(raw)) return raw;
  if (/^[1-6]$/.test(raw)) return `小${raw}`;
  if (/^[7-9]$/.test(raw)) return `中${Number(raw) - 6}`;
  if (/^1[0-2]$/.test(raw)) return `高${Number(raw) - 9}`;
  return raw || defaultGrade;
}

function gradeRank(value: string | number | null | undefined) {
  const normalized = normalizeGrade(value);
  const index = (gradeOptions as readonly string[]).indexOf(normalized);
  return index >= 0 ? index : -1;
}

function isParentDriver(
  car: AllocationRow,
  player: PlayerRow,
  playerGuardians: PlayerGuardianRow[]
) {
  if (car.guardian_id && isGuardianLinkedToPlayer(player, car.guardian_id, playerGuardians)) {
    return true;
  }

  return (
    car.driver_name.includes(player.name) ||
    car.driver_name.includes(player.parent_name) ||
    player.parent_name.includes(car.driver_name)
  );
}

function splitIntoGroups(
  players: PlayerRow[],
  options: AutoAssignOptions,
  siblingLinks: PlayerSiblingLinkRow[]
) {
  if (!options.keepSiblingsTogether) {
    return players.map((player) => [player]);
  }

  const playerById = new Map(players.map((player) => [player.id, player]));
  const adjacency = new Map(players.map((player) => [player.id, new Set<string>()]));

  siblingLinks.forEach((link) => {
    if (playerById.has(link.player_id) && playerById.has(link.sibling_player_id)) {
      adjacency.get(link.player_id)?.add(link.sibling_player_id);
      adjacency.get(link.sibling_player_id)?.add(link.player_id);
    }
  });

  const familyGroups = players.reduce<Record<string, string[]>>((result, player) => {
    const key = player.family_group.trim();
    if (!key) return result;
    result[key] = [...(result[key] ?? []), player.id];
    return result;
  }, {});

  Object.values(familyGroups).forEach((ids) => {
    ids.forEach((id) => {
      ids.forEach((siblingId) => {
        if (id !== siblingId) adjacency.get(id)?.add(siblingId);
      });
    });
  });

  const visited = new Set<string>();
  const groups: PlayerRow[][] = [];

  players.forEach((player) => {
    if (visited.has(player.id)) return;
    const stack = [player.id];
    const group: PlayerRow[] = [];
    visited.add(player.id);

    while (stack.length > 0) {
      const playerId = stack.pop();
      if (!playerId) continue;
      const targetPlayer = playerById.get(playerId);
      if (targetPlayer) group.push(targetPlayer);
      adjacency.get(playerId)?.forEach((siblingId) => {
        if (!visited.has(siblingId)) {
          visited.add(siblingId);
          stack.push(siblingId);
        }
      });
    }

    groups.push(group);
  });

  return Object.values(groups).sort((a, b) => b.length - a.length);
}

function findBestCarIndex(
  cars: AllocationRow[],
  group: PlayerRow[],
  players: PlayerRow[],
  playerGuardians: PlayerGuardianRow[],
  options: AutoAssignOptions
) {
  const groupGrades = new Set(group.map((player) => normalizeGrade(player.grade)));

  const scored = cars
    .map((car, index) => {
      const remainingSeats = car.capacity - car.player_ids.length;
      if (remainingSeats < group.length) return null;

      const driverScore =
        options.rideWithParentDriver &&
        group.some((player) => isParentDriver(car, player, playerGuardians))
          ? 100
          : 0;
      const gradeScore =
        options.preferSameGrade &&
        car.player_ids.some((playerId) => {
          const player = getPlayer(players, playerId);
          return player ? groupGrades.has(normalizeGrade(player.grade)) : false;
        })
          ? 20
          : 0;
      const emptyBonus = car.player_ids.length === 0 ? 5 : 0;

      return { index, score: driverScore + gradeScore + emptyBonus + remainingSeats / 10 };
    })
    .filter((item): item is { index: number; score: number } => item !== null)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.index ?? -1;
}

function createAutoAssignedCars(
  baseCars: AllocationRow[],
  targetPlayers: PlayerRow[],
  allPlayers: PlayerRow[],
  playerGuardians: PlayerGuardianRow[],
  siblingLinks: PlayerSiblingLinkRow[],
  options: AutoAssignOptions
) {
  const emptyCars = baseCars.map((car) => ({ ...car, player_ids: [] as string[] }));
  const sortedPlayers = [...targetPlayers].sort(
    (a, b) => gradeRank(b.grade) - gradeRank(a.grade) || a.name.localeCompare(b.name, "ja")
  );
  const groups = splitIntoGroups(sortedPlayers, options, siblingLinks);
  const remainingGroups: PlayerRow[][] = [];

  groups.forEach((group) => {
    const carIndex = options.rideWithParentDriver
      ? emptyCars.findIndex(
          (car) =>
            group.some((player) => isParentDriver(car, player, playerGuardians)) &&
            car.capacity - car.player_ids.length >= group.length
        )
      : -1;

    if (carIndex >= 0) {
      emptyCars[carIndex].player_ids.push(...group.map((player) => player.id));
      return;
    }

    remainingGroups.push(group);
  });

  remainingGroups.forEach((group) => {
    const carIndex = findBestCarIndex(emptyCars, group, allPlayers, playerGuardians, options);
    if (carIndex >= 0) {
      emptyCars[carIndex].player_ids.push(...group.map((player) => player.id));
    }
  });

  return emptyCars;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [, setScreenHistory] = useState<Screen[]>([]);
  const [adminEmail, setAdminEmail] = useState(defaultAdminEmail);
  const [password, setPassword] = useState("");
  const [loginErrorEmail, setLoginErrorEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [playerGuardians, setPlayerGuardians] = useState<PlayerGuardianRow[]>([]);
  const [siblingLinks, setSiblingLinks] = useState<PlayerSiblingLinkRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedGuardianId, setSelectedGuardianId] = useState("");
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [guardianDrafts, setGuardianDrafts] = useState<GuardianDraft[]>([]);
  const [playerDrafts, setPlayerDrafts] = useState<PlayerDraft[]>([]);
  const [staffDrafts, setStaffDrafts] = useState<StaffDraft[]>([]);
  const [parentForm, setParentForm] = useState(initialParentForm);
  const [carForm, setCarForm] = useState({
    driverName: "",
    carName: "",
    capacity: "4"
  });
  const [cargoForm, setCargoForm] = useState({
    driverName: "",
    carName: "荷物車",
    passengerGuardianId: "",
    cargoNote: ""
  });
  const [autoAssignOptions, setAutoAssignOptions] = useState<AutoAssignOptions>({
    preferSameGrade: true,
    keepSiblingsTogether: true,
    rideWithParentDriver: true
  });

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const isParentLinkMode =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "parent";
  const eventAttendance = useMemo(
    () =>
      selectedEvent
        ? attendance.filter((row) => row.event_id === selectedEvent.id)
        : [],
    [attendance, selectedEvent]
  );
  const eventAllocations = selectedEvent
    ? allocations
        .filter((row) => row.event_id === selectedEvent.id)
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const eventStaffAttendance = useMemo(
    () =>
      selectedEvent
        ? staffAttendance.filter((row) => row.event_id === selectedEvent.id)
        : [],
    [selectedEvent, staffAttendance]
  );
  const selectedGuardian = guardians.find((guardian) => guardian.id === selectedGuardianId);
  const guardianPlayers = useMemo(
    () =>
      selectedGuardian
        ? players.filter((player) =>
            isGuardianLinkedToPlayer(player, selectedGuardian.id, playerGuardians)
          )
        : [],
    [playerGuardians, players, selectedGuardian]
  );
  const isAllocationConfirmed = selectedEvent?.allocation_status === "confirmed";

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      "参加": 0,
      "欠席": 0,
      "遅刻": 0,
      "未回答": 0
    };

    players.forEach((player) => {
      const row = eventAttendance.find((item) => item.player_id === player.id);
      counts[row?.status ?? "未回答"] += 1;
    });

    return counts;
  }, [eventAttendance, players]);

  const rideTargetPlayers = players.filter((player) => {
    const row = eventAttendance.find((item) => item.player_id === player.id);
    return (row?.status ?? "未回答") !== "欠席";
  });
  const assignedPlayerIds = new Set(eventAllocations.flatMap((car) => car.player_ids));
  const unassignedPlayers = rideTargetPlayers.filter(
    (player) => !assignedPlayerIds.has(player.id)
  );

  function navigateTo(nextScreen: Screen) {
    setScreen((current) => {
      if (current === nextScreen) return current;
      setScreenHistory((history) => [...history, current]);
      return nextScreen;
    });
  }

  function goBack() {
    setScreenHistory((history) => {
      const previous = history[history.length - 1];
      setScreen(previous ?? "landing");
      return history.slice(0, -1);
    });
  }

  function goHome() {
    setScreenHistory([]);
    setScreen("landing");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");
    const guardianId = params.get("guardian");
    const mode = params.get("mode");

    void loadSessionAndData(eventId, guardianId, mode === "parent");
  }, []);

  useEffect(() => {
    if (!selectedGuardian) return;
    const firstPlayer = guardianPlayers[0];
    const guardianRows = eventAttendance.filter(
      (row) => row.guardian_id === selectedGuardian.id
    );
    const firstAttendance = guardianRows[0];
    const playerStatuses = guardianPlayers.reduce<Record<string, AttendanceStatus>>(
      (result, player) => {
        const row = eventAttendance.find((item) => item.player_id === player.id);
        result[player.id] = row?.status ?? "未回答";
        return result;
      },
      {}
    );

    queueMicrotask(() => {
      setParentForm((current) => ({
        ...current,
        guardianId: selectedGuardian.id,
        playerId: firstPlayer?.id ?? "",
        status: firstAttendance?.status ?? current.status,
        guardianStatus: firstAttendance?.guardian_status ?? "未回答",
        playerStatuses,
        driverName: firstAttendance?.driver_name ?? selectedGuardian.name,
        canDrive: firstAttendance?.guardian_can_drive ?? selectedGuardian.can_drive_default,
        capacity: String(firstAttendance?.car_capacity ?? selectedGuardian.car_capacity_default),
        note: firstAttendance?.note ?? ""
      }));
    });
  }, [eventAttendance, guardianPlayers, selectedGuardian]);

  async function loadSessionAndData(
    eventIdFromUrl?: string | null,
    guardianIdFromUrl?: string | null,
    parentMode?: boolean
  ) {
    if (!supabase) return;

    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const hasSession = Boolean(sessionData.session);
    setIsAdmin(hasSession);

    const [
      eventsResult,
      guardiansResult,
      playersResult,
      playerGuardiansResult,
      siblingLinksResult,
      staffResult,
      staffAttendanceResult,
      attendanceResult,
      allocationsResult
    ] = await Promise.all([
      supabase.from("events").select("*").order("starts_at", { ascending: true }),
      supabase.from("guardians").select("*").order("name", { ascending: true }),
      supabase.from("players").select("*").order("grade", { ascending: false }),
      supabase.from("player_guardians").select("*"),
      supabase.from("player_sibling_links").select("*"),
      supabase.from("staff").select("*").order("role", { ascending: true }).order("name", { ascending: true }),
      supabase.from("staff_attendance").select("*"),
      supabase.from("attendance").select("*"),
      supabase.from("allocations").select("*").order("sort_order", { ascending: true })
    ]);

    if (eventsResult.error) setMessage(`遠征データの取得に失敗しました: ${eventsResult.error.message}`);
    if (guardiansResult.error) setMessage(`保護者データの取得に失敗しました: ${guardiansResult.error.message}`);
    if (playersResult.error) setMessage(`選手データの取得に失敗しました: ${playersResult.error.message}`);
    if (playerGuardiansResult.error) setMessage(`親子関係データの取得に失敗しました: ${playerGuardiansResult.error.message}`);
    if (siblingLinksResult.error) setMessage(`兄弟データの取得に失敗しました: ${siblingLinksResult.error.message}`);
    if (staffResult.error) setMessage(`指導者データの取得に失敗しました: ${staffResult.error.message}`);
    if (staffAttendanceResult.error) setMessage(`指導者出欠データの取得に失敗しました: ${staffAttendanceResult.error.message}`);
    if (attendanceResult.error) setMessage(`出欠データの取得に失敗しました: ${attendanceResult.error.message}`);
    if (allocationsResult.error) setMessage(`配車データの取得に失敗しました: ${allocationsResult.error.message}`);
    const allEvents = (eventsResult.data ?? []) as EventRow[];
    const allGuardians = (guardiansResult.data ?? []) as GuardianRow[];
    const demoGuardianIds = new Set(
      allGuardians.filter((guardian) => isDemoGuardian(guardian)).map((guardian) => guardian.id)
    );
    const loadedEvents = allEvents.filter((event) => !isDemoEvent(event));
    const visibleEventIds = new Set(loadedEvents.map((event) => event.id));
    const loadedGuardians = allGuardians.filter((guardian) => !isDemoGuardian(guardian));
    const visibleGuardianIds = new Set(loadedGuardians.map((guardian) => guardian.id));
    const loadedPlayers = ((playersResult.data ?? []) as PlayerRow[]).filter(
      (player) =>
        !isDemoPlayer(player, demoGuardianIds) &&
        (!player.guardian_id || visibleGuardianIds.has(player.guardian_id))
    ).sort(
      (a, b) => gradeRank(b.grade) - gradeRank(a.grade) || a.name.localeCompare(b.name, "ja")
    );
    const visiblePlayerIds = new Set(loadedPlayers.map((player) => player.id));
    const loadedPlayerGuardians = ((playerGuardiansResult.data ?? []) as PlayerGuardianRow[]).filter(
      (row) => visiblePlayerIds.has(row.player_id) && visibleGuardianIds.has(row.guardian_id)
    );
    const loadedSiblingLinks = ((siblingLinksResult.data ?? []) as PlayerSiblingLinkRow[]).filter(
      (row) => visiblePlayerIds.has(row.player_id) && visiblePlayerIds.has(row.sibling_player_id)
    );
    const loadedStaff = (staffResult.data ?? []) as StaffRow[];
    const visibleStaffIds = new Set(loadedStaff.map((staffMember) => staffMember.id));
    const loadedAttendance = ((attendanceResult.data ?? []) as AttendanceRow[]).filter(
      (row) => visibleEventIds.has(row.event_id) && visiblePlayerIds.has(row.player_id)
    );
    const loadedStaffAttendance = ((staffAttendanceResult.data ?? []) as StaffAttendanceRow[]).filter(
      (row) => visibleEventIds.has(row.event_id) && visibleStaffIds.has(row.staff_id)
    );
    const loadedAllocations = ((allocationsResult.data ?? []) as AllocationRow[]).filter((row) =>
      visibleEventIds.has(row.event_id)
    ).map((row) => ({
      ...row,
      staff_ids: row.staff_ids ?? [],
      passenger_guardian_ids: row.passenger_guardian_ids ?? [],
      vehicle_type: row.vehicle_type ?? "regular",
      cargo_note: row.cargo_note ?? null
    }));
    setEvents(loadedEvents);
    setGuardians(loadedGuardians);
    setPlayers(loadedPlayers);
    setPlayerGuardians(loadedPlayerGuardians);
    setSiblingLinks(loadedSiblingLinks);
    setStaff(loadedStaff);
    setStaffAttendance(loadedStaffAttendance);
    setAttendance(loadedAttendance);
    setAllocations(loadedAllocations);
    setGuardianDrafts(loadedGuardians.map((guardian) => createGuardianDraft(guardian)));
    setPlayerDrafts(
      loadedPlayers.map((player) =>
        createPlayerDraft(player, loadedPlayerGuardians, loadedSiblingLinks)
      )
    );
    setStaffDrafts(loadedStaff.map((staffMember) => createStaffDraft(staffMember)));

    const requestedEventId =
      eventIdFromUrl && loadedEvents.some((event) => event.id === eventIdFromUrl)
        ? eventIdFromUrl
        : null;
    const requestedGuardianId =
      guardianIdFromUrl && loadedGuardians.some((guardian) => guardian.id === guardianIdFromUrl)
        ? guardianIdFromUrl
        : null;

    setSelectedEventId((current) => {
      if (requestedEventId) return requestedEventId;
      if (current && loadedEvents.some((event) => event.id === current)) return current;
      return loadedEvents[0]?.id ?? null;
    });
    setSelectedGuardianId((current) => {
      if (requestedGuardianId) return requestedGuardianId;
      if (current && loadedGuardians.some((guardian) => guardian.id === current)) return current;
      return "";
    });
    if (parentMode) setScreen("parent");
    setLoading(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase環境変数が未設定です。");
      return;
    }

    const submittedEmail = adminEmail.trim();
    setLoginErrorEmail("");
    setMessage("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: submittedEmail,
      password
    });
    setLoading(false);

    if (error) {
      setLoginErrorEmail(submittedEmail);
      setMessage("メールアドレスまたはパスワードが違います");
      return;
    }

    setAdminEmail(submittedEmail);
    setIsAdmin(true);
    setScreenHistory(["landing"]);
    setScreen("home");
    await loadSessionAndData();
  }

  async function handleLogout() {
    await supabase?.auth.signOut();
    setIsAdmin(false);
    setScreenHistory([]);
    setScreen("landing");
  }

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    if (!eventForm.title.trim() || !eventForm.startsAt) {
      setMessage("イベント名と日時を入力してください。");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const startsAt = new Date(eventForm.startsAt).toISOString();
    const result = editingEventId
      ? await supabase
          .from("events")
          .update({
            title: eventForm.title.trim(),
            event_type: eventForm.eventType,
            starts_at: startsAt,
            place: eventForm.place.trim()
          })
          .eq("id", editingEventId)
          .select()
          .single()
      : await supabase
          .from("events")
          .insert({
            title: eventForm.title.trim(),
            event_type: eventForm.eventType,
            starts_at: startsAt,
            place: eventForm.place.trim(),
            created_by: userData.user?.id ?? null
          })
          .select()
          .single();

    if (result.error) {
      setMessage(`遠征の保存に失敗しました: ${result.error.message}`);
      return;
    }

    setEventForm(initialEventForm);
    setEditingEventId(null);
    setMessage(editingEventId ? "遠征を更新しました。" : "遠征を作成しました。");
    await loadSessionAndData(result.data.id);
  }

  function startEditEvent(eventToEdit: EventRow) {
    setEditingEventId(eventToEdit.id);
    setSelectedEventId(eventToEdit.id);
    setEventForm({
      title: eventToEdit.title,
      eventType: eventToEdit.event_type,
      startsAt: toDatetimeLocalValue(eventToEdit.starts_at),
      place: eventToEdit.place
    });
    navigateTo("events");
  }

  function resetEventForm() {
    setEditingEventId(null);
    setEventForm(initialEventForm);
  }

  async function deleteEvent(eventId: string) {
    if (!supabase || !isAdmin) return;
    const eventToDelete = events.find((event) => event.id === eventId);
    if (!window.confirm(`${eventToDelete?.title ?? "この遠征"} を削除します。よろしいですか？`)) {
      return;
    }

    const nextEventId = events.find((event) => event.id !== eventId)?.id ?? null;
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      setMessage(`遠征の削除に失敗しました: ${error.message}`);
      return;
    }

    if (editingEventId === eventId) resetEventForm();
    setSelectedEventId(nextEventId);
    if (
      !nextEventId &&
      (screen === "parent" || screen === "carpool" || screen === "summary" || screen === "responses")
    ) {
      navigateTo("events");
    }
    setMessage("遠征を削除しました。");
    await loadSessionAndData(nextEventId);
  }

  async function deleteGuardian(guardianId: string) {
    if (!supabase || !isAdmin) return;
    const guardian = guardians.find((item) => item.id === guardianId);
    const linkedPlayers = players.filter((player) =>
      isGuardianLinkedToPlayer(player, guardianId, playerGuardians)
    );
    const warning =
      linkedPlayers.length > 0
        ? `\n\nこの保護者に紐づく選手が${linkedPlayers.length}名います。削除すると選手の保護者設定が未設定になります。`
        : "";

    if (!window.confirm(`${guardian?.name ?? "この保護者"} を削除します。よろしいですか？${warning}`)) {
      return;
    }

    const { error } = await supabase.from("guardians").delete().eq("id", guardianId);
    if (error) {
      setMessage(`保護者の削除に失敗しました: ${error.message}`);
      return;
    }

    setMessage("保護者を削除しました。");
    await loadSessionAndData(selectedEventId);
  }

  async function syncPlayerGuardians(playerId: string, guardianIds: string[]) {
    if (!supabase || !isAdmin) return false;
    const uniqueGuardianIds = guardianIds.filter(Boolean);
    if (new Set(uniqueGuardianIds).size !== uniqueGuardianIds.length) {
      setMessage("保護者1と保護者2に同じ保護者は選択できません。");
      return false;
    }

    const { error: deleteError } = await supabase
      .from("player_guardians")
      .delete()
      .eq("player_id", playerId);
    if (deleteError) {
      setMessage(`親子関係の更新に失敗しました: ${deleteError.message}`);
      return false;
    }

    if (uniqueGuardianIds.length > 0) {
      const { error: insertError } = await supabase.from("player_guardians").insert(
        uniqueGuardianIds.map((guardianId, index) => ({
          player_id: playerId,
          guardian_id: guardianId,
          relationship_label: index === 0 ? "保護者1" : "保護者2",
          display_order: (index + 1) as 1 | 2
        }))
      );
      if (insertError) {
        setMessage(`親子関係の保存に失敗しました: ${insertError.message}`);
        return false;
      }
    }

    return true;
  }

  async function syncPlayerSiblings(playerId: string, siblingIds: string[]) {
    if (!supabase || !isAdmin) return false;
    const uniqueSiblingIds = siblingIds.filter(Boolean);
    if (uniqueSiblingIds.includes(playerId)) {
      setMessage("選手自身を兄弟として選択することはできません。");
      return false;
    }
    if (uniqueSiblingIds.length > 3) {
      setMessage("兄弟は最大3名まで選択できます。");
      return false;
    }
    if (new Set(uniqueSiblingIds).size !== uniqueSiblingIds.length) {
      setMessage("同じ兄弟を重複して選択することはできません。");
      return false;
    }

    const { error: deleteError } = await supabase
      .from("player_sibling_links")
      .delete()
      .or(`player_id.eq.${playerId},sibling_player_id.eq.${playerId}`);
    if (deleteError) {
      setMessage(`兄弟設定の更新に失敗しました: ${deleteError.message}`);
      return false;
    }

    if (uniqueSiblingIds.length > 0) {
      const rows = uniqueSiblingIds.flatMap((siblingId) => [
        { player_id: playerId, sibling_player_id: siblingId },
        { player_id: siblingId, sibling_player_id: playerId }
      ]);
      const { error: insertError } = await supabase.from("player_sibling_links").insert(rows);
      if (insertError) {
        setMessage(`兄弟設定の保存に失敗しました: ${insertError.message}`);
        return false;
      }
    }

    return true;
  }

  async function deletePlayer(playerId: string) {
    if (!supabase || !isAdmin) return;
    const player = players.find((item) => item.id === playerId);
    if (!window.confirm(`${player?.name ?? "この選手"} を削除します。よろしいですか？`)) return;

    const { error } = await supabase.from("players").delete().eq("id", playerId);
    if (error) {
      setMessage(`選手の削除に失敗しました: ${error.message}`);
      return;
    }

    setMessage("選手を削除しました。");
    await loadSessionAndData(selectedEventId);
  }

  function updateGuardianDraft(localId: string, patch: Partial<GuardianDraft>) {
    setGuardianDrafts((current) =>
      current.map((draft) => (draft.localId === localId ? { ...draft, ...patch } : draft))
    );
  }

  function updatePlayerDraft(localId: string, patch: Partial<PlayerDraft>) {
    setPlayerDrafts((current) =>
      current.map((draft) => (draft.localId === localId ? { ...draft, ...patch } : draft))
    );
  }

  function addGuardianDraft() {
    setGuardianDrafts((current) => [...current, createGuardianDraft()]);
  }

  function addPlayerDraft() {
    setPlayerDrafts((current) => [...current, createPlayerDraft()]);
  }

  async function persistGuardianDraft(draft: GuardianDraft) {
    if (!supabase || !isAdmin) return false;
    if (!draft.name.trim()) {
      setMessage("保護者氏名を入力してください。");
      return false;
    }

    const payload = {
      name: draft.name.trim(),
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      note: draft.note.trim() || null,
      can_drive_default: draft.canDrive,
      car_capacity_default: Math.max(Number(draft.capacity) || 1, 1)
    };
    const result = draft.id
      ? await supabase.from("guardians").update(payload).eq("id", draft.id)
      : await supabase.from("guardians").insert(payload);

    if (result.error) {
      setMessage(`保護者の保存に失敗しました: ${result.error.message}`);
      return false;
    }

    return true;
  }

  async function saveGuardianDraft(draft: GuardianDraft) {
    const saved = await persistGuardianDraft(draft);
    if (!saved) return;
    setMessage("保存しました");
    await loadSessionAndData(selectedEventId);
  }

  async function saveAllGuardianDrafts() {
    for (const draft of guardianDrafts) {
      const saved = await persistGuardianDraft(draft);
      if (!saved) return;
    }
    setMessage("保存しました");
    await loadSessionAndData(selectedEventId);
  }

  async function deleteGuardianDraft(draft: GuardianDraft) {
    if (draft.isNew || !draft.id) {
      if (!window.confirm("この未保存の保護者行を削除しますか？")) return;
      setGuardianDrafts((current) => current.filter((item) => item.localId !== draft.localId));
      return;
    }

    await deleteGuardian(draft.id);
  }

  async function persistPlayerDraft(draft: PlayerDraft) {
    if (!supabase || !isAdmin) return false;
    if (!draft.name.trim()) {
      setMessage("選手氏名を入力してください。");
      return false;
    }
    if (draft.guardianId1 && draft.guardianId1 === draft.guardianId2) {
      setMessage(`${draft.name} の保護者1と保護者2が重複しています。`);
      return false;
    }

    const selectedGuardianForPlayer = guardians.find(
      (guardian) => guardian.id === draft.guardianId1
    );
    const payload = {
      name: draft.name.trim(),
      grade: normalizeGrade(draft.grade),
      guardian_id: draft.guardianId1 || null,
      family_group: draft.familyGroup.trim() || draft.name.trim(),
      parent_name: selectedGuardianForPlayer?.name ?? ""
    };
    const result = draft.id
      ? await supabase.from("players").update(payload).eq("id", draft.id).select().single()
      : await supabase.from("players").insert(payload).select().single();

    if (result.error) {
      setMessage(`選手の保存に失敗しました: ${result.error.message}`);
      return false;
    }

    const syncedGuardians = await syncPlayerGuardians(result.data.id, [
      draft.guardianId1,
      draft.guardianId2
    ]);
    if (!syncedGuardians) return false;

    const syncedSiblings = await syncPlayerSiblings(result.data.id, [
      draft.siblingId1,
      draft.siblingId2,
      draft.siblingId3
    ]);
    if (!syncedSiblings) return false;

    return true;
  }

  async function savePlayerDraft(draft: PlayerDraft) {
    const saved = await persistPlayerDraft(draft);
    if (!saved) return;
    setMessage("保存しました");
    await loadSessionAndData(selectedEventId);
  }

  async function saveAllPlayerDrafts() {
    for (const draft of playerDrafts) {
      const saved = await persistPlayerDraft(draft);
      if (!saved) return;
    }
    setMessage("保存しました");
    await loadSessionAndData(selectedEventId);
  }

  async function deletePlayerDraft(draft: PlayerDraft) {
    if (draft.isNew || !draft.id) {
      if (!window.confirm("この未保存の選手行を削除しますか？")) return;
      setPlayerDrafts((current) => current.filter((item) => item.localId !== draft.localId));
      return;
    }

    await deletePlayer(draft.id);
  }

  function mergeGuardianDrafts(importedDrafts: GuardianDraft[]) {
    setGuardianDrafts((current) => {
      const next = [...current];

      importedDrafts.forEach((draft) => {
        const normalizedEmail = draft.email.trim().toLowerCase();
        const indexById = draft.id ? next.findIndex((item) => item.id === draft.id) : -1;
        const indexByEmail = normalizedEmail
          ? next.findIndex((item) => item.email.trim().toLowerCase() === normalizedEmail)
          : -1;
        const targetIndex = indexById >= 0 ? indexById : indexByEmail;

        if (targetIndex >= 0) {
          next[targetIndex] = {
            ...draft,
            localId: next[targetIndex].localId,
            id: next[targetIndex].id || draft.id,
            isNew: next[targetIndex].isNew && !draft.id
          };
        } else {
          next.push(draft);
        }
      });

      return next;
    });
  }

  async function handleGuardianImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rows = await readSpreadsheetRows(file);
      let skipped = 0;
      let matched = 0;
      const importedDrafts = rows.flatMap((row) => {
        const name = getSpreadsheetCell(row, ["保護者氏名", "保護者名", "氏名", "名前"]);
        if (!name) {
          skipped += 1;
          return [];
        }

        const email = getSpreadsheetCell(row, ["メールアドレス", "メール", "Email", "email"]);
        const existingGuardian = email
          ? guardians.find(
              (guardian) => (guardian.email ?? "").toLowerCase() === email.toLowerCase()
            )
          : undefined;
        if (existingGuardian) matched += 1;

        return [
          {
            ...createGuardianDraft(existingGuardian),
            name,
            email,
            phone: getSpreadsheetCell(row, ["電話番号", "電話", "TEL", "tel"]),
            note: getSpreadsheetCell(row, ["備考", "メモ", "note"]),
            canDrive: parseImportBoolean(
              getSpreadsheetCell(row, ["車出し初期可否", "車出し", "車出し可否"])
            ),
            capacity:
              getSpreadsheetCell(row, ["乗車可能人数", "乗車人数", "定員"]) ||
              String(existingGuardian?.car_capacity_default ?? 4),
            isNew: !existingGuardian
          }
        ];
      });

      if (importedDrafts.length === 0) {
        setMessage("読み込める保護者データがありません。保護者氏名の列を確認してください。");
        return;
      }

      mergeGuardianDrafts(importedDrafts);
      setMessage(
        `${importedDrafts.length}件読み込みました${
          matched > 0 ? `（${matched}件はメールアドレス一致のため上書き候補です）` : ""
        }${skipped > 0 ? `。氏名が空欄の${skipped}行は読み込みませんでした。` : ""}`
      );
    } catch (error) {
      setMessage(
        `保護者インポートに失敗しました: ${
          error instanceof Error ? error.message : "ファイルを確認してください。"
        }`
      );
    }
  }

  async function handlePlayerImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rows = await readSpreadsheetRows(file);
      let skipped = 0;
      let unlinked = 0;
      const importedDrafts = rows.flatMap((row) => {
        const name = getSpreadsheetCell(row, ["選手氏名", "選手名", "氏名", "名前"]);
        if (!name) {
          skipped += 1;
          return [];
        }

        const guardianName1 = getSpreadsheetCell(row, ["保護者1氏名", "保護者氏名", "保護者名", "保護者"]);
        const guardianName2 = getSpreadsheetCell(row, ["保護者2氏名"]);
        const linkedGuardian1 = guardianName1
          ? guardians.find((guardian) => guardian.name.trim() === guardianName1)
          : undefined;
        const linkedGuardian2 = guardianName2
          ? guardians.find((guardian) => guardian.name.trim() === guardianName2)
          : undefined;
        if (guardianName1 && !linkedGuardian1) unlinked += 1;
        if (guardianName2 && !linkedGuardian2) unlinked += 1;
        const siblingNames = [
          getSpreadsheetCell(row, ["兄弟1"]),
          getSpreadsheetCell(row, ["兄弟2"]),
          getSpreadsheetCell(row, ["兄弟3"])
        ];
        const linkedSiblings = siblingNames.map((siblingName) =>
          siblingName ? players.find((player) => player.name.trim() === siblingName) : undefined
        );
        unlinked += siblingNames.filter((nameValue, index) => nameValue && !linkedSiblings[index]).length;
        const importedGrade = normalizeGrade(getSpreadsheetCell(row, ["学年", "grade"]));

        return [
          {
            ...createPlayerDraft(),
            name,
            grade: (gradeOptions as readonly string[]).includes(importedGrade)
              ? importedGrade
              : defaultGrade,
            guardianId1: linkedGuardian1?.id ?? "",
            guardianId2:
              linkedGuardian2 && linkedGuardian2.id !== linkedGuardian1?.id ? linkedGuardian2.id : "",
            familyGroup: getSpreadsheetCell(row, ["兄弟グループ", "兄弟", "family_group"]),
            siblingId1: linkedSiblings[0]?.id ?? "",
            siblingId2: linkedSiblings[1]?.id ?? "",
            siblingId3: linkedSiblings[2]?.id ?? ""
          }
        ];
      });

      if (importedDrafts.length === 0) {
        setMessage("読み込める選手データがありません。選手氏名の列を確認してください。");
        return;
      }

      setPlayerDrafts((current) => [...current, ...importedDrafts]);
      setMessage(
        `${importedDrafts.length}件読み込みました${
          unlinked > 0 ? `（${unlinked}件は保護者が未紐づけです）` : ""
        }${skipped > 0 ? `。氏名が空欄の${skipped}行は読み込みませんでした。` : ""}`
      );
    } catch (error) {
      setMessage(
        `選手インポートに失敗しました: ${
          error instanceof Error ? error.message : "ファイルを確認してください。"
        }`
      );
    }
  }

  async function downloadGuardianTemplate() {
    try {
      await downloadTemplateFile("保護者Excelテンプレート.xlsx", "保護者", [
        "保護者氏名",
        "メールアドレス",
        "電話番号",
        "車出し初期可否",
        "乗車可能人数",
        "備考"
      ]);
    } catch (error) {
      setMessage(
        `保護者テンプレートの作成に失敗しました: ${
          error instanceof Error ? error.message : "もう一度お試しください。"
        }`
      );
    }
  }

  async function downloadPlayerTemplate() {
    try {
      await downloadTemplateFile("選手Excelテンプレート.xlsx", "選手", [
        "選手氏名",
        "学年",
        "保護者1氏名",
        "保護者2氏名",
        "兄弟1",
        "兄弟2",
        "兄弟3"
      ]);
    } catch (error) {
      setMessage(
        `選手テンプレートの作成に失敗しました: ${
          error instanceof Error ? error.message : "もう一度お試しください。"
        }`
      );
    }
  }

  function updateStaffDraft(localId: string, patch: Partial<StaffDraft>) {
    setStaffDrafts((current) =>
      current.map((draft) => (draft.localId === localId ? { ...draft, ...patch } : draft))
    );
  }

  function addStaffDraft() {
    setStaffDrafts((current) => [...current, createStaffDraft()]);
  }

  async function persistStaffDraft(draft: StaffDraft) {
    if (!supabase || !isAdmin) return false;
    if (!draft.name.trim()) {
      setMessage("指導者氏名を入力してください。");
      return false;
    }

    const payload = {
      name: draft.name.trim(),
      role: staffRoleOptions.includes(draft.role) ? draft.role : "コーチ",
      phone: draft.phone.trim() || null,
      note: draft.note.trim() || null
    };
    const result = draft.id
      ? await supabase.from("staff").update(payload).eq("id", draft.id)
      : await supabase.from("staff").insert(payload);

    if (result.error) {
      setMessage(`指導者の保存に失敗しました: ${result.error.message}`);
      return false;
    }

    return true;
  }

  async function saveStaffDraft(draft: StaffDraft) {
    const saved = await persistStaffDraft(draft);
    if (!saved) return;
    setMessage("保存しました");
    await loadSessionAndData(selectedEventId);
  }

  async function saveAllStaffDrafts() {
    for (const draft of staffDrafts) {
      const saved = await persistStaffDraft(draft);
      if (!saved) return;
    }
    setMessage("保存しました");
    await loadSessionAndData(selectedEventId);
  }

  async function deleteStaffDraft(draft: StaffDraft) {
    if (!supabase || !isAdmin) return;
    if (draft.isNew || !draft.id) {
      if (!window.confirm("この未保存の指導者行を削除しますか？")) return;
      setStaffDrafts((current) => current.filter((item) => item.localId !== draft.localId));
      return;
    }

    if (!window.confirm(`${draft.name || "この指導者"} を削除します。よろしいですか？`)) return;
    const { error } = await supabase.from("staff").delete().eq("id", draft.id);
    if (error) {
      setMessage(`指導者の削除に失敗しました: ${error.message}`);
      return;
    }

    setMessage("指導者を削除しました。");
    await loadSessionAndData(selectedEventId);
  }

  async function handleStaffImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const rows = await readSpreadsheetRows(file);
      let skipped = 0;
      const importedDrafts = rows.flatMap((row) => {
        const name = getSpreadsheetCell(row, ["指導者氏名", "氏名", "名前"]);
        if (!name) {
          skipped += 1;
          return [];
        }

        const roleValue = getSpreadsheetCell(row, ["役割", "role"]);
        const role = staffRoleOptions.includes(roleValue as StaffRole)
          ? (roleValue as StaffRole)
          : "コーチ";

        return [
          {
            ...createStaffDraft(),
            name,
            role,
            phone: getSpreadsheetCell(row, ["電話番号", "電話", "TEL", "tel"]),
            note: getSpreadsheetCell(row, ["備考", "メモ", "note"])
          }
        ];
      });

      if (importedDrafts.length === 0) {
        setMessage("読み込める指導者データがありません。指導者氏名の列を確認してください。");
        return;
      }

      setStaffDrafts((current) => [...current, ...importedDrafts]);
      setMessage(
        `${importedDrafts.length}件読み込みました${
          skipped > 0 ? `。氏名が空欄の${skipped}行は読み込みませんでした。` : ""
        }`
      );
    } catch (error) {
      setMessage(
        `指導者インポートに失敗しました: ${
          error instanceof Error ? error.message : "ファイルを確認してください。"
        }`
      );
    }
  }

  async function downloadStaffTemplate() {
    try {
      await downloadTemplateFile("指導者Excelテンプレート.xlsx", "指導者", [
        "指導者氏名",
        "役割",
        "電話番号",
        "備考"
      ]);
    } catch (error) {
      setMessage(
        `指導者テンプレートの作成に失敗しました: ${
          error instanceof Error ? error.message : "もう一度お試しください。"
        }`
      );
    }
  }

  async function handleStaffAttendanceSubmit(
    event: FormEvent<HTMLFormElement>,
    staffMember: StaffRow
  ) {
    event.preventDefault();
    if (!supabase || !selectedEvent || !isAdmin) return;

    const formData = new FormData(event.currentTarget);
    const rawStatus = formData.get("attendance_status") as AttendanceStatus | null;
    const attendanceStatus =
      rawStatus && attendanceStatuses.includes(rawStatus) ? rawStatus : "未回答";
    const canDrive = formData.get("can_drive") === "on";
    const driverName = String(formData.get("driver_name") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    const { error } = await supabase.from("staff_attendance").upsert(
      {
        event_id: selectedEvent.id,
        staff_id: staffMember.id,
        attendance_status: attendanceStatus,
        can_drive: canDrive,
        capacity: Math.max(Number(formData.get("capacity")) || 1, 1),
        driver_name: canDrive ? driverName || staffMember.name : null,
        note: note || null
      },
      { onConflict: "event_id,staff_id" }
    );

    if (error) {
      setMessage(`指導者出欠の保存に失敗しました: ${error.message}`);
      return;
    }

    setMessage("保存しました");
    await loadSessionAndData(selectedEvent.id);
  }

  async function handleParentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedEvent) {
      setMessage("遠征が選択されていません。");
      return;
    }
    if (!selectedGuardian) {
      setMessage("保護者を選択してください。");
      return;
    }
    if (guardianPlayers.length === 0) {
      setMessage("この保護者に紐づく選手が登録されていません。管理者に確認してください。");
      return;
    }

    const sharedPayload = {
      event_id: selectedEvent.id,
      guardian_id: selectedGuardian.id,
      guardian_status: parentForm.guardianStatus,
      guardian_can_drive: parentForm.canDrive,
      driver_name: parentForm.canDrive ? parentForm.driverName.trim() || selectedGuardian.name : null,
      car_capacity: Math.max(Number(parentForm.capacity) || 1, 1),
      note: parentForm.note.trim() || null,
      submitted_at: new Date().toISOString()
    };

    const payload = guardianPlayers.map((player) => ({
      ...sharedPayload,
      player_id: player.id,
      status: parentForm.playerStatuses[player.id] ?? "未回答"
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(payload, { onConflict: "event_id,player_id" });

    if (error) {
      setMessage(`保存に失敗しました: ${error.message}`);
      return;
    }

    setMessage("保存しました");
    await loadSessionAndData(selectedEvent.id, selectedGuardian.id, screen === "parent");
  }

  async function handleAdminAttendanceSubmit(
    event: FormEvent<HTMLFormElement>,
    player: PlayerRow
  ) {
    event.preventDefault();
    if (!supabase || !selectedEvent || !isAdmin) return;

    const formData = new FormData(event.currentTarget);
    const rawStatus = formData.get("status") as AttendanceStatus | null;
    const rawGuardianStatus = formData.get("guardian_status") as AttendanceStatus | null;
    const status =
      rawStatus && attendanceStatuses.includes(rawStatus) ? rawStatus : "未回答";
    const guardianStatus =
      rawGuardianStatus && attendanceStatuses.includes(rawGuardianStatus)
        ? rawGuardianStatus
        : "未回答";
    const primaryGuardianId = getPlayerGuardianIds(player, playerGuardians)[0] ?? null;
    const guardian = getGuardian(guardians, primaryGuardianId);
    const canDrive = formData.get("guardian_can_drive") === "on";
    const driverName = String(formData.get("driver_name") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    const { error } = await supabase.from("attendance").upsert(
      {
        event_id: selectedEvent.id,
        player_id: player.id,
        guardian_id: primaryGuardianId,
        status,
        guardian_status: guardianStatus,
        guardian_can_drive: canDrive,
        driver_name: canDrive ? driverName || guardian?.name || null : null,
        car_capacity: Math.max(Number(formData.get("car_capacity")) || 1, 1),
        note: note || null,
        submitted_at: new Date().toISOString()
      },
      { onConflict: "event_id,player_id" }
    );

    if (error) {
      setMessage(`回答の保存に失敗しました: ${error.message}`);
      return;
    }

    setMessage("保存しました");
    await loadSessionAndData(selectedEvent.id);
  }

  async function handleCreateCar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedEvent || !isAdmin || isAllocationConfirmed) return;

    const { error } = await supabase.from("allocations").insert({
      event_id: selectedEvent.id,
      driver_name: carForm.driverName,
      car_name: carForm.carName || `${eventAllocations.length + 1}号車`,
      capacity: Math.max(Number(carForm.capacity) || 1, 1),
      player_ids: [],
      staff_ids: [],
      passenger_guardian_ids: [],
      vehicle_type: "regular",
      cargo_note: null,
      sort_order: eventAllocations.length
    });

    if (error) setMessage(error.message);
    setCarForm({ driverName: "", carName: "", capacity: "4" });
    await loadSessionAndData(selectedEvent.id);
  }

  async function handleCreateCargoCar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedEvent || !isAdmin || isAllocationConfirmed) return;
    if (!cargoForm.driverName.trim()) {
      setMessage("荷物車の運転手を入力してください。");
      return;
    }

    const { error } = await supabase.from("allocations").insert({
      event_id: selectedEvent.id,
      guardian_id: cargoForm.passengerGuardianId || null,
      driver_name: cargoForm.driverName.trim(),
      car_name: cargoForm.carName.trim() || "荷物車",
      capacity: 2,
      player_ids: [],
      staff_ids: [],
      passenger_guardian_ids: cargoForm.passengerGuardianId ? [cargoForm.passengerGuardianId] : [],
      vehicle_type: "cargo",
      cargo_note: cargoForm.cargoNote.trim() || null,
      sort_order: eventAllocations.length
    });

    if (error) {
      setMessage(`荷物車の追加に失敗しました: ${error.message}`);
      return;
    }

    if (!cargoForm.passengerGuardianId) {
      setMessage("荷物車を追加しました。同乗保護者が未設定です。可能なら保護者を1名設定してください。");
    } else {
      setMessage("荷物車を追加しました。");
    }
    setCargoForm({ driverName: "", carName: "荷物車", passengerGuardianId: "", cargoNote: "" });
    await loadSessionAndData(selectedEvent.id);
  }

  function createStaffCarsFromResponses(startOrder: number) {
    const warnings: string[] = [];
    const participatingRows = eventStaffAttendance.filter(
      (row) => row.attendance_status === "参加" || row.attendance_status === "遅刻"
    );
    const driverRows = participatingRows.filter((row) => row.can_drive);
    const staffCars: AllocationRow[] = driverRows.map((row, index) => {
      const staffMember = staff.find((item) => item.id === row.staff_id);
      return {
        id: crypto.randomUUID(),
        event_id: selectedEvent?.id ?? "",
        guardian_id: null,
        driver_name: row.driver_name || staffMember?.name || "指導者",
        car_name: `指導者車${index + 1}`,
        capacity: Math.max(row.capacity || 1, 1),
        player_ids: [],
        staff_ids: [],
        passenger_guardian_ids: [],
        vehicle_type: "staff",
        cargo_note: null,
        sort_order: startOrder + index,
        created_at: "",
        updated_at: ""
      };
    });

    if (participatingRows.length > 0 && staffCars.length === 0) {
      warnings.push("指導者用車両が不足しています。指導者の車出し可否を確認してください。");
      return { staffCars, warnings };
    }

    participatingRows.forEach((row) => {
      const driverCar = staffCars.find((car) => car.driver_name === row.driver_name);
      const targetCar =
        driverCar && driverCar.staff_ids.length < driverCar.capacity
          ? driverCar
          : staffCars.find((car) => car.staff_ids.length < car.capacity);

      if (targetCar) {
        targetCar.staff_ids.push(row.staff_id);
      } else {
        const staffMember = staff.find((item) => item.id === row.staff_id);
        warnings.push(
          `指導者用車両の座席が不足しています: ${staffMember?.name ?? "未登録の指導者"}`
        );
      }
    });

    return { staffCars, warnings };
  }

  async function createRidePlanFromResponses() {
    if (!supabase || !selectedEvent || !isAdmin || isAllocationConfirmed) return;

    const driverRows = eventAttendance.reduce<AttendanceRow[]>((result, row) => {
      if (!row.guardian_can_drive || row.status === "欠席" || row.guardian_status === "欠席") {
        return result;
      }
      if (row.guardian_id && result.some((item) => item.guardian_id === row.guardian_id)) {
        return result;
      }
      if (!row.guardian_id && result.some((item) => item.driver_name === row.driver_name)) {
        return result;
      }
      return [...result, row];
    }, []);

    const existingCargoCars = eventAllocations.filter(
      (car) => (car.vehicle_type ?? "regular") === "cargo"
    );
    const warnings: string[] = [];
    const playersWithoutGuardian = rideTargetPlayers.filter(
      (player) => getPlayerGuardianIds(player, playerGuardians).length === 0
    );
    if (playersWithoutGuardian.length > 0) {
      warnings.push(
        `保護者未設定の選手がいます: ${playersWithoutGuardian
          .map((player) => player.name)
          .join("、")}`
      );
    }
    const hasBrokenSiblingLinks = siblingLinks.some(
      (link) =>
        !siblingLinks.some(
          (other) =>
            other.player_id === link.sibling_player_id && other.sibling_player_id === link.player_id
        )
    );
    if (hasBrokenSiblingLinks) {
      warnings.push("兄弟設定の不整合があります。選手管理で兄弟設定を保存し直してください。");
    }
    existingCargoCars.forEach((car) => {
      if (!car.driver_name.trim()) warnings.push(`${car.car_name} の運転手が未設定です。`);
      if ((car.passenger_guardian_ids ?? []).length === 0) {
        warnings.push(`${car.car_name} の同乗保護者が未設定です。保護者の同乗余力を確認してください。`);
      }
    });

    const baseCars = driverRows.map((row, index) => ({
      id: crypto.randomUUID(),
      event_id: selectedEvent.id,
      guardian_id: row.guardian_id,
      driver_name: row.driver_name || getGuardian(guardians, row.guardian_id)?.name || "運転者",
      car_name: `${index + 1}号車`,
      capacity: row.car_capacity,
      player_ids: [] as string[],
      staff_ids: [] as string[],
      passenger_guardian_ids: [] as string[],
      vehicle_type: "regular" as VehicleType,
      cargo_note: null,
      sort_order: index,
      created_at: "",
      updated_at: ""
    }));

    const assignedCars = createAutoAssignedCars(
      baseCars,
      rideTargetPlayers,
      players,
      playerGuardians,
      siblingLinks,
      autoAssignOptions
    );
    const assignedPlayerCount = assignedCars.reduce((count, car) => count + car.player_ids.length, 0);
    if (assignedPlayerCount < rideTargetPlayers.length) {
      warnings.push(
        `通常車の座席が不足しています。未割当: ${rideTargetPlayers.length - assignedPlayerCount}名`
      );
    }
    const { staffCars, warnings: staffWarnings } = createStaffCarsFromResponses(assignedCars.length);
    warnings.push(...staffWarnings);

    await supabase.from("allocations").delete().eq("event_id", selectedEvent.id);
    const nextCars = [
      ...assignedCars,
      ...staffCars,
      ...existingCargoCars.map((car) => ({
        ...car,
        player_ids: [] as string[],
        staff_ids: [] as string[],
        vehicle_type: "cargo" as VehicleType
      }))
    ];
    if (nextCars.length === 0) {
      setMessage("車出し可能な回答がありません。");
      await loadSessionAndData(selectedEvent.id);
      return;
    }

    const { error } = await supabase.from("allocations").insert(
      nextCars.map((car, index) => ({
        event_id: selectedEvent.id,
        guardian_id: car.guardian_id,
        driver_name: car.driver_name,
        car_name: car.car_name,
        capacity: car.capacity,
        player_ids: car.player_ids,
        staff_ids: car.staff_ids,
        passenger_guardian_ids: car.passenger_guardian_ids,
        vehicle_type: car.vehicle_type,
        cargo_note: car.cargo_note,
        sort_order: index
      }))
    );

    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(warnings.length > 0 ? warnings.join("\n") : "配車表を作成しました。");
    await loadSessionAndData(selectedEvent.id);
  }

  async function autoAssignExistingCars() {
    if (!supabase || !selectedEvent || !isAdmin || isAllocationConfirmed) return;
    const client = supabase;

    const assignedCars = createAutoAssignedCars(
      eventAllocations.filter((car) => (car.vehicle_type ?? "regular") === "regular"),
      rideTargetPlayers,
      players,
      playerGuardians,
      siblingLinks,
      autoAssignOptions
    );

    await Promise.all(
      assignedCars.map((car) =>
        client.from("allocations").update({ player_ids: car.player_ids }).eq("id", car.id)
      )
    );
    await loadSessionAndData(selectedEvent.id);
  }

  async function assignPlayerToCar(playerId: string, allocationId: string) {
    if (!supabase || !selectedEvent || !isAdmin || isAllocationConfirmed) return;
    const client = supabase;

    const nextCars = eventAllocations.map((car) => ({
      ...car,
      player_ids: car.player_ids.filter((id) => id !== playerId)
    }));
    const targetCar = nextCars.find((car) => car.id === allocationId);
    if (targetCar && (targetCar.vehicle_type ?? "regular") !== "regular") {
      setMessage("指導者用車両・荷物車には子どもを割り当てできません。");
      return;
    }
    if (targetCar) targetCar.player_ids = [...targetCar.player_ids, playerId];

    await Promise.all(
      nextCars.map((car) =>
        client.from("allocations").update({ player_ids: car.player_ids }).eq("id", car.id)
      )
    );
    await loadSessionAndData(selectedEvent.id);
  }

  async function completeRidePlan() {
    if (!supabase || !selectedEvent || !isAdmin) return;
    await supabase
      .from("events")
      .update({ allocation_status: "confirmed" })
      .eq("id", selectedEvent.id);
    await loadSessionAndData(selectedEvent.id);
  }

  async function reopenRidePlanForEdit() {
    if (!supabase || !selectedEvent || !isAdmin) return;
    await supabase
      .from("events")
      .update({ allocation_status: "draft" })
      .eq("id", selectedEvent.id);
    await loadSessionAndData(selectedEvent.id);
  }

  async function deleteCar(allocationId: string) {
    if (!supabase || !isAdmin || isAllocationConfirmed) return;
    await supabase.from("allocations").delete().eq("id", allocationId);
    await loadSessionAndData(selectedEventId);
  }

  async function updateCargoCar(
    allocationId: string,
    payload: {
      carName: string;
      driverName: string;
      passengerGuardianId: string;
      cargoNote: string;
    }
  ) {
    if (!supabase || !selectedEvent || !isAdmin || isAllocationConfirmed) return;
    if (!payload.driverName.trim()) {
      setMessage("荷物車の運転手を入力してください。");
      return;
    }

    const { error } = await supabase
      .from("allocations")
      .update({
        car_name: payload.carName.trim() || "荷物車",
        driver_name: payload.driverName.trim(),
        passenger_guardian_ids: payload.passengerGuardianId ? [payload.passengerGuardianId] : [],
        guardian_id: payload.passengerGuardianId || null,
        cargo_note: payload.cargoNote.trim() || null,
        player_ids: [],
        staff_ids: [],
        vehicle_type: "cargo"
      })
      .eq("id", allocationId);

    if (error) {
      setMessage(`荷物車の保存に失敗しました: ${error.message}`);
      return;
    }

    setMessage(payload.passengerGuardianId ? "保存しました" : "保存しました。同乗保護者が未設定です。");
    await loadSessionAndData(selectedEvent.id);
  }

  function shareUrl(eventId: string, guardianId?: string) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/?event=${eventId}&mode=parent${
      guardianId ? `&guardian=${guardianId}` : ""
    }`;
  }

  async function copyShareText(eventToShare: EventRow) {
    const text = `【${eventToShare.title} 参加確認】\n${formatDate(
      eventToShare.starts_at
    )}\n場所: ${eventToShare.place}\n以下URLから出欠と配車可否を入力してください。\n${shareUrl(
      eventToShare.id
    )}`;
    await navigator.clipboard.writeText(text);
    setMessage("LINE共有テキストをコピーしました。");
  }

  async function copyRidePlanText() {
    if (!selectedEvent) return;
    const regularCars = eventAllocations.filter((car) => (car.vehicle_type ?? "regular") === "regular");
    const staffCars = eventAllocations.filter((car) => car.vehicle_type === "staff");
    const cargoCars = eventAllocations.filter((car) => car.vehicle_type === "cargo");
    const lines = [
      `【${selectedEvent.title} 配車表】`,
      `${formatDate(selectedEvent.starts_at)} / ${selectedEvent.place}`,
      "",
      "【通常車】",
      ...(regularCars.length > 0
        ? regularCars.flatMap((car, index) => [
            `${index + 1}号車：運転手 ${car.driver_name}さん`,
            `乗車：${
              car.player_ids.map((playerId) => getPlayer(players, playerId)?.name ?? "不明").join("、") ||
              "未割当"
            }`,
            ""
          ])
        : ["配車結果はまだありません。", ""]),
      "【指導者用車両】",
      ...(staffCars.length > 0
        ? staffCars.flatMap((car) => [
            `${car.car_name}：運転手 ${car.driver_name}さん`,
            `乗車：${
              car.staff_ids
                .map((staffId) => {
                  const staffMember = staff.find((item) => item.id === staffId);
                  return staffMember ? `${staffMember.role} ${staffMember.name}` : "不明";
                })
                .join("、") || "未割当"
            }`,
            ""
          ])
        : ["指導者用車両はありません。", ""]),
      "【荷物車】",
      ...(cargoCars.length > 0
        ? cargoCars.flatMap((car) => [
            `${car.car_name}：運転手 ${car.driver_name}さん`,
            car.passenger_guardian_ids.length > 0
              ? `同乗：${car.passenger_guardian_ids
                  .map((guardianId) => `${getGuardian(guardians, guardianId)?.name ?? "不明"}さん`)
                  .join("、")}`
              : "同乗：未設定",
            `荷物：${car.cargo_note || "未設定"}`,
            ""
          ])
        : ["荷物車はありません。", ""])
    ];
    await navigator.clipboard.writeText(lines.join("\n").trim());
    setMessage("配車表のLINE共有テキストをコピーしました。");
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-chalk px-4 py-10 text-slate-900">
        <section className="mx-auto max-w-md rounded-lg bg-white p-5 shadow-soft">
          <h1 className="text-xl font-black">Supabase設定が必要です</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と
            `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。
          </p>
        </section>
      </main>
    );
  }

  if (screen === "landing") {
    return (
      <main className="min-h-[100dvh] bg-chalk px-4 py-8 text-slate-900" style={appBackgroundStyle}>
        <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center">
          <div className="mb-8">
            <p className="mb-3 text-sm font-bold text-slate-800">少年野球遠征配車</p>
            <h1 className="text-3xl font-black leading-tight">使う画面を選んでください</h1>
            <p className="mt-4 text-sm leading-6 text-slate-700">
              保護者は遠征を選んで出欠と車出し可否を入力できます。管理者はログインして遠征、保護者、選手、配車を管理します。
            </p>
          </div>
          <div className="grid gap-4">
            <button
              type="button"
              onClick={() => {
                setMessage("");
                if (!selectedEventId && events[0]) setSelectedEventId(events[0].id);
                navigateTo("parent");
              }}
              className="rounded-lg border border-emerald-200 bg-white px-5 py-7 text-left text-night shadow-soft hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-emerald-100"
            >
              <span className="block text-2xl font-black">保護者用</span>
              <span className="mt-2 block text-sm font-bold text-slate-700">
                遠征を選んで、家庭の出欠・車出しを入力
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                navigateTo(isAdmin ? "home" : "adminLogin");
              }}
              className="rounded-lg border border-yellow-300 bg-yellow-200 px-5 py-7 text-left text-night shadow-soft hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300 active:bg-yellow-400"
            >
              <span className="block text-2xl font-black">管理者用</span>
              <span className="mt-2 block text-sm font-bold opacity-90">
                Supabase Authでログインして全データを管理
              </span>
            </button>
          </div>
          {message && <p className="mt-4 text-sm font-bold text-rose-700">{message}</p>}
        </section>
      </main>
    );
  }

  if (screen === "adminLogin") {
    return (
      <main className="min-h-[100dvh] bg-chalk px-4 py-8 text-slate-900" style={appBackgroundStyle}>
        <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center">
          <div className="mb-8">
            <p className="mb-3 text-sm font-bold text-slate-800">少年野球遠征配車</p>
            <h1 className="text-3xl font-black leading-tight">
              Supabaseで共有する配車管理
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-700">
              管理者はログインして全データを編集できます。保護者は共有URLから入力できます。
            </p>
          </div>
          <form onSubmit={handleLogin} className="rounded-lg bg-white p-5 shadow-soft">
            <label className="mb-2 block text-sm font-bold">メールアドレス</label>
            <input
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              className="mb-4 w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-night placeholder:text-slate-700 focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20"
            />
            <label className="mb-2 block text-sm font-bold">パスワード</label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
              className="mb-3 w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-night placeholder:text-slate-700 focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20"
            />
            {loginErrorEmail && (
              <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                送信したメールアドレス: {loginErrorEmail}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`w-full px-4 py-4 ${primaryButtonClass}`}
            >
              {loading ? "ログイン中..." : "管理者としてログイン"}
            </button>
          </form>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={goBack}
              className={backButtonClass}
            >
              戻る
            </button>
            <button
              type="button"
              onClick={goHome}
              className={homeButtonClass}
            >
              ホームに戻る
            </button>
          </div>
          {message && <p className="mt-4 text-sm font-bold text-rose-700">{message}</p>}
        </section>
      </main>
    );
  }

  if (screen === "parent") {
    const selectedGuardianAllocations = selectedGuardian
      ? eventAllocations.filter((car) =>
          car.player_ids.some((playerId) =>
            guardianPlayers.some((player) => player.id === playerId)
          )
        )
      : [];

    return (
      <main className="min-h-[100dvh] bg-chalk px-4 py-6 text-slate-900" style={appBackgroundStyle}>
        <section className="mx-auto max-w-md space-y-5">
          <div className="rounded-lg bg-white p-5 shadow-soft">
            <p className="text-sm font-bold text-slate-800">保護者用</p>
            <h1 className="mt-2 text-2xl font-black">出欠・車出し入力</h1>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              遠征を選び、ご自身の家庭の出欠と車出し可否を入力してください。
            </p>
          </div>

          {events.length === 0 && (
            <EmptyState
              title="遠征がまだ登録されていません。管理者が遠征を作成してください。"
              body="遠征が作成されると、この画面から出欠と車出し可否を入力できます。"
            />
          )}

          {events.length > 0 && (
            <div className="rounded-lg bg-white p-5 shadow-soft">
              <label className="mb-2 block text-sm font-bold">遠征イベント</label>
              <select
                value={selectedEventId ?? ""}
                onChange={(event) => {
                  setSelectedEventId(event.target.value || null);
                  setMessage("");
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-night focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} / {formatDate(event.starts_at)}
                  </option>
                ))}
              </select>
              {selectedEvent && (
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {selectedEvent.place} / {selectedEvent.event_type}
                </p>
              )}
            </div>
          )}

          {selectedEvent && guardians.length === 0 && (
            <EmptyState
              title="保護者がまだ登録されていません。管理者が保護者を登録してください。"
              body="保護者が登録されると、ここから家庭を選択できます。"
            />
          )}

          {selectedEvent && guardians.length > 0 && (
            <form onSubmit={handleParentSubmit} className="rounded-lg bg-white p-5 shadow-soft">
              <label className="mb-2 block text-sm font-bold">保護者</label>
              <select
                value={selectedGuardianId}
                onChange={(event) => {
                  const guardianId = event.target.value;
                  setSelectedGuardianId(guardianId);
                  setParentForm((current) => ({ ...current, guardianId }));
                  setMessage("");
                }}
                className="mb-4 w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-night focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20"
              >
                <option value="">保護者を選択</option>
                {guardians.map((guardian) => (
                  <option key={guardian.id} value={guardian.id}>
                    {guardian.name}
                  </option>
                ))}
              </select>

              {selectedGuardian && (
                <div className="space-y-5">
                  <div>
                    <h2 className="mb-3 text-lg font-black">選手ごとの参加可否</h2>
                    {guardianPlayers.length === 0 ? (
                      <EmptyState
                        title="選手がまだ登録されていません。管理者が選手を登録してください。"
                        body="管理者が選手管理で保護者を紐づけてください。"
                      />
                    ) : (
                      <div className="space-y-3">
                        {guardianPlayers.map((player) => {
                          const currentStatus =
                            parentForm.playerStatuses[player.id] ?? "未回答";

                          return (
                            <div
                              key={player.id}
                              className="rounded-md border border-slate-100 bg-slate-50 p-3"
                            >
                              <p className="mb-2 font-black">
                                {player.name} {normalizeGrade(player.grade)}
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {attendanceStatuses.map((status) => (
                                  <button
                                    type="button"
                                    key={status}
                                    onClick={() =>
                                      setParentForm((current) => ({
                                        ...current,
                                        playerStatuses: {
                                          ...current.playerStatuses,
                                          [player.id]: status
                                        }
                                      }))
                                    }
                                    className={`rounded-md border px-3 py-3 font-bold ${
                                      currentStatus === status
                                        ? statusStyles[status]
                                        : "border-slate-200 bg-white text-night hover:bg-slate-100 active:bg-slate-200"
                                    }`}
                                  >
                                    {status}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <h2 className="mb-3 text-lg font-black">保護者自身の参加可否</h2>
                    <div className="grid grid-cols-2 gap-2">
                      {attendanceStatuses.map((status) => (
                        <button
                          type="button"
                          key={status}
                          onClick={() =>
                            setParentForm((current) => ({
                              ...current,
                              guardianStatus: status
                            }))
                          }
                          className={`rounded-md border px-3 py-3 font-bold ${
                            parentForm.guardianStatus === status
                              ? statusStyles[status]
                              : "border-slate-200 bg-white text-night hover:bg-slate-100 active:bg-slate-200"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-3 font-bold text-night">
                    車出しできます
                    <input
                      checked={parentForm.canDrive}
                      onChange={(event) =>
                        setParentForm((current) => ({
                          ...current,
                          canDrive: event.target.checked
                        }))
                      }
                      type="checkbox"
                      className="h-6 w-6 accent-field"
                    />
                  </label>

                  {parentForm.canDrive && (
                    <div className="grid gap-3">
                      <input
                        value={parentForm.driverName}
                        onChange={(event) =>
                          setParentForm((current) => ({
                            ...current,
                            driverName: event.target.value
                          }))
                        }
                        placeholder="運転者名"
                        className={formFieldClass}
                      />
                      <input
                        value={parentForm.capacity}
                        onChange={(event) =>
                          setParentForm((current) => ({
                            ...current,
                            capacity: event.target.value
                          }))
                        }
                        type="number"
                        min="1"
                        placeholder="乗車可能人数"
                        className="rounded-md border border-slate-200 bg-white px-4 py-3 text-night placeholder:text-slate-700 focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20"
                      />
                    </div>
                  )}

                  <textarea
                    value={parentForm.note}
                    onChange={(event) =>
                      setParentForm((current) => ({ ...current, note: event.target.value }))
                    }
                    placeholder="備考"
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-night placeholder:text-slate-700 focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20"
                  />

                  <button
                    disabled={guardianPlayers.length === 0}
                    className={`w-full px-4 py-4 ${primaryButtonClass}`}
                  >
                    保存する
                  </button>
                </div>
              )}
            </form>
          )}

          {selectedEvent && (
            <div className="rounded-lg bg-white p-5 shadow-soft">
              <h2 className="text-lg font-black">配車結果</h2>
              {isAllocationConfirmed ? (
                selectedGuardian ? (
                  selectedGuardianAllocations.length > 0 ? (
                    <div className="mt-3">
                      <AllocationResult
                        allocations={selectedGuardianAllocations}
                        players={players}
                        guardians={guardians}
                        staff={staff}
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-slate-700">
                      この家庭の選手はまだ配車結果に入っていません。
                    </p>
                  )
                ) : (
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    保護者を選択すると配車結果を確認できます。
                  </p>
                )
              ) : (
                <p className="mt-3 rounded-md bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
                  配車はまだ確定していません
                </p>
              )}
            </div>
          )}

          {message && <p className="text-sm font-bold text-field">{message}</p>}
          <div className="grid gap-2">
            <button
              onClick={goBack}
              className={`w-full ${backButtonClass}`}
            >
              戻る
            </button>
            <button
              onClick={goHome}
              className={`w-full ${homeButtonClass}`}
            >
              ホームに戻る
            </button>
            {isAdmin && !isParentLinkMode && (
              <button
                onClick={() => navigateTo("home")}
                className={`w-full ${homeButtonClass}`}
              >
                管理者メニューへ戻る
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-chalk pb-28 text-slate-900" style={appBackgroundStyle}>
      <header className="sticky top-0 z-20 border-b border-black/5 bg-chalk/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-800">{adminEmail}</p>
            <h1 className="text-lg font-black">遠征配車管理</h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              onClick={goBack}
              className={backButtonClass}
            >
              戻る
            </button>
            <button
              onClick={goHome}
              className={homeButtonClass}
            >
              ホームに戻る
            </button>
            <button
              onClick={handleLogout}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-black text-night hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-200"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-5">
        {screen === "home" && (
          <div className="space-y-4">
            <DashboardCard
              label="保存先"
              title="Supabase共有モード"
              body="保護者入力、出欠、配車結果はSupabaseに保存され、別端末でも同じデータを確認できます。"
            />
            <div className="grid grid-cols-2 gap-3">
              <Metric label="遠征" value={`${events.length}件`} />
              <Metric label="選手" value={`${players.length}名`} />
              <Metric label="保護者" value={`${guardians.length}名`} />
              <Metric label="指導者" value={`${staff.length}名`} />
              <Metric label="配車" value={`${allocations.length}台`} />
            </div>
            <section className="rounded-lg bg-white p-4 shadow-soft">
              <h2 className="text-xl font-black">管理メニュー</h2>
              <div className="mt-4 grid gap-3">
                <AdminNavButton
                  title="遠征管理"
                  body="遠征・試合・練習の作成、編集、削除"
                  onClick={() => navigateTo("events")}
                />
                <AdminNavButton
                  title="保護者管理"
                  body="保護者情報と車出し初期設定の管理"
                  onClick={() => navigateTo("guardians")}
                />
                <AdminNavButton
                  title="選手管理"
                  body="選手、学年、保護者2名、兄弟3名の管理"
                  onClick={() => navigateTo("players")}
                />
                <AdminNavButton
                  title="指導者管理"
                  body="監督、コーチ、その他スタッフの登録と編集"
                  onClick={() => navigateTo("staff")}
                />
                <AdminNavButton
                  title="出欠・車出し回答管理"
                  body="保護者が入力した出欠、車出し、運転者、備考を確認・編集"
                  onClick={() => navigateTo("responses")}
                />
                <AdminNavButton
                  title="配車管理"
                  body="出欠回答から自動配車し、確定結果を保存"
                  onClick={() => navigateTo("carpool")}
                />
              </div>
            </section>
          </div>
        )}

        {screen === "events" && (
          <div className="space-y-5">
            <form onSubmit={handleCreateEvent} className="rounded-lg bg-white p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">遠征管理</h2>
                {editingEventId && (
                  <button
                    type="button"
                    onClick={resetEventForm}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-black text-night hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-200"
                  >
                    新規作成に戻る
                  </button>
                )}
              </div>
              <div className="grid gap-3">
                <input
                  value={eventForm.title}
                  onChange={(event) =>
                    setEventForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="イベント名"
                  className={formFieldClass}
                />
                <select
                  value={eventForm.eventType}
                  onChange={(event) =>
                    setEventForm((current) => ({
                      ...current,
                      eventType: event.target.value as EventType
                    }))
                  }
                  className={formFieldClass}
                >
                  <option>練習</option>
                  <option>試合</option>
                  <option>遠征</option>
                </select>
                <input
                  value={eventForm.startsAt}
                  onChange={(event) =>
                    setEventForm((current) => ({ ...current, startsAt: event.target.value }))
                  }
                  type="datetime-local"
                  className={formFieldClass}
                />
                <input
                  value={eventForm.place}
                  onChange={(event) =>
                    setEventForm((current) => ({ ...current, place: event.target.value }))
                  }
                  placeholder="場所"
                  className={formFieldClass}
                />
                <button className="rounded-md bg-yellow-200 px-4 py-4 font-bold text-night hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300 active:bg-yellow-400">
                  {editingEventId ? "遠征を更新" : "Supabaseにイベント保存"}
                </button>
              </div>
            </form>

            {events.length === 0 && (
              <EmptyState
                title="遠征がまだ登録されていません。管理者が遠征を作成してください。"
                body="作成すると保護者への参加確認URL、出欠入力、配車管理が使えるようになります。"
              />
            )}

            {events.map((event) => (
              <article key={event.id} className="rounded-lg bg-white p-4 shadow-soft">
                <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-night">
                  {event.event_type}
                </span>
                <h3 className="mt-3 text-lg font-black">{event.title}</h3>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDate(event.starts_at)} / {event.place}
                </p>
                <p className="mt-2 break-all rounded-md bg-slate-50 p-2 text-xs font-bold text-slate-700">
                  {shareUrl(event.id)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSelectedEventId(event.id);
                      navigateTo("parent");
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-3 font-bold text-night hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-200"
                  >
                    入力画面
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEventId(event.id);
                      navigateTo("carpool");
                    }}
                    className={carpoolActionButtonClass}
                  >
                    配車
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEventId(event.id);
                      navigateTo("summary");
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-3 font-bold text-night hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-200"
                  >
                    集計
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEventId(event.id);
                      void copyShareText(event);
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-3 font-bold text-night hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-200"
                  >
                    LINE文コピー
                  </button>
                  <button
                    onClick={() => startEditEvent(event)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-3 font-bold text-night hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-200"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="rounded-md border border-rose-200 bg-white px-3 py-3 font-bold text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200 active:bg-rose-100"
                  >
                    イベント削除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {screen === "guardians" && (
          <div className="space-y-5">
            <HeaderBlock
              label="管理者設定"
              title="保護者管理"
              body="Excelのように一覧表から保護者情報を直接編集できます。"
            />
            <div className="rounded-lg bg-white p-4 shadow-soft">
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" onClick={addGuardianDraft} className={addButtonClass}>
                  保護者を追加
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById("guardian-import-input")?.click()}
                  className={addButtonClass}
                >
                  Excelから保護者をインポート
                </button>
                <input
                  id="guardian-import-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleGuardianImportFile}
                />
                <button type="button" onClick={downloadGuardianTemplate} className={templateButtonClass}>
                  保護者Excelテンプレートをダウンロード
                </button>
                <button type="button" onClick={saveAllGuardianDrafts} className={secondaryButtonClass}>
                  すべて保存
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1120px] border-collapse text-night">
                  <thead>
                    <tr>
                      <th className={tableHeaderClass}>保護者氏名</th>
                      <th className={tableHeaderClass}>メールアドレス</th>
                      <th className={tableHeaderClass}>電話番号</th>
                      <th className={tableHeaderClass}>車出し初期可否</th>
                      <th className={tableHeaderClass}>乗車可能人数</th>
                      <th className={tableHeaderClass}>備考</th>
                      <th className={tableHeaderClass}>紐づく選手</th>
                      <th className={tableHeaderClass}>保存</th>
                      <th className={tableHeaderClass}>削除</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guardianDrafts.length === 0 && (
                      <tr>
                        <td colSpan={9} className="border border-slate-200 bg-white px-3 py-5 text-center text-sm font-bold text-slate-700">
                          保護者がまだ登録されていません。管理者が保護者を登録してください。
                        </td>
                      </tr>
                    )}
                    {guardianDrafts.map((draft) => {
                      const linkedPlayers = players.filter((player) =>
                        isGuardianLinkedToPlayer(player, draft.id, playerGuardians)
                      );

                      return (
                        <tr key={draft.localId}>
                          <td className={tableCellClass}>
                            <input
                              value={draft.name}
                              onChange={(event) => updateGuardianDraft(draft.localId, { name: event.target.value })}
                              className={tableInputClass}
                              placeholder="保護者氏名"
                            />
                          </td>
                          <td className={tableCellClass}>
                            <input
                              value={draft.email}
                              onChange={(event) => updateGuardianDraft(draft.localId, { email: event.target.value })}
                              className={tableInputClass}
                              type="email"
                              placeholder="mail@example.com"
                            />
                          </td>
                          <td className={tableCellClass}>
                            <input
                              value={draft.phone}
                              onChange={(event) => updateGuardianDraft(draft.localId, { phone: event.target.value })}
                              className={tableInputClass}
                              placeholder="電話番号"
                            />
                          </td>
                          <td className={`${tableCellClass} text-center`}>
                            <input
                              checked={draft.canDrive}
                              onChange={(event) => updateGuardianDraft(draft.localId, { canDrive: event.target.checked })}
                              type="checkbox"
                              className="h-6 w-6 accent-field"
                              aria-label="車出し初期可否"
                            />
                          </td>
                          <td className={tableCellClass}>
                            <input
                              value={draft.capacity}
                              onChange={(event) => updateGuardianDraft(draft.localId, { capacity: event.target.value })}
                              className="w-full min-w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-night focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20"
                              type="number"
                              min="1"
                            />
                          </td>
                          <td className={tableCellClass}>
                            <textarea
                              value={draft.note}
                              onChange={(event) => updateGuardianDraft(draft.localId, { note: event.target.value })}
                              className={`${tableInputClass} min-w-48`}
                              rows={2}
                              placeholder="備考"
                            />
                          </td>
                          <td className={tableCellClass}>
                            <div className="flex min-w-44 flex-wrap gap-1">
                              {linkedPlayers.length === 0 && (
                                <span className="text-xs font-bold text-slate-700">未設定</span>
                              )}
                              {linkedPlayers.map((player) => (
                                <span key={player.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-night">
                                  {player.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className={tableCellClass}>
                            <button type="button" onClick={() => saveGuardianDraft(draft)} className={primaryButtonClass}>
                              保存
                            </button>
                          </td>
                          <td className={tableCellClass}>
                            <button type="button" onClick={() => deleteGuardianDraft(draft)} className={dangerButtonClass}>
                              削除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {screen === "players" && (
          <div className="space-y-5">
            <HeaderBlock
              label="管理者設定"
              title="選手管理"
              body="Excelのように一覧表から選手と親子関係を直接編集できます。"
            />
            <div className="rounded-lg bg-white p-4 shadow-soft">
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" onClick={addPlayerDraft} className={addButtonClass}>
                  選手を追加
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById("player-import-input")?.click()}
                  className={addButtonClass}
                >
                  Excelから選手をインポート
                </button>
                <input
                  id="player-import-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handlePlayerImportFile}
                />
                <button type="button" onClick={downloadPlayerTemplate} className={templateButtonClass}>
                  選手Excelテンプレートをダウンロード
                </button>
                <button type="button" onClick={saveAllPlayerDrafts} className={secondaryButtonClass}>
                  すべて保存
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1420px] border-collapse text-night">
                  <thead>
                    <tr>
                      <th className={tableHeaderClass}>選手氏名</th>
                      <th className={tableHeaderClass}>学年</th>
                      <th className={tableHeaderClass}>保護者1</th>
                      <th className={tableHeaderClass}>保護者2</th>
                      <th className={tableHeaderClass}>兄弟1</th>
                      <th className={tableHeaderClass}>兄弟2</th>
                      <th className={tableHeaderClass}>兄弟3</th>
                      <th className={tableHeaderClass}>保存</th>
                      <th className={tableHeaderClass}>削除</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerDrafts.length === 0 && (
                      <tr>
                        <td colSpan={9} className="border border-slate-200 bg-white px-3 py-5 text-center text-sm font-bold text-slate-700">
                          選手がまだ登録されていません。管理者が選手を登録してください。
                        </td>
                      </tr>
                    )}
                    {playerDrafts.map((draft) => (
                      <tr key={draft.localId}>
                        <td className={tableCellClass}>
                          <input
                            value={draft.name}
                            onChange={(event) => updatePlayerDraft(draft.localId, { name: event.target.value })}
                            className={tableInputClass}
                            placeholder="選手氏名"
                          />
                        </td>
                        <td className={tableCellClass}>
                          <select
                            value={normalizeGrade(draft.grade)}
                            onChange={(event) => updatePlayerDraft(draft.localId, { grade: event.target.value })}
                            className={tableSelectClass}
                          >
                            {gradeOptions.map((grade) => (
                              <option key={grade} value={grade}>
                                {grade}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={tableCellClass}>
                          <select
                            value={draft.guardianId1}
                            onChange={(event) => {
                              const nextGuardianId = event.target.value;
                              updatePlayerDraft(draft.localId, {
                                guardianId1: nextGuardianId,
                                guardianId2:
                                  nextGuardianId && nextGuardianId === draft.guardianId2
                                    ? ""
                                    : draft.guardianId2
                              });
                            }}
                            className={`${tableSelectClass} min-w-44`}
                          >
                            <option value="">未紐づけ（保護者を選択）</option>
                            {guardians.map((guardian) => (
                              <option key={guardian.id} value={guardian.id}>
                                {guardian.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={tableCellClass}>
                          <select
                            value={draft.guardianId2}
                            onChange={(event) => {
                              const nextGuardianId = event.target.value;
                              updatePlayerDraft(draft.localId, {
                                guardianId2:
                                  nextGuardianId && nextGuardianId === draft.guardianId1
                                    ? ""
                                    : nextGuardianId
                              });
                            }}
                            className={`${tableSelectClass} min-w-44`}
                          >
                            <option value="">未設定</option>
                            {guardians
                              .filter((guardian) => guardian.id !== draft.guardianId1)
                              .map((guardian) => (
                                <option key={guardian.id} value={guardian.id}>
                                  {guardian.name}
                                </option>
                              ))}
                          </select>
                        </td>
                        {[1, 2, 3].map((order) => {
                          const field = `siblingId${order}` as "siblingId1" | "siblingId2" | "siblingId3";
                          const selectedSiblingIds = [
                            draft.siblingId1,
                            draft.siblingId2,
                            draft.siblingId3
                          ].filter(Boolean);

                          return (
                            <td key={field} className={tableCellClass}>
                              <select
                                value={draft[field]}
                                onChange={(event) => {
                                  const nextSiblingId = event.target.value;
                                  updatePlayerDraft(draft.localId, {
                                    [field]:
                                      nextSiblingId &&
                                      selectedSiblingIds.includes(nextSiblingId) &&
                                      draft[field] !== nextSiblingId
                                        ? ""
                                        : nextSiblingId
                                  } as Partial<PlayerDraft>);
                                }}
                                className={`${tableSelectClass} min-w-40`}
                              >
                                <option value="">未設定</option>
                                {players
                                  .filter(
                                    (player) =>
                                      player.id !== draft.id &&
                                      (!selectedSiblingIds.includes(player.id) || player.id === draft[field])
                                  )
                                  .map((player) => (
                                    <option key={player.id} value={player.id}>
                                      {player.name}
                                    </option>
                                  ))}
                              </select>
                            </td>
                          );
                        })}
                        <td className={tableCellClass}>
                          <button type="button" onClick={() => savePlayerDraft(draft)} className={primaryButtonClass}>
                            保存
                          </button>
                        </td>
                        <td className={tableCellClass}>
                          <button type="button" onClick={() => deletePlayerDraft(draft)} className={dangerButtonClass}>
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {screen === "staff" && (
          <div className="space-y-5">
            <HeaderBlock
              label="管理者設定"
              title="指導者管理"
              body="監督、コーチ、その他スタッフをExcelのような表で登録・編集できます。"
            />
            <div className="rounded-lg bg-white p-4 shadow-soft">
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <button type="button" onClick={addStaffDraft} className={addButtonClass}>
                  指導者を追加
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById("staff-import-input")?.click()}
                  className={addButtonClass}
                >
                  Excelから指導者をインポート
                </button>
                <input
                  id="staff-import-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleStaffImportFile}
                />
                <button type="button" onClick={downloadStaffTemplate} className={templateButtonClass}>
                  指導者Excelテンプレートをダウンロード
                </button>
                <button type="button" onClick={saveAllStaffDrafts} className={secondaryButtonClass}>
                  すべて保存
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[920px] border-collapse text-night">
                  <thead>
                    <tr>
                      <th className={tableHeaderClass}>氏名</th>
                      <th className={tableHeaderClass}>役割</th>
                      <th className={tableHeaderClass}>電話番号</th>
                      <th className={tableHeaderClass}>備考</th>
                      <th className={tableHeaderClass}>保存</th>
                      <th className={tableHeaderClass}>削除</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffDrafts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="border border-slate-200 bg-white px-3 py-5 text-center text-sm font-bold text-slate-700">
                          指導者がまだ登録されていません。管理者が指導者を登録してください。
                        </td>
                      </tr>
                    )}
                    {staffDrafts.map((draft) => (
                      <tr key={draft.localId}>
                        <td className={tableCellClass}>
                          <input
                            value={draft.name}
                            onChange={(event) => updateStaffDraft(draft.localId, { name: event.target.value })}
                            className={tableInputClass}
                            placeholder="指導者氏名"
                          />
                        </td>
                        <td className={tableCellClass}>
                          <select
                            value={draft.role}
                            onChange={(event) =>
                              updateStaffDraft(draft.localId, { role: event.target.value as StaffRole })
                            }
                            className={tableSelectClass}
                          >
                            {staffRoleOptions.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={tableCellClass}>
                          <input
                            value={draft.phone}
                            onChange={(event) => updateStaffDraft(draft.localId, { phone: event.target.value })}
                            className={tableInputClass}
                            placeholder="電話番号"
                          />
                        </td>
                        <td className={tableCellClass}>
                          <textarea
                            value={draft.note}
                            onChange={(event) => updateStaffDraft(draft.localId, { note: event.target.value })}
                            className={`${tableInputClass} min-w-48`}
                            rows={2}
                            placeholder="備考"
                          />
                        </td>
                        <td className={tableCellClass}>
                          <button type="button" onClick={() => saveStaffDraft(draft)} className={primaryButtonClass}>
                            保存
                          </button>
                        </td>
                        <td className={tableCellClass}>
                          <button type="button" onClick={() => deleteStaffDraft(draft)} className={dangerButtonClass}>
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {screen === "responses" && (
          <div className="space-y-5">
            <HeaderBlock
              label="管理者設定"
              title="出欠・車出し回答管理"
              body="保護者が入力した選手の参加可否、保護者参加、車出し、運転者、備考を編集できます。"
            />

            {events.length === 0 && (
              <EmptyState
                title="遠征がまだ登録されていません。管理者が遠征を作成してください。"
                body="遠征がないため、出欠・車出し回答は確認できません。"
              />
            )}

            {events.length > 0 && (
              <div className="rounded-lg bg-white p-4 shadow-soft">
                <label className="mb-2 block text-sm font-bold">確認する遠征</label>
                <select
                  value={selectedEventId ?? ""}
                  onChange={(event) => setSelectedEventId(event.target.value || null)}
                  className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-night focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20"
                >
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} / {formatDate(event.starts_at)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedEvent && players.length === 0 && (
              <EmptyState
                title="選手がまだ登録されていません。管理者が選手を登録してください。"
                body="選手を登録すると、ここで出欠・車出し回答を確認できます。"
              />
            )}

            {selectedEvent && players.length > 0 && (
              <div className="space-y-3">
                {players.map((player) => {
                  const row = eventAttendance.find((item) => item.player_id === player.id);
                  const guardian = getGuardian(
                    guardians,
                    getPlayerGuardianIds(player, playerGuardians)[0] ?? null
                  );

                  return (
                    <form
                      key={`${selectedEvent.id}-${player.id}-${row?.updated_at ?? "new"}`}
                      onSubmit={(event) => handleAdminAttendanceSubmit(event, player)}
                      className="rounded-lg bg-white p-4 shadow-soft"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black">
                            {player.name} {normalizeGrade(player.grade)}
                          </h3>
                          <p className="mt-1 text-sm text-slate-700">
                            保護者: {guardian?.name ?? "未設定"}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-700">
                            {row?.submitted_at
                              ? `最終回答: ${formatDate(row.submitted_at)}`
                              : "未回答"}
                          </p>
                        </div>
                        <span
                          className={`rounded-md border px-3 py-1 text-sm font-bold ${
                            statusStyles[row?.status ?? "未回答"]
                          }`}
                        >
                          {row?.status ?? "未回答"}
                        </span>
                      </div>

                      <div className="grid gap-3">
                        <label className="grid gap-1 text-sm font-bold">
                          選手の参加可否
                          <select
                            name="status"
                            defaultValue={row?.status ?? "未回答"}
                            className={formFieldClass}
                          >
                            {attendanceStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="grid gap-1 text-sm font-bold">
                          保護者自身の参加可否
                          <select
                            name="guardian_status"
                            defaultValue={row?.guardian_status ?? "未回答"}
                            className={formFieldClass}
                          >
                            {attendanceStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-3 font-bold text-night">
                          車出し可
                          <input
                            name="guardian_can_drive"
                            type="checkbox"
                            defaultChecked={
                              row?.guardian_can_drive ?? guardian?.can_drive_default ?? false
                            }
                            className="h-6 w-6 accent-field"
                          />
                        </label>

                        <input
                          name="car_capacity"
                          type="number"
                          min="1"
                          defaultValue={row?.car_capacity ?? guardian?.car_capacity_default ?? 4}
                          placeholder="乗車可能人数"
                          className={formFieldClass}
                        />
                        <input
                          name="driver_name"
                          defaultValue={row?.driver_name ?? guardian?.name ?? ""}
                          placeholder="運転者名"
                          className={formFieldClass}
                        />
                        <textarea
                          name="note"
                          defaultValue={row?.note ?? ""}
                          rows={2}
                          placeholder="備考"
                          className={formFieldClass}
                        />
                        <button className={primaryButtonClass}>
                          回答を保存
                        </button>
                      </div>
                    </form>
                  );
                })}
              </div>
            )}

            {selectedEvent && (
              <div className="rounded-lg bg-white p-4 shadow-soft">
                <h3 className="text-lg font-black">指導者の参加・車出し</h3>
                <p className="mt-1 text-sm text-slate-700">
                  指導者は指導者用車両にまとめて配車され、子どもは乗せません。
                </p>
                {staff.length === 0 ? (
                  <div className="mt-3">
                    <EmptyState
                      title="指導者がまだ登録されていません。管理者が指導者を登録してください。"
                      body="指導者管理で監督・コーチ・スタッフを登録できます。"
                    />
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {staff.map((staffMember) => {
                      const row = eventStaffAttendance.find(
                        (item) => item.staff_id === staffMember.id
                      );

                      return (
                        <form
                          key={`${selectedEvent.id}-${staffMember.id}-${row?.updated_at ?? "new"}`}
                          onSubmit={(event) => handleStaffAttendanceSubmit(event, staffMember)}
                          className="rounded-md border border-slate-100 bg-slate-50 p-3"
                        >
                          <div className="mb-3">
                            <h4 className="font-black">
                              {staffMember.role} {staffMember.name}
                            </h4>
                            <p className="text-xs font-bold text-slate-700">
                              {row ? "回答済み" : "未回答"}
                            </p>
                          </div>
                          <div className="grid gap-3">
                            <select
                              name="attendance_status"
                              defaultValue={row?.attendance_status ?? "未回答"}
                              className={formFieldClass}
                            >
                              {attendanceStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                            <label className="flex items-center justify-between rounded-md bg-white px-3 py-3 font-bold text-night">
                              車出し可
                              <input
                                name="can_drive"
                                type="checkbox"
                                defaultChecked={row?.can_drive ?? false}
                                className="h-6 w-6 accent-field"
                              />
                            </label>
                            <input
                              name="capacity"
                              type="number"
                              min="1"
                              defaultValue={row?.capacity ?? 4}
                              placeholder="乗車可能人数"
                              className={formFieldClass}
                            />
                            <input
                              name="driver_name"
                              defaultValue={row?.driver_name ?? staffMember.name}
                              placeholder="運転者名"
                              className={formFieldClass}
                            />
                            <textarea
                              name="note"
                              defaultValue={row?.note ?? ""}
                              rows={2}
                              placeholder="備考"
                              className={formFieldClass}
                            />
                            <button className={primaryButtonClass}>指導者回答を保存</button>
                          </div>
                        </form>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {screen === "carpool" && !selectedEvent && (
          <EmptyState
            title="遠征がまだ登録されていません。管理者が遠征を作成してください。"
            body="遠征がないため、自動配車、配車確定、配車編集は実行できません。"
          />
        )}

        {screen === "carpool" && selectedEvent && (
          <div className="space-y-5">
            <HeaderBlock
              label="管理者配車"
              title={selectedEvent.title}
              body={`${formatDate(selectedEvent.starts_at)} / ${selectedEvent.place}`}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="対象" value={`${rideTargetPlayers.length}名`} />
              <Metric label="未割当" value={`${unassignedPlayers.length}名`} />
              <Metric label="車両" value={`${eventAllocations.length}台`} />
              <Metric
                label="指導者"
                value={`${eventStaffAttendance.filter((row) => row.attendance_status === "参加").length}名`}
              />
            </div>
            <div className="rounded-lg bg-white p-4 shadow-soft">
              <h3 className="font-black">回答から配車表を作成</h3>
              <p className="mt-1 text-sm text-slate-700">
                車出し可能な保護者回答を車両にし、自動配車します。
              </p>
              <button
                onClick={createRidePlanFromResponses}
                disabled={isAllocationConfirmed}
                className={`mt-4 w-full ${carpoolActionButtonClass}`}
              >
                回答から配車表を作成
              </button>
              {isAllocationConfirmed ? (
                <button
                  onClick={reopenRidePlanForEdit}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 font-bold text-night hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-200"
                >
                  配車完了後に修正する
                </button>
              ) : (
                <button
                  onClick={completeRidePlan}
                  disabled={eventAllocations.length === 0}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 font-bold text-night hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-700"
                >
                  配車確定
                </button>
              )}
            </div>

            <form onSubmit={handleCreateCar} className="rounded-lg bg-white p-4 shadow-soft">
              <h3 className="mb-3 font-black">車両を手動追加</h3>
              <div className="grid gap-3">
                <input
                  value={carForm.driverName}
                  onChange={(event) =>
                    setCarForm((current) => ({ ...current, driverName: event.target.value }))
                  }
                  placeholder="運転者名"
                  className={formFieldClass}
                />
                <input
                  value={carForm.carName}
                  onChange={(event) =>
                    setCarForm((current) => ({ ...current, carName: event.target.value }))
                  }
                  placeholder="車両名"
                  className={formFieldClass}
                />
                <input
                  value={carForm.capacity}
                  onChange={(event) =>
                    setCarForm((current) => ({ ...current, capacity: event.target.value }))
                  }
                  type="number"
                  min="1"
                  className={formFieldClass}
                />
                <button
                  disabled={isAllocationConfirmed}
                  className={carpoolActionButtonClass}
                >
                  車両追加
                </button>
              </div>
            </form>

            <form onSubmit={handleCreateCargoCar} className="rounded-lg bg-white p-4 shadow-soft">
              <h3 className="mb-3 font-black">荷物車を追加</h3>
              <p className="mb-3 text-sm text-slate-700">
                荷物車には子どもを割り当てません。運転手は必須で、可能なら保護者を1名同乗に設定してください。
              </p>
              <div className="grid gap-3">
                <input
                  value={cargoForm.driverName}
                  onChange={(event) =>
                    setCargoForm((current) => ({ ...current, driverName: event.target.value }))
                  }
                  placeholder="荷物車の運転手名"
                  className={formFieldClass}
                />
                <input
                  value={cargoForm.carName}
                  onChange={(event) =>
                    setCargoForm((current) => ({ ...current, carName: event.target.value }))
                  }
                  placeholder="車両名"
                  className={formFieldClass}
                />
                <select
                  value={cargoForm.passengerGuardianId}
                  onChange={(event) =>
                    setCargoForm((current) => ({
                      ...current,
                      passengerGuardianId: event.target.value
                    }))
                  }
                  className={formFieldClass}
                >
                  <option value="">同乗保護者を選択（任意）</option>
                  {guardians.map((guardian) => (
                    <option key={guardian.id} value={guardian.id}>
                      {guardian.name}
                    </option>
                  ))}
                </select>
                <textarea
                  value={cargoForm.cargoNote}
                  onChange={(event) =>
                    setCargoForm((current) => ({ ...current, cargoNote: event.target.value }))
                  }
                  rows={3}
                  placeholder="荷物内容（テント、救急箱、ボールケースなど）"
                  className={formFieldClass}
                />
                <button disabled={isAllocationConfirmed} className={carpoolActionButtonClass}>
                  荷物車を追加
                </button>
              </div>
            </form>

            <div className="rounded-lg bg-white p-4 shadow-soft">
              <h3 className="mb-3 font-black">自動配車条件</h3>
              <AutoAssignToggle
                checked={autoAssignOptions.rideWithParentDriver}
                label="運転手の子どもを同じ車にする"
                onChange={(checked) =>
                  setAutoAssignOptions((current) => ({
                    ...current,
                    rideWithParentDriver: checked
                  }))
                }
              />
              <AutoAssignToggle
                checked={autoAssignOptions.keepSiblingsTogether}
                label="兄弟は同じ車にする"
                onChange={(checked) =>
                  setAutoAssignOptions((current) => ({
                    ...current,
                    keepSiblingsTogether: checked
                  }))
                }
              />
              <AutoAssignToggle
                checked={autoAssignOptions.preferSameGrade}
                label="学年が同じ選手を優先して同乗にする"
                onChange={(checked) =>
                  setAutoAssignOptions((current) => ({
                    ...current,
                    preferSameGrade: checked
                  }))
                }
              />
              <button
                onClick={autoAssignExistingCars}
                disabled={eventAllocations.length === 0 || isAllocationConfirmed}
                className={`mt-3 w-full ${carpoolActionButtonClass}`}
              >
                既存車両で自動配車
              </button>
              <button
                onClick={copyRidePlanText}
                disabled={eventAllocations.length === 0}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-4 py-3 font-bold text-night hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-700"
              >
                配車表LINE文コピー
              </button>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-soft">
              <h3 className="mb-3 font-black">選手割当</h3>
              <div className="space-y-3">
                {players.map((player) => {
                  const row = eventAttendance.find((item) => item.player_id === player.id);
                  const assignedCar = eventAllocations.find((car) =>
                    car.player_ids.includes(player.id)
                  );
                  return (
                    <div key={player.id} className="grid gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          {player.name} {normalizeGrade(player.grade)}
                        </span>
                        <span
                          className={`rounded-md border px-3 py-1 text-sm font-bold ${
                            statusStyles[row?.status ?? "未回答"]
                          }`}
                        >
                          {row?.status ?? "未回答"}
                        </span>
                      </div>
                      <select
                        value={assignedCar?.id ?? ""}
                        onChange={(event) => assignPlayerToCar(player.id, event.target.value)}
                        disabled={row?.status === "欠席" || isAllocationConfirmed}
                        className="rounded-md border border-slate-200 bg-white px-4 py-3 text-night focus:border-field focus:outline-none focus:ring-2 focus:ring-field/20 disabled:bg-slate-100 disabled:text-slate-700"
                      >
                        <option value="">未割当</option>
                        {eventAllocations
                          .filter((car) => (car.vehicle_type ?? "regular") === "regular")
                          .map((car) => (
                          <option key={car.id} value={car.id}>
                            {car.car_name}（{car.driver_name}）
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <AllocationResult
              allocations={eventAllocations}
              players={players}
              guardians={guardians}
              staff={staff}
              onDelete={deleteCar}
              onUpdateCargo={updateCargoCar}
              locked={isAllocationConfirmed}
            />
          </div>
        )}

        {screen === "summary" && !selectedEvent && (
          <EmptyState
            title="遠征がまだ登録されていません。管理者が遠征を作成してください。"
            body="遠征を作成すると、参加・欠席・遅刻・未回答の集計を確認できます。"
          />
        )}

        {screen === "summary" && selectedEvent && (
          <div className="space-y-5">
            <HeaderBlock
              label="参加人数集計"
              title={selectedEvent.title}
              body={`${formatDate(selectedEvent.starts_at)} / ${selectedEvent.place}`}
            />
            <div className="grid grid-cols-2 gap-3">
              {(["参加", "欠席", "遅刻", "未回答"] as AttendanceStatus[]).map(
                (status) => (
                  <Metric key={status} label={status} value={`${summary[status]}名`} />
                )
              )}
            </div>
          </div>
        )}
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white px-3 pb-3 pt-3">
        <div className="mx-auto grid max-w-3xl grid-cols-6 gap-2">
          <TabButton active={screen === "home"} onClick={() => navigateTo("home")}>
            ホーム
          </TabButton>
          <TabButton active={screen === "events"} onClick={() => navigateTo("events")}>
            遠征
          </TabButton>
          <TabButton active={screen === "responses"} onClick={() => navigateTo("responses")}>
            回答
          </TabButton>
          <TabButton active={screen === "staff"} onClick={() => navigateTo("staff")}>
            指導者
          </TabButton>
          <TabButton active={screen === "carpool"} onClick={() => navigateTo("carpool")}>
            配車
          </TabButton>
          <TabButton active={screen === "summary"} onClick={() => navigateTo("summary")}>
            集計
          </TabButton>
        </div>
      </nav>
    </main>
  );
}

function AdminNavButton({
  title,
  body,
  onClick
}: {
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-left text-night hover:bg-white focus:outline-none focus:ring-2 focus:ring-field/30 active:bg-slate-100"
    >
      <span className="block text-base font-black text-night">{title}</span>
      <span className="mt-1 block text-sm leading-5 text-slate-700">{body}</span>
    </button>
  );
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center shadow-soft">
      <p className="text-base font-black text-slate-800">{title}</p>
      {body && <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>}
    </div>
  );
}

function DashboardCard({
  label,
  title,
  body
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-soft">
      <p className="text-sm font-bold text-slate-800">{label}</p>
      <h2 className="mt-1 text-2xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
    </div>
  );
}

function HeaderBlock({
  label,
  title,
  body
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p className="text-sm font-bold text-slate-800">{label}</p>
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-1 text-sm text-slate-700">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-soft">
      <p className="text-sm font-bold text-slate-700">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function AllocationResult({
  allocations,
  players,
  guardians = [],
  staff = [],
  locked,
  onDelete,
  onUpdateCargo
}: {
  allocations: AllocationRow[];
  players: PlayerRow[];
  guardians?: GuardianRow[];
  staff?: StaffRow[];
  locked?: boolean;
  onDelete?: (id: string) => void;
  onUpdateCargo?: (
    id: string,
    payload: {
      carName: string;
      driverName: string;
      passengerGuardianId: string;
      cargoNote: string;
    }
  ) => void;
}) {
  if (allocations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center shadow-soft">
        <p className="text-base font-black text-slate-900">配車結果はまだありません。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allocations.map((car) => {
        const vehicleType = car.vehicle_type ?? "regular";
        const passengerCount =
          vehicleType === "staff"
            ? car.staff_ids.length
            : vehicleType === "cargo"
              ? car.passenger_guardian_ids.length
              : car.player_ids.length;
        const label =
          vehicleType === "staff"
            ? "指導者用車両"
            : vehicleType === "cargo"
              ? "荷物車"
              : "通常車";

        return (
          <article key={car.id} className="rounded-lg bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-night">
                  {label}
                </span>
                <h3 className="mt-2 text-lg font-black">{car.car_name}</h3>
                <p className="mt-1 text-sm text-slate-700">運転者: {car.driver_name}</p>
                {vehicleType === "cargo" && (
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    荷物: {car.cargo_note || "未設定"}
                  </p>
                )}
              </div>
              {onDelete && (
                <button
                  disabled={locked}
                  onClick={() => onDelete(car.id)}
                  className={dangerButtonClass}
                >
                  削除
                </button>
              )}
            </div>
            <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
              {passengerCount} / {car.capacity}名
            </div>
            <div className="flex flex-wrap gap-2">
              {vehicleType === "regular" && car.player_ids.length === 0 && (
                <span className="text-sm font-bold text-slate-700">未割当</span>
              )}
              {vehicleType === "regular" &&
                car.player_ids.map((playerId) => {
                  const player = players.find((item) => item.id === playerId);
                  return (
                    <span
                      key={playerId}
                      className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-night"
                    >
                      {player?.name ?? "不明"}
                    </span>
                  );
                })}
              {vehicleType === "staff" &&
                (car.staff_ids.length > 0 ? (
                  car.staff_ids.map((staffId) => {
                    const staffMember = staff.find((item) => item.id === staffId);
                    return (
                      <span
                        key={staffId}
                        className="rounded-md bg-sky-100 px-3 py-2 text-sm font-bold text-night"
                      >
                        {staffMember ? `${staffMember.role} ${staffMember.name}` : "不明"}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-sm font-bold text-slate-700">未割当</span>
                ))}
              {vehicleType === "cargo" &&
                (car.passenger_guardian_ids.length > 0 ? (
                  car.passenger_guardian_ids.map((guardianId) => {
                    const guardian = guardians.find((item) => item.id === guardianId);
                    return (
                      <span
                        key={guardianId}
                        className="rounded-md bg-amber-100 px-3 py-2 text-sm font-bold text-night"
                      >
                        同乗: {guardian?.name ?? "不明"}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-sm font-bold text-slate-700">同乗保護者未設定</span>
                ))}
            </div>
            {vehicleType === "cargo" && onUpdateCargo && (
              <form
                className="mt-4 grid gap-2 rounded-md bg-amber-50 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  onUpdateCargo(car.id, {
                    carName: String(formData.get("car_name") ?? ""),
                    driverName: String(formData.get("driver_name") ?? ""),
                    passengerGuardianId: String(formData.get("passenger_guardian_id") ?? ""),
                    cargoNote: String(formData.get("cargo_note") ?? "")
                  });
                }}
              >
                <input
                  name="car_name"
                  defaultValue={car.car_name}
                  disabled={locked}
                  className={formFieldClass}
                  placeholder="車両名"
                />
                <input
                  name="driver_name"
                  defaultValue={car.driver_name}
                  disabled={locked}
                  className={formFieldClass}
                  placeholder="運転手"
                />
                <select
                  name="passenger_guardian_id"
                  defaultValue={car.passenger_guardian_ids[0] ?? ""}
                  disabled={locked}
                  className={formFieldClass}
                >
                  <option value="">同乗保護者を選択（任意）</option>
                  {guardians.map((guardian) => (
                    <option key={guardian.id} value={guardian.id}>
                      {guardian.name}
                    </option>
                  ))}
                </select>
                <textarea
                  name="cargo_note"
                  defaultValue={car.cargo_note ?? ""}
                  disabled={locked}
                  rows={2}
                  className={formFieldClass}
                  placeholder="荷物内容"
                />
                <button disabled={locked} className={primaryButtonClass}>
                  荷物車を保存
                </button>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}

function AutoAssignToggle({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="mb-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-3">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
        className="h-6 w-6 accent-field"
      />
    </label>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-3 text-sm font-black focus:outline-none focus:ring-2 focus:ring-field/30 ${
        active
          ? "border-yellow-300 bg-yellow-200 text-night hover:bg-yellow-300 active:bg-yellow-400"
          : "border-slate-200 bg-white text-night hover:bg-slate-100 active:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
