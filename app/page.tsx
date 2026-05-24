"use client";

import { useMemo, useRef, useState } from "react";

type AttendanceStatus = "未回答" | "参加" | "不参加";
type DriverAvailabilityStatus = "未回答" | "配車可" | "配車不可";

type GuardianInput = {
  id: number;
  name: string;
  capacity: string;
  availability: DriverAvailabilityStatus;
};

type Player = {
  id: number;
  name: string;
  grade: string;
  siblingGroup: string;
  parentGuardianName: string;
  attendance: AttendanceStatus;
};

type StaffRole = "監督" | "コーチ";

type StaffMember = {
  id: number;
  name: string;
  role: StaffRole;
  attendance: AttendanceStatus;
};

type AllocationResult = {
  id: number;
  guardianName: string;
  capacity: number;
  players: Player[];
  staff: StaffMember[];
};

type PlayerDraft = {
  name: string;
  grade: string;
  siblingGroup: string;
  parentGuardianName: string;
};

type StaffDraft = {
  name: string;
  role: StaffRole;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const getCarLoad = (car: AllocationResult) => car.players.length + car.staff.length;

const getRemainingSeats = (car: AllocationResult) => car.capacity - getCarLoad(car);

const INITIAL_PLAYER_DRAFT: PlayerDraft = {
  name: "",
  grade: "",
  siblingGroup: "",
  parentGuardianName: "",
};

const INITIAL_STAFF_DRAFT: StaffDraft = {
  name: "",
  role: "監督",
};

export default function Home() {
  const [expeditionName, setExpeditionName] = useState("");
  const [destination, setDestination] = useState("");

  const [guardians, setGuardians] = useState<GuardianInput[]>([
    { id: 1, name: "", capacity: "4", availability: "未回答" },
  ]);

  const [playerMaster, setPlayerMaster] = useState<Player[]>([]);
  const [playerDraft, setPlayerDraft] = useState<PlayerDraft>(INITIAL_PLAYER_DRAFT);

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffDraft, setStaffDraft] = useState<StaffDraft>(INITIAL_STAFF_DRAFT);

  const [allocation, setAllocation] = useState<AllocationResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const guardianIdRef = useRef(2);
  const playerIdRef = useRef(1);
  const staffIdRef = useRef(1);

  const participatingPlayers = useMemo(
    () => playerMaster.filter((player) => player.attendance === "参加"),
    [playerMaster],
  );

  const participatingStaff = useMemo(
    () => staffMembers.filter((staff) => staff.attendance === "参加"),
    [staffMembers],
  );

  const addGuardian = () => {
    setGuardians((prev) => [
      ...prev,
      {
        id: guardianIdRef.current,
        name: "",
        capacity: "4",
        availability: "未回答",
      },
    ]);
    guardianIdRef.current += 1;
  };

  const removeGuardian = (id: number) => {
    setGuardians((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((guardian) => guardian.id !== id);
    });
  };

  const updateGuardian = (
    id: number,
    key: keyof Omit<GuardianInput, "id">,
    value: string,
  ) => {
    setGuardians((prev) =>
      prev.map((guardian) =>
        guardian.id === id ? { ...guardian, [key]: value } : guardian,
      ),
    );
  };

  const registerPlayer = () => {
    const name = playerDraft.name.trim();
    const grade = playerDraft.grade.trim();

    if (!name || !grade) {
      setErrorMessage("選手の登録には「名前」と「学年」が必要です。");
      return;
    }

    setErrorMessage("");
    setPlayerMaster((prev) => [
      ...prev,
      {
        id: playerIdRef.current,
        name,
        grade,
        siblingGroup: playerDraft.siblingGroup.trim(),
        parentGuardianName: playerDraft.parentGuardianName.trim(),
        attendance: "未回答",
      },
    ]);
    playerIdRef.current += 1;
    setPlayerDraft(INITIAL_PLAYER_DRAFT);
  };

  const removePlayer = (id: number) => {
    setPlayerMaster((prev) => prev.filter((player) => player.id !== id));
  };

  const updatePlayerAttendance = (id: number, status: AttendanceStatus) => {
    setPlayerMaster((prev) =>
      prev.map((player) =>
        player.id === id ? { ...player, attendance: status } : player,
      ),
    );
  };

  const registerStaff = () => {
    const name = staffDraft.name.trim();

    if (!name) {
      setErrorMessage("監督・コーチの登録には名前が必要です。");
      return;
    }

    setErrorMessage("");
    setStaffMembers((prev) => [
      ...prev,
      {
        id: staffIdRef.current,
        name,
        role: staffDraft.role,
        attendance: "未回答",
      },
    ]);
    staffIdRef.current += 1;
    setStaffDraft(INITIAL_STAFF_DRAFT);
  };

  const removeStaff = (id: number) => {
    setStaffMembers((prev) => prev.filter((staff) => staff.id !== id));
  };

  const updateStaffAttendance = (id: number, status: AttendanceStatus) => {
    setStaffMembers((prev) =>
      prev.map((staff) => (staff.id === id ? { ...staff, attendance: status } : staff)),
    );
  };

  const handleAutoAllocate = () => {
    setErrorMessage("");
    setCopyMessage("");

    const normalizedGuardians: {
      id: number;
      name: string;
      capacity: number;
      availability: DriverAvailabilityStatus;
    }[] = [];

    // 車情報の入力を検証し、配車に使う形式へ変換します。
    for (const guardian of guardians) {
      const name = guardian.name.trim();
      const capacityText = guardian.capacity.trim();

      if (name === "" && capacityText === "") {
        continue;
      }

      if (name === "" || capacityText === "") {
        setAllocation([]);
        setErrorMessage("保護者名と定員はセットで入力してください。");
        return;
      }

      const capacity = Number(capacityText);
      if (!Number.isInteger(capacity) || capacity <= 0) {
        setAllocation([]);
        setErrorMessage("定員は1以上の整数で入力してください。");
        return;
      }

      normalizedGuardians.push({
        id: guardian.id,
        name,
        capacity,
        availability: guardian.availability,
      });
    }

    const availableGuardians = normalizedGuardians.filter(
      (guardian) => guardian.availability === "配車可",
    );

    if (availableGuardians.length === 0) {
      setAllocation([]);
      setErrorMessage("配車可能（配車可）の保護者を1名以上設定してください。");
      return;
    }

    const guardianNameToIndex = new Map<string, number>();
    for (const guardian of availableGuardians) {
      const normalizedName = normalizeText(guardian.name);
      if (guardianNameToIndex.has(normalizedName)) {
        setAllocation([]);
        setErrorMessage(
          "配車可の保護者名が重複しています。重複しない名前にしてください。",
        );
        return;
      }
      guardianNameToIndex.set(normalizedName, guardianNameToIndex.size);
    }

    if (participatingPlayers.length === 0 && participatingStaff.length === 0) {
      setAllocation([]);
      setErrorMessage("参加者がいません。選手・監督・コーチの参加可否を入力してください。");
      return;
    }

    const totalPassengers = participatingPlayers.length + participatingStaff.length;
    const totalCapacity = availableGuardians.reduce(
      (sum, guardian) => sum + guardian.capacity,
      0,
    );

    if (totalPassengers > totalCapacity) {
      setAllocation([]);
      setErrorMessage(
        `定員不足です。参加者${totalPassengers}名に対して、総定員は${totalCapacity}名です。`,
      );
      return;
    }

    const cars: AllocationResult[] = availableGuardians.map((guardian) => ({
      id: guardian.id,
      guardianName: guardian.name,
      capacity: guardian.capacity,
      players: [],
      staff: [],
    }));

    const scoreCarForPlayer = (
      car: AllocationResult,
      carIndex: number,
      player: Player,
      anchorCarIndex: number | null,
    ) => {
      const remaining = getRemainingSeats(car);
      if (remaining <= 0) {
        return Number.NEGATIVE_INFINITY;
      }

      const normalizedParent = normalizeText(player.parentGuardianName);
      const normalizedGrade = normalizeText(player.grade);
      const normalizedSibling = normalizeText(player.siblingGroup);

      let score = 0;

      if (anchorCarIndex !== null && carIndex === anchorCarIndex) {
        score += 260;
      }

      // 親が運転手の場合は、その親の車を最優先にします。
      if (normalizedParent && normalizedParent === normalizeText(car.guardianName)) {
        score += 1000;
      }

      // 兄弟グループがすでに乗っている車を強く優先します。
      if (
        normalizedSibling &&
        car.players.some(
          (assignedPlayer) =>
            normalizeText(assignedPlayer.siblingGroup) === normalizedSibling,
        )
      ) {
        score += 520;
      }

      // 同学年の選手がいる車を優先し、同学年同乗を促進します。
      const sameGradeCount = car.players.filter(
        (assignedPlayer) => normalizeText(assignedPlayer.grade) === normalizedGrade,
      ).length;
      score += sameGradeCount * 95;

      // 監督・コーチは選手と分けたいので、スタッフがいる車は選手をやや避けます。
      if (car.staff.length > 0) {
        score -= 260;
      }

      // 人数バランスをとるため、混雑車は少し不利にします。
      score -= getCarLoad(car) * 8;

      return score;
    };

    // 兄弟指定のある選手はグループ化して連続で割当し、同乗しやすくします。
    const siblingUnits = new Map<string, Player[]>();
    const individualUnits: Player[][] = [];

    for (const player of participatingPlayers) {
      const siblingKey = normalizeText(player.siblingGroup);
      if (!siblingKey) {
        individualUnits.push([player]);
        continue;
      }

      const existing = siblingUnits.get(siblingKey);
      if (existing) {
        existing.push(player);
      } else {
        siblingUnits.set(siblingKey, [player]);
      }
    }

    const playerUnits: Player[][] = [...siblingUnits.values(), ...individualUnits].sort(
      (a, b) => b.length - a.length,
    );

    for (const unit of playerUnits) {
      const sortedMembers = [...unit].sort((a, b) => {
        const aHasParent = guardianNameToIndex.has(normalizeText(a.parentGuardianName));
        const bHasParent = guardianNameToIndex.has(normalizeText(b.parentGuardianName));
        if (aHasParent !== bHasParent) {
          return Number(bHasParent) - Number(aHasParent);
        }
        return a.name.localeCompare(b.name, "ja");
      });

      let anchorCarIndex: number | null = null;

      for (const player of sortedMembers) {
        const candidateCars = cars
          .map((car, carIndex) => ({
            carIndex,
            score: scoreCarForPlayer(car, carIndex, player, anchorCarIndex),
          }))
          .filter((candidate) => Number.isFinite(candidate.score))
          .sort((a, b) => {
            if (a.score !== b.score) {
              return b.score - a.score;
            }

            const aLoad = getCarLoad(cars[a.carIndex]);
            const bLoad = getCarLoad(cars[b.carIndex]);
            if (aLoad !== bLoad) {
              return aLoad - bLoad;
            }

            return b.carIndex - a.carIndex;
          });

        if (candidateCars.length === 0) {
          setAllocation([]);
          setErrorMessage("選手の配車に失敗しました。定員や参加者設定を見直してください。");
          return;
        }

        const selectedCarIndex = candidateCars[0].carIndex;
        cars[selectedCarIndex].players.push(player);

        if (anchorCarIndex === null) {
          anchorCarIndex = selectedCarIndex;
        }
      }
    }

    // 監督・コーチは選手とは別枠で割当し、できるだけ選手の少ない車へ配車します。
    for (const staff of participatingStaff) {
      const candidateCars = cars
        .map((car, carIndex) => {
          const remaining = getRemainingSeats(car);
          if (remaining <= 0) {
            return { carIndex, score: Number.NEGATIVE_INFINITY };
          }

          // 選手が少ない車、スタッフが少ない車を優先します。
          const score =
            car.players.length * -80 +
            car.staff.length * -40 +
            getCarLoad(car) * -6 +
            remaining * 4;

          return { carIndex, score };
        })
        .filter((candidate) => Number.isFinite(candidate.score))
        .sort((a, b) => b.score - a.score);

      if (candidateCars.length === 0) {
        setAllocation([]);
        setErrorMessage("監督・コーチの配車に失敗しました。定員を確認してください。");
        return;
      }

      cars[candidateCars[0].carIndex].staff.push(staff);
    }

    setAllocation(cars);
  };

  const lineShareText = useMemo(() => {
    if (allocation.length === 0) {
      return "";
    }

    const lines: string[] = [
      "",
      `遠征名: ${expeditionName.trim() || "未入力"}`,
      `目的地: ${destination.trim() || "未入力"}`,
      `参加選手: ${participatingPlayers.length}名 / 監督・コーチ: ${participatingStaff.length}名`,
      "",
    ];

    allocation.forEach((car, index) => {
      lines.push(
        `${index + 1}号車 ${car.guardianName}（${getCarLoad(car)}/${car.capacity}名）`,
      );
      lines.push(`選手(${car.players.length}名)`);

      if (car.players.length > 0) {
        car.players.forEach((player) => {
          lines.push(`・${player.name} (${player.grade})`);
        });
      } else {
        lines.push("・なし");
      }

      lines.push(`監督・コーチ(${car.staff.length}名)`);
      if (car.staff.length > 0) {
        car.staff.forEach((staff) => {
          lines.push(`・${staff.role} ${staff.name}`);
        });
      } else {
        lines.push("・なし");
      }

      lines.push("");
    });

    return lines.join("\n");
  }, [allocation, expeditionName, destination, participatingPlayers.length, participatingStaff.length]);

  const handleCopyShareText = async () => {
    if (!lineShareText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(lineShareText);
      setCopyMessage("コピーしました。LINEに貼り付けて共有できます。");
    } catch {
      setCopyMessage("コピーできませんでした。テキストを手動でコピーしてください。");
    }
  };

  const isCopyError = copyMessage.includes("コピーできませんでした");

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-4 text-slate-900 sm:px-6 sm:py-8">
      <main className="mx-auto w-full max-w-4xl space-y-5 rounded-3xl bg-white p-4 shadow-sm sm:space-y-6 sm:p-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            少年野球 遠征配車アプリ
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            チームメンバーの出欠回答をそのまま配車に反映できます。
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block text-sm font-semibold">遠征名</span>
            <input
              type="text"
              value={expeditionName}
              onChange={(event) => setExpeditionName(event.target.value)}
              placeholder="例: 練習試合@横浜"
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-sm font-semibold">目的地</span>
            <input
              type="text"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="例: ○○小学校グラウンド"
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">保護者（運転手）出欠管理</h2>
            <button
              type="button"
              onClick={addGuardian}
              className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700"
            >
              + 保護者を追加
            </button>
          </div>

          <p className="text-xs text-slate-600">
            「配車可」を選んだ保護者だけが自動配車の対象になります。
          </p>

          <div className="space-y-3">
            {guardians.map((guardian) => (
              <div
                key={guardian.id}
                className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                  <input
                    type="text"
                    value={guardian.name}
                    onChange={(event) =>
                      updateGuardian(guardian.id, "name", event.target.value)
                    }
                    placeholder="保護者名"
                    className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <input
                    type="number"
                    min={1}
                    value={guardian.capacity}
                    onChange={(event) =>
                      updateGuardian(guardian.id, "capacity", event.target.value)
                    }
                    placeholder="定員"
                    className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeGuardian(guardian.id)}
                    className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={guardians.length === 1}
                  >
                    削除
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(["未回答", "配車可", "配車不可"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateGuardian(guardian.id, "availability", status)}
                      className={`min-h-10 rounded-xl border text-xs font-semibold ${
                        guardian.availability === status
                          ? status === "配車可"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : status === "配車不可"
                              ? "border-rose-300 bg-rose-50 text-rose-800"
                              : "border-slate-300 bg-slate-100 text-slate-800"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <h2 className="text-lg font-semibold">選手出欠管理</h2>

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={playerDraft.name}
              onChange={(event) =>
                setPlayerDraft((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="選手名"
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="text"
              value={playerDraft.grade}
              onChange={(event) =>
                setPlayerDraft((prev) => ({ ...prev, grade: event.target.value }))
              }
              placeholder="学年（例: 5年）"
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="text"
              value={playerDraft.siblingGroup}
              onChange={(event) =>
                setPlayerDraft((prev) => ({
                  ...prev,
                  siblingGroup: event.target.value,
                }))
              }
              placeholder="兄弟グループ名（任意）"
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="text"
              value={playerDraft.parentGuardianName}
              onChange={(event) =>
                setPlayerDraft((prev) => ({
                  ...prev,
                  parentGuardianName: event.target.value,
                }))
              }
              placeholder="保護者名（運転手と同名で優先同乗）"
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={registerPlayer}
            className="min-h-11 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 active:bg-indigo-700"
          >
            + 選手を登録
          </button>

          <p className="text-sm font-medium text-slate-700">
            参加選手: {participatingPlayers.length}名（未回答/参加/不参加を入力）
          </p>

          {playerMaster.length === 0 ? (
            <p className="text-sm text-slate-500">まだ選手が登録されていません。</p>
          ) : (
            <div className="space-y-2">
              {playerMaster.map((player) => (
                <div
                  key={player.id}
                  className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {player.name} ({player.grade})
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        兄弟: {player.siblingGroup || "なし"} / 保護者: {player.parentGuardianName || "未設定"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePlayer(player.id)}
                      className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      削除
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["未回答", "参加", "不参加"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updatePlayerAttendance(player.id, status)}
                        className={`min-h-10 rounded-xl border text-xs font-semibold ${
                          player.attendance === status
                            ? status === "参加"
                              ? "border-blue-300 bg-blue-50 text-blue-800"
                              : status === "不参加"
                                ? "border-rose-300 bg-rose-50 text-rose-800"
                                : "border-slate-300 bg-slate-100 text-slate-800"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <h2 className="text-lg font-semibold">監督・コーチ出欠管理</h2>

          <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
            <input
              type="text"
              value={staffDraft.name}
              onChange={(event) =>
                setStaffDraft((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="氏名"
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={staffDraft.role}
              onChange={(event) =>
                setStaffDraft((prev) => ({
                  ...prev,
                  role: event.target.value as StaffRole,
                }))
              }
              className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="監督">監督</option>
              <option value="コーチ">コーチ</option>
            </select>
          </div>

          <button
            type="button"
            onClick={registerStaff}
            className="min-h-11 w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 active:bg-amber-700"
          >
            + 監督・コーチを登録
          </button>

          <p className="text-sm font-medium text-slate-700">
            参加監督・コーチ: {participatingStaff.length}名（未回答/参加/不参加を入力）
          </p>

          {staffMembers.length === 0 ? (
            <p className="text-sm text-slate-500">まだ監督・コーチが登録されていません。</p>
          ) : (
            <div className="space-y-2">
              {staffMembers.map((staff) => (
                <div
                  key={staff.id}
                  className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {staff.role} {staff.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeStaff(staff.id)}
                      className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      削除
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["未回答", "参加", "不参加"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateStaffAttendance(staff.id, status)}
                        className={`min-h-10 rounded-xl border text-xs font-semibold ${
                          staff.attendance === status
                            ? status === "参加"
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : status === "不参加"
                                ? "border-rose-300 bg-rose-50 text-rose-800"
                                : "border-slate-300 bg-slate-100 text-slate-800"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={handleAutoAllocate}
          className="min-h-12 w-full rounded-2xl bg-blue-600 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-blue-500 active:bg-blue-700"
        >
          出欠回答を反映して自動配車する
        </button>

        {errorMessage && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessage}
          </p>
        )}

        {allocation.length > 0 && (
          <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold">配車結果</h2>
            <p className="text-sm text-slate-600">
              遠征名: {expeditionName.trim() || "未入力"} / 目的地: {destination.trim() || "未入力"}
            </p>

            <div className="space-y-3">
              {allocation.map((car, index) => (
                <article
                  key={car.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {index + 1}号車: {car.guardianName}
                    </h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {getCarLoad(car)}/{car.capacity}名
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-800">
                        選手 ({car.players.length}名)
                      </p>
                      {car.players.length > 0 ? (
                        <ul className="space-y-1 text-sm text-slate-700">
                          {car.players.map((player, playerIndex) => (
                            <li key={`${car.id}-player-${playerIndex}`}>
                              ・{player.name} ({player.grade})
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">なし</p>
                      )}
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-800">
                        監督・コーチ ({car.staff.length}名)
                      </p>
                      {car.staff.length > 0 ? (
                        <ul className="space-y-1 text-sm text-slate-700">
                          {car.staff.map((staff, staffIndex) => (
                            <li key={`${car.id}-staff-${staffIndex}`}>
                              ・{staff.role} {staff.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">なし</p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  LINE共有用テキスト
                </h3>
                <button
                  type="button"
                  onClick={handleCopyShareText}
                  className="min-h-10 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 active:bg-slate-900"
                >
                  コピー
                </button>
              </div>

              <textarea
                readOnly
                value={lineShareText}
                className="h-56 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-800"
              />

              {copyMessage && (
                <p
                  className={`text-xs font-medium ${
                    isCopyError ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {copyMessage}
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}