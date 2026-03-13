import { useState, useRef } from "react";
import { loadLog, saveLog, persistImage, removeImage } from "./storage";
import { callGemini } from "./api";
import { compress } from "./utils";

export function useCalorieTracker() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("ct_apikey") || "",
  );
  const [keyInput, setKeyInput] = useState("");
  const [goal, setGoal] = useState(
    () => Number(localStorage.getItem("ct_goal") || "1800"),
  );
  const [editGoal, setEditGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState("1800");
  const [log, setLog] = useState(() => loadLog());
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [b64, setB64] = useState(null);
  const [mime, setMime] = useState("image/webp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingEntry, setPendingEntry] = useState(null);
  const [confirmItems, setConfirmItems] = useState([]);
  const fileRef = useRef();

  const total = log.reduce((s, e) => s + e.total, 0);
  const pct = Math.min((total / goal) * 100, 100);
  const remaining = goal - total;
  const pColorClass = pct < 60 ? "green" : pct < 85 ? "yellow" : "red";
  const canSubmit = !loading && (!!b64 || text.trim().length > 0);
  const isAndroid = /android/i.test(navigator.userAgent);

  function openPicker() {
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current.click();
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(null);
    setB64(null);
    setError("");
    try {
      const res = await compress(file);
      setPreview(res.dataUrl);
      setB64(res.b64);
      setMime(res.mime);
    } catch {
      setError("Не удалось загрузить фото");
    }
  }

  function clearImage() {
    setPreview(null);
    setB64(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function saveGoal() {
    const v = parseInt(tempGoal);
    if (v > 0) {
      setGoal(v);
      localStorage.setItem("ct_goal", String(v));
    }
    setEditGoal(false);
  }

  function saveApiKey() {
    const v = keyInput.trim();
    if (!v) return;
    localStorage.setItem("ct_apikey", v);
    setApiKey(v);
  }

  function resetApiKey() {
    localStorage.removeItem("ct_apikey");
    setApiKey("");
    setKeyInput("");
  }

  async function handleAnalyze() {
    if (!canSubmit) return;
    if (!apiKey) {
      setError("Сначала введи Gemini API ключ");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await callGemini(apiKey, b64, mime, text.trim());
      const entry = {
        id: Date.now(),
        time: new Date().toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        description: result.description || text || "Приём пищи",
        items: result.items || [],
        total: result.total || 0,
        image: preview,
      };
      setPendingEntry(entry);
      setConfirmItems(entry.items.map((it) => ({ ...it })));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function handleRecalculate() {
    const names = confirmItems.map((it) => it.name).filter(Boolean);
    if (!names.length || !apiKey) return;
    setError("");
    setLoading(true);
    try {
      const result = await callGemini(apiKey, null, null, names.join(", "));
      setConfirmItems(result.items || []);
      setPendingEntry((prev) => ({
        ...prev,
        description: result.description || prev.description,
      }));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function handleConfirm() {
    if (!pendingEntry) return;
    const items = confirmItems.filter((it) => it.name.trim());
    const total = items.reduce((s, it) => s + (Number(it.calories) || 0), 0);
    const entry = { ...pendingEntry, items, total };
    persistImage(entry.id, entry.image);
    const updated = [entry, ...log];
    setLog(updated);
    saveLog(updated);
    setPendingEntry(null);
    setConfirmItems([]);
    setText("");
    clearImage();
  }

  function cancelPending() {
    setPendingEntry(null);
    setConfirmItems([]);
  }

  function removeEntry(id) {
    removeImage(id);
    const updated = log.filter((e) => e.id !== id);
    setLog(updated);
    saveLog(updated);
  }

  return {
    // state
    apiKey,
    keyInput,
    setKeyInput,
    goal,
    editGoal,
    setEditGoal,
    tempGoal,
    setTempGoal,
    log,
    text,
    setText,
    preview,
    loading,
    error,
    fileRef,
    isAndroid,
    // computed
    total,
    pct,
    remaining,
    pColorClass,
    canSubmit,
    // handlers
    openPicker,
    onFileChange,
    clearImage,
    saveGoal,
    saveApiKey,
    resetApiKey,
    handleAnalyze,
    pendingEntry,
    confirmItems,
    setConfirmItems,
    handleRecalculate,
    handleConfirm,
    cancelPending,
    removeEntry,
  };
}
