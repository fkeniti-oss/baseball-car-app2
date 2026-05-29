"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import type {
  AllocationRow,
  AttendanceRow,
  AttendanceStatus,
  EventRow,
  EventType,
  GuardianRow,
  PlayerRow
} from "@/lib/types/database";

type Screen =
  | "landing"
  | "adminLogin"
  | "home"
  | "events"
  | "guardians"
  | "players"
  | "responses"
  | "parent"
  | "carpool"
  | "summary";
type AutoAssignOptions = {
  preferSameGrade: boolean;
  keepSiblingsTogether: boolean;
  rideWithParentDriver: boolean;
};

const statusStyles: Record<AttendanceStatus, string> = {
  "参加": "bg-field text-white border-field",
  "欠席": "bg-white text-rose-700 border-rose-200",
  "遅刻": "bg-amber-100 text-amber-900 border-amber-200",
  "未回答": "bg-white text-slate-500 border-slate-200"
};

const attendanceStatuses: AttendanceStatus[] = ["参加", "欠席", "遅刻", "未回答"];

const initialEventForm = {
  title: "",
  eventType: "遠征" as EventType,
  startsAt: "",
  place: ""
};

const initialGuardianForm = {
  id: "",
  name: "",
  email: "",
  phone: "",
  canDrive: false,
  capacity: "4"
};

