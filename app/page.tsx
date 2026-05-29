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

type Screen = "login" | "home" | "events" | "parent" | "carpool" | "summary";
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
  canDrive: false,
  driverName: "",
  capacity: "4",
  note: ""
};

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
  const [screen, setScreen] = useState<Screen>("login");
  const [adminEmail, setAdminEmail] = useState("manager@example.com");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedGuardianId, setSelectedGuardianId] = useState("");
  const [eventForm, setEventForm] = useState(initialEventForm);
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

  const selectedEvent = events.find((event) => event.id === selectedEventId);
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
  const selectedAttendance = eventAttendance.find(
    (row) => row.player_id === parentForm.playerId
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
    setParentForm((current) => ({
      ...current,
      guardianId: selectedGuardian.id,
      playerId: firstPlayer?.id ?? "",
      driverName: selectedGuardian.name,
      canDrive: selectedGuardian.can_drive_default,
      capacity: String(selectedGuardian.car_capacity_default)
    }));
  }, [guardianPlayers, selectedGuardian]);

  useEffect(() => {
    if (!selectedAttendance) return;
    setParentForm((current) => ({
      ...current,
      status: selectedAttendance.status,
      canDrive: selectedAttendance.guardian_can_drive,
      driverName: selectedAttendance.driver_name ?? current.driverName,
      capacity: String(selectedAttendance.car_capacity),
      note: selectedAttendance.note ?? ""
    }));
  }, [selectedAttendance]);

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
    if (hasSession && !parentMode) setScreen("home");

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

    if (eventsResult.error) setMessage(eventsResult.error.message);
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

    const fallbackEventId = eventIdFromUrl ?? loadedEvents[0]?.id ?? "";
    const fallbackGuardianId = guardianIdFromUrl ?? loadedGuardians[0]?.id ?? "";
    setSelectedEventId((current) => current || fallbackEventId);
    setSelectedGuardianId((current) => current || fallbackGuardianId);
    setLoading(false);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase環境変数が未設定です。");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setIsAdmin(true);
    setScreen("home");
    await loadSessionAndData();
  }

  async function handleLogout() {
    await supabase?.auth.signOut();
    setIsAdmin(false);
    setScreen("login");
  }

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;

    const { data: userData } = await supabase.auth.getUser();
    const startsAt = new Date(eventForm.startsAt).toISOString();
    const { data, error } = await supabase
      .from("events")
      .insert({
        title: eventForm.title,
        event_type: eventForm.eventType,
        starts_at: startsAt,
        place: eventForm.place,
        created_by: userData.user?.id ?? null
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setEventForm(initialEventForm);
    await loadSessionAndData(data.id);
  }

  async function deleteEvent(eventId: string) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await loadSessionAndData();
  }

  async function handleParentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedEvent || !parentForm.playerId) return;

    const payload = {
      event_id: selectedEvent.id,
      player_id: parentForm.playerId,
      guardian_id: parentForm.guardianId || null,
      status: parentForm.status,
      guardian_can_drive: parentForm.canDrive,
      driver_name: parentForm.canDrive ? parentForm.driverName : null,
      car_capacity: Math.max(Number(parentForm.capacity) || 1, 1),
      note: parentForm.note || null,
      submitted_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("attendance")
      .upsert(payload, { onConflict: "event_id,player_id" });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("回答を保存しました。");
    await loadSessionAndData(selectedEvent.id, parentForm.guardianId, screen === "parent");
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

    const driverRows = eventAttendance.filter(
      (row) => row.guardian_can_drive && row.status !== "欠席"
    );

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

  if (screen === "login") {
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
              className="mb-4 w-full rounded-md border border-slate-200 px-4 py-3"
            />
            <label className="mb-2 block text-sm font-bold">パスワード</label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="mb-5 w-full rounded-md border border-slate-200 px-4 py-3"
            />
            <button
              disabled={loading}
              className="w-full rounded-md bg-field px-4 py-4 font-bold text-white disabled:bg-slate-300"
            >
              ログイン
            </button>
          </form>
          {message && <p className="mt-4 text-sm font-bold text-rose-700">{message}</p>}
        </section>
      </main>
    );
  }

  if (screen === "parent" && selectedEvent) {
    return (
      <main className="min-h-[100dvh] bg-chalk px-4 py-6" style={appBackgroundStyle}>
        <section className="mx-auto max-w-md space-y-5">
          <div className="rounded-lg bg-white p-5 shadow-soft">
            <p className="text-sm font-bold text-clay">保護者入力</p>
            <h1 className="mt-2 text-2xl font-black">{selectedEvent.title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {formatDate(selectedEvent.starts_at)} / {selectedEvent.place}
            </p>
          </div>

          <form onSubmit={handleParentSubmit} className="rounded-lg bg-white p-5 shadow-soft">
            <label className="mb-2 block text-sm font-bold">保護者</label>
            <select
              value={parentForm.guardianId}
              onChange={(event) => setSelectedGuardianId(event.target.value)}
              className="mb-4 w-full rounded-md border border-slate-200 px-4 py-3"
            >
              {guardians.map((guardian) => (
                <option key={guardian.id} value={guardian.id}>
                  {guardian.name}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-sm font-bold">選手</label>
            <select
              value={parentForm.playerId}
              onChange={(event) =>
                setParentForm((current) => ({ ...current, playerId: event.target.value }))
              }
              className="mb-4 w-full rounded-md border border-slate-200 px-4 py-3"
            >
              {guardianPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["参加", "欠席", "遅刻", "未回答"] as AttendanceStatus[]).map(
                (status) => (
                  <button
                    type="button"
                    key={status}
                    onClick={() => setParentForm((current) => ({ ...current, status }))}
                    className={`rounded-md border px-3 py-4 font-bold ${
                      parentForm.status === status
                        ? statusStyles[status]
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {status}
                  </button>
                )
              )}
            </div>

            <label className="mb-3 flex items-center justify-between rounded-md bg-slate-50 px-3 py-3 font-bold">
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
              <div className="mb-4 grid gap-3">
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
                  className="rounded-md border border-slate-200 px-4 py-3"
                />
              </div>
            )}

            <textarea
              value={parentForm.note}
              onChange={(event) =>
                setParentForm((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="連絡事項"
              rows={3}
              className="mb-4 w-full rounded-md border border-slate-200 px-4 py-3"
            />

            <button className="w-full rounded-md bg-field px-4 py-4 font-bold text-white">
              Supabaseに保存
            </button>
          </form>

          {isAllocationConfirmed && (
            <AllocationResult allocations={eventAllocations} players={players} />
          )}

          {message && <p className="text-sm font-bold text-field">{message}</p>}
          {!isParentLinkMode && (
            <button
              onClick={() => setScreen("events")}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 font-bold"
            >
              管理者画面へ戻る
            </button>
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
          </div>
        )}

        {screen === "events" && (
          <div className="space-y-5">
            <form onSubmit={handleCreateEvent} className="rounded-lg bg-white p-4 shadow-soft">
              <h2 className="mb-3 text-xl font-black">遠征・イベント作成</h2>
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
                  Supabaseにイベント保存
                </button>
              </div>
            </form>

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
                    onClick={() => deleteEvent(event.id)}
                    className="col-span-2 rounded-md border border-rose-100 bg-white px-3 py-3 font-bold text-rose-700"
                  >
                    イベント削除
                  </button>
                </div>
              </article>
            ))}
          </div>
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
          <TabButton active={screen === "parent"} onClick={() => setScreen("parent")}>
            入力
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