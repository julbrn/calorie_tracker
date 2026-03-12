import { useState, useRef } from "react";
import imageCompression from "browser-image-compression";

const GEMINI_MODEL = "gemini-3-flash-preview";

const C = {
  bg: "#07070f",
  surf: "#111120",
  elev: "#181828",
  border: "rgba(255,255,255,0.07)",
  t1: "#f0f2ff",
  t2: "#b0b8d8",
  t3: "#6b7280",
  acc: "#7c7ff7",
  accl: "#a5a8fb",
  pur: "#a855f7",
  grn: "#4ade80",
  yel: "#fbbf24",
  red: "#f87171",
};
const R = { sm: 10, md: 14, lg: 18, xl: 22 };

function getDayKey() {
  const d = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return `ct_log:${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function cleanOldLogs() {
  const today = getDayKey();
  Object.keys(localStorage).forEach((k) => {
    if ((k.startsWith("ct_log:") || k.startsWith("ct_img:")) && k !== today) {
      // ct_img ключи содержат id, не дату — удалять только ct_log
      if (k.startsWith("ct_log:")) localStorage.removeItem(k);
    }
  });
}

function getMealIcon(t) {
  const h = parseInt((t || "12").split(":")[0]);
  if (h < 10) return "🌅";
  if (h < 14) return "☀️";
  if (h < 18) return "🌤️";
  return "🌙";
}
function saveLog(log) {
  try {
    const slim = log.map((e) => ({
      id: e.id,
      time: e.time,
      description: e.description,
      items: e.items,
      total: e.total,
    }));
    localStorage.setItem(getDayKey(), JSON.stringify(slim));
  } catch (e) {}
}
function saveImage(id, dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(`ct_img:${id}`, dataUrl);
  } catch (e) {}
}
function loadImage(id) {
  try {
    return localStorage.getItem(`ct_img:${id}`) || null;
  } catch (e) {
    return null;
  }
}
function removeImage(id) {
  try {
    localStorage.removeItem(`ct_img:${id}`);
  } catch (e) {}
}
function loadLog() {
  cleanOldLogs();
  try {
    const raw = localStorage.getItem(getDayKey());
    if (!raw) return [];
    return JSON.parse(raw).map((e) => ({ ...e, image: loadImage(e.id) }));
  } catch (e) {
    return [];
  }
}

async function compress(file) {
  const options = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 768,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.75,
  };

  const compressed = await imageCompression(file, options);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      resolve({
        dataUrl,
        b64: dataUrl.split(",")[1],
        mime: compressed.type,
      });
    };
    reader.readAsDataURL(compressed);
  });
}

async function callGemini(apiKey, b64, mime, text) {
  const parts = [];
  if (b64) parts.push({ inline_data: { mime_type: mime, data: b64 } });
  const prompt = b64
    ? `Food image${text ? `, also: "${text}"` : ""}. Identify items, estimate calories. Respond ONLY with raw JSON (no markdown): {"items":[{"name":"...","calories":N}],"total":N,"description":"summary in Russian"}`
    : `Estimate calories for: "${text}". Respond ONLY with raw JSON (no markdown): {"items":[{"name":"...","calories":N}],"total":N,"description":"summary in Russian"}`;
  parts.push({ text: prompt });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    },
  );
  if (!res.ok) {
    let msg = "";
    try {
      const ej = await res.json();
      msg = ej?.error?.message || "";
    } catch (e) {}
    throw new Error(`HTTP ${res.status}${msg ? ": " + msg : ""}`);
  }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Неверный формат ответа");
  const parsed = JSON.parse(match[0]);
  if (!parsed.items?.length) throw new Error("Еда не распознана");
  return parsed;
}

const css = `
  *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.t1}; font-family: -apple-system, 'Inter', system-ui, sans-serif; min-height: 100vh; }
  .tap:active { opacity: .75; transform: scale(.97); }
  input:focus, textarea:focus { outline: none; }
  textarea::placeholder { color: ${C.t3}; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { display: inline-block; width: 16px; height: 16px; border: 2.5px solid ${C.t3}; border-top-color: ${C.acc}; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: middle; margin-right: 8px; }
`;

function Card({ children, style }) {
  return (
    <div
      style={{
        background: C.surf,
        borderRadius: R.xl,
        border: `1px solid ${C.border}`,
        padding: "20px 18px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.t3,
        textTransform: "uppercase",
        letterSpacing: ".08em",
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("ct_apikey") || "",
  );
  const [keyInput, setKeyInput] = useState("");
  const [goal, setGoal] = useState(() =>
    Number(localStorage.getItem("ct_goal") || "1800"),
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
  const fileRef = useRef();
  const isAndroid = /android/i.test(navigator.userAgent);

  const total = log.reduce((s, e) => s + e.total, 0);
  const pct = Math.min((total / goal) * 100, 100);
  const remaining = goal - total;
  const pColor = pct < 60 ? C.grn : pct < 85 ? C.yel : C.red;
  const canSubmit = !loading && (!!b64 || text.trim().length > 0);

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
    } catch (err) {
      setError("Не удалось загрузить фото");
    }
  }

  function clearImage() {
    setPreview(null);
    setB64(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function saveGoalFn() {
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
      saveImage(entry.id, preview);
      const updated = [entry, ...log];
      setLog(updated);
      saveLog(updated);
      setText("");
      clearImage();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  function removeEntry(id) {
    removeImage(id);
    const updated = log.filter((e) => e.id !== id);
    setLog(updated);
    saveLog(updated);
  }

  return (
    <>
      <style>{css}</style>

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(7,7,15,.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${C.border}`,
          padding: "12px 18px",
          paddingTop: "max(12px, env(safe-area-inset-top))",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: `linear-gradient(135deg,${C.acc},${C.pur})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                boxShadow: "0 4px 14px rgba(124,127,247,.4)",
                flexShrink: 0,
              }}
            >
              🥗
            </div>
            <span
              style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.4px" }}
            >
              Calorie Tracker
            </span>
          </div>
          {editGoal ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                value={tempGoal}
                type="number"
                autoFocus
                onChange={(e) => setTempGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveGoalFn()}
                style={{
                  width: 80,
                  background: C.elev,
                  border: `1.5px solid ${C.acc}`,
                  borderRadius: R.sm,
                  color: C.t1,
                  padding: "6px 10px",
                  fontSize: 15,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              />
              <button
                onClick={saveGoalFn}
                className="tap"
                style={{
                  background: C.acc,
                  border: "none",
                  borderRadius: R.sm,
                  color: "#fff",
                  padding: "6px 12px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ОК
              </button>
              <button
                onClick={() => setEditGoal(false)}
                className="tap"
                style={{
                  background: C.elev,
                  border: "none",
                  borderRadius: R.sm,
                  color: C.t2,
                  padding: "6px 10px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditGoal(true);
                setTempGoal(String(goal));
              }}
              className="tap"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(124,127,247,.1)",
                border: "1px solid rgba(124,127,247,.2)",
                borderRadius: R.md,
                padding: "7px 12px",
                cursor: "pointer",
              }}
            >
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 10,
                    color: C.acc,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    fontWeight: 700,
                  }}
                >
                  Лимит
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: C.accl,
                    letterSpacing: "-.3px",
                  }}
                >
                  {goal} ккал
                </div>
              </div>
              <span style={{ fontSize: 15, opacity: 0.7 }}>⚙️</span>
            </button>
          )}
        </div>
      </header>

      <main
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "18px 14px 60px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* API Key */}
        {!apiKey && (
          <div
            style={{
              background: "rgba(124,127,247,.1)",
              border: "1px solid rgba(124,127,247,.25)",
              borderRadius: R.xl,
              padding: "18px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: C.t2,
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              <strong style={{ color: C.t1 }}>Введи Gemini API ключ</strong> —
              сохранится на устройстве.
              <br />
              Бесплатно:{" "}
              <strong style={{ color: C.accl }}>aistudio.google.com</strong> →
              Get API key
            </p>
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveApiKey()}
              type="password"
              placeholder="API ключ..."
              style={{
                width: "100%",
                background: C.elev,
                border: `1.5px solid ${C.acc}`,
                borderRadius: R.md,
                color: C.t1,
                padding: "11px 14px",
                fontSize: 14,
                marginBottom: 10,
              }}
            />
            <button
              onClick={saveApiKey}
              className="tap"
              style={{
                width: "100%",
                padding: 13,
                borderRadius: R.md,
                border: "none",
                background: `linear-gradient(135deg,${C.acc},${C.pur})`,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Сохранить ключ
            </button>
          </div>
        )}

        {/* Progress */}
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.t3,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 4,
                }}
              >
                Съедено сегодня
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span
                  style={{
                    fontSize: 48,
                    fontWeight: 900,
                    lineHeight: 1,
                    color: pColor,
                    transition: "color .4s",
                    letterSpacing: "-2px",
                  }}
                >
                  {total}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.t3 }}>
                  ккал
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.t3,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 4,
                }}
              >
                {remaining >= 0 ? "Осталось" : "Перебор"}
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: "-1px",
                  color: remaining >= 0 ? C.grn : C.red,
                }}
              >
                {remaining >= 0 ? remaining : `+${Math.abs(remaining)}`}
              </div>
            </div>
          </div>
          <div
            style={{
              height: 10,
              background: C.elev,
              borderRadius: 99,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: `linear-gradient(90deg,${pColor}60,${pColor})`,
                borderRadius: 99,
                transition: "width .7s cubic-bezier(.4,0,.2,1)",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: C.t3 }}>0</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: pColor }}>
              {Math.round(pct)}%
            </span>
            <span style={{ fontSize: 11, color: C.t3 }}>{goal}</span>
          </div>
        </Card>

        {/* Add meal */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Label>Добавить приём пищи</Label>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            {...(isAndroid ? { capture: "environment" } : {})}
            style={{ display: "none" }}
            onChange={onFileChange}
          />

          {preview ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: C.elev,
                borderRadius: R.md,
                padding: "10px 12px",
              }}
            >
              <img
                src={preview}
                alt=""
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: R.sm,
                  objectFit: "cover",
                  flexShrink: 0,
                  border: `2px solid ${C.acc}`,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.t1,
                    marginBottom: 4,
                  }}
                >
                  📷 Фото загружено
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={openPicker}
                    className="tap"
                    style={{
                      background: "none",
                      border: "none",
                      color: C.accl,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Заменить
                  </button>
                  <span style={{ color: C.t3, fontSize: 12 }}>·</span>
                  <button
                    onClick={clearImage}
                    className="tap"
                    style={{
                      background: "none",
                      border: "none",
                      color: C.red,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={openPicker}
              className="tap"
              style={{
                width: "100%",
                padding: 16,
                borderRadius: R.md,
                border: `2px dashed ${C.elev}`,
                background: C.elev,
                color: C.t2,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>📷</span>
              <span>Добавить фото еды</span>
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: C.elev }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.t3,
                letterSpacing: ".06em",
              }}
            >
              ИЛИ ОПИШИТЕ
            </span>
            <div style={{ flex: 1, height: 1, background: C.elev }} />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="«гречка с курицей, кефир, яблоко»"
            style={{
              width: "100%",
              background: C.elev,
              border: `1.5px solid transparent`,
              borderRadius: R.md,
              color: C.t1,
              padding: "12px 14px",
              fontSize: 15,
              fontWeight: 500,
              resize: "none",
              fontFamily: "inherit",
              lineHeight: 1.5,
              transition: "border-color .2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = C.acc)}
            onBlur={(e) => (e.target.style.borderColor = "transparent")}
          />

          {error && (
            <div style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            className={canSubmit ? "tap" : ""}
            style={{
              width: "100%",
              padding: 15,
              borderRadius: R.lg,
              border: "none",
              background: canSubmit
                ? `linear-gradient(135deg,${C.acc},${C.pur})`
                : C.elev,
              color: canSubmit ? "#fff" : C.t3,
              fontSize: 16,
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all .2s",
              boxShadow: canSubmit ? "0 8px 24px rgba(124,127,247,.3)" : "none",
            }}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Анализирую...
              </>
            ) : (
              "Посчитать калории →"
            )}
          </button>
        </Card>

        {/* Log */}
        {log.length > 0 && (
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <Label style={{ marginBottom: 0 }}>Журнал дня</Label>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t2 }}>
                {total} ккал
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {log.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    background: C.elev,
                    borderRadius: R.lg,
                    padding: 12,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  {entry.image ? (
                    <img
                      src={entry.image}
                      alt=""
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: R.md,
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: R.md,
                        background: C.surf,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      {getMealIcon(entry.time)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: C.t1,
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.description}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.t3,
                        marginBottom: 6,
                      }}
                    >
                      {entry.time}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {entry.items.slice(0, 3).map((it, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            background: "rgba(124,127,247,.12)",
                            color: C.accl,
                            padding: "2px 7px",
                            borderRadius: 99,
                          }}
                        >
                          {it.name} · {it.calories}
                        </span>
                      ))}
                      {entry.items.length > 3 && (
                        <span
                          style={{
                            fontSize: 11,
                            background: C.surf,
                            color: C.t3,
                            padding: "2px 7px",
                            borderRadius: 99,
                          }}
                        >
                          +{entry.items.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 900,
                          color: C.accl,
                          letterSpacing: "-.5px",
                        }}
                      >
                        {entry.total}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: C.t3,
                          textTransform: "uppercase",
                        }}
                      >
                        ккал
                      </div>
                    </div>
                    <button
                      onClick={() => removeEntry(entry.id)}
                      onTouchStart={(e) =>
                        (e.currentTarget.style.color = C.red)
                      }
                      onTouchEnd={(e) => (e.currentTarget.style.color = C.t3)}
                      style={{
                        background: "none",
                        border: "none",
                        color: C.t3,
                        cursor: "pointer",
                        fontSize: 18,
                        padding: 4,
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Change API key */}
        {apiKey && (
          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => {
                localStorage.removeItem("ct_apikey");
                setApiKey("");
                setKeyInput("");
              }}
              style={{
                background: "none",
                border: "none",
                color: C.t3,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Сменить API ключ
            </button>
          </div>
        )}
      </main>
    </>
  );
}
