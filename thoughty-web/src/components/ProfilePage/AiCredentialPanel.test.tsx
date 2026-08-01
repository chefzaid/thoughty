import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AiCredentialPanel from "./AiCredentialPanel";

const aiService = vi.hoisted(() => ({
  getCredentialStatus: vi.fn(),
  updateCredential: vi.fn(),
  removeCredential: vi.fn(),
  getUsageDashboard: vi.fn(),
}));

const {
  getCredentialStatus,
  updateCredential,
  removeCredential,
  getUsageDashboard,
} = aiService;

vi.mock("../../hooks/useAppState", () => ({
  useApiServices: () => ({
    aiService,
  }),
}));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${Object.values(params).join(",")}` : key;

const personalStatus = {
  hasPersonalKey: true,
  keyHint: "...value",
  source: "personal" as const,
  aiAvailable: true,
};

const dashboard = {
  provider: {
    label: "Personal key",
    usage: 2.5,
    usageDaily: 0.1,
    usageWeekly: 0.7,
    usageMonthly: 1.2,
    limit: 10,
    limitRemaining: 7.5,
    limitReset: "monthly" as const,
    expiresAt: null,
  },
  thoughty: {
    promptTokens: 1200,
    completionTokens: 300,
    reasoningTokens: 40,
    totalTokens: 1500,
    cost: 0.05,
    requests: 4,
    periodDays: 30,
  },
};

describe("AiCredentialPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCredentialStatus.mockResolvedValue(personalStatus);
    getUsageDashboard.mockResolvedValue({ data: dashboard, error: null });
    updateCredential.mockResolvedValue({ data: personalStatus, error: null });
    removeCredential.mockResolvedValue({
      data: {
        hasPersonalKey: false,
        keyHint: null,
        source: "server",
        aiAvailable: true,
      },
      error: null,
    });
  });

  it("shows the masked personal key and token and cost usage", async () => {
    render(<AiCredentialPanel t={t} onCredentialChanged={vi.fn()} />);

    expect(await screen.findByText("...value")).toBeInTheDocument();
    expect(await screen.findByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("$2.50")).toBeInTheDocument();
    expect(screen.getByText("thoughtyUsagePeriod:30")).toBeInTheDocument();
  });

  it("validates and replaces a personal key without echoing it back", async () => {
    const onCredentialChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <AiCredentialPanel t={t} onCredentialChanged={onCredentialChanged} />,
    );
    await screen.findByText("...value");

    fireEvent.change(screen.getByLabelText("openRouterApiKey"), {
      target: { value: "sk-or-v1-new-personal-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /replaceApiKey/ }));

    await waitFor(() => {
      expect(updateCredential).toHaveBeenCalledWith(
        "sk-or-v1-new-personal-key",
      );
      expect(onCredentialChanged).toHaveBeenCalled();
    });
    expect(screen.getByText("apiKeySaved")).toBeInTheDocument();
    expect(screen.getByLabelText("openRouterApiKey")).toHaveValue("");
  });

  it("removes a personal key and falls back to the server status", async () => {
    render(
      <AiCredentialPanel
        t={t}
        onCredentialChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    await screen.findByText("...value");

    fireEvent.click(screen.getByRole("button", { name: /removeApiKey/ }));

    expect(await screen.findByText("serverKeyActive")).toBeInTheDocument();
    expect(removeCredential).toHaveBeenCalled();
    expect(screen.queryByText("usageDashboard")).not.toBeInTheDocument();
  });

  it("does not request usage when no personal key exists", async () => {
    getCredentialStatus.mockResolvedValue({
      hasPersonalKey: false,
      keyHint: null,
      source: "none",
      aiAvailable: false,
    });

    render(<AiCredentialPanel t={t} onCredentialChanged={vi.fn()} />);

    expect(await screen.findByText("aiUnavailable")).toBeInTheDocument();
    expect(getUsageDashboard).not.toHaveBeenCalled();
  });
});
