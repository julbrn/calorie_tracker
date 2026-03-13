import { useState, useRef } from "react";
import imageCompression from "browser-image-compression";
import "./App.scss";

const GEMINI_MODEL = "gemini-3-flash-preview";

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

function Card({ children, className }) {
  return (
    <div className={`card${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

function Label({ children, className }) {
  return (
    <div className={`label${className ? ` ${className}` : ""}`}>
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
  const pColorClass = pct < 60 ? "green" : pct < 85 ? "yellow" : "red";
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
      {/* Header */}
      <header className="header">
        <div className="header__inner">
          <div className="header__brand">
            <div className="header__logo">🥗</div>
            <span className="header__title">Calorie Tracker</span>
          </div>
          {editGoal ? (
            <div className="header__goal-edit">
              <input
                value={tempGoal}
                type="number"
                autoFocus
                onChange={(e) => setTempGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveGoalFn()}
                className="header__goal-input"
              />
              <button onClick={saveGoalFn} className="header__goal-save tap">
                ОК
              </button>
              <button
                onClick={() => setEditGoal(false)}
                className="header__goal-cancel tap"
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
              className="header__goal-btn tap"
            >
              <div className="header__goal-text">
                <div className="header__goal-label">Лимит</div>
                <div className="header__goal-value">{goal} ккал</div>
              </div>
              <span className="header__goal-icon">⚙️</span>
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {/* API Key */}
        {!apiKey && (
          <div className="api-key-banner">
            <p className="api-key-banner__text">
              <strong>Введи Gemini API ключ</strong> — сохранится на устройстве.
              <br />
              Бесплатно:{" "}
              <strong className="api-key-banner__link">
                aistudio.google.com
              </strong>{" "}
              → Get API key
            </p>
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveApiKey()}
              type="password"
              placeholder="API ключ..."
              className="api-key-banner__input"
            />
            <button onClick={saveApiKey} className="api-key-banner__submit tap">
              Сохранить ключ
            </button>
          </div>
        )}

        {/* Progress */}
        <Card>
          <div className="progress__header">
            <div>
              <div className="progress__stat-label">Съедено сегодня</div>
              <div className="progress__total">
                <span
                  className={`progress__total-value progress__total-value--${pColorClass}`}
                >
                  {total}
                </span>
                <span className="progress__total-unit">ккал</span>
              </div>
            </div>
            <div className="progress__remaining">
              <div className="progress__stat-label">
                {remaining >= 0 ? "Осталось" : "Перебор"}
              </div>
              <div
                className={`progress__remaining-value progress__remaining-value--${remaining >= 0 ? "positive" : "negative"}`}
              >
                {remaining >= 0 ? remaining : `+${Math.abs(remaining)}`}
              </div>
            </div>
          </div>
          <div className="progress__bar">
            <div
              className={`progress__bar-fill progress__bar-fill--${pColorClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="progress__labels">
            <span className="progress__label-text">0</span>
            <span
              className={`progress__label-text progress__label-text--pct progress__label-text--${pColorClass}`}
            >
              {Math.round(pct)}%
            </span>
            <span className="progress__label-text">{goal}</span>
          </div>
        </Card>

        {/* Add meal */}
        <Card className="card--flex">
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
            <div className="meal-form__photo-preview">
              <img
                src={preview}
                alt=""
                className="meal-form__photo-thumb"
              />
              <div className="meal-form__photo-info">
                <div className="meal-form__photo-title">📷 Фото загружено</div>
                <div className="meal-form__photo-actions">
                  <button
                    onClick={openPicker}
                    className="meal-form__photo-replace tap"
                  >
                    Заменить
                  </button>
                  <span className="meal-form__photo-sep">·</span>
                  <button
                    onClick={clearImage}
                    className="meal-form__photo-remove tap"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button onClick={openPicker} className="meal-form__upload-btn tap">
              <span className="meal-form__upload-icon">📷</span>
              <span>Добавить фото еды</span>
            </button>
          )}

          <div className="divider">
            <div className="divider__line" />
            <span className="divider__text">ИЛИ ОПИШИТЕ</span>
            <div className="divider__line" />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="«гречка с курицей, кефир, яблоко»"
            className="meal-form__textarea"
          />

          {error && (
            <div className="meal-form__error">⚠️ {error}</div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            className={`meal-form__submit meal-form__submit--${canSubmit ? "active tap" : "disabled"}`}
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
            <div className="log__header">
              <Label className="label--no-margin">Журнал дня</Label>
              <span className="log__total">{total} ккал</span>
            </div>
            <div className="log__list">
              {log.map((entry) => (
                <div key={entry.id} className="log-entry">
                  {entry.image ? (
                    <img
                      src={entry.image}
                      alt=""
                      className="log-entry__image"
                    />
                  ) : (
                    <div className="log-entry__icon">
                      {getMealIcon(entry.time)}
                    </div>
                  )}
                  <div className="log-entry__info">
                    <div className="log-entry__title">{entry.description}</div>
                    <div className="log-entry__time">{entry.time}</div>
                    <div className="log-entry__badges">
                      {entry.items.slice(0, 3).map((it, i) => (
                        <span key={i} className="log-entry__badge">
                          {it.name} · {it.calories}
                        </span>
                      ))}
                      {entry.items.length > 3 && (
                        <span className="log-entry__badge log-entry__badge--more">
                          +{entry.items.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="log-entry__actions">
                    <div className="log-entry__calories">
                      <div className="log-entry__calories-value">
                        {entry.total}
                      </div>
                      <div className="log-entry__calories-unit">ккал</div>
                    </div>
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="log-entry__delete"
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
          <div className="change-key">
            <button
              onClick={() => {
                localStorage.removeItem("ct_apikey");
                setApiKey("");
                setKeyInput("");
              }}
              className="change-key__btn"
            >
              Сменить API ключ
            </button>
          </div>
        )}
      </main>
    </>
  );
}
