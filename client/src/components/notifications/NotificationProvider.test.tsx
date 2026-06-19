import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationProvider, useNotifications } from "./NotificationProvider";

function TriggerButtons() {
  const notify = useNotifications();

  return (
    <>
      <button onClick={() => notify.success({ title: "保存成功", detail: "Provider 已创建" })}>success</button>
      <button
        onClick={() =>
          notify.error({
            title: "请求失败",
            code: "missing_api_key",
            detail: "missing_api_key: Missing API key env var | env var not found"
          })
        }
      >
        error
      </button>
      <button onClick={() => notify.warning({ title: "输入有误", detail: "不要填真实 key" })}>warning</button>
      <button onClick={() => notify.info({ title: "正在执行", detail: "拉取远程模型" })}>info</button>
    </>
  );
}

describe("NotificationProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders success, error, warning, and info messages with code and detail", async () => {
    render(
      <NotificationProvider>
        <TriggerButtons />
      </NotificationProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "success" }));
    await userEvent.click(screen.getByRole("button", { name: "error" }));
    await userEvent.click(screen.getByRole("button", { name: "warning" }));
    await userEvent.click(screen.getByRole("button", { name: "info" }));

    expect(screen.getByText("保存成功")).toBeInTheDocument();
    expect(screen.getByText("missing_api_key")).toBeInTheDocument();
    expect(screen.getByText("不要填真实 key")).toBeInTheDocument();
    expect(screen.getByText("拉取远程模型")).toBeInTheDocument();
  });

  it("lets users dismiss a notification", async () => {
    render(
      <NotificationProvider>
        <TriggerButtons />
      </NotificationProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "error" }));
    await userEvent.click(screen.getByRole("button", { name: "关闭 请求失败" }));

    await waitFor(() => expect(screen.queryByText("请求失败")).not.toBeInTheDocument());
  });

  it("auto-dismisses non-error notifications", async () => {
    vi.useFakeTimers();

    render(
      <NotificationProvider>
        <TriggerButtons />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "success" }));

    expect(screen.getByText("保存成功")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("保存成功")).not.toBeInTheDocument();
  });

  it("shows a dismissal progress bar only for timed notifications", () => {
    render(
      <NotificationProvider>
        <TriggerButtons />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "success" }));
    fireEvent.click(screen.getByRole("button", { name: "error" }));

    expect(screen.getByLabelText("保存成功 消失进度")).toBeInTheDocument();
    expect(screen.queryByLabelText("请求失败 消失进度")).not.toBeInTheDocument();
  });

  it("keeps error notifications visible until users dismiss them", async () => {
    vi.useFakeTimers();

    render(
      <NotificationProvider>
        <TriggerButtons />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "error" }));

    expect(screen.getByText("请求失败")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("请求失败")).toBeInTheDocument();
  });
});