const initialPlayerForm = {
  id: "",
  name: "",
  grade: "",
  guardianId: "",
  familyGroup: ""
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

function isParentDriver(car: AllocationRow, player: PlayerRow) {
  return (
    car.driver_name.includes(player.name) ||
    car.driver_name.includes(player.parent_name) ||
    player.parent_name.includes(car.driver_name)
  );
}

function splitIntoGroups(players: PlayerRow[], options: AutoAssignOptions) {
  if (!options.keepSiblingsTogether) {
    return players.map((player) => [player]);
  }

  const groups = players.reduce<Record<string, PlayerRow[]>>((result, player) => {
    result[player.family_group] = [...(result[player.family_group] ?? []), player];
    return result;
  }, {});

  return Object.values(groups).sort((a, b) => b.length - a.length);
}

function findBestCarIndex(
  cars: AllocationRow[],
  group: PlayerRow[],
  players: PlayerRow[],
  options: AutoAssignOptions
) {
  const groupGrades = new Set(group.map((player) => player.grade));

  const scored = cars
    .map((car, index) => {
      const remainingSeats = car.capacity - car.player_ids.length;
      if (remainingSeats < group.length) return null;

      const driverScore =
        options.rideWithParentDriver &&
        group.some((player) => isParentDriver(car, player))
          ? 100
          : 0;
      const gradeScore =
        options.preferSameGrade &&
        car.player_ids.some((playerId) => {
          const player = getPlayer(players, playerId);
          return player ? groupGrades.has(player.grade) : false;
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
  options: AutoAssignOptions
) {
  const emptyCars = baseCars.map((car) => ({ ...car, player_ids: [] as string[] }));
  const sortedPlayers = [...targetPlayers].sort(
    (a, b) => b.grade - a.grade || a.name.localeCompare(b.name, "ja")
  );
  const groups = splitIntoGroups(sortedPlayers, options);
  const remainingGroups: PlayerRow[][] = [];

  groups.forEach((group) => {
    const carIndex = options.rideWithParentDriver
      ? emptyCars.findIndex(
          (car) =>
            group.some((player) => isParentDriver(car, player)) &&
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
    const carIndex = findBestCarIndex(emptyCars, group, allPlayers, options);
    if (carIndex >= 0) {
      emptyCars[carIndex].player_ids.push(...group.map((player) => player.id));
    }
  });

  return emptyCars;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [adminEmail, setAdminEmail] = useState(defaultAdminEmail);
  const [password, setPassword] = useState("");
  const [loginErrorEmail, setLoginErrorEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedGuardianId, setSelectedGuardianId] = useState("");
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [guardianForm, setGuardianForm] = useState(initialGuardianForm);
  const [playerForm, setPlayerForm] = useState(initialPlayerForm);
  const [parentForm, setParentForm] = useState(initialParentForm);
  const [carForm, setCarForm] = useState({
    driverName: "",
    carName: "",
    capacity: "4"
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
  const selectedGuardian = guardians.find((guardian) => guardian.id === selectedGuardianId);
  const guardianPlayers = useMemo(
    () =>
      selectedGuardian
        ? players.filter((player) => player.guardian_id === selectedGuardian.id)
        : [],
    [players, selectedGuardian]
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");
    const guardianId = params.get("guardian");
    const mode = params.get("mode");

    if (eventId) setSelectedEventId(eventId);
    if (guardianId) setSelectedGuardianId(guardianId);
    if (mode === "parent") setScreen("parent");

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
      attendanceResult,
      allocationsResult
    ] = await Promise.all([
      supabase.from("events").select("*").order("starts_at", { ascending: true }),
      supabase.from("guardians").select("*").order("name", { ascending: true }),
      supabase.from("players").select("*").order("grade", { ascending: false }),
      supabase.from("attendance").select("*"),
      supabase.from("allocations").select("*").order("sort_order", { ascending: true })
    ]);

    if (eventsResult.error) setMessage(`遠征データの取得に失敗しました: ${eventsResult.error.message}`);
    if (guardiansResult.error) setMessage(`保護者データの取得に失敗しました: ${guardiansResult.error.message}`);
    if (playersResult.error) setMessage(`選手データの取得に失敗しました: ${playersResult.error.message}`);
    if (attendanceResult.error) setMessage(`出欠データの取得に失敗しました: ${attendanceResult.error.message}`);
    if (allocationsResult.error) setMessage(`配車データの取得に失敗しました: ${allocationsResult.error.message}`);
    const loadedEvents = (eventsResult.data ?? []) as EventRow[];
    const loadedGuardians = (guardiansResult.data ?? []) as GuardianRow[];
    const loadedPlayers = (playersResult.data ?? []) as PlayerRow[];
    const loadedAttendance = (attendanceResult.data ?? []) as AttendanceRow[];
    const loadedAllocations = (allocationsResult.data ?? []) as AllocationRow[];
    setEvents(loadedEvents);
    setGuardians(loadedGuardians);
    setPlayers(loadedPlayers);
    setAttendance(loadedAttendance);
    setAllocations(loadedAllocations);

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
    setScreen("home");
    await loadSessionAndData();
  }

  async function handleLogout() {
    await supabase?.auth.signOut();
    setIsAdmin(false);
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
    setScreen("events");
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
      setScreen("events");
    }
    setMessage("遠征を削除しました。");
    await loadSessionAndData(nextEventId);
  }

  async function handleGuardianSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    if (!guardianForm.name.trim() || !guardianForm.email.trim()) {
      setMessage("保護者名とメールアドレスを入力してください。");
      return;
    }

    const payload = {
      name: guardianForm.name.trim(),
      email: guardianForm.email.trim(),
      phone: guardianForm.phone.trim() || null,
      can_drive_default: guardianForm.canDrive,
      car_capacity_default: Math.max(Number(guardianForm.capacity) || 1, 1)
    };

    const result = guardianForm.id
      ? await supabase.from("guardians").update(payload).eq("id", guardianForm.id)
      : await supabase.from("guardians").insert(payload);

    if (result.error) {
      setMessage(`保護者の保存に失敗しました: ${result.error.message}`);
      return;
    }

    setGuardianForm(initialGuardianForm);
    setMessage(guardianForm.id ? "保護者を更新しました。" : "保護者を追加しました。");
    await loadSessionAndData(selectedEventId);
  }

  function startEditGuardian(guardian: GuardianRow) {
    setGuardianForm({
      id: guardian.id,
      name: guardian.name,
      email: guardian.email,
      phone: guardian.phone ?? "",
      canDrive: guardian.can_drive_default,
      capacity: String(guardian.car_capacity_default)
    });
    setScreen("guardians");
  }

  async function deleteGuardian(guardianId: string) {
    if (!supabase || !isAdmin) return;
    const guardian = guardians.find((item) => item.id === guardianId);
    const linkedPlayers = players.filter((player) => player.guardian_id === guardianId);
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

    if (guardianForm.id === guardianId) setGuardianForm(initialGuardianForm);
    setMessage("保護者を削除しました。");
    await loadSessionAndData(selectedEventId);
  }

  async function handlePlayerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    if (!playerForm.name.trim()) {
      setMessage("選手名を入力してください。");
      return;
    }

    const selectedGuardianForPlayer = guardians.find(
      (guardian) => guardian.id === playerForm.guardianId
    );
    const payload = {
      name: playerForm.name.trim(),
      grade: Math.max(Number(playerForm.grade) || 0, 0),
      guardian_id: playerForm.guardianId || null,
      family_group: playerForm.familyGroup.trim() || playerForm.name.trim(),
      parent_name: selectedGuardianForPlayer?.name ?? ""
    };

    const result = playerForm.id
      ? await supabase.from("players").update(payload).eq("id", playerForm.id)
      : await supabase.from("players").insert(payload);

    if (result.error) {
      setMessage(`選手の保存に失敗しました: ${result.error.message}`);
      return;
    }

    setPlayerForm(initialPlayerForm);
    setMessage(playerForm.id ? "選手を更新しました。" : "選手を追加しました。");
    await loadSessionAndData(selectedEventId);
  }

  function startEditPlayer(player: PlayerRow) {
    setPlayerForm({
      id: player.id,
      name: player.name,
      grade: String(player.grade),
      guardianId: player.guardian_id ?? "",
      familyGroup: player.family_group
    });
    setScreen("players");
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

    if (playerForm.id === playerId) setPlayerForm(initialPlayerForm);
    setMessage("選手を削除しました。");
    await loadSessionAndData(selectedEventId);
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
    const guardian = getGuardian(guardians, player.guardian_id);
    const canDrive = formData.get("guardian_can_drive") === "on";
    const driverName = String(formData.get("driver_name") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    const { error } = await supabase.from("attendance").upsert(
      {
        event_id: selectedEvent.id,
        player_id: player.id,
        guardian_id: player.guardian_id,
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

  async function updateAttendanceStatus(playerId: string, status: AttendanceStatus) {
    if (!supabase || !selectedEvent || !isAdmin) return;

    const player = getPlayer(players, playerId);
    const { error } = await supabase
      .from("attendance")
      .upsert(
        {
          event_id: selectedEvent.id,
          player_id: playerId,
          guardian_id: player?.guardian_id ?? null,
          status,
          submitted_at: new Date().toISOString()
        },
        { onConflict: "event_id,player_id" }
      );

    if (error) setMessage(error.message);
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
      sort_order: eventAllocations.length
    });

    if (error) setMessage(error.message);
    setCarForm({ driverName: "", carName: "", capacity: "4" });
    await loadSessionAndData(selectedEvent.id);
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

    const baseCars = driverRows.map((row, index) => ({
      id: crypto.randomUUID(),
      event_id: selectedEvent.id,
      guardian_id: row.guardian_id,
      driver_name: row.driver_name || getGuardian(guardians, row.guardian_id)?.name || "運転者",
      car_name: `${index + 1}号車`,
      capacity: row.car_capacity,
      player_ids: [] as string[],
      sort_order: index,
      created_at: "",
      updated_at: ""
    }));

    const assignedCars = createAutoAssignedCars(
      baseCars,
      rideTargetPlayers,
      players,
      autoAssignOptions
    );

    await supabase.from("allocations").delete().eq("event_id", selectedEvent.id);
    if (assignedCars.length === 0) {
      setMessage("車出し可能な回答がありません。");
      await loadSessionAndData(selectedEvent.id);
      return;
    }

    const { error } = await supabase.from("allocations").insert(
      assignedCars.map((car, index) => ({
        event_id: selectedEvent.id,
        guardian_id: car.guardian_id,
        driver_name: car.driver_name,
        car_name: car.car_name,
        capacity: car.capacity,
        player_ids: car.player_ids,
        sort_order: index
      }))
    );

    if (error) setMessage(error.message);
    await loadSessionAndData(selectedEvent.id);
  }

  async function autoAssignExistingCars() {
    if (!supabase || !selectedEvent || !isAdmin || isAllocationConfirmed) return;
    const client = supabase;

    const assignedCars = createAutoAssignedCars(
      eventAllocations,
      rideTargetPlayers,
      players,
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
    const lines = [
      `【${selectedEvent.title} 配車表】`,
      `${formatDate(selectedEvent.starts_at)} / ${selectedEvent.place}`,
      "",
      ...eventAllocations.flatMap((car) => [
        `${car.car_name}（運転者: ${car.driver_name} / ${car.player_ids.length}/${car.capacity}名）`,
        car.player_ids
          .map((playerId) => getPlayer(players, playerId)?.name ?? "不明")
          .join("、") || "未割当",
        ""
      ])
    ];
    await navigator.clipboard.writeText(lines.join("\n").trim());
    setMessage("配車表のLINE共有テキストをコピーしました。");
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-chalk px-4 py-10">
        <section className="mx-auto max-w-md rounded-lg bg-white p-5 shadow-soft">
          <h1 className="text-xl font-black">Supabase設定が必要です</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と
            `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。
          </p>
        </section>
      </main>
    );
  }

  if (screen === "landing") {
    return (
      <main className="min-h-[100dvh] bg-chalk px-4 py-8" style={appBackgroundStyle}>
        <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center">
          <div className="mb-8">
            <p className="mb-3 text-sm font-bold text-clay">少年野球遠征配車</p>
            <h1 className="text-3xl font-black leading-tight">使う画面を選んでください</h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              保護者は遠征を選んで出欠と車出し可否を入力できます。管理者はログインして遠征、保護者、選手、配車を管理します。
            </p>
          </div>
          <div className="grid gap-4">
            <button
              type="button"
              onClick={() => {
                setMessage("");
                if (!selectedEventId && events[0]) setSelectedEventId(events[0].id);
                setScreen("parent");
              }}
              className="rounded-lg bg-field px-5 py-7 text-left text-white shadow-soft"
            >
              <span className="block text-2xl font-black">保護者用</span>
              <span className="mt-2 block text-sm font-bold opacity-90">
                遠征を選んで、家庭の出欠・車出しを入力
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setScreen(isAdmin ? "home" : "adminLogin");
              }}
              className="rounded-lg bg-night px-5 py-7 text-left text-white shadow-soft"
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
      <main className="min-h-[100dvh] bg-chalk px-4 py-8" style={appBackgroundStyle}>
        <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center">
          <div className="mb-8">
            <p className="mb-3 text-sm font-bold text-clay">少年野球遠征配車</p>
            <h1 className="text-3xl font-black leading-tight">
              Supabaseで共有する配車管理
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
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
              className="mb-4 w-full rounded-md border border-slate-200 px-4 py-3"
            />
            <label className="mb-2 block text-sm font-bold">パスワード</label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
              className="mb-3 w-full rounded-md border border-slate-200 px-4 py-3"
            />
            {loginErrorEmail && (
              <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                送信したメールアドレス: {loginErrorEmail}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-field px-4 py-4 font-bold text-white disabled:bg-slate-300"
            >
              {loading ? "ログイン中..." : "管理者としてログイン"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setScreen("landing")}
            className="mt-3 w-full rounded-md border border-slate-200 bg-white px-4 py-3 font-bold"
          >
            最初の画面へ戻る
          </button>
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
      <main className="min-h-[100dvh] bg-chalk px-4 py-6" style={appBackgroundStyle}>
        <section className="mx-auto max-w-md space-y-5">
          <div className="rounded-lg bg-white p-5 shadow-soft">
            <p className="text-sm font-bold text-clay">保護者用</p>
            <h1 className="mt-2 text-2xl font-black">出欠・車出し入力</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
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
                className="w-full rounded-md border border-slate-200 px-4 py-3"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} / {formatDate(event.starts_at)}
                  </option>
                ))}
              </select>
              {selectedEvent && (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {selectedEvent.place} / {selectedEvent.event_type}
                </p>
              )}
            </div>
          )}

          {selectedEvent && guardians.length === 0 && (
            <EmptyState
              title="保護者がまだ登録されていません。"
              body="管理者が保護者を登録すると、ここから家庭を選択できます。"
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
                className="mb-4 w-full rounded-md border border-slate-200 px-4 py-3"
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
                        title="この保護者に紐づく選手がいません。"
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
                                {player.name} {player.grade}年
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
                                        : "border-slate-200 bg-white text-slate-600"
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
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-3 font-bold">
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
                        className="rounded-md border border-slate-200 px-4 py-3"
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
                        className="rounded-md border border-slate-200 px-4 py-3"
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
                    className="w-full rounded-md border border-slate-200 px-4 py-3"
                  />

                  <button
                    disabled={guardianPlayers.length === 0}
                    className="w-full rounded-md bg-field px-4 py-4 font-bold text-white disabled:bg-slate-300"
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
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-slate-500">
                      この家庭の選手はまだ配車結果に入っていません。
                    </p>
                  )
                ) : (
                  <p className="mt-3 text-sm font-bold text-slate-500">
                    保護者を選択すると配車結果を確認できます。
                  </p>
                )
              ) : (
                <p className="mt-3 rounded-md bg-slate-50 px-3 py-3 text-sm font-bold text-slate-600">
                  配車はまだ確定していません
                </p>
              )}
            </div>
          )}

          {message && <p className="text-sm font-bold text-field">{message}</p>}
          {!isParentLinkMode && (
            <div className="grid gap-2">
              <button
                onClick={() => setScreen("landing")}
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 font-bold"
              >
                最初の画面へ戻る
              </button>
              {isAdmin && (
                <button
                  onClick={() => setScreen("home")}
                  className="w-full rounded-md bg-night px-4 py-3 font-bold text-white"
                >
                  管理者メニューへ戻る
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-chalk pb-28" style={appBackgroundStyle}>
      <header className="sticky top-0 z-20 border-b border-black/5 bg-chalk/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs font-bold text-clay">{adminEmail}</p>
            <h1 className="text-lg font-black">遠征配車管理</h1>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
          >
            ログアウト
          </button>
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
              <Metric label="配車" value={`${allocations.length}台`} />
            </div>
            <section className="rounded-lg bg-white p-4 shadow-soft">
              <h2 className="text-xl font-black">管理メニュー</h2>
              <div className="mt-4 grid gap-3">
                <AdminNavButton
                  title="遠征管理"
                  body="遠征・試合・練習の作成、編集、削除"
                  onClick={() => setScreen("events")}
                />
                <AdminNavButton
                  title="保護者管理"
                  body="保護者情報と車出し初期設定の管理"
                  onClick={() => setScreen("guardians")}
                />
                <AdminNavButton
                  title="選手管理"
                  body="選手、学年、保護者、兄弟グループの管理"
                  onClick={() => setScreen("players")}
                />
                <AdminNavButton
                  title="出欠・車出し回答管理"
                  body="保護者が入力した出欠、車出し、運転者、備考を確認・編集"
                  onClick={() => setScreen("responses")}
                />
                <AdminNavButton
                  title="配車管理"
                  body="出欠回答から自動配車し、確定結果を保存"
                  onClick={() => setScreen("carpool")}
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
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
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
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <select
                  value={eventForm.eventType}
                  onChange={(event) =>
                    setEventForm((current) => ({
                      ...current,
                      eventType: event.target.value as EventType
                    }))
                  }
                  className="rounded-md border border-slate-200 px-4 py-3"
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
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <input
                  value={eventForm.place}
                  onChange={(event) =>
                    setEventForm((current) => ({ ...current, place: event.target.value }))
                  }
                  placeholder="場所"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <button className="rounded-md bg-night px-4 py-4 font-bold text-white">
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
                <span className="rounded-md bg-clay px-2 py-1 text-xs font-bold text-white">
                  {event.event_type}
                </span>
                <h3 className="mt-3 text-lg font-black">{event.title}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDate(event.starts_at)} / {event.place}
                </p>
                <p className="mt-2 break-all rounded-md bg-slate-50 p-2 text-xs font-bold text-slate-600">
                  {shareUrl(event.id)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setScreen("parent");
                    }}
                    className="rounded-md border border-slate-200 bg-white px-3 py-3 font-bold"
                  >
                    入力画面
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setScreen("carpool");
                    }}
                    className="rounded-md bg-field px-3 py-3 font-bold text-white"
                  >
                    配車
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setScreen("summary");
                    }}
                    className="rounded-md border border-slate-200 bg-white px-3 py-3 font-bold"
                  >
                    集計
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEventId(event.id);
                      void copyShareText(event);
                    }}
                    className="rounded-md border border-slate-200 bg-white px-3 py-3 font-bold"
                  >
                    LINE文コピー
                  </button>
                  <button
                    onClick={() => startEditEvent(event)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-3 font-bold"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="rounded-md border border-rose-100 bg-white px-3 py-3 font-bold text-rose-700"
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
              body="保護者の連絡先、車出し初期設定、乗車可能人数をSupabaseに保存します。"
            />
            <form onSubmit={handleGuardianSubmit} className="rounded-lg bg-white p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-lg font-black">
                  {guardianForm.id ? "保護者を編集" : "保護者を追加"}
                </h3>
                {guardianForm.id && (
                  <button
                    type="button"
                    onClick={() => setGuardianForm(initialGuardianForm)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                  >
                    新規追加に戻る
                  </button>
                )}
              </div>
              <div className="grid gap-3">
                <input
                  value={guardianForm.name}
                  onChange={(event) =>
                    setGuardianForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="保護者名"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <input
                  value={guardianForm.email}
                  onChange={(event) =>
                    setGuardianForm((current) => ({ ...current, email: event.target.value }))
                  }
                  type="email"
                  placeholder="メールアドレス"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <input
                  value={guardianForm.phone}
                  onChange={(event) =>
                    setGuardianForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="電話番号"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <label className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-3 font-bold">
                  車出し初期可否
                  <input
                    checked={guardianForm.canDrive}
                    onChange={(event) =>
                      setGuardianForm((current) => ({
                        ...current,
                        canDrive: event.target.checked
                      }))
                    }
                    type="checkbox"
                    className="h-6 w-6 accent-field"
                  />
                </label>
                <input
                  value={guardianForm.capacity}
                  onChange={(event) =>
                    setGuardianForm((current) => ({ ...current, capacity: event.target.value }))
                  }
                  type="number"
                  min="1"
                  placeholder="乗車可能人数"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <button className="rounded-md bg-field px-4 py-4 font-bold text-white">
                  {guardianForm.id ? "保護者を更新" : "保護者を追加"}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {guardians.length === 0 && (
                <EmptyState
                  title="保護者がまだ登録されていません。"
                  body="保護者を追加すると、参加確認URLから出欠と車出し可否を入力できるようになります。"
                />
              )}
              {guardians.map((guardian) => {
                const linkedPlayerCount = players.filter(
                  (player) => player.guardian_id === guardian.id
                ).length;

                return (
                  <article key={guardian.id} className="rounded-lg bg-white p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">{guardian.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{guardian.email}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {guardian.phone || "電話番号未登録"} / 選手 {linkedPlayerCount}名
                        </p>
                      </div>
                      <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-bold">
                        {guardian.can_drive_default
                          ? `${guardian.car_capacity_default}名`
                          : "車出しなし"}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => startEditGuardian(guardian)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-3 font-bold"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deleteGuardian(guardian.id)}
                        className="rounded-md border border-rose-100 bg-white px-3 py-3 font-bold text-rose-700"
                      >
                        削除
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {screen === "players" && (
          <div className="space-y-5">
            <HeaderBlock
              label="管理者設定"
              title="選手管理"
              body="選手名、学年、保護者、兄弟グループをSupabaseに保存します。"
            />
            <form onSubmit={handlePlayerSubmit} className="rounded-lg bg-white p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-lg font-black">
                  {playerForm.id ? "選手を編集" : "選手を追加"}
                </h3>
                {playerForm.id && (
                  <button
                    type="button"
                    onClick={() => setPlayerForm(initialPlayerForm)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                  >
                    新規追加に戻る
                  </button>
                )}
              </div>
              <div className="grid gap-3">
                <input
                  value={playerForm.name}
                  onChange={(event) =>
                    setPlayerForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="選手名"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <input
                  value={playerForm.grade}
                  onChange={(event) =>
                    setPlayerForm((current) => ({ ...current, grade: event.target.value }))
                  }
                  type="number"
                  min="0"
                  placeholder="学年"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <select
                  value={playerForm.guardianId}
                  onChange={(event) =>
                    setPlayerForm((current) => ({
                      ...current,
                      guardianId: event.target.value
                    }))
                  }
                  className="rounded-md border border-slate-200 px-4 py-3"
                >
                  <option value="">保護者を選択</option>
                  {guardians.map((guardian) => (
                    <option key={guardian.id} value={guardian.id}>
                      {guardian.name}
                    </option>
                  ))}
                </select>
                <input
                  value={playerForm.familyGroup}
                  onChange={(event) =>
                    setPlayerForm((current) => ({
                      ...current,
                      familyGroup: event.target.value
                    }))
                  }
                  placeholder="兄弟グループIDまたは兄弟グループ名"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <button className="rounded-md bg-field px-4 py-4 font-bold text-white">
                  {playerForm.id ? "選手を更新" : "選手を追加"}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {players.length === 0 && (
                <EmptyState
                  title="選手がまだ登録されていません。"
                  body="選手を追加すると、出欠入力と配車表の割り当て対象になります。"
                />
              )}
              {players.map((player) => {
                const guardian = getGuardian(guardians, player.guardian_id);

                return (
                  <article key={player.id} className="rounded-lg bg-white p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">
                          {player.name} {player.grade}年
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          保護者: {guardian?.name ?? "未設定"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          兄弟グループ: {player.family_group || "未設定"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => startEditPlayer(player)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-3 font-bold"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => deletePlayer(player.id)}
                        className="rounded-md border border-rose-100 bg-white px-3 py-3 font-bold text-rose-700"
                      >
                        削除
                      </button>
                    </div>
                  </article>
                );
              })}
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
                  className="w-full rounded-md border border-slate-200 px-4 py-3"
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
                title="選手がまだ登録されていません。"
                body="選手を登録すると、ここで出欠・車出し回答を確認できます。"
              />
            )}

            {selectedEvent && players.length > 0 && (
              <div className="space-y-3">
                {players.map((player) => {
                  const row = eventAttendance.find((item) => item.player_id === player.id);
                  const guardian = getGuardian(guardians, player.guardian_id);

                  return (
                    <form
                      key={`${selectedEvent.id}-${player.id}-${row?.updated_at ?? "new"}`}
                      onSubmit={(event) => handleAdminAttendanceSubmit(event, player)}
                      className="rounded-lg bg-white p-4 shadow-soft"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black">
                            {player.name} {player.grade}年
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            保護者: {guardian?.name ?? "未設定"}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
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
                            className="rounded-md border border-slate-200 px-4 py-3"
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
                            className="rounded-md border border-slate-200 px-4 py-3"
                          >
                            {attendanceStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-3 font-bold">
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
                          className="rounded-md border border-slate-200 px-4 py-3"
                        />
                        <input
                          name="driver_name"
                          defaultValue={row?.driver_name ?? guardian?.name ?? ""}
                          placeholder="運転者名"
                          className="rounded-md border border-slate-200 px-4 py-3"
                        />
                        <textarea
                          name="note"
                          defaultValue={row?.note ?? ""}
                          rows={2}
                          placeholder="備考"
                          className="rounded-md border border-slate-200 px-4 py-3"
                        />
                        <button className="rounded-md bg-field px-4 py-4 font-bold text-white">
                          回答を保存
                        </button>
                      </div>
                    </form>
                  );
                })}
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
            <div className="grid grid-cols-3 gap-3">
              <Metric label="対象" value={`${rideTargetPlayers.length}名`} />
              <Metric label="未割当" value={`${unassignedPlayers.length}名`} />
              <Metric label="車両" value={`${eventAllocations.length}台`} />
            </div>
            <div className="rounded-lg bg-white p-4 shadow-soft">
              <h3 className="font-black">回答から配車表を作成</h3>
              <p className="mt-1 text-sm text-slate-600">
                車出し可能な保護者回答を車両にし、自動配車します。
              </p>
              <button
                onClick={createRidePlanFromResponses}
                disabled={isAllocationConfirmed}
                className="mt-4 w-full rounded-md bg-field px-4 py-4 font-bold text-white disabled:bg-slate-300"
              >
                回答から配車表を作成
              </button>
              {isAllocationConfirmed ? (
                <button
                  onClick={reopenRidePlanForEdit}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 font-bold"
                >
                  配車完了後に修正する
                </button>
              ) : (
                <button
                  onClick={completeRidePlan}
                  disabled={eventAllocations.length === 0}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 font-bold disabled:text-slate-300"
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
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <input
                  value={carForm.carName}
                  onChange={(event) =>
                    setCarForm((current) => ({ ...current, carName: event.target.value }))
                  }
                  placeholder="車両名"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <input
                  value={carForm.capacity}
                  onChange={(event) =>
                    setCarForm((current) => ({ ...current, capacity: event.target.value }))
                  }
                  type="number"
                  min="1"
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
                <button
                  disabled={isAllocationConfirmed}
                  className="rounded-md bg-night px-4 py-4 font-bold text-white disabled:bg-slate-300"
                >
                  車両追加
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
                className="mt-3 w-full rounded-md bg-field px-4 py-4 font-bold text-white disabled:bg-slate-300"
              >
                既存車両で自動配車
              </button>
              <button
                onClick={copyRidePlanText}
                disabled={eventAllocations.length === 0}
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3 font-bold disabled:text-slate-300"
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
                          {player.name} {player.grade}年
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
                        className="rounded-md border border-slate-200 px-4 py-3 disabled:bg-slate-100"
                      >
                        <option value="">未割当</option>
                        {eventAllocations.map((car) => (
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
              onDelete={deleteCar}
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
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-2">
          <TabButton active={screen === "home"} onClick={() => setScreen("home")}>
            ホーム
          </TabButton>
          <TabButton active={screen === "events"} onClick={() => setScreen("events")}>
            遠征
          </TabButton>
          <TabButton active={screen === "responses"} onClick={() => setScreen("responses")}>
            回答
          </TabButton>
          <TabButton active={screen === "carpool"} onClick={() => setScreen("carpool")}>
            配車
          </TabButton>
          <TabButton active={screen === "summary"} onClick={() => setScreen("summary")}>
            集計
          </TabButton>
        </div>
      </nav>
    </main>
  );
}

function getBrandString(brand: unknown, keys: string[]) {
  if (typeof brand !== "object" || brand === null) return "";
  const brandRecord = brand as Record<string, unknown>;

  for (const key of keys) {
    const value = brandRecord[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function TeamLogo({
  brand,
  teamName,
  size = "md"
}: {
  brand?: unknown;
  teamName: string;
  size?: string;
}) {
  const logoUrl = getBrandString(brand, [
    "logoUrl",
    "logo_url",
    "logo",
    "teamLogoUrl",
    "team_logo_url",
    "imageUrl",
    "image_url"
  ]);
  const primaryColor = getBrandString(brand, [
    "primaryColor",
    "primary_color",
    "mainColor",
    "main_color"
  ]) || "#28745a";
  const accentColor = getBrandString(brand, [
    "accentColor",
    "accent_color",
    "secondaryColor",
    "secondary_color"
  ]) || "#b85f38";
  const sizeClass =
    {
      sm: "h-9 w-9 text-sm",
      md: "h-12 w-12 text-base",
      lg: "h-16 w-16 text-xl"
    }[size] ?? "h-12 w-12 text-base";
  const initial = teamName.trim().charAt(0) || "球";

  return (
    <div
      aria-label={`${teamName} ロゴ`}
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-cover bg-center font-black text-white shadow-soft`}
      style={
        logoUrl
          ? { backgroundImage: `url(${logoUrl})` }
          : { background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }
      }
      title={`${teamName} ロゴ`}
    >
      {!logoUrl && <span>{initial}</span>}
    </div>
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
      className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-left"
    >
      <span className="block text-base font-black text-night">{title}</span>
      <span className="mt-1 block text-sm leading-5 text-slate-600">{body}</span>
    </button>
  );
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center shadow-soft">
      <p className="text-base font-black text-slate-800">{title}</p>
      {body && <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>}
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
      <p className="text-sm font-bold text-clay">{label}</p>
      <h2 className="mt-1 text-2xl font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
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
      <p className="text-sm font-bold text-clay">{label}</p>
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-soft">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function AllocationResult({
  allocations,
  players,
  locked,
  onDelete
}: {
  allocations: AllocationRow[];
  players: PlayerRow[];
  locked?: boolean;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {allocations.map((car) => (
        <article key={car.id} className="rounded-lg bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">{car.car_name}</h3>
              <p className="mt-1 text-sm text-slate-600">運転者: {car.driver_name}</p>
            </div>
            {onDelete && (
              <button
                disabled={locked}
                onClick={() => onDelete(car.id)}
                className="rounded-md border border-rose-100 bg-white px-3 py-2 text-sm font-bold text-rose-700 disabled:text-slate-300"
              >
                削除
              </button>
            )}
          </div>
          <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
            {car.player_ids.length} / {car.capacity}名
          </div>
          <div className="flex flex-wrap gap-2">
            {car.player_ids.length === 0 && (
              <span className="text-sm font-bold text-slate-400">未割当</span>
            )}
            {car.player_ids.map((playerId) => {
              const player = players.find((item) => item.id === playerId);
              return (
                <span
                  key={playerId}
                  className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold"
                >
                  {player?.name ?? "不明"}
                </span>
              );
            })}
          </div>
        </article>
      ))}
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
      className={`rounded-md px-2 py-3 text-sm font-bold ${
        active ? "bg-night text-white" : "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}