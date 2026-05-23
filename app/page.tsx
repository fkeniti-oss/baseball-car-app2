"use client";

import { useRef, useState } from "react";

type GuardianInput = {
  id: number;
  name: string;
  capacity: string;
};

type ChildInput = {
  id: number;
  name: string;
};

type AllocationResult = {
  id: number;
  guardianName: string;
  capacity: number;
  assignedChildren: string[];
};

export default function Home() {
  const [expeditionName, setExpeditionName] = useState("");
  const [destination, setDestination] = useState("");
  const [guardians, setGuardians] = useState<GuardianInput[]>([
    { id: 1, name: "", capacity: "4" },
  ]);
  const [children, setChildren] = useState<ChildInput[]>([{ id: 1, name: "" }]);
  const [allocation, setAllocation] = useState<AllocationResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const guardianIdRef = useRef(2);
  const childIdRef = useRef(2);

  const addGuardian = () => {
    setGuardians((prev) => [
      ...prev,
      { id: guardianIdRef.current, name: "", capacity: "4" },
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

  const addChild = () => {
    setChildren((prev) => [...prev, { id: childIdRef.current, name: "" }]);
    childIdRef.current += 1;
  };

  const removeChild = (id: number) => {
    setChildren((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((child) => child.id !== id);
    });
  };

  const updateChild = (id: number, value: string) => {
    setChildren((prev) =>
      prev.map((child) => (child.id === id ? { ...child, name: value } : child)),
    );
  };

  const handleAutoAllocate = () => {
    setErrorMessage("");
    setCopyMessage("");

    const normalizedGuardians: { id: number; name: string; capacity: number }[] =
      [];

    // 入力フォームには空行があり得るため、空行は無視し、部分入力はエラーにします。
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

      normalizedGuardians.push({ id: guardian.id, name, capacity });
    }

    const normalizedChildren = children
      .map((child) => child.name.trim())
      .filter((name) => name !== "");

    if (normalizedGuardians.length === 0) {
      setAllocation([]);
      setErrorMessage("車を出せる保護者を1名以上入力してください。");
      return;
    }

    if (normalizedChildren.length === 0) {
      setAllocation([]);
      setErrorMessage("子どもの名前を1名以上入力してください。");
      return;
    }

    const totalCapacity = normalizedGuardians.reduce(
      (sum, guardian) => sum + guardian.capacity,
      0,
    );
    if (normalizedChildren.length > totalCapacity) {
      setAllocation([]);
      setErrorMessage(
        `定員不足です。子ども${normalizedChildren.length}名に対して、総定員は${totalCapacity}名です。`,
      );
      return;
    }

    const result: AllocationResult[] = normalizedGuardians.map((guardian) => ({
      id: guardian.id,
      guardianName: guardian.name,
      capacity: guardian.capacity,
      assignedChildren: [],
    }));

    // 各ステップで「現在の乗車人数が最も少ない車」に1人ずつ入れることで、
    // 定員を守りながらできるだけ均等な配車にします。
    for (const childName of normalizedChildren) {
      const availableCars = result.filter(
        (car) => car.assignedChildren.length < car.capacity,
      );

      if (availableCars.length === 0) {
        setAllocation([]);
        setErrorMessage("配車できませんでした。入力内容を確認してください。");
        return;
      }

      availableCars.sort((a, b) => {
        if (a.assignedChildren.length !== b.assignedChildren.length) {
          return a.assignedChildren.length - b.assignedChildren.length;
        }
        return b.capacity - a.capacity;
      });

      availableCars[0].assignedChildren.push(childName);
    }

    setAllocation(result);
  };

  const lineShareText =
    allocation.length === 0
      ? ""
      : [
          "【少年野球 遠征配車】",
          `遠征名: ${expeditionName.trim() || "未入力"}`,
          `目的地: ${destination.trim() || "未入力"}`,
          "",
          ...allocation.map((car, index) => {
            const childrenText =
              car.assignedChildren.length > 0
                ? car.assignedChildren.map((name) => `・${name}`).join("\n")
                : "・なし";
            return `${index + 1}号車 ${car.guardianName}（${car.assignedChildren.length}/${car.capacity}名）\n${childrenText}`;
          }),
        ].join("\n");

  const handleCopyShareText = async () => {
    if (!lineShareText) return;
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
      <main className="mx-auto w-full max-w-3xl space-y-5 rounded-3xl bg-white p-4 shadow-sm sm:space-y-6 sm:p-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            少年野球 遠征配車アプリ
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            遠征情報・保護者の車・子どもを入力して「自動配車する」を押してください。
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
            <h2 className="text-lg font-semibold">保護者の車</h2>
            <button
              type="button"
              onClick={addGuardian}
              className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700"
            >
              + 車を追加
            </button>
          </div>

          <div className="space-y-3">
            {guardians.map((guardian) => (
              <div
                key={guardian.id}
                className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_120px_auto]"
              >
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
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">子ども</h2>
            <button
              type="button"
              onClick={addChild}
              className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 active:bg-indigo-700"
            >
              + 子どもを追加
            </button>
          </div>

          <div className="space-y-3">
            {children.map((child) => (
              <div
                key={child.id}
                className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto]"
              >
                <input
                  type="text"
                  value={child.name}
                  onChange={(event) => updateChild(child.id, event.target.value)}
                  placeholder="子どもの名前"
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => removeChild(child.id)}
                  className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={children.length === 1}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={handleAutoAllocate}
          className="min-h-12 w-full rounded-2xl bg-blue-600 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-blue-500 active:bg-blue-700"
        >
          自動配車する
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
              遠征名: {expeditionName.trim() || "未入力"} / 目的地:{" "}
              {destination.trim() || "未入力"}
            </p>

            <div className="space-y-3">
              {allocation.map((car, index) => (
                <article
                  key={car.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {index + 1}号車: {car.guardianName}
                    </h3>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {car.assignedChildren.length}/{car.capacity}名
                    </span>
                  </div>

                  {car.assignedChildren.length > 0 ? (
                    <ul className="space-y-1 text-sm text-slate-700">
                      {car.assignedChildren.map((childName, childIndex) => (
                        <li key={`${car.id}-${childIndex}`}>・{childName}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">子どもの割り当てなし</p>
                  )}
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
                className="h-44 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-800"
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