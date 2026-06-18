import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
});
