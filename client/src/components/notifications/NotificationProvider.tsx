import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

type NotificationTone = "success" | "error" | "warning" | "info";

interface NotificationInput {
  title: string;
  detail?: string;
  code?: string;
}

interface NotificationRecord extends NotificationInput {
  id: string;
  tone: NotificationTone;
}

interface NotificationContextValue {
  success(input: NotificationInput): void;
  error(input: NotificationInput): void;
  warning(input: NotificationInput): void;
  info(input: NotificationInput): void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  function push(tone: NotificationTone, input: NotificationInput) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications((current) => [{ id, tone, ...input }, ...current].slice(0, 4));
  }

  function dismiss(id: string) {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }

  const value = useMemo<NotificationContextValue>(
    () => ({
      success: (input) => push("success", input),
      error: (input) => push("error", input),
      warning: (input) => push("warning", input),
      info: (input) => push("info", input)
    }),
    []
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <section className="notification-viewport" aria-label="Notifications">
        {notifications.map((notification) => (
          <article className={`notification-toast ${notification.tone}`} key={notification.id}>
            <div>
              <strong>{notification.title}</strong>
              {notification.code && <code>{notification.code}</code>}
              {notification.detail && <p>{notification.detail}</p>}
            </div>
            <button type="button" aria-label={`关闭 ${notification.title}`} onClick={() => dismiss(notification.id)}>
              x
            </button>
          </article>
        ))}
      </section>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) {
    throw new Error("useNotifications must be used inside NotificationProvider");
  }
  return value;
}
