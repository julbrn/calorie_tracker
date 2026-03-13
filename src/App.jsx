import "./App.scss";
import { useCalorieTracker } from "./useCalorieTracker";
import { getMealIcon } from "./utils";

function Card({ children, className }) {
  return (
    <div className={`card${className ? ` ${className}` : ""}`}>{children}</div>
  );
}

function Label({ children, className }) {
  return (
    <div className={`label${className ? ` ${className}` : ""}`}>{children}</div>
  );
}

export default function App() {
  const {
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
    total,
    pct,
    remaining,
    pColorClass,
    canSubmit,
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
  } = useCalorieTracker();

  return (
    <>
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
                onKeyDown={(e) => e.key === "Enter" && saveGoal()}
                className="header__goal-input"
              />
              <button onClick={saveGoal} className="header__goal-save tap">
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
              <img src={preview} alt="" className="meal-form__photo-thumb" />
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
          {error && <div className="meal-form__error">⚠️ {error}</div>}
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

        {pendingEntry && (
          <Card className="card--flex">
            <Label>Проверь ингредиенты</Label>
            {pendingEntry.image && (
              <img
                src={pendingEntry.image}
                alt=""
                className="confirm__preview"
              />
            )}
            <div className="confirm__description">
              {pendingEntry.description}
            </div>
            <div className="confirm__items">
              {confirmItems.map((item, i) => (
                <div key={i} className="confirm__item">
                  <input
                    value={item.name}
                    onChange={(e) =>
                      setConfirmItems((prev) =>
                        prev.map((it, j) =>
                          j === i ? { ...it, name: e.target.value } : it,
                        ),
                      )
                    }
                    className="confirm__item-name"
                    placeholder="Название"
                  />
                  {item.calories > 0 && (
                    <span className="confirm__item-cal">
                      {item.calories} ккал
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setConfirmItems((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="confirm__item-del tap"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                setConfirmItems((prev) => [...prev, { name: "", calories: 0 }])
              }
              className="confirm__add tap"
            >
              + Добавить ингредиент
            </button>
            <button
              onClick={handleRecalculate}
              disabled={loading}
              className="confirm__recalc tap"
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Считаю...
                </>
              ) : (
                "Пересчитать калории"
              )}
            </button>
            {confirmItems.some((it) => it.calories > 0) && (
              <div className="confirm__total">
                Итого:{" "}
                <strong>
                  {confirmItems.reduce(
                    (s, it) => s + (Number(it.calories) || 0),
                    0,
                  )}
                </strong>{" "}
                ккал
              </div>
            )}
            <button
              onClick={handleConfirm}
              disabled={!confirmItems.some((it) => it.calories > 0)}
              className={`meal-form__submit meal-form__submit--${confirmItems.some((it) => it.calories > 0) ? "active tap" : "disabled"}`}
            >
              Добавить в журнал →
            </button>
            <button onClick={cancelPending} className="confirm__cancel tap">
              Отмена
            </button>
          </Card>
        )}

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

        {apiKey && (
          <div className="change-key">
            <button onClick={resetApiKey} className="change-key__btn">
              Сменить API ключ
            </button>
          </div>
        )}
      </main>
    </>
  );
}
